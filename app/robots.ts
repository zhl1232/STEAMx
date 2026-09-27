import type { MetadataRoute } from 'next';
import { AI_CRAWLER_USER_AGENTS, CN_INDEX_CRAWLER_USER_AGENTS, PRIVATE_CRAWLER_DISALLOW, PUBLIC_IMAGE_CRAWLER_ALLOW } from '@/lib/seo/robots-policy';
import { buildAbsoluteUrl } from '@/lib/seo/site';

const publicCrawlerRule = {
    allow: ['/', ...PUBLIC_IMAGE_CRAWLER_ALLOW],
    disallow: [...PRIVATE_CRAWLER_DISALLOW],
};

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: 'Baiduspider',
                ...publicCrawlerRule,
            },
            {
                userAgent: 'Googlebot',
                ...publicCrawlerRule,
            },
            {
                userAgent: [...CN_INDEX_CRAWLER_USER_AGENTS],
                ...publicCrawlerRule,
            },
            {
                userAgent: [...AI_CRAWLER_USER_AGENTS],
                ...publicCrawlerRule,
            },
            {
                userAgent: '*',
                ...publicCrawlerRule,
            },
        ],
        // Only the primary sitemap is advertised. /sitemap-v2.xml stays as a
        // rewrite alias (next.config.mjs) for crawlers that cached the old URL.
        sitemap: buildAbsoluteUrl('/sitemap.xml'),
    };
}
