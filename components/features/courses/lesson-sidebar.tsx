"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";

import type { CourseLessonRow, CourseLessonStep } from "@/lib/courses/types";
import { cn } from "@/lib/utils";
import { LessonRichText } from "./lesson-rich-text";

export function LessonSidebar({
    courseId,
    courseTitle,
    lesson,
    displaySteps,
    activeStepIndex,
    focusedStepIndex,
    onStepClick,
    completed,
    compactSteps = false,
    directoryOnly = false,
}: {
    courseId: number;
    courseTitle: string;
    lesson: CourseLessonRow;
    displaySteps?: CourseLessonStep[];
    activeStepIndex: number;
    focusedStepIndex?: number | null;
    onStepClick: (index: number) => void;
    completed?: boolean;
    compactSteps?: boolean;
    directoryOnly?: boolean;
}) {
    const summary =
        typeof lesson.content?.summary === "string" ? lesson.content.summary : null;
    const steps = displaySteps ?? lesson.steps ?? [];
    const scratch = lesson.lesson_type === "scratch" ? lesson.content?.scratch : undefined;

    return (
        <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-card">
            {directoryOnly ? (
                <div className="shrink-0 border-b border-border px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold">课程目录</h2>
                        <span className="text-xs tabular-nums text-muted-foreground">{steps.length} 页</span>
                    </div>
                    {summary ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{summary}</p> : null}
                </div>
            ) : <div className="shrink-0 border-b border-border px-4 py-3">
                <Link
                    href={`/courses/${courseId}`}
                    className="mb-2 hidden items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground lg:inline-flex"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    返回 · {courseTitle}
                </Link>
                <h2 className="max-md:hidden text-base font-black leading-snug text-foreground lg:text-lg">
                    {lesson.title}
                </h2>
                {summary ? (
                    <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {summary}
                    </p>
                ) : null}
                {scratch?.goals?.length ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        本课目标：{scratch.goals.join("；")}
                    </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    {lesson.duration_minutes ? (
                        <span className="text-xs text-muted-foreground">
                            预计 {lesson.duration_minutes} 分钟
                        </span>
                    ) : null}
                    {completed ? (
                        <span className="inline-block rounded-full bg-[hsl(var(--status-success-surface))] px-2 py-0.5 text-xs font-semibold text-[hsl(var(--status-success))]">
                            已完成
                        </span>
                    ) : null}
                </div>
            </div>}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <ol className="space-y-1.5">
                    {steps.map((step, index) => (
                        <LessonStepItem
                            key={`${step.title}-${index}`}
                            step={step}
                            index={index}
                            active={index === activeStepIndex}
                            focused={index === focusedStepIndex}
                            compact={compactSteps}
                            directoryOnly={directoryOnly}
                            onClick={() => onStepClick(index)}
                        />
                    ))}
                </ol>
                {scratch && !directoryOnly ? (
                    <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs leading-relaxed">
                        <p><strong>自由挑战：</strong>{scratch.challenge}</p>
                        <p><strong>想一想：</strong>{scratch.reflection}</p>
                    </div>
                ) : null}
                {lesson.resources?.length ? (
                    <div className="mt-4 border-t border-border pt-3">
                        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            参考资源
                        </h3>
                        <ul className="space-y-1">
                            {lesson.resources.map((r) => (
                                <li key={r.url}>
                                    <a
                                        href={r.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-[hsl(var(--nav-active))] hover:underline"
                                    >
                                        {r.title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
            </div>
            {lesson.lesson_type === "scratch" ? (
                <p className="shrink-0 border-t border-border px-4 py-2 text-center text-[10px] leading-relaxed text-muted-foreground">
                    基于{" "}
                    <a
                        href="https://scratch.mit.edu"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                    >
                        Scratch
                    </a>{" "}
                    · 作品保存在本平台
                </p>
            ) : null}
        </aside>
    );
}

function LessonStepItem({
    step,
    index,
    active,
    focused,
    compact,
    directoryOnly,
    onClick,
}: {
    step: CourseLessonStep;
    index: number;
    active: boolean;
    focused: boolean;
    compact: boolean;
    directoryOnly: boolean;
    onClick: () => void;
}) {
    const itemRef = useRef<HTMLButtonElement>(null);
    const images = (step.visuals ?? []).filter((visual) => visual.type === "scratch_image");

    useEffect(() => {
        if (!directoryOnly) {
            if (focused) itemRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        if (!focused && !(directoryOnly && active)) return;
        const item = itemRef.current;
        const scroller = item?.closest("ol")?.parentElement;
        if (!item || !scroller) return;
        // Scroll only the directory, never the page or mobile viewport.
        const offset = item.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        if (offset < 0 || offset + item.offsetHeight > scroller.clientHeight) {
            scroller.scrollTop += offset - (scroller.clientHeight - item.offsetHeight) / 2;
        }
    }, [focused, active, directoryOnly]);

    return (
        <li>
            <button
                ref={itemRef}
                type="button"
                onClick={onClick}
                aria-current={active ? "step" : undefined}
                className={cn(
                    "w-full rounded-sm px-3 py-2 text-left transition",
                    active
                        ? "bg-[hsl(var(--brand-blue)/0.12)] ring-1 ring-[hsl(var(--brand-blue)/0.35)]"
                        : "hover:bg-muted/60",
                    focused && "ring-2 ring-[hsl(var(--brand-amber))] ring-offset-2 ring-offset-card",
                    directoryOnly && "flex min-h-11 items-center gap-3",
                )}
            >
                <span className="text-xs font-bold text-[hsl(var(--brand-blue))]">
                    {directoryOnly ? String(index + 1).padStart(2, "0") : `步骤 ${index + 1}`}
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-foreground">
                    {step.title}
                </span>
                {active && compact && !directoryOnly ? (
                    <span className="mt-1 inline-flex rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--brand-blue))]">
                        当前步骤
                    </span>
                ) : null}
                {active && !compact && step.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        <LessonRichText text={step.description} />
                    </p>
                ) : null}
                {active && !compact && step.hint ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-[hsl(var(--brand-amber))]">
                        提示：<LessonRichText text={step.hint} />
                    </p>
                ) : null}
            </button>
            {active && !directoryOnly && images.map((visual) => (
                <figure key={visual.src} className="mt-2 overflow-hidden rounded-lg border border-border bg-white p-1.5">
                    <a href={visual.src} target="_blank" rel="noopener noreferrer" aria-label={`放大查看：${visual.alt}`}>
                        <Image src={visual.src} alt={visual.alt} width={640} height={360} unoptimized className="h-auto w-full" />
                    </a>
                    {visual.caption ? <figcaption className="px-1 py-1.5 text-xs text-muted-foreground">{visual.caption}</figcaption> : null}
                </figure>
            ))}
            {active && !directoryOnly && step.checklist?.length ? (
                <ul className="mt-2 space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground list-disc">
                    {step.checklist.map((item) => <li key={item}>{item}</li>)}
                </ul>
            ) : null}
        </li>
    );
}
