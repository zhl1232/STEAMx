
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { CourseBoard, CourseBoardError } from "@/components/features/courses/course-board";
import { listApprovedCourses } from "@/lib/api/courses";
import type { CourseListItem } from "@/lib/courses/types";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { createClient } from "@/lib/supabase/server";
import { getContentClassificationSettings } from "@/lib/content-classification";
import { getStartCourseCategory } from "@/lib/product/onboarding";

const COURSE_HUB_DESCRIPTION =
    "创探空间提供积木搭建、Scratch 编程、五子棋等免费技能课程，按步骤学会一项技能，把过程做成自己的作品。";

export const metadata = buildPageMetadata({
    title: "积木与编程课程",
    description: COURSE_HUB_DESCRIPTION,
    path: "/courses",
    keywords: ["创探空间 课程", "积木课程", "少儿编程", "Scratch 课程", "技能课程"],
});

export default async function CoursesPage({ searchParams }: {
    searchParams?: Promise<{ category?: string | string[] }>;
}) {
    const initialFilter = getStartCourseCategory((await searchParams)?.category);
    const retryHref = initialFilter === 'recommended' ? '/courses' : `/courses?category=${initialFilter}`;
    let courses: CourseListItem[] | null = null;
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        const classificationSettings = await getContentClassificationSettings();
        courses = await listApprovedCourses(supabase, {
            userId: user?.id ?? null,
            includeClassification: classificationSettings.publicV1Enabled,
            previewLessonLimit: 8,
        });
    } catch {
        courses = null;
    }

    return (
        <>
            <JsonLd
                data={buildBreadcrumbJsonLd([
                    { name: "首页", url: "/" },
                    { name: "技能课程", url: "/courses" },
                ])}
            />
            <div className="app-canvas-community">
                <MobileGlobalHeader variant="title" title="技能课程" showUserButton={false} />
                <main className="app-shell-wide pb-28 pt-2 md:py-6">
                    <header className="mb-5 hidden flex-wrap items-end justify-between gap-3 px-1 md:flex">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-black text-foreground">技能课程</h1>
                            <p className="mt-1 text-sm text-muted-foreground">动手实践 · 掌握新技能 · 让创意变成作品</p>
                        </div>
                    </header>
                    {courses ? <CourseBoard courses={courses} initialFilter={initialFilter} /> : <CourseBoardError retryHref={retryHref} />}
                </main>
            </div>
        </>
    );
}
