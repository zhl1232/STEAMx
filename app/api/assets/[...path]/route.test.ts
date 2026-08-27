import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, HEAD } from "./route";

const originalAssetsBaseUrl = process.env.ASSETS_BASE_URL;
const originalProxyReferer = process.env.ASSETS_PROXY_REFERER;

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
        return;
    }
    process.env[key] = value;
}

afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnv("ASSETS_BASE_URL", originalAssetsBaseUrl);
    restoreEnv("ASSETS_PROXY_REFERER", originalProxyReferer);
});

describe("asset proxy", () => {
    it("retries a rejected environment referer with the canonical site referer", async () => {
        process.env.ASSETS_BASE_URL = "https://assets.example.com";
        process.env.ASSETS_PROXY_REFERER = "http://127.0.0.1:3000";
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response("forbidden", { status: 403 }))
            .mockResolvedValueOnce(
                new Response(new Uint8Array([82, 73, 70, 70]), {
                    status: 200,
                    headers: { "Content-Type": "image/webp" },
                }),
            );
        vi.stubGlobal("fetch", fetchMock);

        const response = await GET(
            new NextRequest("http://localhost/api/assets/projects/example.webp"),
            { params: Promise.resolve({ path: ["projects", "example.webp"] }) },
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("image/webp");
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const firstHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
        const retryHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
        expect(firstHeaders.get("Referer")).toBe("http://127.0.0.1:3000");
        expect(retryHeaders.get("Referer")).toBe("https://steamx.cc");
    });

    it("uses the known CDN's HTTP emergency path when its TLS certificate is expired", async () => {
        process.env.ASSETS_BASE_URL = "https://assets.steamx.cc";
        const certificateError = Object.assign(new TypeError("fetch failed"), {
            cause: Object.assign(new Error("certificate has expired"), { code: "CERT_HAS_EXPIRED" }),
        });
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockRejectedValueOnce(certificateError)
            .mockResolvedValueOnce(
                new Response(new Uint8Array([82, 73, 70, 70]), {
                    status: 200,
                    headers: { "Content-Type": "image/webp" },
                }),
            );
        vi.stubGlobal("fetch", fetchMock);

        const response = await GET(
            new NextRequest("http://localhost/api/assets/courses/example.webp"),
            { params: Promise.resolve({ path: ["courses", "example.webp"] }) },
        );

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            "https://assets.steamx.cc/courses/example.webp",
        );
        expect(fetchMock.mock.calls[1]?.[0]).toBe(
            "http://assets.steamx.cc/courses/example.webp",
        );
    });

    it("does not downgrade an arbitrary configured asset origin after a TLS error", async () => {
        process.env.ASSETS_BASE_URL = "https://assets.example.com";
        const certificateError = Object.assign(new TypeError("fetch failed"), {
            cause: Object.assign(new Error("certificate has expired"), { code: "CERT_HAS_EXPIRED" }),
        });
        const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(certificateError);
        vi.stubGlobal("fetch", fetchMock);

        const response = await GET(
            new NextRequest("http://localhost/api/assets/courses/example.webp"),
            { params: Promise.resolve({ path: ["courses", "example.webp"] }) },
        );

        expect(response.status).toBe(502);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("streams byte ranges from the local public fallback", async () => {
        delete process.env.ASSETS_BASE_URL;
        const request = new NextRequest(
            "http://localhost/api/assets/courses/ldraw/LDConfig.ldr",
            { headers: { Range: "bytes=0-3" } },
        );

        const response = await GET(request, {
            params: Promise.resolve({ path: ["courses", "ldraw", "LDConfig.ldr"] }),
        });

        expect(response.status).toBe(206);
        expect(response.headers.get("accept-ranges")).toBe("bytes");
        expect(response.headers.get("content-length")).toBe("4");
        expect(response.headers.get("content-range")).toMatch(/^bytes 0-3\/\d+$/);
        expect(await response.text()).toBe("0 LD");
    });

    it("returns metadata without opening a response body for local HEAD requests", async () => {
        delete process.env.ASSETS_BASE_URL;
        const response = await HEAD(
            new NextRequest("http://localhost/api/assets/courses/ldraw/LDConfig.ldr"),
            { params: Promise.resolve({ path: ["courses", "ldraw", "LDConfig.ldr"] }) },
        );

        expect(response.status).toBe(200);
        expect(Number(response.headers.get("content-length"))).toBeGreaterThan(0);
        expect(response.body).toBeNull();
    });

    it("returns 504 instead of throwing when the upstream connect times out", async () => {
        process.env.ASSETS_BASE_URL = "https://assets.example.com";
        const abortError = new Error("The operation was aborted");
        abortError.name = "AbortError";
        const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(abortError);
        vi.stubGlobal("fetch", fetchMock);

        const response = await GET(
            new NextRequest("http://localhost/api/assets/projects/generated/missing.webp"),
            { params: Promise.resolve({ path: ["projects", "generated", "missing.webp"] }) },
        );

        expect(response.status).toBe(504);
        await expect(response.json()).resolves.toEqual({ error: "Asset upstream timeout" });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
