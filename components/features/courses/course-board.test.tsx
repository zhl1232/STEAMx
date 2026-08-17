import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CourseListItem } from "@/lib/courses/types";

import { CourseBoard, isBrickCourse, partitionCourseGroups } from "./course-board";

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

vi.mock("@/components/ui/optimized-image", () => ({
    OptimizedImage: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

function makeCourse(overrides: Partial<CourseListItem> = {}): CourseListItem {
    return {
        id: 1,
        title: "示例课程",
        description: "跟着步骤完成一个小作品。",
        image_url: null,
        tags: [],
        difficulty_stars: 1,
        status: "approved",
        sort_order: 1,
        steam_weights: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        lesson_count: 8,
        progress: null,
        ...overrides,
    };
}

describe("course board groups", () => {
    it("recognizes brick courses from their existing tags", () => {
        expect(isBrickCourse(makeCourse({ tags: ["乐高", "得宝"] }))).toBe(true);
        expect(isBrickCourse(makeCourse({ tags: ["Scratch", "编程"] }))).toBe(false);
        expect(isBrickCourse(makeCourse({ tags: null }))).toBe(false);
    });

    it("keeps brick courses in the recommended group and preserves order", () => {
        const courses = [
            makeCourse({ id: 1, title: "Scratch" }),
            makeCourse({ id: 2, title: "小班积木", tags: ["乐高", "得宝"] }),
            makeCourse({ id: 3, title: "五子棋", tags: ["五子棋"] }),
            makeCourse({ id: 4, title: "中班积木", tags: ["乐高", "得宝"] }),
        ];

        const groups = partitionCourseGroups(courses);

        expect(groups.brick.map((course) => course.id)).toEqual([2, 4]);
        expect(groups.other.map((course) => course.id)).toEqual([1, 3]);
    });

    it("renders the mainline and other-skill sections without a generic course badge", () => {
        render(
            <CourseBoard
                courses={[
                    makeCourse({ id: 1, title: "小班积木", tags: ["乐高", "得宝"] }),
                    makeCourse({ id: 2, title: "Scratch", tags: ["Scratch", "编程"] }),
                ]}
            />,
        );

        expect(screen.getByRole("heading", { name: "积木搭建" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "其他技能" })).toBeInTheDocument();
        expect(screen.getByText("推荐起步")).toBeInTheDocument();
        expect(screen.getByText("继续探索")).toBeInTheDocument();
        expect(screen.queryByText("课程", { exact: true })).not.toBeInTheDocument();
    });

    it("uses one fallback section when no brick courses are available", () => {
        render(<CourseBoard courses={[makeCourse({ title: "Scratch", tags: ["Scratch"] })]} />);

        expect(screen.getByRole("heading", { name: "技能课程" })).toBeInTheDocument();
        expect(screen.getByText("全部课程")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "积木搭建" })).not.toBeInTheDocument();
        expect(screen.queryByText("其他技能")).not.toBeInTheDocument();
    });

    it("keeps the empty state when the approved course list is empty", () => {
        render(<CourseBoard courses={[]} />);

        expect(screen.getByText("技能课程即将上线，敬请期待。"))
            .toBeInTheDocument();
    });
});
