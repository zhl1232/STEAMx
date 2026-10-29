import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LessonCompletionDialog } from "./lesson-completion-dialog";

describe("LessonCompletionDialog", () => {
    afterEach(() => { sessionStorage.clear(); vi.unstubAllGlobals(); });
    it("推荐下一课并显示进度", () => {
        render(<LessonCompletionDialog open onOpenChange={() => {}} courseId={5} result={{ courseCompletionState: "not_complete", courseProgress: { completedLessonCount: 3, totalLessonCount: 10, nextLessonId: 31 } }} />);
        expect(screen.getByText("你完成啦！")).toBeInTheDocument();
        expect(screen.getByText(/3\/10/)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "学下一课" })).toHaveAttribute("href", "/courses/5/lessons/31");
    });

    it("整门课学完时给结课凭证", () => {
        render(<LessonCompletionDialog open onOpenChange={() => {}} courseId={5} result={{ courseCompletionState: "created", courseProgress: { nextLessonId: null } }} />);
        expect(screen.getByRole("link", { name: "看结课凭证" })).toHaveAttribute("href", "/courses/5/certificate");
        expect(screen.queryByRole("link", { name: "学下一课" })).not.toBeInTheDocument();
    });

    it("回到明确选中本课程的目录，下一课仍使用真实课时链接", () => {
        sessionStorage.setItem("courses:mobile-view:v1", JSON.stringify({ selected: 5 }));
        vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
        render(<LessonCompletionDialog open onOpenChange={() => {}} courseId={5} result={{ courseProgress: { nextLessonId: 31 } }} />);
        expect(screen.getByRole("link", { name: "回到课程" })).toHaveAttribute("href", "/courses?course=5");
        expect(screen.getByRole("link", { name: "学下一课" })).toHaveAttribute("href", "/courses/5/lessons/31");
    });
});
