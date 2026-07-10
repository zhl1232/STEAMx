"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ClipboardCheck, Lightbulb, MessageCircleQuestion, PackageCheck, Sparkles } from "lucide-react";

import type { CourseLessonRow, CourseLessonStep, CourseTeacherGuide } from "@/lib/courses/types";
import { cn } from "@/lib/utils";
import { LessonRichText } from "./lesson-rich-text";

export function LessonSidebar({
    courseId,
    courseTitle,
    lesson,
    activeStepIndex,
    focusedStepIndex,
    onStepClick,
    completed,
    compactSteps = false,
}: {
    courseId: number;
    courseTitle: string;
    lesson: CourseLessonRow;
    activeStepIndex: number;
    focusedStepIndex?: number | null;
    onStepClick: (index: number) => void;
    completed?: boolean;
    compactSteps?: boolean;
}) {
    const summary =
        typeof lesson.content?.summary === "string" ? lesson.content.summary : null;
    const learningGoals = Array.isArray(lesson.content?.learningGoals)
        ? lesson.content.learningGoals.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
    const teacherGuide = normalizeTeacherGuide(lesson.content?.teacherGuide);
    const steps = lesson.steps ?? [];

    return (
        <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-card">
            <div className="shrink-0 border-b border-border px-4 py-3">
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
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <LessonGuidePanel learningGoals={learningGoals} guide={teacherGuide} />
                <ol className="space-y-1.5">
                    {steps.map((step, index) => (
                        <LessonStepItem
                            key={`${step.title}-${index}`}
                            step={step}
                            index={index}
                            active={index === activeStepIndex}
                            focused={index === focusedStepIndex}
                            compact={compactSteps}
                            onClick={() => onStepClick(index)}
                        />
                    ))}
                </ol>
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

function normalizeStringList(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeTeacherGuide(value: unknown): CourseTeacherGuide | null {
    if (!value || typeof value !== "object") return null;
    const guide = value as Record<string, unknown>;
    const normalized: CourseTeacherGuide = {
        inquiryQuestion: typeof guide.inquiryQuestion === "string" ? guide.inquiryQuestion : undefined,
        prepare: normalizeStringList(guide.prepare),
        guidePrompts: normalizeStringList(guide.guidePrompts),
        observe: normalizeStringList(guide.observe),
        extension: typeof guide.extension === "string" ? guide.extension : undefined,
        familyShare: typeof guide.familyShare === "string" ? guide.familyShare : undefined,
    };

    return normalized.inquiryQuestion ||
        normalized.prepare?.length ||
        normalized.guidePrompts?.length ||
        normalized.observe?.length ||
        normalized.extension ||
        normalized.familyShare
        ? normalized
        : null;
}

function LessonGuidePanel({
    learningGoals,
    guide,
}: {
    learningGoals: string[];
    guide: CourseTeacherGuide | null;
}) {
    if (learningGoals.length === 0 && !guide) return null;

    return (
        <section className="mb-3 space-y-2 rounded-sm border border-border bg-muted/30 p-3">
            {guide?.inquiryQuestion ? (
                <div>
                    <p className="flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--brand-blue))]">
                        <MessageCircleQuestion className="h-3.5 w-3.5" />
                        探究问题
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-foreground">
                        <LessonRichText text={guide.inquiryQuestion} />
                    </p>
                </div>
            ) : null}

            {learningGoals.length > 0 ? (
                <CompactGuideList
                    icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                    title="学习目标"
                    items={learningGoals}
                />
            ) : null}
            {guide?.prepare?.length ? (
                <CompactGuideList
                    icon={<PackageCheck className="h-3.5 w-3.5" />}
                    title="材料准备"
                    items={guide.prepare}
                />
            ) : null}
            {guide?.guidePrompts?.length ? (
                <CompactGuideList
                    icon={<Lightbulb className="h-3.5 w-3.5" />}
                    title="引导提问"
                    items={guide.guidePrompts}
                />
            ) : null}
            {guide?.observe?.length ? (
                <CompactGuideList
                    icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                    title="观察记录"
                    items={guide.observe}
                />
            ) : null}
            {guide?.extension || guide?.familyShare ? (
                <div className="space-y-1.5 border-t border-border/70 pt-2">
                    {guide.extension ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            <span className="font-bold text-foreground">延伸：</span>
                            <LessonRichText text={guide.extension} />
                        </p>
                    ) : null}
                    {guide.familyShare ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            <span className="font-bold text-foreground">带回家：</span>
                            <LessonRichText text={guide.familyShare} />
                        </p>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}

function CompactGuideList({
    icon,
    title,
    items,
}: {
    icon: ReactNode;
    title: string;
    items: string[];
}) {
    return (
        <div>
            <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                {icon}
                {title}
            </p>
            <ul className="mt-1 space-y-1">
                {items.map((item) => (
                    <li key={item} className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[hsl(var(--brand-amber))]" />
                        <span>
                            <LessonRichText text={item} />
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function LessonStepItem({
    step,
    index,
    active,
    focused,
    compact,
    onClick,
}: {
    step: CourseLessonStep;
    index: number;
    active: boolean;
    focused: boolean;
    compact: boolean;
    onClick: () => void;
}) {
    const itemRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!focused) return;
        itemRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [focused]);

    return (
        <li>
            <button
                ref={itemRef}
                type="button"
                onClick={onClick}
                className={cn(
                    "w-full rounded-sm px-3 py-2 text-left transition",
                    active
                        ? "bg-[hsl(var(--brand-blue)/0.12)] ring-1 ring-[hsl(var(--brand-blue)/0.35)]"
                        : "hover:bg-muted/60",
                    focused && "ring-2 ring-[hsl(var(--brand-amber))] ring-offset-2 ring-offset-card",
                )}
            >
                <span className="text-xs font-bold text-[hsl(var(--brand-blue))]">
                    步骤 {index + 1}
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-foreground">
                    {step.title}
                </span>
                {active && compact ? (
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
        </li>
    );
}
