"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Check,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GomokuBoard } from "@/components/features/courses/gomoku-board";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/context/auth-context";
import { useLoginPrompt } from "@/lib/context/login-prompt-context";
import type {
    CourseLessonRow,
    PlaygroundLessonContent,
} from "@/lib/courses/types";
import { cn } from "@/lib/utils";

/**
 * 已接入课程化的游乐场游戏。
 * key 与 PlaygroundLessonContent.gameKey 对应，提供实战入口、图标与默认 CTA 文案；
 * 没在这里登记的 gameKey 仍能渲染，但会回退到通用文案。
 */
type PlaygroundGameDescriptor = {
    key: string;
    label: string;
    practiceHref: string;
    defaultCta: string;
};

const PLAYGROUND_GAMES: Record<string, PlaygroundGameDescriptor> = {
    gomoku: {
        key: "gomoku",
        label: "五子棋",
        practiceHref: "/playground/gomoku",
        defaultCta: "去和 AI 下一局",
    },
};

function resolvePlaygroundContent(
    lesson: CourseLessonRow,
): PlaygroundLessonContent & {
    descriptor: PlaygroundGameDescriptor | null;
    practiceHref: string;
    practiceCta: string;
} {
    const raw: PlaygroundLessonContent = lesson.content?.playground ?? { gameKey: "" };
    // 缺失 gameKey 时不要静默落到 gomoku：回退到通用 /playground 入口，
    // 与未登记 gameKey 的行为保持一致，避免管理员误建空配置课时被链到五子棋。
    const gameKey = typeof raw.gameKey === "string" ? raw.gameKey : "";
    const descriptor = gameKey ? (PLAYGROUND_GAMES[gameKey] ?? null) : null;
    const fallbackHref = descriptor?.practiceHref ?? "/playground";
    const fallbackCta = descriptor?.defaultCta ?? "去游乐场实战";
    return {
        gameKey,
        practiceHref:
            (typeof raw.practiceHref === "string" && raw.practiceHref) || fallbackHref,
        practiceCta:
            (typeof raw.practiceCta === "string" && raw.practiceCta) || fallbackCta,
        descriptor,
    };
}

export function PlaygroundWorkspace({
    courseId,
    lesson,
    activeStepIndex,
    onStepChange,
    initialCompleted,
    onCompleted,
}: {
    courseId: number;
    lesson: CourseLessonRow;
    activeStepIndex: number;
    onStepChange: (index: number) => void;
    initialCompleted?: boolean;
    onCompleted?: () => void;
}) {
    const { user } = useAuth();
    const { promptLogin } = useLoginPrompt();
    const { toast } = useToast();
    const [completed, setCompleted] = useState(Boolean(initialCompleted));
    const [completing, setCompleting] = useState(false);

    const { descriptor, practiceHref, practiceCta } = useMemo(
        () => resolvePlaygroundContent(lesson),
        [lesson],
    );

    const steps = lesson.steps ?? [];
    const total = steps.length;
    const clampedStep = total > 0 ? Math.min(activeStepIndex, total - 1) : 0;
    const currentStep = steps[clampedStep];
    // 0 步课时也要能完成：没有步骤时把整课视为「最后一步」，直接显示「完成这课」。
    const isLastStep = total === 0 || clampedStep >= total - 1;

    useEffect(() => {
        setCompleted(Boolean(initialCompleted));
    }, [initialCompleted, lesson.id]);

    const goStep = useCallback(
        (delta: number) => {
            const next = Math.min(Math.max(clampedStep + delta, 0), Math.max(total - 1, 0));
            onStepChange(next);
        },
        [clampedStep, onStepChange, total],
    );

    const handleComplete = useCallback(async () => {
        if (!user) {
            promptLogin();
            return;
        }
        setCompleting(true);
        try {
            const res = await fetch(
                `/api/courses/${courseId}/lessons/${lesson.id}/complete`,
                { method: "POST" },
            );
            const data = (await res.json().catch(() => ({}))) as {
                error?: string;
                alreadyCompleted?: boolean;
            };
            if (!res.ok) {
                throw new Error(data.error || "完成失败");
            }
            setCompleted(true);
            if (data.alreadyCompleted) {
                toast({ title: "本课已完成 ✓" });
            } else {
                toast({ title: "课时已完成 🎉", description: "+15 经验值" });
            }
            onCompleted?.();
        } catch (error) {
            toast({
                title: "完成失败",
                description: error instanceof Error ? error.message : undefined,
                variant: "destructive",
            });
        } finally {
            setCompleting(false);
        }
    }, [courseId, lesson.id, onCompleted, promptLogin, toast, user]);

    return (
        <section className="flex min-h-0 flex-1 flex-col bg-muted/20">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
                {/* 讲解面板：展示当前步骤的标题、描述与提示 */}
                <div className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
                    <div className="mx-auto w-full max-w-2xl space-y-5">
                        <header className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-[hsl(var(--brand-blue)/0.12)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--brand-blue))]">
                                    {descriptor ? descriptor.label : "游乐场实训"}
                                </span>
                                {typeof lesson.content?.summary === "string" ? (
                                    <span className="text-xs text-muted-foreground">
                                        {lesson.content.summary}
                                    </span>
                                ) : null}
                            </div>
                            <h2 className="text-lg font-black leading-snug text-foreground sm:text-xl">
                                {currentStep?.title ?? lesson.title}
                            </h2>
                        </header>

                        {currentStep?.description ? (
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                {currentStep.description}
                            </p>
                        ) : null}

                        {descriptor?.key === "gomoku" ? (
                            <GomokuStepVisual stepIndex={clampedStep} />
                        ) : null}

                        {currentStep?.hint ? (
                            <Card className="border-[hsl(var(--brand-amber)/0.32)] bg-[hsl(var(--brand-amber)/0.08)] p-3.5">
                                <p className="text-xs font-semibold text-[hsl(var(--brand-amber))]">
                                    提示
                                </p>
                                <p className="mt-1 text-sm leading-relaxed text-foreground">
                                    {currentStep.hint}
                                </p>
                            </Card>
                        ) : null}

                        {currentStep?.checklist?.length ? (
                            <ul className="space-y-1.5">
                                {currentStep.checklist.map((item) => (
                                    <li
                                        key={item}
                                        className="flex items-start gap-2 text-sm text-muted-foreground"
                                    >
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--status-success))]" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : null}

                        {lesson.resources?.length ? (
                            <div className="border-t border-border pt-3">
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
                                                className="inline-flex items-center gap-1 text-sm text-[hsl(var(--nav-active))] hover:underline"
                                            >
                                                {r.title}
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* 实战侧栏：去游乐场游戏 + 步骤导航 + 完成课时 */}
                <aside className="flex shrink-0 flex-col border-border bg-card lg:w-[320px] lg:border-l max-lg:border-t">
                    <div className="space-y-3 border-b border-border p-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                实战入口
                            </p>
                            <p className="mt-1 text-sm text-foreground">
                                看完讲解，到游乐场游戏里实战，再回来完成课时。
                            </p>
                        </div>
                        <Button asChild size="lg" className="w-full">
                            <Link href={practiceHref}>
                                {practiceCta}
                                <ExternalLink className="ml-1.5 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>

                    <div className="grid grid-cols-[1fr_1fr] gap-2 border-b border-border p-3">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={clampedStep === 0}
                            onClick={() => goStep(-1)}
                        >
                            <ChevronLeft className="mr-1 h-4 w-4" />
                            上一步
                        </Button>
                        {isLastStep ? (
                            <Button
                                type="button"
                                disabled={completing || completed}
                                onClick={() => void handleComplete()}
                            >
                                {completing ? (
                                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="mr-1 h-4 w-4" />
                                )}
                                {completed ? "已完成" : "完成这课"}
                            </Button>
                        ) : (
                            <Button type="button" onClick={() => goStep(1)}>
                                下一步
                                <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {/* 本课进度：用紧凑进度条代替重复的步骤列表（步骤导航由左侧 LessonSidebar 负责） */}
                    {total > 0 ? (
                        <div className="px-4 py-4">
                            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                                <span className="font-bold">本课进度</span>
                                <span>
                                    {clampedStep + 1} / {total}
                                </span>
                            </div>
                            <div className="flex gap-1">
                                {steps.map((step, index) => (
                                    <span
                                        key={`${step.title}-${index}`}
                                        aria-hidden
                                        className={cn(
                                            "h-1.5 flex-1 rounded-full transition",
                                            index <= clampedStep
                                                ? "bg-[hsl(var(--brand-blue))]"
                                                : "bg-[hsl(var(--surface-border))]",
                                        )}
                                    />
                                ))}
                            </div>
                            <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                下一步：{steps[Math.min(clampedStep + 1, total - 1)]?.title ?? "完成本课"}
                            </p>
                        </div>
                    ) : null}
                </aside>
            </div>
        </section>
    );
}

/**
 * 五子棋课时步骤示意：按步骤序号展示不同棋局，给讲解配上视觉锚点，
 * 避免主内容区只有文字时显得空旷。
 * 步骤 0：空棋盘 + 连五示意（横/竖/斜三向各一组）；
 * 步骤 1：活三 / 冲四棋型；
 * 步骤 2：黑方五连获胜（呼应极小极大算法的终局）。
 * 超出已知步骤时回退到步骤 0 的示意。
 */
function GomokuStepVisual({ stepIndex }: { stepIndex: number }) {
    const configs: Array<{
        black: Array<{ r: number; c: number }>;
        white: Array<{ r: number; c: number }>;
        winLine?: { from: { r: number; c: number }; to: { r: number; c: number } };
        caption: string;
    }> = [
        {
            // 连五示意：横向 5 黑子 + 斜向示意白子
            black: [
                { r: 7, c: 5 },
                { r: 7, c: 6 },
                { r: 7, c: 7 },
                { r: 7, c: 8 },
                { r: 7, c: 9 },
            ],
            white: [
                { r: 5, c: 7 },
                { r: 9, c: 6 },
            ],
            winLine: { from: { r: 7, c: 5 }, to: { r: 7, c: 9 } },
            caption: "横、竖、斜任一方向连成 5 子即胜",
        },
        {
            // 活三：黑子 _○○○_ 形态（第 7 行 6-8 列），白子防守于一侧
            black: [
                { r: 7, c: 6 },
                { r: 7, c: 7 },
                { r: 7, c: 8 },
            ],
            white: [
                { r: 7, c: 5 },
                { r: 8, c: 7 },
            ],
            caption: "活三：两端都空，下一步可成活四",
        },
        {
            // 极小极大终局：黑方对角五连获胜
            black: [
                { r: 6, c: 6 },
                { r: 7, c: 7 },
                { r: 8, c: 8 },
                { r: 9, c: 9 },
                { r: 10, c: 10 },
            ],
            white: [
                { r: 6, c: 7 },
                { r: 7, c: 8 },
                { r: 8, c: 9 },
                { r: 9, c: 10 },
            ],
            winLine: { from: { r: 6, c: 6 }, to: { r: 10, c: 10 } },
            caption: "AI 评估到这一步连五，即判定为胜局",
        },
    ];

    const config = configs[Math.min(stepIndex, configs.length - 1)] ?? configs[0];

    return (
        <figure className="surface-subtle flex flex-col items-center gap-2 rounded-[var(--radius-md)] p-4">
            <GomokuBoard
                blackStones={config.black}
                whiteStones={config.white}
                winLine={config.winLine}
                ariaLabel={config.caption}
                className="max-w-[260px] drop-shadow-[0_10px_18px_hsl(var(--surface-shadow)/0.2)]"
            />
            <figcaption className="text-center text-xs font-medium text-muted-foreground">
                {config.caption}
            </figcaption>
        </figure>
    );
}
