import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/courses", () => ({
  getLessonInCourse: vi.fn(),
  getUserLessonProgress: vi.fn(),
  getCourseSuccessor: vi.fn(async () => null),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/seo/metadata", () => ({ buildPageMetadata: vi.fn((value) => value) }));
vi.mock("@/lib/content-classification", () => ({
  getContentClassificationSettings: vi.fn(async () => ({ publicV1Enabled: false })),
}));
vi.mock("./lesson-page-client", () => ({ LessonPageClient: () => null }));
vi.mock("@/components/seo/json-ld", () => ({ JsonLd: () => null }));
vi.mock("@/components/ui/content-classification", () => ({ ContentClassification: () => null }));

import { generateMetadata } from "./page";
import { getLessonInCourse } from "@/lib/api/courses";

const params = Promise.resolve({ courseId: "1", lessonId: "4" });
const searchParams = Promise.resolve({});

function lessonContext(isListed: boolean) {
  return {
    course: { id: 1, title: "Scratch 少儿编程入门", description: "旧课", image_url: null, is_listed: isListed },
    lesson: { id: 4, title: "认识 Scratch", content: null },
  } as unknown as Awaited<ReturnType<typeof getLessonInCourse>>;
}

describe("lesson metadata robots", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks lessons of unlisted courses noindex but followable", async () => {
    vi.mocked(getLessonInCourse).mockResolvedValue(lessonContext(false));

    expect(await generateMetadata({ params, searchParams })).toMatchObject({ noIndex: true, noIndexFollow: true });
  });

  it("indexes lessons of listed courses", async () => {
    vi.mocked(getLessonInCourse).mockResolvedValue(lessonContext(true));

    expect(await generateMetadata({ params, searchParams })).toMatchObject({ noIndex: false, noIndexFollow: false });
  });

  it("keeps missing lessons noindex, nofollow", async () => {
    vi.mocked(getLessonInCourse).mockResolvedValue(null);

    const metadata = await generateMetadata({ params, searchParams });
    expect(metadata).toMatchObject({ noIndex: true });
    expect(metadata).not.toHaveProperty("noIndexFollow");
  });
});
