import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CourseLessonCatalog } from "./course-lesson-catalog";
import type { LessonCatalogItem } from "@/lib/courses/lesson-catalog";

vi.mock("@/components/ui/optimized-image", () => ({
  OptimizedImage: ({ src, alt, onError }: { src?: string; alt?: string; onError?: React.ReactEventHandler }) => {
    // oxlint-disable-next-line next/no-img-element
    return <img data-testid="optimized-image" src={src} alt={alt} onError={onError} />;
  },
}));

function lesson(overrides: Partial<LessonCatalogItem> & Pick<LessonCatalogItem, "id" | "title">): LessonCatalogItem {
  return {
    initial: "A",
    searchText: overrides.title.toLocaleLowerCase(),
    durationMinutes: 20,
    typeLabel: null,
    trackLabel: null,
    hasModel: true,
    finishedImageUrl: null,
    isCompleted: false,
    ...overrides,
  };
}

describe("CourseLessonCatalog", () => {
  it("renders a supplied finished image and keeps the lesson destination", () => {
    render(<CourseLessonCatalog courseId={5} lessons={[lesson({ id: 1, title: "埃菲尔铁塔", finishedImageUrl: "/finished.webp" })]} showProgressFilters desktopCards />);

    expect(screen.getByRole("img", { name: "埃菲尔铁塔成品参考图" })).toHaveAttribute("src", "/finished.webp");
    expect(screen.getAllByRole("link", { name: /埃菲尔铁塔/ })[0]).toHaveAttribute("href", "/courses/5/lessons/1");
  });

  it("uses a text card for missing images and never substitutes a course cover", () => {
    render(<CourseLessonCatalog courseId={5} lessons={[lesson({ id: 2, title: "小桥", finishedImageUrl: null })]} showProgressFilters desktopCards />);

    expect(screen.getAllByText("暂无成品图")).toHaveLength(1);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText("tech_programming")).toBeNull();
  });

  it("replaces a failed image with a text card", () => {
    render(<CourseLessonCatalog courseId={5} lessons={[lesson({ id: 3, title: "小车", finishedImageUrl: "/broken.webp" })]} showProgressFilters desktopCards />);

    fireEvent.error(screen.getByRole("img", { name: "小车成品参考图" }));

    expect(screen.getAllByText("图片暂时无法显示")).toHaveLength(1);
    expect(screen.queryByRole("img", { name: "小车成品参考图" })).toBeNull();
  });

  it("keeps search and model filtering connected to the correct lesson link", () => {
    const lessons = [
      lesson({ id: 10, title: "长颈龙", searchText: "长颈龙 changjinglong cjl", hasModel: true }),
      lesson({ id: 11, title: "城堡", searchText: "城堡 chengbao cb", hasModel: false }),
    ];
    render(<CourseLessonCatalog courseId={5} lessons={lessons} showProgressFilters desktopCards={false} />);

    fireEvent.change(screen.getByRole("textbox", { name: "在本课程内搜索课时" }), { target: { value: "城堡" } });
    expect(screen.getByText("找到 1 节课时")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /城堡/ })).toHaveAttribute("href", "/courses/5/lessons/11");
    expect(screen.queryByRole("link", { name: /长颈龙/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /有 3D 分步/ }));
    expect(screen.getByText("没有匹配的课时")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "课时筛选" })).getByRole("button", { name: /有 3D 分步/ })).toHaveAttribute("aria-pressed", "true");
  });
});
