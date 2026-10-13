import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { signAssetProxyUrl } from "@/lib/assets/signed-asset-url";

import { GET, HEAD } from "./route";

const originalAssetsBaseUrl = process.env.ASSETS_BASE_URL;
const originalPublicAssetsBaseUrl = process.env.NEXT_PUBLIC_ASSETS_BASE_URL;
const originalProxyReferer = process.env.ASSETS_PROXY_REFERER;
const originalSigningSecret = process.env.ASSETS_URL_SIGNING_SECRET;

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
    restoreEnv("NEXT_PUBLIC_ASSETS_BASE_URL", originalPublicAssetsBaseUrl);
    restoreEnv("ASSETS_PROXY_REFERER", originalProxyReferer);
    restoreEnv("ASSETS_URL_SIGNING_SECRET", originalSigningSecret);
});

describe("asset proxy", () => {
    it.each(["gzip", "br"])("drops wire lengths and range headers for decoded %s bodies", async (encoding) => {
        process.env.ASSETS_BASE_URL = "https://assets.example.com";
        const body = "0 !COLOUR Light_Bluish_Gray CODE 71 VALUE #A0A5A9 EDGE #333333\n";
        vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(body, {
            headers: {
                "Content-Encoding": encoding,
                "Content-Length": "12",
                "Content-Range": "bytes 0-11/12",
                "Accept-Ranges": "bytes",
            },
        })));
        const response = await GET(new NextRequest("http://localhost/api/assets/courses/ldraw/LDConfig-test.ldr"), {
            params: Promise.resolve({ path: ["courses", "ldraw", "LDConfig-test.ldr"] }),
        });
        expect(response.status).toBe(200);
        for (const name of ["content-length", "content-encoding", "content-range", "accept-ranges"]) {
            expect(response.headers.has(name)).toBe(false);
        }
        expect(await response.text()).toBe(body);
    });

    it.each([undefined, "identity"])("preserves lengths for identity responses (%s)", async (encoding) => {
        process.env.ASSETS_BASE_URL = "https://assets.example.com";
        const headers = new Headers({ "Content-Length": "4" });
        if (encoding) headers.set("Content-Encoding", encoding);
        vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("test", { headers })));
        const response = await GET(new NextRequest("http://localhost/api/assets/projects/test.txt"), {
            params: Promise.resolve({ path: ["projects", "test.txt"] }),
        });
        expect(response.headers.get("content-length")).toBe("4");
        expect(response.headers.has("content-encoding")).toBe(false);
        expect(await response.text()).toBe("test");
    });

    it("rejects encoded partial responses even if the origin ignores identity", async () => {
        process.env.ASSETS_BASE_URL = "https://assets.example.com";
        vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("decoded", {
            status: 206,
            headers: { "Content-Encoding": "gzip", "Content-Range": "bytes 0-3/100" },
        })));
        const response = await GET(new NextRequest("http://localhost/api/assets/projects/test.txt", {
            headers: { Range: "bytes=0-3" },
        }), { params: Promise.resolve({ path: ["projects", "test.txt"] }) });
        expect(response.status).toBe(502);
        expect(response.headers.has("content-range")).toBe(false);
    });

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

    it("proxies non-whitelist CDN paths when ASSETS_BASE_URL is configured", async () => {
        process.env.ASSETS_BASE_URL = "https://assets.example.com";
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(new Uint8Array([0, 0, 0, 0]), {
                status: 200,
                headers: { "Content-Type": "video/mp4" },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const response = await GET(
            new NextRequest("http://localhost/api/assets/kejiao16a/demo/video_1.mp4"),
            { params: Promise.resolve({ path: ["kejiao16a", "demo", "video_1.mp4"] }) },
        );

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            "https://assets.example.com/kejiao16a/demo/video_1.mp4",
        );
    });

    it("rejects non-whitelist paths when ASSETS_BASE_URL is not configured", async () => {
        delete process.env.ASSETS_BASE_URL;
        delete process.env.NEXT_PUBLIC_ASSETS_BASE_URL;
        const response = await GET(
            new NextRequest("http://localhost/api/assets/kejiao16a/demo/video_1.mp4"),
            { params: Promise.resolve({ path: ["kejiao16a", "demo", "video_1.mp4"] }) },
        );
        expect(response.status).toBe(404);
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
        // 超时会重试一次再放弃。
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("allows unsigned images when signing secret is configured", async () => {
        process.env.ASSETS_BASE_URL = "https://assets.example.com";
        process.env.ASSETS_URL_SIGNING_SECRET = "test-assets-signing-secret";
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(new Uint8Array([1, 2, 3]), {
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
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("rejects unsigned mp4 with 403 when signing secret is configured", async () => {
        process.env.ASSETS_BASE_URL = "https://assets.example.com";
        process.env.ASSETS_URL_SIGNING_SECRET = "test-assets-signing-secret";
        const fetchMock = vi.fn<typeof fetch>();
        vi.stubGlobal("fetch", fetchMock);

        const response = await GET(
            new NextRequest("http://localhost/api/assets/kejiao16a/demo/video_1.mp4"),
            { params: Promise.resolve({ path: ["kejiao16a", "demo", "video_1.mp4"] }) },
        );

        expect(response.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects expired mp4 signatures with 403", async () => {
        process.env.ASSETS_BASE_URL = "https://assets.example.com";
        process.env.ASSETS_URL_SIGNING_SECRET = "test-assets-signing-secret";
        const fetchMock = vi.fn<typeof fetch>();
        vi.stubGlobal("fetch", fetchMock);

        const signed = signAssetProxyUrl("/api/assets/kejiao16a/demo/video_1.mp4", {
            nowMs: Date.now(),
            exp: Math.floor(Date.now() / 1000) - 30,
        });
        const response = await GET(
            new NextRequest(`http://localhost${signed}`),
            { params: Promise.resolve({ path: ["kejiao16a", "demo", "video_1.mp4"] }) },
        );

        expect(response.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("proxies signed mp4 with Range as 206 and strips sig from upstream URL", async () => {
        process.env.ASSETS_BASE_URL = "https://assets.example.com";
        process.env.ASSETS_URL_SIGNING_SECRET = "test-assets-signing-secret";
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(new Uint8Array([0, 1, 2, 3]), {
                status: 206,
                headers: {
                    "Content-Type": "video/mp4",
                    "Content-Range": "bytes 0-3/100",
                    "Accept-Ranges": "bytes",
                    "Content-Length": "4",
                },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const signed = signAssetProxyUrl("/api/assets/kejiao16a/demo/video_1.mp4");
        const response = await GET(
            new NextRequest(`http://localhost${signed}`, {
                headers: { Range: "bytes=0-3" },
            }),
            { params: Promise.resolve({ path: ["kejiao16a", "demo", "video_1.mp4"] }) },
        );

        expect(response.status).toBe(206);
        expect(response.headers.get("content-range")).toBe("bytes 0-3/100");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            "https://assets.example.com/kejiao16a/demo/video_1.mp4",
        );
        const upstreamHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
        expect(upstreamHeaders.get("Range")).toBe("bytes=0-3");
        expect(upstreamHeaders.get("Accept-Encoding")).toBe("identity");
        expect(response.headers.get("content-length")).toBe("4");
        expect(await response.arrayBuffer()).toEqual(new Uint8Array([0, 1, 2, 3]).buffer);
    });

});
