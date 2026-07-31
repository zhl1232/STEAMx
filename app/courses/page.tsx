import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { CourseBoard, CourseBoardError } from "@/components/features/courses/course-board";
import { listApprovedCourses } from "@/lib/api/courses";
import type { CourseListItem } from "@/lib/courses/types";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { createClient } from "@/lib/supabase/server";

export const metadata = buildPageMetadata({
    title: "技能课程",
    description: "按课表系统学习 Scratch 编程、积木搭建等 STEAM 技能，支持在线练习与保存作品。",
    path: "/courses",
});

export default async function CoursesPage() {
    let courses: CourseListItem[] | null = null;
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        courses = await listApprovedCourses(supabase, { userId: user?.id ?? null });
    } catch {
        courses = null;
    }

    return (
        <div className="min-h-screen app-canvas-community">
            <MobileGlobalHeader variant="title" title="技能课程" showUserButton={false} />
            <main className="app-shell-wide pb-28 pt-4 md:py-6">
                <header className="mb-5 px-1">
                    <h1 className="text-2xl font-black text-foreground">技能课程</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        按课时系统学习编程、搭建等本领，支持在线练习、保存作品与跟踪进度。
                    </p>
                </header>
                <div className="surface-panel overflow-hidden">
                    {courses ? (
                        <CourseBoard courses={courses} />
                    ) : (
                        <CourseBoardError retryHref="/courses" />
                    )}
                </div>
            </main>
        </div>
    );
}
