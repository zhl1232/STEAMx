import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LessonCompletionDialog } from "./lesson-completion-dialog";

describe("LessonCompletionDialog", () => {
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
});
