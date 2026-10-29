import { courseCatalogHref } from '@/lib/courses/catalog-url'
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import type { CourseSummary } from "@/lib/api/courses";
import { cn } from "@/lib/utils";

export function getCourseSuccessorLinkLabel(successorTitle: string) {
    return `本课程已更新，前往新版课程：${successorTitle}`;
}

/**
 * 「新版课程」入口：旧课程（已从目录隐藏）详情页与课时页指向替代课程。
 * successor 为空（无映射、新课不存在或未上架）时不渲染任何内容。
 */
export function CourseSuccessorBanner({
    successor,
    variant = "card",
    className,
}: {
    successor: CourseSummary | null;
    /** card：课程详情页醒目卡片；compact：课时页顶部细条，不挤占工作区。 */
    variant?: "card" | "compact";
    className?: string;
}) {
    if (!successor) return null;
    const label = getCourseSuccessorLinkLabel(successor.title);

    if (variant === "compact") {
        return (
            <Link
                href={courseCatalogHref(successor.id)}
                data-testid="course-successor-banner"
                className={cn(
                    "group flex min-h-11 shrink-0 items-center gap-2 border-b border-[hsl(var(--brand-blue)/0.2)] bg-[hsl(var(--brand-blue)/0.08)] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--brand-blue))] transition-colors hover:bg-[hsl(var(--brand-blue)/0.12)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[hsl(var(--brand-blue))] md:px-5 md:text-sm",
                    className,
                )}
            >
                <span aria-hidden className="shrink-0 rounded-md bg-[hsl(var(--brand-blue))] px-1.5 py-0.5 text-[11px] font-bold text-white">
                    新版课程
                </span>
                <span className="min-w-0 flex-1 line-clamp-2 leading-snug md:line-clamp-1">{label}</span>
                <ArrowRight aria-hidden className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
        );
    }

    return (
        <Link
            href={courseCatalogHref(successor.id)}
            data-testid="course-successor-banner"
            className={cn(
                "group flex items-center gap-3 rounded-xl border border-[hsl(var(--brand-blue)/0.28)] bg-[hsl(var(--brand-blue)/0.08)] p-3.5 text-[hsl(var(--brand-blue))] transition-colors hover:bg-[hsl(var(--brand-blue)/0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--brand-blue))] md:gap-4 md:p-4",
                className,
            )}
        >
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--brand-blue))] text-white">
                <Sparkles className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
                <span aria-hidden className="block text-[11px] font-bold tracking-[0.14em] md:text-xs">新版课程</span>
                <span className="mt-0.5 block text-sm font-bold leading-snug text-foreground md:text-base">
                    {label}
                </span>
            </span>
            <span aria-hidden className="hidden shrink-0 items-center gap-1 text-sm font-semibold md:inline-flex">
                去学习
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
            <ArrowRight aria-hidden className="h-5 w-5 shrink-0 md:hidden" />
        </Link>
    );
}
