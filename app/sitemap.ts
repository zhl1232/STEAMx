import type { MetadataRoute } from 'next';
import { createPublicClient } from '@/lib/supabase/server';
import { hasLdrawModelFile } from '@/lib/courses/ldraw-bom-source';
import { logger } from '@/lib/logger';
import { buildAbsoluteUrl } from '@/lib/seo/site';

// Keep the discovery file stable for crawlers and CDNs while still refreshing
// newly published public content without requiring a full deployment.
export const revalidate = 3600;

function toLastModified(value: string | null | undefined) {
    if (!value) return undefined;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const routes: MetadataRoute.Sitemap = [
        {
            url: buildAbsoluteUrl('/'),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: buildAbsoluteUrl('/explore'),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: buildAbsoluteUrl('/create'),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: buildAbsoluteUrl('/courses'),
            changeFrequency: 'weekly',
            priority: 0.9,
        },
        {
            url: buildAbsoluteUrl('/nature'),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: buildAbsoluteUrl('/nature/species'),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: buildAbsoluteUrl('/nature/observations'),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: buildAbsoluteUrl('/nature/map'),
            changeFrequency: 'daily',
            priority: 0.7,
        },
        {
            url: buildAbsoluteUrl('/leaderboard'),
            changeFrequency: 'daily',
            priority: 0.7,
        },
        {
            url: buildAbsoluteUrl('/playground'),
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: buildAbsoluteUrl('/legal/privacy'),
            changeFrequency: 'yearly',
            priority: 0.3,
        },
        {
            url: buildAbsoluteUrl('/legal/terms'),
            changeFrequency: 'yearly',
            priority: 0.3,
        },
    ];

    try {
        const supabase = createPublicClient();

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

        speciesResult.data?.forEach((species: { slug: string; updated_at: string | null }) => {
            routes.push({
                url: buildAbsoluteUrl(`/nature/species/${species.slug}`),
                lastModified: toLastModified(species.updated_at),
                changeFrequency: 'weekly',
                priority: 0.7,
            });
        });

        observationsResult.data?.forEach((observation: { id: number; updated_at: string | null }) => {
            routes.push({
                url: buildAbsoluteUrl(`/nature/observations/${observation.id}`),
                lastModified: toLastModified(observation.updated_at),
                changeFrequency: 'weekly',
                priority: 0.7,
            });
        });

        projectsResult.data?.forEach((project: { id: number; updated_at: string | null }) => {
            routes.push({
                url: buildAbsoluteUrl(`/project/${project.id}`),
                lastModified: toLastModified(project.updated_at),
                changeFrequency: 'weekly',
                priority: 0.8,
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
                lastModified: toLastModified(course.updated_at),
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

            const lessonRows = (lessons ?? []) as Array<{
                id: number;
                course_id: number;
                updated_at: string | null;
                ldraw_model_url?: string | null;
            }>;
            const modelAvailability = await Promise.all(
                lessonRows.map(async (lesson) => ({
                    lesson,
                    hasModelFile: Boolean(lesson.ldraw_model_url) && await hasLdrawModelFile(lesson.ldraw_model_url),
                })),
            );

            modelAvailability.forEach(({ lesson, hasModelFile }) => {
                const lastModified = toLastModified(lesson.updated_at);
                routes.push({
                    url: buildAbsoluteUrl(`/courses/${lesson.course_id}/lessons/${lesson.id}`),
                    lastModified,
                    changeFrequency: 'monthly',
                    priority: 0.7,
                });
                if (hasModelFile) {
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
