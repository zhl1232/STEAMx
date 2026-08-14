import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
        expect(screen.queryByText("蓝色2×2 积木")).not.toBeInTheDocument();
        // 总清单仍然可查
        expect(screen.getByText("2 种 · 3 块")).toBeInTheDocument();
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

        const { unmount } = renderWorkspace();
        fireEvent.click(screen.getByRole("button", { name: "全屏横向展示" }));

        await waitFor(() => {
            expect(requestFullscreen).toHaveBeenCalledOnce();
            expect(lock).toHaveBeenCalledWith("landscape");
        });
        const exitButton = screen.getByRole("button", { name: "退出全屏" });
        expect(exitButton.closest("section")).toHaveClass("fixed", "h-dvh", "w-dvw");

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
