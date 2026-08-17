import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { CourseBoard, CourseBoardError } from "@/components/features/courses/course-board";
import { listApprovedCourses } from "@/lib/api/courses";
import type { CourseListItem } from "@/lib/courses/types";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { createClient } from "@/lib/supabase/server";

const COURSE_HUB_DESCRIPTION =
    "积木搭建、Scratch 编程、五子棋等免费课程，按步骤学会一项技能，把过程做成自己的作品。";

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
                <header className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-black text-foreground">挑一项技能，做一件作品</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                            {COURSE_HUB_DESCRIPTION}
                        </p>
                    </div>
                    <Link
                        href="/create"
                        className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-[hsl(var(--brand-blue))]"
                    >
                        想挑战更难的？看项目挑战
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
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
