"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, HelpCircle, Loader2, Save, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/context/auth-context";
import { useLoginPrompt } from "@/lib/context/login-prompt-context";
import {
    SCRATCH_PARENT_SOURCE,
    isScratchHostMessage,
} from "@/lib/courses/scratch-messages";
import type { ScratchBlockCategory } from "@/lib/courses/scratch-hints";
import { canUseScratchEditor } from "@/lib/courses/device";
import { cn } from "@/lib/utils";
import { ScratchLoadingOverlay } from "./scratch-loading-overlay";

export type ScratchWorkspaceBlockHint = {
    stepIndex: number;
    keywords: string[];
    category?: ScratchBlockCategory;
    reason: "stuck" | "next_step" | "review";
};

function getScratchHostUrl(playerOnly: boolean): string {
    const origin =
        typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const base =
        process.env.NEXT_PUBLIC_SCRATCH_HOST_URL || `${origin}/scratch/index.html`;
    const url = new URL(base, origin);
    if (playerOnly) url.searchParams.set("playerOnly", "1");
    else url.searchParams.set("embed", "1");
    return url.toString();
}

async function uploadSb3ToLesson(
    courseId: number,
    lessonId: number,
    base64: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/x.scratch.sb3" });
    const form = new FormData();
    form.append("file", blob, "project.sb3");
    const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}/project`, {
        method: "POST",
        body: form,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
            ok: false,
            error: (err as { error?: string }).error || "保存失败",
        };
    }
    return { ok: true };
}

export function ScratchWorkspace({
    courseId,
    lessonId,
    playerOnly = false,
    tutorialDeckId,
    initialCompleted = false,
    blockHint,
    onDismissBlockHint,
    onProjectSaved,
    onCompleted,
}: {
    courseId: number;
    lessonId: number;
    playerOnly?: boolean;
    tutorialDeckId?: string;
    initialCompleted?: boolean;
    blockHint?: ScratchWorkspaceBlockHint | null;
    onDismissBlockHint?: () => void;
    onProjectSaved?: () => void;
    onCompleted?: () => void;
}) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const saveResolverRef = useRef<((ok: boolean) => void) | null>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveToastRef = useRef(true);
    const { user } = useAuth();
    const { promptLogin } = useLoginPrompt();
    const { toast } = useToast();
    const [ready, setReady] = useState(false);
    const [projectLoaded, setProjectLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [completed, setCompleted] = useState(initialCompleted);
    const [hasSavedProject, setHasSavedProject] = useState(false);
    const [loadingProject, setLoadingProject] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const editorAllowed = playerOnly || canUseScratchEditor();

    const postToIframe = useCallback((message: Record<string, unknown>) => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        win.postMessage({ ...message, source: SCRATCH_PARENT_SOURCE }, window.location.origin);
    }, []);

    const finishPendingSave = useCallback((ok: boolean) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
        saveResolverRef.current?.(ok);
        saveResolverRef.current = null;
    }, []);

    const persistBase64 = useCallback(
        async (base64: string, options?: { showToast?: boolean }) => {
            const showToast = options?.showToast ?? saveToastRef.current;
            setSaving(true);
            try {
                const result = await uploadSb3ToLesson(courseId, lessonId, base64);
                if (!result.ok) {
                    if (showToast) {
                        toast({
                            title: "保存失败",
                            description: result.error,
                            variant: "destructive",
                        });
                    }
                    postToIframe({ type: "PROJECT_SAVED", ok: false, error: result.error });
                    return false;
                }
                setHasSavedProject(true);
                if (showToast) {
                    toast({ title: "作品已保存到课程" });
                }
                onProjectSaved?.();
                postToIframe({ type: "PROJECT_SAVED", ok: true });
                return true;
            } catch (e) {
                const message = e instanceof Error ? e.message : "保存失败";
                if (showToast) {
                    toast({
                        title: "保存失败",
                        description: message,
                        variant: "destructive",
                    });
                }
                postToIframe({ type: "PROJECT_SAVED", ok: false, error: message });
                return false;
            } finally {
                setSaving(false);
            }
        },
        [courseId, lessonId, onProjectSaved, postToIframe, toast],
    );

    const requestIframeSave = useCallback((): Promise<boolean> => {
        return new Promise((resolve) => {
            if (!ready) {
                resolve(false);
                return;
            }
            saveResolverRef.current = resolve;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                finishPendingSave(false);
            }, 45000);
            postToIframe({ type: "SAVE_PROJECT" });
        });
    }, [finishPendingSave, postToIframe, ready]);

    const loadProjectUrl = useCallback(async () => {
        setLoadingProject(true);
        try {
            if (!user) {
                postToIframe({ type: "LOAD_PROJECT", url: null });
                return;
            }
            const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}/project`);
            if (!res.ok) throw new Error("无法加载项目");
            const data = await res.json();
            setHasSavedProject(Boolean(data.hasUserProject));
            postToIframe({ type: "LOAD_PROJECT", url: data.projectUrl ?? null });
        } catch {
            setHasSavedProject(false);
            postToIframe({ type: "LOAD_PROJECT", url: null });
        } finally {
            setLoadingProject(false);
        }
    }, [courseId, lessonId, postToIframe, user]);

    useEffect(() => {
        const onMessage = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (!isScratchHostMessage(event.data)) return;

            const msg = event.data;
            if (msg.type === "SCRATCH_READY") {
                setReady(true);
                setProjectLoaded(false);
                postToIframe({
                    type: "SCRATCH_INIT",
                    lessonId,
                    playerOnly,
                });
                if (playerOnly) {
                    postToIframe({ type: "RUN_PLAYER_ONLY" });
                }
                // Let iframe finish default project + redux sync before optional course sb3 load
                window.setTimeout(() => {
                    void loadProjectUrl();
                }, 300);
            }
            if (msg.type === "PROJECT_LOADED") {
                setProjectLoaded(msg.ok);
                if (!msg.ok && msg.error) {
                    toast({
                        title: "Scratch 项目加载失败",
                        description: msg.error,
                        variant: "destructive",
                    });
                }
            }
            if (msg.type === "PROJECT_SAVED" && !msg.ok) {
                finishPendingSave(false);
            }
            if (msg.type === "PROJECT_SAVE_DATA" && msg.base64) {
                if (!user) {
                    promptLogin();
                    finishPendingSave(false);
                    return;
                }
                const ok = await persistBase64(msg.base64);
                finishPendingSave(ok);
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [
        courseId,
        finishPendingSave,
        lessonId,
        loadProjectUrl,
        persistBase64,
        playerOnly,
        postToIframe,
        promptLogin,
        toast,
        user,
    ]);

    const handleSaveClick = () => {
        if (!user) {
            promptLogin();
            return;
        }
        saveToastRef.current = true;
        postToIframe({ type: "SAVE_PROJECT" });
    };

    const handleComplete = async () => {
        if (!user) {
            promptLogin();
            return;
        }
        if (!ready || !projectLoaded) {
            toast({
                title: "编辑器尚未就绪",
                description: "请等待 Scratch 与项目加载完成后再试",
                variant: "destructive",
            });
            return;
        }
        setCompleting(true);
        saveToastRef.current = false;
        try {
            const saved = await requestIframeSave();
            if (!saved) {
                toast({
                    title: "无法标记完成",
                    description: hasSavedProject
                        ? "保存作品失败，请检查网络后重试"
                        : "请先保存 Scratch 作品，或确保编辑器已加载完成",
                    variant: "destructive",
                });
                return;
            }
            const res = await fetch(
                `/api/courses/${courseId}/lessons/${lessonId}/complete`,
                { method: "POST" },
            );
            const data = (await res.json().catch(() => ({}))) as {
                error?: string;
                missing?: string[];
                alreadyCompleted?: boolean;
            };
            // 422：作品还没用到本课要求的关键积木，友好提示孩子还差什么
            if (res.status === 422) {
                const missing = Array.isArray(data.missing) ? data.missing : [];
                toast({
                    title: "作品还差一点点 💪",
                    description: missing.length
                        ? `再加上「${missing.join("」「")}」就能完成啦！`
                        : "再按课程步骤完善一下作品吧",
                });
                return;
            }
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
        } catch (e) {
            toast({
                title: "无法标记完成",
                description: e instanceof Error ? e.message : undefined,
                variant: "destructive",
            });
        } finally {
            saveToastRef.current = true;
            setCompleting(false);
        }
    };

    const handleFileUpload = (file: File) => {
        if (!user) {
            promptLogin();
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const buf = reader.result as ArrayBuffer;
            const bytes = new Uint8Array(buf);
            let binary = "";
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
                binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
            }
            const base64 = btoa(binary);
            postToIframe({ type: "LOAD_PROJECT_BUFFER", base64 });
            saveToastRef.current = true;
            void persistBase64(base64);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleTutorialClick = () => {
        if (tutorialDeckId) {
            postToIframe({ type: "OPEN_TUTORIAL_DECK", deckId: tutorialDeckId });
        } else {
            postToIframe({ type: "OPEN_TUTORIALS" });
        }
    };

    useEffect(() => {
        if (!blockHint?.keywords.length || playerOnly) return;
        postToIframe({
            type: "HIGHLIGHT_BLOCK_KEYWORDS",
            keywords: blockHint.keywords,
            category: blockHint.category,
        });
    }, [blockHint, playerOnly, postToIframe]);

    useEffect(() => {
        if (blockHint?.keywords.length || playerOnly) return;
        postToIframe({ type: "DISMISS_BLOCK_KEYWORDS" });
    }, [blockHint, playerOnly, postToIframe]);

    if (!editorAllowed && !playerOnly) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                <p className="max-w-sm text-muted-foreground">
                    在手机上的小屏幕较难舒适地使用 Scratch 编辑器。请用平板或电脑打开本课，也可以上传已完成的 .sb3 文件交作业。
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".sb3"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f);
                    }}
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    上传 .sb3 作品
                </Button>
            </div>
        );
    }

    const busy = saving || completing;

    return (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {!playerOnly ? (
                <>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card/95 px-3 py-1.5 backdrop-blur-sm">
                        <Button
                            type="button"
                            size="sm"
                            disabled={!ready || !projectLoaded || busy}
                            onClick={handleSaveClick}
                        >
                            {saving && !completing ? (
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="mr-1 h-4 w-4" />
                            )}
                            <span className="hidden sm:inline">保存到课程</span>
                            <span className="sm:hidden">保存</span>
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".sb3"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFileUpload(f);
                            }}
                        />
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!ready || !projectLoaded || busy}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="mr-1 h-4 w-4" />
                            <span className="hidden sm:inline">打开文件</span>
                            <span className="sm:hidden">打开</span>
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!ready || !projectLoaded}
                            onClick={handleTutorialClick}
                            title={tutorialDeckId ? "打开本课教程" : "打开教程"}
                        >
                            <HelpCircle className="mr-1 h-4 w-4" />
                            <span className="hidden sm:inline">
                                {tutorialDeckId ? "本课教程" : "教程"}
                            </span>
                            <span className="sm:hidden">教程</span>
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={!ready || !projectLoaded || busy || completed}
                            onClick={() => void handleComplete()}
                        >
                            {completing ? (
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : completed ? (
                                <Check className="mr-1 h-4 w-4" />
                            ) : null}
                            <span className="hidden sm:inline">
                                {completed ? "已完成" : "完成课时"}
                            </span>
                            <span className="sm:hidden">{completed ? "已完成" : "完成"}</span>
                        </Button>
                        {(loadingProject || !ready) && (
                            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                加载编辑器…
                            </span>
                        )}
                    </div>
                    {blockHint?.keywords.length ? (
                        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[hsl(var(--brand-amber)/0.28)] bg-[hsl(var(--brand-amber)/0.09)] px-3 py-2 text-xs">
                            <span className="font-semibold text-foreground">
                                可以先找这些积木
                            </span>
                            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                                {blockHint.keywords.map((keyword) => (
                                    <span
                                        key={keyword}
                                        className="rounded-[var(--radius-xs)] border border-[hsl(var(--brand-amber)/0.35)] bg-background/85 px-2 py-0.5 font-medium text-[hsl(var(--brand-amber))]"
                                    >
                                        {keyword}
                                    </span>
                                ))}
                            </div>
                            {onDismissBlockHint ? (
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 shrink-0"
                                    aria-label="关闭积木提示"
                                    onClick={onDismissBlockHint}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                </>
            ) : null}
            <div
                className={cn(
                    "relative min-h-0 flex-1 overflow-hidden",
                    playerOnly ? "min-h-[360px]" : "",
                )}
            >
                <ScratchLoadingOverlay show={!ready || !projectLoaded} />
                <iframe
                    ref={iframeRef}
                    title="Scratch 编辑器"
                    src={getScratchHostUrl(playerOnly)}
                    className="absolute inset-0 h-full w-full border-0 bg-background"
                    allow="microphone; camera"
                />
            </div>
        </div>
    );
}
