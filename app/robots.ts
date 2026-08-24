import type { MetadataRoute } from 'next';
import { AI_CRAWLER_USER_AGENTS, PRIVATE_CRAWLER_DISALLOW } from '@/lib/seo/robots-policy';
import { buildAbsoluteUrl } from '@/lib/seo/site';

const publicCrawlerRule = {
    allow: '/',
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
                userAgent: [...AI_CRAWLER_USER_AGENTS],
                ...publicCrawlerRule,
            },
            {
                userAgent: '*',
                ...publicCrawlerRule,
            },
        ],
        sitemap: buildAbsoluteUrl('/sitemap.xml'),
    };
}
