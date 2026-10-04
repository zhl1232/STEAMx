import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CourseLessonSummary, CourseOverview } from "@/lib/courses/types";

const state = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("@/lib/api/courses", () => ({ getCourseOverview: vi.fn(), getCourseSuccessor: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) } })),
}));
vi.mock("@/lib/store/service", () => ({ listStoreProductsForContext: vi.fn(async () => []) }));
vi.mock("@/lib/content-classification", () => ({
  getContentClassificationSettings: vi.fn(async () => ({ publicV1Enabled: false })),
}));
vi.mock("@/lib/seo/json-ld", () => ({
  buildBreadcrumbJsonLd: vi.fn(() => ({})),
  buildCourseJsonLd: vi.fn(() => ({})),
}));
vi.mock("@/lib/seo/metadata", () => ({ buildPageMetadata: vi.fn((value) => value) }));
vi.mock("@/components/seo/json-ld", () => ({ JsonLd: () => null }));
vi.mock("@/components/layout/mobile-global-header", () => ({ MobileGlobalHeader: () => null }));
vi.mock("@/components/store/contextual-store-products", () => ({ ContextualStoreProducts: () => null }));
vi.mock("@/components/features/courses/course-share-button", () => ({ CourseShareButton: () => null }));
vi.mock("@/components/features/courses/gomoku-board", () => ({ GomokuBoard: () => null }));
vi.mock("@/components/ui/optimized-image", () => ({ OptimizedImage: () => null }));
vi.mock("@/components/ui/content-classification", () => ({ ContentClassification: () => null }));
vi.mock("@/components/features/courses/course-lesson-catalog", () => ({
  CourseLessonCatalog: ({ desktopCards }: { desktopCards?: boolean }) => <div data-desktop-cards={desktopCards ? "true" : "false"} />,
}));

import CourseDetailPage, { generateMetadata } from "./page";
import { getCourseOverview, getCourseSuccessor } from "@/lib/api/courses";

function makeLesson(id: number, lessonType: CourseLessonSummary["lesson_type"] = "building_3d"): CourseLessonSummary {
  return {
    id,
    course_id: 5,
    title: `课时 ${id}`,
    lesson_type: lessonType,
    sort_order: id,
    duration_minutes: 20,
    track: null,
    level_label: null,
    summary: null,
    has_model: true,
    finished_image_url: null,
    is_completed: false,
    completed_at: null,
  };
}

function makeCourse(progress: CourseOverview["progress"], lessons = Array.from({ length: 24 }, (_, index) => makeLesson(index + 1))): CourseOverview {
  return {
    id: 5,
    title: "大颗粒作品课",
    description: "跟着 3D 步骤搭建作品。",
    image_url: null,
    tags: ["积木"],
    status: "approved",
    sort_order: 1,
    steam_weights: null,
    created_at: "2026-09-20T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
    lessons,
    progress,
  };
}

async function renderCourse(course: CourseOverview, user: { id: string } | null = null) {
  state.user = user;
  vi.mocked(getCourseOverview).mockResolvedValue(course);
  const element = await CourseDetailPage({ params: Promise.resolve({ courseId: "5" }) });
  return new DOMParser().parseFromString(renderToString(element), "text/html");
}

describe("course detail CTA", () => {
  beforeEach(() => {
    state.user = null;
    vi.clearAllMocks();
  });

  it("sends a new large building course to the catalog anchor", async () => {
    const document = await renderCourse(makeCourse(null));

    expect(document.querySelector('a[href="#course-lessons-heading"]')).toHaveTextContent("挑一个作品开始");
    expect(document.querySelector('a[href^="/courses/5/lessons/"]')).toBeNull();
    expect(document.querySelector('[data-desktop-cards="true"]')).not.toBeNull();
  });

  it("keeps the in-progress lesson CTA and adds a catalog choice", async () => {
    const document = await renderCourse(makeCourse({
      completed_lesson_count: 2,
      total_lesson_count: 24,
      status: "in_progress",
      next_lesson_id: 3,
      milestone_completed_at: null,
    }), { id: "learner" });

    expect(document.querySelector('a[href="/courses/5/lessons/3"]')).toHaveTextContent("继续 第 3 课");
    expect(document.querySelector('a[href="#course-lessons-heading"]')).toHaveTextContent("挑选作品");
  });

  it("keeps review semantics after completion while allowing catalog selection", async () => {
    const document = await renderCourse(makeCourse({
      completed_lesson_count: 24,
      total_lesson_count: 24,
      status: "completed",
      next_lesson_id: null,
      milestone_completed_at: null,
    }), { id: "learner" });

    expect(document.body).toHaveTextContent("回顾课程");
    expect(document.querySelector('a[href="#course-lessons-heading"]')).toHaveTextContent("挑选作品");
  });

  it("keeps the ordered lesson route for a small non-building course", async () => {
    const document = await renderCourse(makeCourse(null, [makeLesson(1, "playground"), makeLesson(2, "playground")]));

    expect(document.querySelector('a[href="/courses/5/lessons/1"]')).toHaveTextContent("开始 第 1 课");
    expect(document.querySelector('a[href="#course-lessons-heading"]')).toBeNull();
    expect(document.querySelector('[data-desktop-cards="true"]')).toBeNull();
  });
});

describe("unlisted course successor and robots", () => {
  beforeEach(() => {
    state.user = null;
    vi.clearAllMocks();
    vi.mocked(getCourseSuccessor).mockResolvedValue(null);
  });

  it("keeps unlisted courses out of search but lets crawlers follow links", async () => {
    vi.mocked(getCourseOverview).mockResolvedValue({ ...makeCourse(null), id: 1, is_listed: false });

    const metadata = await generateMetadata({ params: Promise.resolve({ courseId: "1" }) });

    expect(metadata).toMatchObject({ noIndex: true, noIndexFollow: true, path: "/courses/1" });
  });

  it("indexes listed courses and keeps nofollow for missing ones", async () => {
    vi.mocked(getCourseOverview).mockResolvedValueOnce({ ...makeCourse(null), is_listed: true });
    expect(await generateMetadata({ params: Promise.resolve({ courseId: "5" }) })).toMatchObject({
      noIndex: false,
      noIndexFollow: false,
    });

    vi.mocked(getCourseOverview).mockResolvedValueOnce(null);
    const missing = await generateMetadata({ params: Promise.resolve({ courseId: "404" }) });
    expect(missing).toMatchObject({ noIndex: true });
    expect(missing).not.toHaveProperty("noIndexFollow");
  });

  it("shows the 新版课程 entry with the successor title without touching progress UI", async () => {
    vi.mocked(getCourseSuccessor).mockResolvedValue({ id: 8, title: "Scratch 创探编程：从动画到作品" });
    const document = await renderCourse({ ...makeCourse({
      completed_lesson_count: 2,
      total_lesson_count: 24,
      status: "in_progress",
      next_lesson_id: 3,
      milestone_completed_at: null,
    }), is_listed: false }, { id: "learner" });

    const banner = document.querySelector('[data-testid="course-successor-banner"]');
    expect(banner).toHaveAttribute("href", "/courses/8");
    expect(banner).toHaveTextContent("本课程已更新，前往新版课程：Scratch 创探编程：从动画到作品");
    expect(document.querySelector('a[href="/courses/5/lessons/3"]')).toHaveTextContent("继续 第 3 课");
  });

  it("renders no entry when there is no listed successor", async () => {
    const document = await renderCourse(makeCourse(null));

    expect(document.querySelector('[data-testid="course-successor-banner"]')).toBeNull();
  });
});

