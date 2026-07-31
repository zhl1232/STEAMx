"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, HelpCircle, ListChecks, Loader2, Save, Target, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/context/auth-context";
import { useLoginPrompt } from "@/lib/context/login-prompt-context";
import {
    SCRATCH_PARENT_SOURCE,
    isScratchHostMessage,
    type ScratchEditorContext,
} from "@/lib/courses/scratch-messages";
import {
    getScratchRichTextCategoryLabel,
    type ScratchBlockCategory,
    type ScratchBlockHintItem,
} from "@/lib/courses/scratch-hints";
import { useScratchEditorAvailability } from "@/lib/courses/device";
import { getLessonCompletionFeedback } from "@/lib/courses/progress";
import { cn } from "@/lib/utils";
import {
    getScratchHostUrl,
    useScratchHost,
} from "./scratch-host-context";
import { ScratchLoadingOverlay } from "./scratch-loading-overlay";
import type { ScratchStepCheckItemResult, ScratchStepCheckResult } from "@/lib/courses/scratch-step-check";

export type ScratchWorkspaceBlockHint = {
    stepIndex: number;
    keywords: string[];
    items?: ScratchBlockHintItem[];
    targetItemIndex?: number;
    category?: ScratchBlockCategory;
    reason: "stuck" | "next_step" | "review";
};

function getBlockHintReasonLabel(reason: ScratchWorkspaceBlockHint["reason"]) {
    if (reason === "review") return "检查这一步";
    if (reason === "stuck") return "先补这一步";
    return "继续做这一步";
}

function getBlockHintItems(blockHint: ScratchWorkspaceBlockHint): ScratchBlockHintItem[] {
    if (blockHint.items?.length) return blockHint.items;
    return blockHint.keywords.map((keyword) => ({
        label: keyword,
        findLabel: keyword,
    }));
}

function getBlockHintTargetIndex(
    blockHint: ScratchWorkspaceBlockHint,
    items = getBlockHintItems(blockHint),
): number {
    const count = items.length || blockHint.keywords.length;
    if (count <= 0) return 0;
    const index = Number.isFinite(blockHint.targetItemIndex)
        ? Math.trunc(blockHint.targetItemIndex ?? 0)
        : 0;
    return Math.min(Math.max(index, 0), count - 1);
}

function getBlockHintCategory(
    blockHint: ScratchWorkspaceBlockHint,
    items = getBlockHintItems(blockHint),
): ScratchBlockCategory | undefined {
    const targetItem = items[getBlockHintTargetIndex(blockHint, items)];
    return targetItem?.category ?? blockHint.category;
}

function getIframeBlockHintPayload(blockHint: ScratchWorkspaceBlockHint) {
    const items = getBlockHintItems(blockHint);
    const targetIndex = getBlockHintTargetIndex(blockHint, items);
    const targetItem = items[targetIndex];
    const targetKeyword =
        targetItem?.findLabel ?? blockHint.keywords[targetIndex] ?? blockHint.keywords[0];

    return {
        keywords: targetKeyword ? [targetKeyword] : blockHint.keywords,
        items: blockHint.items?.length && targetItem ? [targetItem] : undefined,
        category: targetItem?.category ?? blockHint.category,
    };
}

function getStepCheckTitle(result: ScratchStepCheckResult) {
    if (result.status === "complete") return "这一步看起来已完成";
    if (result.reason === "no_items") return "这一步暂时不能自动自检";
    if (result.reason === "no_editor_context") return "等待 Scratch 同步后再自检";
    if (result.reason === "no_selected_target") return "先选中要检查的角色";
    return "这一步还差一点";
}

function getStepCheckDescription(result: ScratchStepCheckResult) {
    if (result.reason === "no_items") {
        return "这一步没有明确的 Scratch 积木目标，请对照步骤说明检查。";
    }
    if (result.reason === "no_editor_context") {
        return "请等编辑器加载完成，或先点一下 Scratch 工作区。";
    }
    if (result.reason === "no_selected_target") {
        return "在舞台或角色列表里点一下当前要做的对象，然后再自检。";
    }
    const target = result.targetName ? `「${result.targetName}」` : "当前对象";
    if (result.status === "complete") {
        return `已在${target}上找到 ${result.completeCount}/${result.total} 个目标动作。`;
    }
    return `已在${target}上完成 ${result.completeCount}/${result.total} 个目标动作。`;
}

function getStepCheckItemStatusLabel(status: ScratchStepCheckItemResult["status"]) {
    if (status === "missing") return "未找到";
    if (status === "needs_edit") return "需修改";
    if (status === "needs_review") return "需核对";
    return "已完成";
}

function getStepCheckToneClass(result: ScratchStepCheckResult) {
    if (result.status === "complete") {
        return "border-[hsl(var(--brand-green)/0.3)] bg-[hsl(var(--brand-green)/0.1)]";
    }
    if (result.status === "unknown") return "border-border bg-muted/35";
    return "border-[hsl(var(--brand-amber)/0.3)] bg-[hsl(var(--brand-amber)/0.09)]";
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
    stepCheckResult,
    onCheckCurrentStep,
    onFocusStepCheckItem,
    onEditorContextChange,
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
    stepCheckResult?: ScratchStepCheckResult | null;
    onCheckCurrentStep?: () => void;
    onFocusStepCheckItem?: (targetItemIndex: number) => void;
    onEditorContextChange?: (context: ScratchEditorContext) => void;
    onProjectSaved?: () => void;
    onCompleted?: () => void;
}) {
    const sharedHost = useScratchHost();

    const localIframeRef = useRef<HTMLIFrameElement>(null);
    const slotRef = useRef<HTMLDivElement>(null);
    const saveResolverRef = useRef<((ok: boolean) => void) | null>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveToastRef = useRef(true);
    const loadedLessonKeyRef = useRef<string | null>(null);
    const bootedRef = useRef(false);
    const readyRef = useRef(false);
    /** 仅当「当前课时」的项目已成功载入 VM 时等于 `${courseId}:${lessonId}`，用于切课静默保存防串课 */
    const boundLessonKeyRef = useRef<string | null>(null);

    const { user } = useAuth();
    const { promptLogin } = useLoginPrompt();
    const { toast } = useToast();

    const [localReady, setLocalReady] = useState(false);
    const [localProjectLoaded, setLocalProjectLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [completed, setCompleted] = useState(initialCompleted);
    const [hasSavedProject, setHasSavedProject] = useState(false);
    const [loadingProject, setLoadingProject] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const scratchEditorAvailable = useScratchEditorAvailability();
    const editorAllowed = playerOnly || scratchEditorAvailable;
    // 预览页 / 无 Provider 时走本地 iframe；课时页仅在支持编辑器的设备上激活共享 Host
    const useSharedHost = Boolean(sharedHost) && !playerOnly && editorAllowed;

    const ready = useSharedHost ? Boolean(sharedHost?.ready) : localReady;
    const projectLoaded = useSharedHost
        ? Boolean(sharedHost?.projectLoaded)
        : localProjectLoaded;
    const switching = useSharedHost ? Boolean(sharedHost?.switching) : false;

    readyRef.current = ready;

    const postToIframe = useCallback(
        (message: Record<string, unknown>) => {
            if (useSharedHost && sharedHost) {
                sharedHost.postToIframe(message);
                return;
            }
            const win = localIframeRef.current?.contentWindow;
            if (!win) return;
            win.postMessage(
                { ...message, source: SCRATCH_PARENT_SOURCE },
                window.location.origin,
            );
        },
        [sharedHost, useSharedHost],
    );

    const setProjectLoaded = useCallback(
        (loaded: boolean) => {
            if (useSharedHost && sharedHost) {
                sharedHost.setProjectLoaded(loaded);
            } else {
                setLocalProjectLoaded(loaded);
            }
        },
        [sharedHost, useSharedHost],
    );

    const finishPendingSave = useCallback((ok: boolean) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
        saveResolverRef.current?.(ok);
        saveResolverRef.current = null;
    }, []);

    const persistBase64 = useCallback(
        async (
            base64: string,
            options?: { showToast?: boolean; courseId?: number; lessonId?: number },
        ) => {
            const showToast = options?.showToast ?? saveToastRef.current;
            const targetCourseId = options?.courseId ?? courseId;
            const targetLessonId = options?.lessonId ?? lessonId;
            setSaving(true);
            try {
                const result = await uploadSb3ToLesson(
                    targetCourseId,
                    targetLessonId,
                    base64,
                );
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
                if (targetCourseId === courseId && targetLessonId === lessonId) {
                    setHasSavedProject(true);
                }
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

    const loadProjectUrl = useCallback(
        async (options?: { force?: boolean }) => {
            const force = options?.force ?? false;
            // 开始换课加载即解除绑定，避免未完成加载时误把上一课内容存到本课
            boundLessonKeyRef.current = null;
            setLoadingProject(true);
            if (useSharedHost && sharedHost) {
                await sharedHost.waitForPendingSave();
                if (force) sharedHost.setSwitching(true);
            }
            setProjectLoaded(false);
            try {
                if (!user) {
                    postToIframe({ type: "LOAD_PROJECT", url: null, force });
                    return;
                }
                const res = await fetch(
                    `/api/courses/${courseId}/lessons/${lessonId}/project`,
                );
                if (!res.ok) throw new Error("无法加载项目");
                const data = await res.json();
                setHasSavedProject(Boolean(data.hasUserProject));
                postToIframe({
                    type: "LOAD_PROJECT",
                    url: data.projectUrl ?? null,
                    force,
                });
            } catch {
                setHasSavedProject(false);
                postToIframe({ type: "LOAD_PROJECT", url: null, force });
            } finally {
                setLoadingProject(false);
            }
        },
        [
            courseId,
            lessonId,
            postToIframe,
            setProjectLoaded,
            sharedHost,
            useSharedHost,
            user,
        ],
    );

    // 共享 Host：挂载槽位 + 订阅消息；卸载时静默保存上一课
    useLayoutEffect(() => {
        if (!useSharedHost || !sharedHost) return;
        sharedHost.activate();
        const slotEl = slotRef.current;
        if (slotEl) sharedHost.registerSlot(slotEl);
        return () => {
            sharedHost.registerSlot(null);
        };
    }, [useSharedHost, sharedHost, courseId, lessonId]);

    useEffect(() => {
        if (!useSharedHost || !sharedHost) return;

        const lessonKey = `${courseId}:${lessonId}`;
        const unsubscribe = sharedHost.subscribe({
            onProjectLoaded: (msg) => {
                if (msg.ok) {
                    boundLessonKeyRef.current = lessonKey;
                } else {
                    boundLessonKeyRef.current = null;
                    if (msg.error) {
                        toast({
                            title: "Scratch 项目加载失败",
                            description: msg.error,
                            variant: "destructive",
                        });
                    }
                }
            },
            onProjectSaved: (msg) => {
                if (!msg.ok) finishPendingSave(false);
            },
            onProjectSaveData: async (msg) => {
                if (!user) {
                    promptLogin();
                    finishPendingSave(false);
                    return;
                }
                const ok = await persistBase64(msg.base64);
                finishPendingSave(ok);
            },
            onEditorContext: (context) => {
                onEditorContextChange?.(context);
            },
        });

        return () => {
            unsubscribe();
            // 仅当本课项目已成功绑定到 VM 时才静默保存，避免把上一课内容写到新课
            if (
                readyRef.current &&
                boundLessonKeyRef.current === lessonKey
            ) {
                boundLessonKeyRef.current = null;
                void sharedHost.requestDetachedSave({ courseId, lessonId });
            }
        };
    }, [
        courseId,
        finishPendingSave,
        lessonId,
        onEditorContextChange,
        persistBase64,
        promptLogin,
        sharedHost,
        toast,
        useSharedHost,
        user,
    ]);

    // 共享 Host：ready 后按 lesson 热换项目（force）
    useEffect(() => {
        if (!useSharedHost || !sharedHost || !ready) return;

        const key = `${courseId}:${lessonId}`;
        const isFirstBoot = !bootedRef.current;
        const lessonChanged = loadedLessonKeyRef.current !== key;

        if (!isFirstBoot && !lessonChanged) return;

        bootedRef.current = true;
        loadedLessonKeyRef.current = key;

        postToIframe({
            type: "SCRATCH_INIT",
            lessonId,
            playerOnly: false,
        });

        const delay = isFirstBoot ? 300 : 0;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            if (cancelled) return;
            void loadProjectUrl({ force: true });
        }, delay);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [
        courseId,
        lessonId,
        loadProjectUrl,
        postToIframe,
        ready,
        sharedHost,
        useSharedHost,
    ]);

    // 本地 iframe（预览 / 无 Provider）：原有消息协议
    useEffect(() => {
        if (useSharedHost) return;

        const onMessage = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (!isScratchHostMessage(event.data)) return;

            const msg = event.data;
            if (msg.type === "SCRATCH_READY") {
                setLocalReady(true);
                setLocalProjectLoaded(false);
                postToIframe({
                    type: "SCRATCH_INIT",
                    lessonId,
                    playerOnly,
                });
                if (playerOnly) {
                    postToIframe({ type: "RUN_PLAYER_ONLY" });
                }
                window.setTimeout(() => {
                    void loadProjectUrl({ force: true });
                }, 300);
            }
            if (msg.type === "PROJECT_LOADED") {
                setLocalProjectLoaded(msg.ok);
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
            if (msg.type === "EDITOR_CONTEXT" && !playerOnly) {
                onEditorContextChange?.(msg.context);
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [
        finishPendingSave,
        lessonId,
        loadProjectUrl,
        persistBase64,
        playerOnly,
        postToIframe,
        promptLogin,
        onEditorContextChange,
        toast,
        useSharedHost,
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
                courseCompletionState?: "not_complete" | "created" | "already_recorded" | "configuration_error";
            };
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
            const feedback = getLessonCompletionFeedback(data);
            toast({ title: feedback.title, description: feedback.description });
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
            postToIframe({ type: "LOAD_PROJECT_BUFFER", base64, force: true });
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
        const payload = getIframeBlockHintPayload(blockHint);
        postToIframe({
            type: "HIGHLIGHT_BLOCK_KEYWORDS",
            keywords: payload.keywords,
            items: payload.items,
            category: payload.category,
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
                    在手机上的小屏幕较难舒适地使用 Scratch
                    编辑器。请用平板或电脑打开本课，也可以上传已完成的 .sb3 文件交作业。
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
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className="mr-2 h-4 w-4" />
                    上传 .sb3 作品
                </Button>
            </div>
        );
    }

    const busy = saving || completing;
    const blockHintItems = blockHint ? getBlockHintItems(blockHint) : [];
    const blockHintTargetIndex = blockHint
        ? getBlockHintTargetIndex(blockHint, blockHintItems)
        : 0;
    const blockHintCategory = blockHint
        ? getBlockHintCategory(blockHint, blockHintItems)
        : undefined;
    const stepCheckIssue = stepCheckResult?.items.find((item) => item.status !== "complete");
    const StepCheckIcon = stepCheckResult?.status === "complete" ? CheckCircle2 : AlertCircle;
    const showOverlay = !ready || !projectLoaded || switching;
    const overlayMode = ready && (switching || !projectLoaded) ? "switch" : "boot";

    return (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {!playerOnly ? (
                <>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card/95 px-3 py-1.5 backdrop-blur-xs">
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
                        {onCheckCurrentStep ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!ready || !projectLoaded || busy}
                                onClick={onCheckCurrentStep}
                            >
                                <ListChecks className="mr-1 h-4 w-4" />
                                <span className="hidden sm:inline">自检这步</span>
                                <span className="sm:hidden">自检</span>
                            </Button>
                        ) : null}
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
                            <span className="sm:hidden">
                                {completed ? "已完成" : "完成"}
                            </span>
                        </Button>
                        {(loadingProject || !ready || switching) && (
                            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {switching || (ready && !projectLoaded)
                                    ? "切换作品…"
                                    : "加载编辑器…"}
                            </span>
                        )}
                    </div>
                    {stepCheckResult ? (
                        <div
                            className={cn(
                                "flex shrink-0 items-start gap-2 border-b px-3 py-2 text-xs",
                                getStepCheckToneClass(stepCheckResult),
                            )}
                        >
                            <StepCheckIcon
                                className={cn(
                                    "mt-0.5 h-4 w-4 shrink-0",
                                    stepCheckResult.status === "complete"
                                        ? "text-[hsl(var(--brand-green))]"
                                        : "text-[hsl(var(--brand-amber))]",
                                )}
                            />
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-foreground">
                                    {getStepCheckTitle(stepCheckResult)}
                                </div>
                                <p className="mt-0.5 text-muted-foreground">
                                    {getStepCheckDescription(stepCheckResult)}
                                </p>
                                {stepCheckResult.items.some((item) => item.status !== "complete") ? (
                                    <ol className="mt-1.5 grid gap-1 sm:grid-cols-2">
                                        {stepCheckResult.items
                                            .filter((item) => item.status !== "complete")
                                            .slice(0, 4)
                                            .map((item) => (
                                                <li
                                                    key={`${item.originalIndex}-${item.item.findLabel}`}
                                                    className="min-w-0 rounded-sm border border-border/70 bg-background/72 px-2 py-1"
                                                >
                                                    <span className="mr-1 font-semibold text-foreground">
                                                        {getStepCheckItemStatusLabel(item.status)}
                                                    </span>
                                                    <span className="font-medium text-foreground">
                                                        {item.item.findLabel}
                                                    </span>
                                                    <span className="ml-1 text-muted-foreground">
                                                        {item.detail}
                                                    </span>
                                                </li>
                                            ))}
                                    </ol>
                                ) : null}
                            </div>
                            {stepCheckIssue && onFocusStepCheckItem ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="shrink-0"
                                    disabled={!ready || !projectLoaded}
                                    onClick={() => onFocusStepCheckItem(stepCheckIssue.originalIndex)}
                                >
                                    <Target className="mr-1 h-4 w-4" />
                                    <span className="hidden sm:inline">定位下一处</span>
                                    <span className="sm:hidden">定位</span>
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                    {blockHint?.keywords.length ? (
                        <div className="flex shrink-0 items-start gap-2 border-b border-[hsl(var(--brand-amber)/0.28)] bg-[hsl(var(--brand-amber)/0.09)] px-3 py-2 text-xs">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="font-semibold text-foreground">
                                        第 {blockHint.stepIndex + 1} 步要用到
                                    </span>
                                    <span className="text-muted-foreground">
                                        {getBlockHintReasonLabel(blockHint.reason)}
                                        {blockHintItems.length > 1
                                            ? ` · 当前 ${blockHintTargetIndex + 1}/${blockHintItems.length}`
                                            : ""}
                                        {blockHintCategory
                                            ? ` · 已帮你打开${getScratchRichTextCategoryLabel(blockHintCategory) ?? "对应"}分类`
                                            : " · 先找积木，再改文字或数字"}
                                    </span>
                                </div>
                                <ol className="mt-1.5 grid min-w-0 gap-1.5 sm:grid-cols-2">
                                    {blockHintItems.map((item, index) => {
                                        const active = index === blockHintTargetIndex;
                                        return (
                                            <li
                                                key={`${item.findLabel}-${item.editHint ?? ""}-${index}`}
                                                aria-current={active ? "step" : undefined}
                                                className={cn(
                                                    "rounded-sm border px-2.5 py-1.5",
                                                    active
                                                        ? "border-[hsl(var(--brand-amber)/0.55)] bg-background shadow-xs ring-1 ring-[hsl(var(--brand-amber)/0.22)]"
                                                        : "border-[hsl(var(--brand-amber)/0.24)] bg-background/82",
                                                )}
                                            >
                                                <div className="flex min-w-0 items-center gap-1.5">
                                                    <span className="shrink-0 rounded-full bg-[hsl(var(--brand-amber)/0.16)] px-1.5 py-0.5 text-[10px] font-bold text-[hsl(var(--brand-amber))]">
                                                        {active
                                                            ? "正在找"
                                                            : index < blockHintTargetIndex
                                                              ? "已提示"
                                                              : "接着"}
                                                    </span>
                                                    <span className="min-w-0 truncate font-semibold text-foreground">
                                                        {item.findLabel}
                                                    </span>
                                                </div>
                                                {item.findHint ? (
                                                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                                                        {item.findHint}
                                                    </p>
                                                ) : null}
                                                {item.editHint ? (
                                                    <p className="mt-1 text-[11px] font-medium leading-snug text-[hsl(var(--brand-blue))]">
                                                        拖出来后：{item.editHint}
                                                    </p>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ol>
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
                <ScratchLoadingOverlay show={showOverlay} mode={overlayMode} />
                {useSharedHost ? (
                    <div
                        ref={slotRef}
                        className="absolute inset-0 h-full w-full [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0 [&_iframe]:bg-background"
                    />
                ) : (
                    <iframe
                        ref={localIframeRef}
                        title="Scratch 编辑器"
                        src={getScratchHostUrl(playerOnly)}
                        className="absolute inset-0 h-full w-full border-0 bg-background"
                        allow="microphone; camera"
                    />
                )}
            </div>
        </div>
    );
}
