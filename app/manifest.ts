import type { MetadataRoute } from "next";

import { BRAND_FULL_NAME, BRAND_NAME } from "@/lib/brand";
import { SITE_DESCRIPTION } from "@/lib/seo/site";

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: "/",
        lang: "zh-CN",
        name: BRAND_FULL_NAME,
        short_name: BRAND_NAME,
        description: SITE_DESCRIPTION,
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#09090b",
        icons: [
            {
                src: "/icon-192x192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icon-512x512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
            },
            {
                // Same assets; Chromium install prefers an explicit maskable entry.
                src: "/icon-512x512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    }
}
