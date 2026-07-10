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
        <div className="flex min-h-0 flex-1 flex-col bg-[hsl(var(--background))]">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                        <Sparkles className="h-4 w-4 text-[hsl(var(--brand-blue))]" />
                        这一课的作品
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        搭好后拍照上传，作品通过审核后会展示在这里
                    </p>
                </div>
                <div className="w-44 shrink-0">
                    <LessonWorkUpload
                        courseId={courseId}
                        lessonId={lessonId}
                        lessonTitle={lessonTitle}
                        onUploaded={() => void load()}
                    />
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {items === null && !error ? (
                    <div className="grid h-full place-items-center">
                        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            正在加载作品
                        </span>
                    </div>
                ) : items && items.length > 0 ? (
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {items.map((item) => {
                            const cover = item.proofImages?.[0];
                            return (
                                <li key={item.id}>
                                  <Link href={`/works/${item.id}`} className="group block overflow-hidden rounded-sm border border-border bg-card transition hover:border-[hsl(var(--surface-border-strong))]">
                                    <div className="relative aspect-square bg-muted">
                                        {cover ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img
                                                src={cover}
                                                alt={`${item.author} 的作品`}
                                                loading="lazy"
                                                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                            />
                                        ) : (
                                            <div className="grid h-full place-items-center text-muted-foreground">
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
                                    <div className="px-2 py-1.5">
                                        <p className="truncate text-xs font-semibold text-foreground">
                                            {item.author}
                                        </p>
                                        {item.notes ? (
                                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
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
                    <div className="grid h-full place-items-center">
                        <div className="max-w-xs rounded-sm border border-dashed border-border bg-card px-6 py-8 text-center">
                            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50" />
                            <p className="mt-2 text-sm font-semibold text-foreground">
                                {error ? "作品加载失败" : "还没有作品"}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {error ? "作品暂时无法加载，请稍后重试。" : "搭好你的作品，拍照上传，做这一课的第一个分享者吧！"}
                            </p>
                            {error ? (
                                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
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
