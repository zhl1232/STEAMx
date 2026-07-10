"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from "react";

import {
    SCRATCH_PARENT_SOURCE,
    isScratchHostMessage,
    type ScratchEditorContext,
    type ScratchHostMessage,
} from "@/lib/courses/scratch-messages";

export function getScratchHostUrl(playerOnly: boolean): string {
    const origin =
        typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const base =
        process.env.NEXT_PUBLIC_SCRATCH_HOST_URL || `${origin}/scratch/index.html`;
    const url = new URL(base, origin);
    if (playerOnly) url.searchParams.set("playerOnly", "1");
    else url.searchParams.set("embed", "1");
    return url.toString();
}

export type ScratchHostSaveTarget = {
    courseId: number;
    lessonId: number;
};

export type ScratchHostMessageHandlers = {
    onProjectLoaded?: (msg: Extract<ScratchHostMessage, { type: "PROJECT_LOADED" }>) => void;
    onProjectSaveData?: (
        msg: Extract<ScratchHostMessage, { type: "PROJECT_SAVE_DATA" }>,
    ) => void | Promise<void>;
    onProjectSaved?: (msg: Extract<ScratchHostMessage, { type: "PROJECT_SAVED" }>) => void;
    onEditorContext?: (context: ScratchEditorContext) => void;
};

type ScratchHostContextValue = {
    ready: boolean;
    projectLoaded: boolean;
    setProjectLoaded: (loaded: boolean) => void;
    switching: boolean;
    setSwitching: (switching: boolean) => void;
    postToIframe: (message: Record<string, unknown>) => void;
    /** 把共享 iframe 挂到课时工作区槽位；传 null 时收回隐藏容器（不销毁） */
    registerSlot: (el: HTMLElement | null) => void;
    /** 激活共享 Host（首次进入 Scratch 课时才创建 iframe） */
    activate: () => void;
    subscribe: (handlers: ScratchHostMessageHandlers) => () => void;
    /**
     * 切课卸载时：登记静默保存目标并请求导出。
     * 返回 Promise，下一课 LOAD_PROJECT 前应 await，避免保存到错误课时。
     */
    requestDetachedSave: (target: ScratchHostSaveTarget) => Promise<void>;
    /** 等待进行中的静默保存结束 */
    waitForPendingSave: () => Promise<void>;
    iframeRef: RefObject<HTMLIFrameElement | null>;
};

const ScratchHostContext = createContext<ScratchHostContextValue | null>(null);

export function useScratchHost(): ScratchHostContextValue | null {
    return useContext(ScratchHostContext);
}

async function uploadSb3ToLesson(
    courseId: number,
    lessonId: number,
    base64: string,
): Promise<boolean> {
    try {
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
        return res.ok;
    } catch {
        return false;
    }
}

export function ScratchHostProvider({ children }: { children: ReactNode }) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const hiddenHostRef = useRef<HTMLDivElement | null>(null);
    const handlersRef = useRef<ScratchHostMessageHandlers | null>(null);
    const detachedSaveTargetRef = useRef<ScratchHostSaveTarget | null>(null);
    const pendingSaveRef = useRef<Promise<void> | null>(null);
    const pendingSaveResolveRef = useRef<(() => void) | null>(null);

    const [activated, setActivated] = useState(false);
    const [ready, setReady] = useState(false);
    const [projectLoaded, setProjectLoaded] = useState(false);
    const [switching, setSwitching] = useState(false);
    const [slot, setSlot] = useState<HTMLElement | null>(null);

    const activate = useCallback(() => {
        setActivated(true);
    }, []);

    const registerSlot = useCallback((el: HTMLElement | null) => {
        setSlot(el);
        if (el) setActivated(true);
    }, []);

    const postToIframe = useCallback((message: Record<string, unknown>) => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        win.postMessage({ ...message, source: SCRATCH_PARENT_SOURCE }, window.location.origin);
    }, []);

    const finishPendingSave = useCallback(() => {
        pendingSaveResolveRef.current?.();
        pendingSaveResolveRef.current = null;
        pendingSaveRef.current = null;
        detachedSaveTargetRef.current = null;
    }, []);

    const waitForPendingSave = useCallback(async () => {
        if (pendingSaveRef.current) {
            await pendingSaveRef.current;
        }
    }, []);

    const requestDetachedSave = useCallback(
        (target: ScratchHostSaveTarget): Promise<void> => {
            if (!ready) {
                return Promise.resolve();
            }
            // 已有进行中的静默保存：等完成后再为新目标开一次，禁止覆盖上传目标
            if (pendingSaveRef.current) {
                return pendingSaveRef.current.then(() => requestDetachedSave(target));
            }

            detachedSaveTargetRef.current = target;
            let resolve!: () => void;
            const promise = new Promise<void>((res) => {
                resolve = res;
            });
            pendingSaveResolveRef.current = resolve;
            pendingSaveRef.current = promise;

            postToIframe({ type: "SAVE_PROJECT" });

            // 超时兜底，避免卡住下一课加载
            window.setTimeout(() => {
                if (pendingSaveRef.current === promise) {
                    finishPendingSave();
                }
            }, 12000);

            return promise;
        },
        [finishPendingSave, postToIframe, ready],
    );

    const subscribe = useCallback((handlers: ScratchHostMessageHandlers) => {
        handlersRef.current = handlers;
        return () => {
            if (handlersRef.current === handlers) {
                handlersRef.current = null;
            }
        };
    }, []);

    useLayoutEffect(() => {
        const iframe = iframeRef.current;
        const hidden = hiddenHostRef.current;
        if (!iframe || !hidden) return;
        const target = slot ?? hidden;
        if (iframe.parentElement !== target) {
            target.appendChild(iframe);
        }
    }, [slot, activated]);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (!isScratchHostMessage(event.data)) return;

            const msg = event.data;
            const handlers = handlersRef.current;

            if (msg.type === "SCRATCH_READY") {
                setReady(true);
                setProjectLoaded(false);
                return;
            }
            if (msg.type === "PROJECT_LOADED") {
                setProjectLoaded(msg.ok);
                setSwitching(false);
                handlers?.onProjectLoaded?.(msg);
                return;
            }
            if (msg.type === "PROJECT_SAVED") {
                if (pendingSaveRef.current && !msg.ok) {
                    finishPendingSave();
                }
                handlers?.onProjectSaved?.(msg);
                return;
            }
            if (msg.type === "PROJECT_SAVE_DATA" && msg.base64) {
                // 切课静默保存优先：即使下一课已 subscribe，也先落到上一课
                const detached = detachedSaveTargetRef.current;
                if (detached && pendingSaveRef.current) {
                    const target = detached;
                    void uploadSb3ToLesson(target.courseId, target.lessonId, msg.base64).then(
                        (ok) => {
                            postToIframe({ type: "PROJECT_SAVED", ok });
                            finishPendingSave();
                        },
                    );
                    return;
                }
                if (handlers?.onProjectSaveData) {
                    void handlers.onProjectSaveData(msg);
                    return;
                }
                return;
            }
            if (msg.type === "EDITOR_CONTEXT") {
                handlers?.onEditorContext?.(msg.context);
            }
        };

        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [finishPendingSave, postToIframe]);

    const value = useMemo<ScratchHostContextValue>(
        () => ({
            ready,
            projectLoaded,
            setProjectLoaded,
            switching,
            setSwitching,
            postToIframe,
            registerSlot,
            activate,
            subscribe,
            requestDetachedSave,
            waitForPendingSave,
            iframeRef,
        }),
        [
            activate,
            postToIframe,
            projectLoaded,
            ready,
            registerSlot,
            requestDetachedSave,
            subscribe,
            switching,
            waitForPendingSave,
        ],
    );

    return (
        <ScratchHostContext.Provider value={value}>
            {children}
            <div
                ref={hiddenHostRef}
                className="pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden opacity-0"
                aria-hidden
            >
                {activated ? (
                    <iframe
                        ref={iframeRef}
                        title="Scratch 编辑器"
                        src={getScratchHostUrl(false)}
                        className="h-full w-full border-0 bg-background"
                        allow="microphone; camera"
                    />
                ) : null}
            </div>
        </ScratchHostContext.Provider>
    );
}
