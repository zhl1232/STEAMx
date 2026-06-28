import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";

/**
 * 项目详情页的「回到课程」入口：当该项目是某课程课时的作品墙（背书项目）时展示。
 * 站内同标签页跳转（不 target=_blank），移动端/桌面端通用。
 */
export function ProjectCourseLink({
    courseId,
    lessonId,
    courseTitle,
    lessonTitle,
}: {
    courseId: number;
    lessonId: number;
    courseTitle: string;
    lessonTitle: string;
}) {
    return (
        <Link
            href={`/courses/${courseId}/lessons/${lessonId}`}
            className="flex items-center gap-3 rounded-sm border border-[hsl(var(--brand-blue)/0.22)] bg-[hsl(var(--brand-blue)/0.06)] px-3 py-2.5 transition-colors hover:bg-[hsl(var(--brand-blue)/0.1)] sm:px-4 sm:py-3"
        >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[hsl(var(--brand-blue)/0.12)] text-[hsl(var(--brand-blue))] sm:h-10 sm:w-10">
                <GraduationCap className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-[hsl(var(--brand-blue))]">
                    来自课程 · {courseTitle}
                </span>
                <span className="block truncate text-sm font-bold text-foreground">{lessonTitle}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    跟着课程一步步搭，再来上传你的作品
                </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
    );
}
