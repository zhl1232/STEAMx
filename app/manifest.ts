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
        // Unsupported browsers follow the standard fullscreen → standalone fallback.
        display: "fullscreen",
        background_color: "#008da1",
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
                src: "/icon-192x192-maskable.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "maskable",
            },
            {
                src: "/icon-512x512-maskable.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    }
}
