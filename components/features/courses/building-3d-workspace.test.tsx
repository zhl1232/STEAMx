import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";

import { Building3DWorkspace } from "./building-3d-workspace";
import type { CourseLessonRow } from "@/lib/courses/types";

const mocks = vi.hoisted(() => ({
    toast: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
    default: () => () => null,
}));

vi.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/context/auth-context", () => ({
    useAuth: () => ({ user: null }),
}));

vi.mock("@/lib/context/login-prompt-context", () => ({
    useLoginPrompt: () => ({ promptLogin: vi.fn() }),
}));

const baseLesson: CourseLessonRow = {
    id: 42,
    course_id: 7,
    title: "救援车",
    lesson_type: "building_3d",
    content: {
        workSubmission: { enabled: false },
        building3d: {
            slideImageUrls: Array.from(
                { length: 10 },
                (_, index) => `/slides/rescue-${index + 1}.webp`,
            ),
            parts: [],
            steps3d: [
                {
                    title: "搭建底盘",
                    description: "先搭好稳定的底盘。",
                    partIds: [],
                },
            ],
        },
    },
    steps: [],
    resources: [],
    starter_project_path: null,
    sort_order: 1,
    duration_minutes: 30,
    created_at: "2026-07-24T00:00:00.000Z",
    updated_at: "2026-07-24T00:00:00.000Z",
};

const YELLOW_2X4 = {
    partId: "3011.dat",
    partName: "2×4 积木",
    partDescription: "Duplo Brick  2 x  4",
    colorCode: 14,
    colorName: "黄色",
    colorHex: "#FAC80A",
    count: 2,
};
const BLUE_2X2 = {
    partId: "3437.dat",
    partName: "2×2 积木",
    partDescription: "Duplo Brick  2 x  2",
    colorCode: 1,
    colorName: "蓝色",
    colorHex: "#1E5AA8",
    count: 1,
};
/** 两步模型：第 1 步黄色 2×4 ×2，第 2 步蓝色 2×2 ×1。 */
const BOM_FIXTURE = {
    stepCount: 2,
    partCount: 3,
    kindCount: 2,
    steps: [
        { stepIndex: 0, partCount: 2, entries: [YELLOW_2X4] },
        { stepIndex: 1, partCount: 1, entries: [BLUE_2X2] },
    ],
    entries: [YELLOW_2X4, BLUE_2X2],
};

function stubBomFetch(bom: unknown = BOM_FIXTURE) {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
            url.includes("/api/courses/ldraw-bom")
                ? { ok: true, json: () => Promise.resolve(bom) }
                : {
                    ok: true,
                    text: () => Promise.resolve(""),
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

function ldrawLesson(stepTitles: string[]): CourseLessonRow {
    return {
        ...baseLesson,
        content: {
            ...baseLesson.content,
            building3d: {
                ...baseLesson.content?.building3d,
                ldrawModelUrl: "/courses/ldraw/rescue-car.mpd",
                parts: [],
                steps3d: stepTitles.map((title) => ({ title, description: `${title}。`, partIds: [] })),
            },
        },
    };
}

function renderWorkspace(lesson = baseLesson, activeStepIndex = 0) {
    return render(
        <Building3DWorkspace
            courseId={7}
            lesson={lesson}
            activeStepIndex={activeStepIndex}
            onStepChange={vi.fn()}
        />,
    );
}

function VoiceControlsProbe({ onMount, onRelease }: { onMount: () => void; onRelease: () => void }) {
    const [listening, setListening] = useState(false);
    useEffect(() => {
        onMount();
        return onRelease;
    }, [onMount, onRelease]);
    return (
        <div data-testid="voice-controls-slot">
            <button type="button" onClick={() => setListening((value) => !value)}>
                {listening ? "暂停语音监听" : "开启语音监听"}
            </button>
        </div>
    );
}

describe("Building3DWorkspace", () => {
    beforeEach(() => {
        mocks.toast.mockReset();
        vi.unstubAllGlobals();
    });

    it("preloads the next visible slide", () => {
        renderWorkspace();

        expect(
            document.querySelector(
                'link[rel="preload"][as="image"][href="/slides/rescue-4.webp"]',
            ),
        ).toBeInTheDocument();
    });

    it("prefetches the first LDraw step as soon as a future build page exists", async () => {
        const arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer });
        vi.stubGlobal("fetch", fetchMock);
        const lesson: CourseLessonRow = {
            ...baseLesson,
            content: {
                ...baseLesson.content,
                building3d: {
                    ...baseLesson.content?.building3d,
                    ldrawModelUrl: "/courses/ldraw/rescue-car.mpd",
                    parts: [],
                    steps3d: [
                        {
                            title: "搭建底盘",
                            description: "先搭好稳定的底盘。",
                            partIds: [],
                        },
                    ],
                },
            },
        };

        renderWorkspace(lesson, 0);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                "/api/courses/ldraw-step?model=rescue-car.mpd&step=0",
                expect.objectContaining({ cache: "force-cache" }),
            );
        });
        expect(arrayBuffer).toHaveBeenCalledOnce();
    });

    it("shows the per-step piece count and the whole-model part list from the model BOM", async () => {
        const fetchMock = stubBomFetch();
        const lesson = ldrawLesson(["搭建底盘", "装上车轮"]);

        // 索引 4 是替换课件后的第一个搭建页。
        const { unmount } = renderWorkspace(lesson, 4);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                "/api/courses/ldraw-bom?model=rescue-car.mpd",
                expect.objectContaining({ cache: "force-cache" }),
            );
        });
        expect(await screen.findByText("2 块")).toBeInTheDocument();
        const stepParts = within(document.getElementById("building-3d-step-parts")!);
        expect(stepParts.getByText("黄色2×4 积木")).toBeInTheDocument();
        expect(stepParts.getByText("×2")).toBeInTheDocument();
        const thumbnail = document.getElementById("building-3d-step-parts")!.querySelector("img");
        expect(thumbnail).toHaveAttribute("src", expect.stringContaining("/courses/part-thumbs/"));
        expect(thumbnail).toHaveAttribute("alt", "");
        expect(screen.getByText("清晰轮廓为本步新增")).toBeInTheDocument();

        // 搭建开始处默认展开整套零件清单
        const allParts = screen.getByRole("button", { name: /全部零件/ });
        expect(allParts).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByText("2 种 · 3 块")).toBeInTheDocument();
        expect(
            within(document.getElementById("building-3d-all-parts")!).getByText("蓝色2×2 积木"),
        ).toBeInTheDocument();

        fireEvent.click(allParts);
        expect(allParts).toHaveAttribute("aria-expanded", "false");
        expect(document.getElementById("building-3d-all-parts")).toBeNull();
        unmount();

        renderWorkspace(lesson, 5);

        expect(await screen.findByText("1 块")).toBeInTheDocument();
        expect(
            within(document.getElementById("building-3d-step-parts")!).getByText("蓝色2×2 积木"),
        ).toBeInTheDocument();
        // 后续步骤只留总量，清单默认收起
        expect(screen.getByRole("button", { name: /全部零件/ })).toHaveAttribute(
            "aria-expanded",
            "false",
        );
        expect(document.getElementById("building-3d-all-parts")).toBeNull();
    });

    it("keeps the fetched part list when paging out of and back into the build section", async () => {
        const fetchMock = stubBomFetch();
        const lesson = ldrawLesson(["搭建底盘", "装上车轮"]);
        const bomCalls = () =>
            fetchMock.mock.calls.filter((call) => String(call[0]).includes("ldraw-bom")).length;

        const { rerender } = renderWorkspace(lesson, 4);
        await waitFor(() => expect(bomCalls()).toBe(1));

        const at = (activeStepIndex: number) =>
            rerender(
                <Building3DWorkspace
                    courseId={7}
                    lesson={lesson}
                    activeStepIndex={activeStepIndex}
                    onStepChange={vi.fn()}
                />,
            );

        // 索引 6 已翻过搭建区，再翻回来不该重新拉清单。
        at(6);
        at(4);

        expect(await screen.findByText("2 块")).toBeInTheDocument();
        expect(bomCalls()).toBe(1);
    });

    it("does not repeat the last step's parts on wrap-up steps the model does not cover", async () => {
        stubBomFetch();
        // 课时比模型多一步「完成」，若沿用上一步清单，家长会把蓝色 2×2 配两遍。
        const lesson = ldrawLesson(["搭建底盘", "装上车轮", "完成救援车"]);

        renderWorkspace(lesson, 6);

        expect(await screen.findByText("0 块")).toBeInTheDocument();
        expect(document.getElementById("building-3d-step-parts")).toBeNull();
        expect(screen.getByText(/这一步模型里没有新增零件/)).toBeInTheDocument();
        expect(screen.queryByText("清晰轮廓为本步新增")).not.toBeInTheDocument();
        expect(screen.queryByText("蓝色2×2 积木")).not.toBeInTheDocument();
        // 总清单仍然可查
        expect(screen.getByText("2 种 · 3 块")).toBeInTheDocument();
    });

    it("keeps course progress in the footer and labels the build header separately", async () => {
        stubBomFetch();
        renderWorkspace(ldrawLesson(["搭建底盘", "装上车轮"]), 4);

        expect(await screen.findByText(/课程 5\/\d+ 页/)).toBeInTheDocument();
        expect(screen.getByText("搭建 1/2 步")).toBeInTheDocument();
    });

    it("shows a retry state when an embedded slide video fails", () => {
        const lesson: CourseLessonRow = {
            ...baseLesson,
            content: {
                ...baseLesson.content,
                building3d: {
                    ...baseLesson.content?.building3d,
                    videoSlideIndex: 1,
                    videoUrl: "/slides/rescue.mp4",
                    parts: [],
                    steps3d: baseLesson.content?.building3d?.steps3d ?? [],
                },
            },
        };

        renderWorkspace(lesson);
        const video = document.querySelector("video");
        expect(video).toBeInTheDocument();
        fireEvent.error(video!);
        expect(screen.getByText("视频加载失败")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "重试" }));
        expect(screen.queryByText("视频加载失败")).not.toBeInTheDocument();
        expect(document.querySelector("video")).toHaveAttribute("src", "/slides/rescue.mp4");
    });

    it("retries a failed slide without losing course navigation", () => {
        renderWorkspace();
        fireEvent.error(screen.getByRole("img", { name: "认识救援车" }));
        expect(screen.getByRole("alert")).toHaveTextContent("课件图片加载失败");
        expect(screen.getByRole("button", { name: "下一页" })).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "重试" }));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("img", { name: "认识救援车" })).toHaveAttribute("src", "/slides/rescue-1.webp");
    });

    it("starts with the whole-model list collapsed on mobile, while keeping it accessible", async () => {
        vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => ({
            matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        })));
        stubBomFetch();
        renderWorkspace(ldrawLesson(["搭建底盘", "装上车轮"]), 4);
        const disclosure = await screen.findByRole("button", { name: /全部零件/ });
        expect(disclosure).toHaveAttribute("aria-expanded", "false");
        expect(document.getElementById("building-3d-all-parts")).not.toBeInTheDocument();
        fireEvent.click(disclosure);
        expect(disclosure).toHaveAttribute("aria-expanded", "true");
        expect(document.getElementById("building-3d-all-parts")).toHaveTextContent("蓝色2×2 积木");
    });

    it("exits fallback immersion with Escape and restores scrolling", () => {
        const fullscreenDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "requestFullscreen");
        const scrollDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: undefined });
        Object.defineProperty(window, "scrollY", { configurable: true, value: 180 });
        const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
        const originalOverflow = document.body.style.overflow;
        try {
            renderWorkspace();
            fireEvent.click(screen.getByRole("button", { name: "全屏横向展示" }));
            expect(document.body.style.overflow).toBe("hidden");
            expect(screen.getByRole("button", { name: "退出全屏" })).toBeInTheDocument();
            fireEvent.keyDown(document, { key: "Escape" });
            expect(screen.queryByRole("button", { name: "退出全屏" })).not.toBeInTheDocument();
            expect(document.body.style.overflow).toBe(originalOverflow);
            expect(scrollTo).toHaveBeenCalledWith({ top: 180, behavior: "auto" });
        } finally {
            scrollTo.mockRestore();
            if (fullscreenDescriptor) Object.defineProperty(HTMLElement.prototype, "requestFullscreen", fullscreenDescriptor);
            else Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
            if (scrollDescriptor) Object.defineProperty(window, "scrollY", scrollDescriptor);
            else Reflect.deleteProperty(window, "scrollY");
        }
    });

    it("keeps the mic hidden until readiness without moving the reserved slot, and preserves menu entries", () => {
        const VoiceProbe = ({ onAvailabilityChange }: { onAvailabilityChange?: (ready: boolean) => void }) => (
            <button data-testid="voice-probe" onClick={() => onAvailabilityChange?.(true)}>ready probe</button>
        );
        const Menu = ({ mobileExtras }: { mobileExtras?: { key: string; label: string; onSelect?: () => void }[] }) => (
            <div data-testid="menu-probe">{mobileExtras?.map((extra) => <button key={extra.key} type="button" onClick={extra.onSelect}>{extra.label}</button>)}</div>
        );
        const lesson = { ...baseLesson, content: { ...baseLesson.content, workSubmission: { enabled: true } } };
        render(
            <Building3DWorkspace
                courseId={7}
                lesson={lesson}
                activeStepIndex={0}
                onStepChange={vi.fn()}
                navigationSlot={<Menu />}
                voiceControlsSlot={<VoiceProbe />}
            />,
        );
        const wrapper = screen.getByTestId("voice-probe").closest("[data-voice-slot-wrapper]");
        expect(wrapper).toHaveClass("hidden");
        expect(screen.queryByTestId("voice-toggle")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "语音设置" }));
        fireEvent.click(screen.getByTestId("voice-probe"));
        expect(wrapper).not.toHaveClass("hidden");
        expect(screen.getByTestId("voice-toggle")).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(screen.getByRole("button", { name: "看看大家的作品" }));
        expect(screen.getByRole("button", { name: /回到课程/ })).toBeInTheDocument();
    });

    it("pages with arrow keys and ignores keys typed in inputs", () => {
        const onStepChange = vi.fn();
        render(<Building3DWorkspace courseId={7} lesson={baseLesson} activeStepIndex={1} onStepChange={onStepChange} />);
        fireEvent.keyDown(window, { key: "ArrowRight" });
        expect(onStepChange).toHaveBeenLastCalledWith(2);
        fireEvent.keyDown(window, { key: "ArrowLeft" });
        expect(onStepChange).toHaveBeenLastCalledWith(0);
        const input = document.createElement("input");
        document.body.appendChild(input);
        onStepChange.mockClear();
        fireEvent.keyDown(input, { key: "ArrowRight" });
        expect(onStepChange).not.toHaveBeenCalled();
        input.remove();
    });

    it("hides all chrome in slide fullscreen and shows controls only on demand", async () => {
        render(
            <Building3DWorkspace
                courseId={7}
                lesson={baseLesson}
                activeStepIndex={0}
                onStepChange={vi.fn()}
                voiceControlsSlot={<div data-testid="voice-probe" />}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "全屏横向展示" }));
        const overlay = await screen.findByTestId("immersive-overlay");
        expect(overlay).toHaveAttribute("data-visible", "false");
        expect(screen.queryByRole("button", { name: "下一页" })).not.toBeNull();
        expect(screen.getByTestId("voice-probe").closest("[data-voice-slot-wrapper]")).toHaveClass("hidden");
        expect(screen.queryByText(/^课程 \d+\/\d+ 页$/)).toBeNull();
    });

    it.each([true, false])("opens 3D controls and parts only on request (mobile: %s)", async (mobile) => {
        vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => ({
            matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        })));
        stubBomFetch();
        const onStepChange = vi.fn();
        render(<Building3DWorkspace courseId={7} lesson={ldrawLesson(["搭建底盘", "安装车轮"])} activeStepIndex={4} onStepChange={onStepChange} />);
        fireEvent.click(screen.getByRole("button", { name: "全屏横向展示" }));
        expect(screen.queryByRole("region", { name: "搭建操作" })).toBeNull();
        expect(screen.queryByText(/^课程 \d+\/\d+ 页$/)).toBeNull();
        expect(screen.getByTestId("build-parts-panel")).toHaveClass("hidden");

        fireEvent.click(screen.getByRole("button", { name: "搭建操作" }));
        const controls = screen.getByRole("region", { name: "搭建操作" });
        fireEvent.click(within(controls).getByRole("button", { name: "下一页" }));
        expect(onStepChange).toHaveBeenCalledWith(5);
        fireEvent.click(within(controls).getByRole("button", { name: /本步零件/ }));
        expect(screen.queryByRole("region", { name: "搭建操作" })).toBeNull();
        expect(screen.getByTestId("build-parts-panel")).not.toHaveClass("hidden");
        expect(screen.getByRole("button", { name: "收起零件" })).toHaveFocus();
        fireEvent.click(screen.getByRole("button", { name: "收起零件" }));
        expect(screen.getByTestId("build-parts-panel")).toHaveClass("hidden");
        expect(screen.getByRole("button", { name: "搭建操作" })).toHaveFocus();
    });

    it.each(["button", "escape", "native"])("clears 3D panels after %s exit and reentry", async (exitPath) => {
        const requestDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "requestFullscreen");
        const elementDescriptor = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
            configurable: true, value: exitPath === "native" ? vi.fn().mockResolvedValue(undefined) : undefined,
        });
        Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
        stubBomFetch();
        try {
            renderWorkspace(ldrawLesson(["搭建底盘", "安装车轮"]), 4);
            for (let attempt = 0; attempt < 2; attempt += 1) {
                fireEvent.click(screen.getByRole("button", { name: "全屏横向展示" }));
                expect(screen.queryByRole("region", { name: "搭建操作" })).toBeNull();
                expect(screen.getByTestId("build-parts-panel")).toHaveClass("hidden");
                fireEvent.click(screen.getByRole("button", { name: "搭建操作" }));
                fireEvent.click(screen.getByRole("button", { name: /本步零件/ }));
                expect(screen.getByTestId("build-parts-panel")).not.toHaveClass("hidden");

                if (exitPath === "button") fireEvent.click(screen.getByRole("button", { name: "关闭全屏" }));
                else if (exitPath === "escape") fireEvent.keyDown(document, { key: "Escape" });
                else fireEvent(document, new Event("fullscreenchange"));
                expect(document.body.style.overflow).not.toBe("hidden");
                expect(screen.queryByRole("button", { name: "关闭全屏" })).toBeNull();
            }
        } finally {
            if (requestDescriptor) Object.defineProperty(HTMLElement.prototype, "requestFullscreen", requestDescriptor);
            else Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
            if (elementDescriptor) Object.defineProperty(document, "fullscreenElement", elementDescriptor);
            else Reflect.deleteProperty(document, "fullscreenElement");
        }
    });

    it("does not reopen 3D when a native fullscreen request completes after closing", async () => {
        const requestDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "requestFullscreen");
        const exitDescriptor = Object.getOwnPropertyDescriptor(document, "exitFullscreen");
        const elementDescriptor = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
        let resolveRequest!: () => void;
        let fullscreenElement: Element | null = null;
        const request = vi.fn(() => new Promise<void>((resolve) => { resolveRequest = resolve; }));
        const exit = vi.fn(async () => { fullscreenElement = null; });
        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: request });
        Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
        Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
        stubBomFetch();
        try {
            renderWorkspace(ldrawLesson(["搭建底盘"]), 4);
            const enter = screen.getByRole("button", { name: "全屏横向展示" });
            const workspace = enter.closest("section");
            fireEvent.click(enter);
            expect(request).toHaveBeenCalledWith({ navigationUI: "hide" });
            fireEvent.click(screen.getByRole("button", { name: "关闭全屏" }));
            await act(async () => {
                fullscreenElement = workspace;
                document.dispatchEvent(new Event("fullscreenchange"));
                resolveRequest();
            });
            expect(exit).toHaveBeenCalledOnce();
            expect(screen.queryByRole("button", { name: "关闭全屏" })).toBeNull();
            expect(document.body.style.overflow).not.toBe("hidden");
        } finally {
            for (const [target, key, descriptor] of [
                [HTMLElement.prototype, "requestFullscreen", requestDescriptor],
                [document, "exitFullscreen", exitDescriptor],
                [document, "fullscreenElement", elementDescriptor],
            ] as const) {
                if (descriptor) Object.defineProperty(target, key, descriptor);
                else Reflect.deleteProperty(target, key);
            }
        }
    });

    it("keeps the voice slot inside fullscreen without remounting and releases it when viewing works", async () => {
        const fullscreenDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "requestFullscreen");
        const requestFullscreen = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: requestFullscreen });
        const onMount = vi.fn();
        const onRelease = vi.fn();
        const lesson = {
            ...baseLesson,
            content: { ...baseLesson.content, workSubmission: { enabled: true } },
        };
        try {
            render(
                <Building3DWorkspace
                    courseId={7}
                    lesson={lesson}
                    activeStepIndex={0}
                    onStepChange={vi.fn()}
                    voiceControlsSlot={<VoiceControlsProbe onMount={onMount} onRelease={onRelease} />}
                />,
            );
            const slot = screen.getByTestId("voice-controls-slot");
            const workspace = slot.closest("section");
            expect(workspace).toBe(screen.getByRole("button", { name: "全屏横向展示" }).closest("section"));
            expect(slot.closest("[data-voice-slot-wrapper]")?.previousElementSibling).toContainElement(screen.getByRole("button", { name: "全屏横向展示" }));
            fireEvent.click(screen.getByRole("button", { name: "开启语音监听" }));
            fireEvent.click(screen.getByRole("button", { name: "全屏横向展示" }));
            await waitFor(() => expect(requestFullscreen).toHaveBeenCalledOnce());
            expect(requestFullscreen.mock.contexts[0]).toBe(workspace);
            expect(workspace).toHaveClass("fixed", "z-[100]");
            expect(screen.getByTestId("voice-controls-slot")).toBe(slot);
            expect(screen.getByRole("button", { name: "暂停语音监听" })).toBeInTheDocument();
            expect(onMount).toHaveBeenCalledOnce();
            expect(onRelease).not.toHaveBeenCalled();

            fireEvent.click(screen.getByRole("button", { name: "退出全屏" }));
            expect(screen.getByTestId("voice-controls-slot")).toBe(slot);
            expect(onMount).toHaveBeenCalledOnce();
            expect(onRelease).not.toHaveBeenCalled();

            fireEvent.click(screen.getByRole("button", { name: /^作品$/ }));
            expect(screen.queryByTestId("voice-controls-slot")).not.toBeInTheDocument();
            expect(onRelease).toHaveBeenCalledOnce();
            fireEvent.click(screen.getByRole("button", { name: "课程内容" }));
            expect(screen.getByRole("button", { name: "开启语音监听" })).toBeInTheDocument();
            expect(onMount).toHaveBeenCalledTimes(2);
        } finally {
            if (fullscreenDescriptor) Object.defineProperty(HTMLElement.prototype, "requestFullscreen", fullscreenDescriptor);
            else Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
        }
    });

    it("enters fullscreen landscape mode from the mobile control", async () => {
        const requestFullscreen = vi.fn().mockResolvedValue(undefined);
        const lock = vi.fn().mockResolvedValue(undefined);
        const unlock = vi.fn();
        const fullscreenDescriptor = Object.getOwnPropertyDescriptor(
            HTMLElement.prototype,
            "requestFullscreen",
        );
        const orientationDescriptor = Object.getOwnPropertyDescriptor(
            window.screen,
            "orientation",
        );
        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
            configurable: true,
            value: requestFullscreen,
        });
        Object.defineProperty(window.screen, "orientation", {
            configurable: true,
            value: { lock, unlock },
        });
        vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
            matches: query.includes("max-width"),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })));

        const { unmount } = renderWorkspace();
        fireEvent.click(screen.getByRole("button", { name: "全屏横向展示" }));

        await waitFor(() => {
            expect(requestFullscreen).toHaveBeenCalledOnce();
            expect(lock).toHaveBeenCalledWith("landscape");
        });
        const exitButton = screen.getByRole("button", { name: "退出全屏" });
        expect(exitButton.closest("section")).toHaveClass("fixed", "h-dvh", "w-dvw");

        fireEvent(document, new Event("fullscreenchange"));
        expect(screen.queryByRole("button", { name: "退出全屏" })).not.toBeInTheDocument();
        expect(unlock).toHaveBeenCalled();

        unmount();
        if (fullscreenDescriptor) {
            Object.defineProperty(
                HTMLElement.prototype,
                "requestFullscreen",
                fullscreenDescriptor,
            );
        } else {
            Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
        }
        if (orientationDescriptor) {
            Object.defineProperty(window.screen, "orientation", orientationDescriptor);
        } else {
            Reflect.deleteProperty(window.screen, "orientation");
        }
    });
});
