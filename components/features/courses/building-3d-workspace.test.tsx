import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
