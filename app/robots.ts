import type { MetadataRoute } from 'next';
import { buildAbsoluteUrl } from '@/lib/seo/site';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/admin/', '/login', '/messages/', '/settings/', '/share/', '/coins/', '/shop/', '/profile', '/migrate'],
        },
        sitemap: buildAbsoluteUrl('/sitemap.xml'),
    };
}
