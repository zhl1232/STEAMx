import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CourseBoard, CourseBoardError } from '@/components/features/courses/course-board';
import { ContinueLastLesson } from '@/components/features/courses/continue-last-lesson';
import { CourseShareButton } from '@/components/features/courses/course-share-button';
import { CourseSuccessorBanner } from '@/components/features/courses/course-successor-banner';
import { getCourseOverview, getCourseSuccessor, listApprovedCourses } from '@/lib/api/courses';
import type { CourseListItem } from '@/lib/courses/types';
import { courseCatalogHref, parseCourseSelection } from '@/lib/courses/catalog-url';
import { JsonLd } from '@/components/seo/json-ld';
import { buildBreadcrumbJsonLd, buildCourseJsonLd } from '@/lib/seo/json-ld';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { createClient } from '@/lib/supabase/server';
import { getContentClassificationSettings } from '@/lib/content-classification';
import { getStartCourseCategory } from '@/lib/product/onboarding';

type Search = { category?: string | string[]; course?: string | string[] };
type PageProps = { searchParams?: Promise<Search> };
const COURSE_HUB_DESCRIPTION = '创探空间提供积木搭建、Scratch 编程、五子棋等免费技能课程，按步骤学会一项技能，把过程做成自己的作品。';

// Metadata and page share the same access decision and lightweight lesson projection.
const loadSelectedCourse = cache(async (courseId: number) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const settings = await getContentClassificationSettings();
    return getCourseOverview(supabase, courseId, { userId: user?.id ?? null, includeClassification: settings.publicV1Enabled });
});

export async function generateMetadata({ searchParams }: PageProps) {
    const query = await searchParams;
    if (query?.course !== undefined) {
        const id = parseCourseSelection(query.course);
        if (!id) notFound();
        let course;
        try { course = await loadSelectedCourse(id); } catch {
            return buildPageMetadata({ title: '课程暂时无法加载', description: COURSE_HUB_DESCRIPTION, path: courseCatalogHref(id), noIndex: true, omitCanonical: true });
        }
        if (!course) notFound();
        return buildPageMetadata({ title: course.title, description: (course.description || COURSE_HUB_DESCRIPTION).slice(0, 160),
            path: courseCatalogHref(id), keywords: [course.title, ...(course.tags ?? [])], image: course.image_url ?? undefined,
            noIndex: course.is_listed === false, noIndexFollow: course.is_listed === false });
    }
    return buildPageMetadata({ title: '积木与编程课程', description: COURSE_HUB_DESCRIPTION, path: '/courses',
        keywords: ['创探空间 课程', '积木课程', '少儿编程', 'Scratch 课程', '技能课程'] });
}

export default async function CoursesPage({ searchParams }: PageProps) {
    const query = await searchParams;
    const selectedId = query?.course === undefined ? undefined : parseCourseSelection(query.course);
    if (selectedId === null) notFound();
    const initialFilter = selectedId ? 'recommended' : getStartCourseCategory(query?.category);
    const retryHref = selectedId ? courseCatalogHref(selectedId) : initialFilter === 'recommended' ? '/courses' : `/courses?category=${initialFilter}`;
    let courses: CourseListItem[] | null = null;
    let selected: Awaited<ReturnType<typeof getCourseOverview>> = null;
    let successor: Awaited<ReturnType<typeof getCourseSuccessor>> = null;
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const settings = await getContentClassificationSettings();
        const [listed, requested] = await Promise.all([
            listApprovedCourses(supabase, { userId: user?.id ?? null, includeClassification: settings.publicV1Enabled, previewLessonLimit: 8 }),
            selectedId ? loadSelectedCourse(selectedId) : Promise.resolve(null),
        ]);
        selected = requested;
        courses = listed;
        if (requested) {
            const { lessons, ...course } = requested;
            const previews = lessons.map((lesson, index) => ({ id: lesson.id, number: index + 1, title: lesson.title,
                image_url: lesson.catalog_image_url ?? lesson.finished_image_url, is_completed: lesson.is_completed }));
            const item: CourseListItem = { ...course, lesson_count: previews.length, preview_lessons: previews,
                next_lesson: previews.find(lesson => lesson.id === course.progress?.next_lesson_id) ?? null };
            courses = listed.some(course => course.id === requested.id) ? listed.map(course => course.id === requested.id ? item : course) : [...listed, item];
            successor = await getCourseSuccessor(supabase, requested.id);
        }
    } catch { courses = null; }
    // Keep database failures retryable; only a successful missing result is a 404.
    if (courses && selectedId && !selected) notFound();

    return <>
        <JsonLd data={buildBreadcrumbJsonLd([{ name: '首页', url: '/' }, { name: '技能课程', url: '/courses' },
            ...(selected ? [{ name: selected.title, url: courseCatalogHref(selected.id) }] : [])])} />
        {selected ? <JsonLd data={buildCourseJsonLd({ id: selected.id, title: selected.title, description: selected.description,
            image: selected.image_url, classification: selected.classification,
            lessons: selected.lessons.map(lesson => ({ id: lesson.id, title: lesson.title })) })} /> : null}
        <div className="app-canvas-community"><main className="app-shell-wide pb-28 pt-2 md:py-6">
            <h1 className="sr-only">{selected?.title ?? '技能课程'}</h1>
            {selected ? <>
                <CourseSuccessorBanner successor={successor} />
                <div className="mb-4 space-y-2 md:hidden" aria-label="课程信息">
                    {selected.description ? <p className="text-sm text-muted-foreground">{selected.description}</p> : null}
                    {selected.classification?.supportLabel ? <p className="text-sm text-muted-foreground">{selected.classification.supportLabel}</p> : null}
                    <div className="flex flex-wrap items-center gap-3">
                        <ContinueLastLesson courseId={selected.id} lessonIds={selected.lessons.map(lesson => lesson.id)} fallback={selected.progress?.status === 'in_progress' && selected.progress.next_lesson_id ? <Link href={`/courses/${selected.id}/lessons/${selected.progress.next_lesson_id}`} prefetch={false}>继续学习</Link> : null} />
                        <CourseShareButton className="h-9 px-3 text-sm" course={{ id: selected.id, title: selected.title, description: selected.description, image: selected.image_url, lessonCount: selected.lessons.length }} />
                        {selected.progress?.status === 'completed' ? <Link href={`/courses/${selected.id}/certificate`}>查看证书</Link> : null}
                    </div>
                </div>
            </> : null}
            {courses ? <CourseBoard courses={courses} initialFilter={initialFilter} initialCourseId={selectedId ?? undefined} /> : <CourseBoardError retryHref={retryHref} />}
        </main></div>
    </>;
}
