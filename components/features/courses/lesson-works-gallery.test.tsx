import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LessonWorksGallery } from "./lesson-works-gallery";

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

vi.mock("@/components/features/courses/lesson-work-upload", () => ({
    LessonWorkUpload: ({ onUploaded }: { onUploaded?: () => void }) => (
        <button type="button" onClick={onUploaded}>上传我的作品</button>
    ),
}));

function response(works: unknown[]) {
    return { ok: true, json: async () => ({ works }) };
}

describe("LessonWorksGallery", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("shows loading before settling on the empty state", async () => {
        let resolve: ((value: unknown) => void) | undefined;
        vi.stubGlobal("fetch", vi.fn(() => new Promise((done) => { resolve = done; })));

        render(<LessonWorksGallery courseId={1} lessonId={2} lessonTitle="小车" />);

        expect(screen.getByText("正在加载作品")).toBeInTheDocument();
        resolve?.(response([]));
        expect(await screen.findByText("还没有作品")).toBeInTheDocument();
    });

    it("retries a failed request and renders the returned work", async () => {
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce(response([{ id: 9, author: "小明", proofImages: [], likes: 0 }]));
        vi.stubGlobal("fetch", fetchMock);

        render(<LessonWorksGallery courseId={1} lessonId={2} lessonTitle="小车" />);

        expect(await screen.findByText("作品加载失败")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
        expect((await screen.findByText("小明")).closest("a")).toHaveAttribute("href", "/works/9");
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("refreshes the gallery after a new work is uploaded", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(response([]))
            .mockResolvedValueOnce(response([{ id: 10, author: "小红", proofImages: [], likes: 0 }]));
        vi.stubGlobal("fetch", fetchMock);

        render(<LessonWorksGallery courseId={1} lessonId={2} lessonTitle="小车" />);

        expect(await screen.findByText("还没有作品")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "上传我的作品" }));
        expect((await screen.findByText("小红")).closest("a")).toHaveAttribute("href", "/works/10");
    });
});
