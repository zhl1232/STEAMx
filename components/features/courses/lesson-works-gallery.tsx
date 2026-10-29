"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Heart, ImageOff, Loader2, RefreshCw, Sparkles } from "lucide-react";

import { LessonWorkUpload } from "@/components/features/courses/lesson-work-upload";
import { Button } from "@/components/ui/button";
import type { Work } from "@/lib/mappers/types";

/**
 * 课时「作品」Tab：展示直接归属于当前课时的公开作品。
 */
export function LessonWorksGallery({
    courseId,
    lessonId,
    lessonTitle,
}: {
    courseId: number;
    lessonId: number;
    lessonTitle: string;
}) {
    const [items, setItems] = useState<Work[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}/works`);
            const data = (await res.json().catch(() => ({}))) as {
                works?: Work[];
                error?: string;
            };
            if (!res.ok) throw new Error(data.error || "加载失败");
            setItems(Array.isArray(data.works) ? data.works : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载失败");
            setItems([]);
        }
    }, [courseId, lessonId]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="flex flex-1 flex-col bg-[hsl(var(--background))] lg:min-h-0">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">
                        本课作品
                    </h3>
                </div>
                <div className="shrink-0 [&_button]:min-h-11 [&_button]:px-3">
                    <LessonWorkUpload
                        courseId={courseId}
                        lessonId={lessonId}
                        lessonTitle={lessonTitle}
                        onUploaded={() => void load()}
                    />
                </div>
            </div>

            <div className="min-h-[16rem] flex-1 p-4 lg:min-h-0 lg:overflow-y-auto">
                {items === null && !error ? (
                    <div role="status" className="grid min-h-[16rem] place-items-center sm:min-h-[20rem]">
                        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            正在加载作品
                        </span>
                    </div>
                ) : items && items.length > 0 ? (
                    <ul className={items.length === 1
                        ? "grid grid-cols-[minmax(0,min(100%,25rem))] items-start gap-4"
                        : "grid grid-cols-1 items-start gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"}>
                        {items.map((item) => {
                            const cover = item.proofImages?.[0];
                            return (
                                <li key={item.id}>
                                  <Link href={`/works/${item.id}`} className="block overflow-hidden rounded-sm border border-border bg-card transition hover:border-[hsl(var(--surface-border-strong))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue))]">
                                    <div className="relative bg-muted">
                                        {cover ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img
                                                src={cover}
                                                alt={`${item.author} 的作品`}
                                                loading="lazy"
                                                className="max-h-[32rem] w-full object-contain"
                                            />
                                        ) : (
                                            <div className="grid aspect-[3/4] place-items-center text-muted-foreground">
                                                <ImageOff className="h-6 w-6" />
                                            </div>
                                        )}
                                        {item.likes > 0 ? (
                                            <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
                                                <Heart className="h-3 w-3 fill-current" />
                                                {item.likes}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="px-3 py-2.5">
                                        <p className="truncate text-sm font-semibold text-foreground">
                                            {item.author}
                                        </p>
                                        {item.notes ? (
                                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                                {item.notes}
                                            </p>
                                        ) : null}
                                    </div>
                                  </Link>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div role="status" className="grid min-h-[16rem] place-items-center sm:min-h-[20rem]">
                        <div className="px-4 py-8 text-center">
                            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50" />
                            <p className="mt-2 text-sm font-semibold text-foreground">
                                {error ? "作品加载失败" : "还没有作品"}
                            </p>
                            {error ? (
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    请稍后重试
                                </p>
                            ) : null}
                            {error ? (
                                <Button type="button" variant="outline" size="sm" className="mt-4 min-h-11" onClick={() => void load()}>
                                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                    重新加载
                                </Button>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
