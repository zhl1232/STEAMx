import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/courses", () => ({ listApprovedCourses: vi.fn() }));
vi.mock("@/lib/api/explore-data", () => ({ getProjects: vi.fn(), getProjectById: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createPublicClient: vi.fn(() => ({ publicOnly: true })) }));

import LearningTopicPage, { generateMetadata } from "./page";
import { listApprovedCourses } from "@/lib/api/courses";
import { getProjects, getProjectById } from "@/lib/api/explore-data";
import type { CourseListItem } from "@/lib/courses/types";
import { LEARNING_TOPICS } from "@/lib/seo/learning-topics";

function makeCourse(id: number, title: string, tags: string[], lessonCount = 3): CourseListItem {
    return {
        id,
        title,
        tags,
        description: `${title}的课程说明。`,
        image_url: null,
        status: "approved",
        sort_order: id,
        steam_weights: null,
        created_at: "2026-09-20T00:00:00Z",
        updated_at: "2026-09-20T00:00:00Z",
        lesson_count: lessonCount,
        progress: null,
    };
}

async function renderTopic(topic: string) {
    const page = await LearningTopicPage({ params: Promise.resolve({ topic }) });
    return new DOMParser().parseFromString(renderToString(page), "text/html");
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProjectById).mockResolvedValue(null);
    vi.mocked(listApprovedCourses).mockResolvedValue([
        makeCourse(10, "大颗粒结构探索", ["building_3d"]),
        makeCourse(20, "Scratch 小故事", ["编程"]),
        makeCourse(30, "五子棋思维课", ["逻辑"]),
        makeCourse(40, "用 Scratch 积木创作", ["scratch"]),
        makeCourse(50, "积木课程待完善", ["积木"], 0),
    ]);
    vi.mocked(getProjects).mockResolvedValue({ projects: [], total: 0, hasMore: false });
});

afterEach(() => vi.unstubAllEnvs());

describe("learning topic metadata", () => {
    it("gives each topic distinct metadata and a canonical URL without requiring the database", async () => {
        vi.stubEnv("NODE_ENV", "production");
        const metadata = await Promise.all(LEARNING_TOPICS.map((topic) => generateMetadata({ params: Promise.resolve({ topic: topic.slug }) })));

        expect(new Set(metadata.map((item) => item.title)).size).toBe(LEARNING_TOPICS.length);
        expect(new Set(metadata.map((item) => item.description)).size).toBe(LEARNING_TOPICS.length);
        for (const [index, topic] of LEARNING_TOPICS.entries()) {
            expect(metadata[index].alternates?.canonical).toBe(`https://steam.bj.cn/learn/${topic.slug}`);
            expect(metadata[index].robots).toBeUndefined();
        }
        expect(listApprovedCourses).not.toHaveBeenCalled();
        expect(getProjects).not.toHaveBeenCalled();
    });

    it("rejects unknown metadata slugs instead of creating an indexable generic page", async () => {
        await expect(generateMetadata({ params: Promise.resolve({ topic: "unknown" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    });
});

describe("learning topic pages", () => {
    it.each(LEARNING_TOPICS)("renders the $slug guide and cross-topic links in initial HTML even when its catalog is empty", async (topic) => {
        vi.mocked(listApprovedCourses).mockResolvedValue([]);

        const document = await renderTopic(topic.slug);

        expect(document.querySelectorAll("h1")).toHaveLength(1);
        expect(document.querySelector("h1")).toHaveTextContent(topic.label);
        expect(document.body).toHaveTextContent(topic.firstChallenge);
        for (const step of topic.sequence) expect(document.body).toHaveTextContent(step.description);
        for (const item of topic.preparation) expect(document.body).toHaveTextContent(item);
        for (const item of LEARNING_TOPICS.filter((item) => item.slug !== topic.slug)) {
            expect(document.querySelector(`a[href="/learn/${item.slug}"]`)).not.toBeNull();
        }
        expect(document.querySelector(`a[href="${topic.slug === "nature" ? "/nature" : "/courses"}"]`)).not.toBeNull();
        expect(document.querySelector('a[href="/explore"]')).not.toBeNull();
        if (topic.slug !== "nature") expect(document.body).toHaveTextContent("暂时没有可展示");
    });

    it("puts the resource entry point before the learning method section", async () => {
        const document = await renderTopic("blocks");
        const resources = document.querySelector("#start-learning");
        const method = document.querySelector("#learning-method");

        expect(resources).not.toBeNull();
        expect(method).not.toBeNull();
        expect(resources!.compareDocumentPosition(method!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(resources!.querySelectorAll('a[href^="/courses/"]')).toHaveLength(1);
        expect(method!.closest("section")).toHaveTextContent(LEARNING_TOPICS.find((topic) => topic.slug === "blocks")!.firstQuestion);
    });

    it("links only physical building courses on the blocks guide", async () => {
        const document = await renderTopic("blocks");

        expect(document.querySelector('a[href="/courses/10"]')).toHaveTextContent("大颗粒结构探索");
        for (const id of [20, 30, 40, 50]) expect(document.querySelector(`a[href="/courses/${id}"]`)).toBeNull();
        expect(listApprovedCourses).toHaveBeenCalledWith({ publicOnly: true });
        expect(getProjects).not.toHaveBeenCalled();
    });

    it("puts observation preparation and boundaries before recording links without catalog queries", async () => {
        const document = await renderTopic("nature");
        const preparation = document.querySelector("#observation-preparation")!;
        const boundaries = document.querySelector("#observation-boundaries")!;
        const method = document.querySelector("#learning-method")!.closest("section")!;
        const usage = document.querySelector("#record-observation")!;
        const resources = document.querySelector("#start-learning")!;

        expect(preparation).not.toBeNull();
        expect(boundaries).not.toBeNull();
        expect(preparation.compareDocumentPosition(boundaries)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(boundaries.compareDocumentPosition(method)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(method.compareDocumentPosition(usage)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(usage.compareDocumentPosition(resources)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(document.querySelectorAll("#learning-preparation")).toHaveLength(1);
        expect(preparation).toHaveTextContent("只用眼睛看、耳朵听就能开始");
        expect(boundaries.querySelector('[aria-labelledby="observation-can-do"]')).toHaveTextContent("拍照、画画");
        expect(boundaries.querySelector('[aria-labelledby="observation-avoid"]')).toHaveTextContent("不追赶、不投喂");
        expect(document.querySelector('header a')).toHaveAttribute("href", "#observation-preparation");
        expect(document.querySelector('nav[aria-label="面包屑"] a')).toHaveAttribute("href", "/nature");
        expect(document.querySelector("#record-observation")).toHaveTextContent("待鉴定");
        expect(document.querySelector("#record-observation")).toHaveTextContent("每张照片会成为一条独立观察");
        expect(usage.querySelector('a[href="/profile/library?tab=observations"]')).not.toBeNull();
        expect(document.querySelector('header a[href="#record-observation"]')).toHaveTextContent("查看页面用法");
        expect(document.querySelector('a[href="/nature/submit"]')).not.toBeNull();
        expect(document.querySelector('a[href="/nature/observations"]')).not.toBeNull();
        expect(document.querySelector('a[href="/nature/species"]')).not.toBeNull();
        expect(document.body).toHaveTextContent("不追赶、不投喂");
        expect(document.querySelector("#building-equipment")).toBeNull();
        expect(listApprovedCourses).not.toHaveBeenCalled();
        expect(getProjects).not.toHaveBeenCalled();
    });

    it("keeps building concepts specific to the physical blocks guide", async () => {
        const blocks = await renderTopic("blocks");
        const concepts = blocks.querySelector("#building-concepts")?.closest("section");
        expect(concepts).toHaveTextContent("互锁");
        expect(concepts).toHaveTextContent("底座与重心");
        expect(concepts).toHaveTextContent("支撑与加固");
        expect(concepts).toHaveTextContent("轮轴与齿轮");
        const scratch = await renderTopic("scratch");
        expect(scratch.querySelector("#building-concepts")).toBeNull();
    });

    it("finds Scratch courses by title or tags without including unrelated courses", async () => {
        vi.mocked(listApprovedCourses).mockResolvedValue([
            makeCourse(20, "Scratch 小故事", []),
            makeCourse(40, "互动创作", ["SCRATCH"]),
            makeCourse(60, "Python 编程", ["编程"]),
        ]);

        const document = await renderTopic("scratch");

        expect(document.querySelector('a[href="/courses/20"]')).not.toBeNull();
        expect(document.querySelector('a[href="/courses/40"]')).not.toBeNull();
        expect(document.querySelector('a[href="/courses/60"]')).toBeNull();
    });

    it("links real science projects and requests strict published project queries", async () => {
        vi.mocked(getProjects).mockResolvedValue({
            projects: [{ id: 91, title: "纸桥承重探索", description: "比较不同折法。", author: "作者", author_id: "public-author", image: "", category: "科学", likes: 0 }],
            total: 1,
            hasMore: false,
        });

        vi.mocked(getProjectById).mockResolvedValue({ id: 91, title: "纸桥承重探索", description: "比较不同折法。", author: "作者", author_id: "public-author", image: "", category: "科学", likes: 0, steps: [{ title: "折纸桥", description: "把纸折成折扇形。" }] });
        const document = await renderTopic("science");

        expect(getProjects).toHaveBeenCalledWith({ category: "科学" }, { sortBy: "latest", strictErrors: true, pageSize: 24 });
        expect(document.querySelector('a[href="/project/91"]')).toHaveTextContent("纸桥承重探索");
        expect(listApprovedCourses).not.toHaveBeenCalled();
    });

    it("rejects unknown page slugs before requesting resources", async () => {
        await expect(LearningTopicPage({ params: Promise.resolve({ topic: "unknown" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
        expect(listApprovedCourses).not.toHaveBeenCalled();
        expect(getProjects).not.toHaveBeenCalled();
    });

    it.each(["blocks", "scratch", "science"])("does not disguise a %s resource failure as an empty catalog", async (topic) => {
        vi.mocked(listApprovedCourses).mockRejectedValue(new Error("database unavailable"));
        vi.mocked(getProjects).mockRejectedValue(new Error("database unavailable"));

        await expect(LearningTopicPage({ params: Promise.resolve({ topic }) })).rejects.toThrow("database unavailable");
    });
});
