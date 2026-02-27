import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Steam Explore & Share',
        short_name: 'Steam E&S',
        description: '探索社区中最酷的 STEAM 创意与互动体验',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#09090b',
        icons: [
            {
                src: '/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    }
}
