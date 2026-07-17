import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

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
        expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({ Referer: "http://127.0.0.1:3000" });
        expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({ Referer: "https://steamx.cc" });
    });
});
