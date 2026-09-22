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
        sitemap: [
            buildAbsoluteUrl('/sitemap.xml'),
            buildAbsoluteUrl('/sitemap-v2.xml'),
        ],
    };
}
