import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { buildAbsoluteUrl } from '@/lib/seo/site';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const routes: MetadataRoute.Sitemap = [
        {
            url: buildAbsoluteUrl('/'),
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: buildAbsoluteUrl('/explore'),
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: buildAbsoluteUrl('/create'),
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: buildAbsoluteUrl('/courses'),
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.9,
        },
        {
            url: buildAbsoluteUrl('/nature'),
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: buildAbsoluteUrl('/nature/species'),
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: buildAbsoluteUrl('/nature/species?topic=birds'),
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: buildAbsoluteUrl('/nature/species?topic=plants'),
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: buildAbsoluteUrl('/nature/observations'),
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: buildAbsoluteUrl('/nature/map'),
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.7,
        },
        {
            url: buildAbsoluteUrl('/leaderboard'),
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.7,
        },
        {
            url: buildAbsoluteUrl('/playground'),
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: buildAbsoluteUrl('/legal/privacy'),
            lastModified: new Date(),
            changeFrequency: 'yearly',
            priority: 0.3,
        },
        {
            url: buildAbsoluteUrl('/legal/terms'),
            lastModified: new Date(),
            changeFrequency: 'yearly',
            priority: 0.3,
        },
    ];

    try {
        const supabase = await createClient();

        const [projectsResult, speciesResult, observationsResult, coursesResult] = await Promise.all([
            supabase
                .from('projects')
                .select('id, updated_at')
                .eq('status', 'approved')
                .eq('moderation_state', 'approved')
                .order('updated_at', { ascending: false })
                .limit(500),
            supabase
                .from('species')
                .select('slug, updated_at')
                .eq('is_active', true)
                .order('updated_at', { ascending: false })
                .limit(500),
            supabase
                .from('observation_events')
                .select('id, updated_at')
                .eq('status', 'approved')
                .eq('is_public', true)
                .eq('moderation_state', 'approved')
                .order('updated_at', { ascending: false })
                .limit(500),
            supabase
                .from('courses')
                .select('id, updated_at')
                .eq('status', 'approved')
                .order('sort_order', { ascending: true }),
        ]);

        if (projectsResult.error) {
            throw projectsResult.error;
        }

        if (speciesResult.error) {
            throw speciesResult.error;
        }

        if (observationsResult.error) {
            throw observationsResult.error;
        }

        projectsResult.data?.forEach((project: { id: number; updated_at: string | null }) => {
            routes.push({
                url: buildAbsoluteUrl(`/project/${project.id}`),
                lastModified: new Date(project.updated_at || new Date()),
                changeFrequency: 'weekly',
                priority: 0.8,
            });
        });

        speciesResult.data?.forEach((species: { slug: string; updated_at: string | null }) => {
            routes.push({
                url: buildAbsoluteUrl(`/nature/species/${species.slug}`),
                lastModified: new Date(species.updated_at || new Date()),
                changeFrequency: 'weekly',
                priority: 0.7,
            });
        });

        observationsResult.data?.forEach((observation: { id: number; updated_at: string | null }) => {
            routes.push({
                url: buildAbsoluteUrl(`/nature/observations/${observation.id}`),
                lastModified: new Date(observation.updated_at || new Date()),
                changeFrequency: 'weekly',
                priority: 0.7,
            });
        });

        if (coursesResult.error) {
            throw coursesResult.error;
        }

        // 300 多节免费课时是站上体量最大的公开内容，之前完全没进 sitemap
        const courseIds = (coursesResult.data ?? []).map((course: { id: number }) => course.id);
        coursesResult.data?.forEach((course: { id: number; updated_at: string | null }) => {
            routes.push({
                url: buildAbsoluteUrl(`/courses/${course.id}`),
                lastModified: new Date(course.updated_at || new Date()),
                changeFrequency: 'weekly',
                priority: 0.8,
            });
        });

        if (courseIds.length > 0) {
            const { data: lessons, error: lessonsError } = await supabase
                .from('course_lessons')
                .select('id, course_id, updated_at, ldraw_model_url:content->building3d->>ldrawModelUrl')
                .in('course_id', courseIds)
                .order('sort_order', { ascending: true });

            if (lessonsError) {
                throw lessonsError;
            }

            lessons?.forEach((lesson: {
                id: number;
                course_id: number;
                updated_at: string | null;
                ldraw_model_url?: string | null;
            }) => {
                const lastModified = new Date(lesson.updated_at || new Date());
                routes.push({
                    url: buildAbsoluteUrl(`/courses/${lesson.course_id}/lessons/${lesson.id}`),
                    lastModified,
                    changeFrequency: 'monthly',
                    priority: 0.7,
                });
                if (lesson.ldraw_model_url) {
                    routes.push({
                        url: buildAbsoluteUrl(`/courses/${lesson.course_id}/lessons/${lesson.id}/parts`),
                        lastModified,
                        changeFrequency: 'monthly',
                        priority: 0.5,
                    });
                }
            });
        }
    } catch (error) {
        logger.error('Error generating sitemap', { error });
    }

    return routes;
}
