import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://steam-explore.com';

    // 基础静态路由
    const routes: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: `${baseUrl}/explore`,
            lastModified: new Date(),
            changeFrequency: 'hourly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/share`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/community`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/leaderboard`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/profile`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.6,
        },
    ];

    try {
        const supabase = await createClient();

        // 获取最新的公开审核通过项目
        const { data: projects } = await supabase
            .from('projects')
            .select('id, updated_at')
            .eq('status', 'approved')
            .order('updated_at', { ascending: false })
            .limit(500);

        if (projects) {
            projects.forEach((project: { id: string; updated_at: string | null }) => {
                routes.push({
                    url: `${baseUrl}/project/${project.id}`,
                    lastModified: new Date(project.updated_at || new Date()),
                    changeFrequency: 'weekly',
                    priority: 0.8,
                });
            });
        }
    } catch (error) {
        console.error('Error generating sitemap for projects:', error);
    }

    return routes;
}
