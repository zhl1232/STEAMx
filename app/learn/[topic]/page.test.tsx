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
import { LEARNING_QUICK_START } from "@/lib/product/learning-quick-start";

function makeCourse(id: number, title: string, tags: string[], lessonCount = 3): CourseListItem {
    return {
        id, title, tags, description: `${title}的课程说明。`, image_url: null,
        status: "approved", sort_order: id, steam_weights: null,
        created_at: "2026-09-20T00:00:00Z", updated_at: "2026-09-20T00:00:00Z",
        lesson_count: lessonCount, progress: null,
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
    it("keeps distinct metadata and canonical URLs without database queries", async () => {
        vi.stubEnv("NODE_ENV", "production");
        const metadata = await Promise.all(LEARNING_TOPICS.map(topic => generateMetadata({ params: Promise.resolve({ topic: topic.slug }) })));
        expect(new Set(metadata.map(item => item.title)).size).toBe(LEARNING_TOPICS.length);
        expect(new Set(metadata.map(item => item.description)).size).toBe(LEARNING_TOPICS.length);
        for (const [index, topic] of LEARNING_TOPICS.entries()) {
            expect(metadata[index].alternates?.canonical).toBe(`https://steam.bj.cn/learn/${topic.slug}`);
            expect(metadata[index].robots).toBeUndefined();
        }
        expect(listApprovedCourses).not.toHaveBeenCalled();
        expect(getProjects).not.toHaveBeenCalled();
    });
    it("rejects unknown metadata slugs", async () => {
        await expect(generateMetadata({ params: Promise.resolve({ topic: "unknown" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    });
});

describe("learning topic pages", () => {
    it.each(LEARNING_TOPICS)("preserves the complete $slug guide in initial HTML, with details closed", async topic => {
        vi.mocked(listApprovedCourses).mockResolvedValue([]);
        const document = await renderTopic(topic.slug);
        expect(document.querySelectorAll("h1")).toHaveLength(1);
        expect(document.querySelector("h1")).toHaveTextContent(topic.label);
        expect(document.body).toHaveTextContent(topic.introduction);
        expect(document.body).toHaveTextContent(topic.firstChallenge);
        expect(document.body).toHaveTextContent(topic.companionNote);
        for (const step of topic.sequence) expect(document.body).toHaveTextContent(step.description);
        for (const item of topic.preparation) expect(document.body).toHaveTextContent(item);
        for (const item of topic.reflection) expect(document.body).toHaveTextContent(item);
        expect(document.querySelectorAll("details[open]")).toHaveLength(0);
        expect(document.querySelectorAll("details").length).toBeGreaterThan(0);
        expect(document.querySelectorAll("#first-try ol > li")).toHaveLength(topic.slug === "science" ? 0 : 3);
        const ids = Array.from(document.querySelectorAll("[id]"), element => element.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const item of LEARNING_TOPICS.filter(item => item.slug !== topic.slug)) {
            expect(document.querySelector(`a[href="/learn/${item.slug}"]`)).not.toBeNull();
        }
        expect(document.querySelector(`a[href="${topic.slug === "nature" ? "/nature" : "/courses"}"]`)).not.toBeNull();
        expect(document.querySelector('a[href="/explore"]')).not.toBeNull();
        expect(document.querySelector('a[href="/start"]')).not.toBeNull();
        if (topic.slug !== "nature") expect(document.body).toHaveTextContent("暂时没有可展示");
    });

    it.each(["blocks", "scratch"] as const)("puts %s course selection before detailed methods and the optional challenge", async slug => {
        const document = await renderTopic(slug);
        const resources = document.querySelector("#start-learning")!;
        const method = document.querySelector("#learning-method")!;
        expect(resources.compareDocumentPosition(method)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(method.closest("details")).not.toBeNull();
        expect(document.querySelector("#first-try")!.closest("details")).not.toBeNull();
        expect(document.querySelector("header a")).toHaveAttribute("href", "#start-learning");
        expect(resources).toHaveTextContent(LEARNING_QUICK_START[slug].materials);
        expect(resources).toHaveTextContent(LEARNING_QUICK_START[slug].safety);
    });

    it("links only physical building courses and preserves kit caveats and concepts", async () => {
        const document = await renderTopic("blocks");
        expect(document.querySelector('a[href="/courses/10"]')).toHaveTextContent("大颗粒结构探索");
        for (const id of [20, 30, 40, 50]) expect(document.querySelector(`a[href="/courses/${id}"]`)).toBeNull();
        expect(listApprovedCourses).toHaveBeenCalledWith({ publicOnly: true });
        expect(getProjects).not.toHaveBeenCalled();
        const equipment = document.querySelector("#building-equipment")!.closest("section")!;
        expect(equipment).toHaveTextContent("不代表单套即可完成整门课程");
        expect(equipment).toHaveTextContent("不能只凭套装编号判断零件是否齐全");
        const concepts = document.querySelector("#building-concepts")!.closest("section")!;
        for (const text of ["互锁", "底座与重心", "支撑与加固", "轮轴与齿轮"]) expect(concepts).toHaveTextContent(text);
        const scratch = await renderTopic("scratch");
        expect(scratch.querySelector("#building-concepts")).toBeNull();
    });

    it("keeps nature safety and privacy visible before publishing, while detailed usage is optional", async () => {
        const document = await renderTopic("nature");
        const preparation = document.querySelector("#observation-preparation")!;
        const boundaries = document.querySelector("#observation-boundaries")!;
        const resources = document.querySelector("#start-learning")!;
        const usage = document.querySelector("#record-observation")!;
        expect(preparation.closest("details")).toBeNull();
        expect(boundaries.closest("details")).toBeNull();
        expect(boundaries).toHaveTextContent("不追赶、不投喂、不采摘");
        expect(boundaries.compareDocumentPosition(resources)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(resources.compareDocumentPosition(usage)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(resources).toHaveTextContent("私人信息");
        expect(resources).toHaveTextContent("位置不要精确公开");
        expect(resources.querySelector('a[href="/nature/submit"]')).toHaveTextContent("发布需要登录");
        expect(resources.querySelector('a[href="/nature/submit"]')!.closest("details")).toBeNull();
        expect(document.querySelector("header a")).toHaveAttribute("href", "#first-try");
        expect(document.querySelector('nav[aria-label="面包屑"] a')).toHaveAttribute("href", "/nature");
        expect(document.querySelectorAll("#learning-preparation")).toHaveLength(1);
        expect(usage.tagName).toBe("DETAILS");
        expect(usage.hasAttribute("open")).toBe(false);
        expect(usage).toHaveTextContent("待鉴定");
        expect(usage).toHaveTextContent("每张照片会成为一条独立观察");
        expect(usage.querySelector('a[href="/profile/library?tab=observations"]')).not.toBeNull();
        for (const href of ["/nature/submit", "/nature/observations", "/nature/species"]) expect(resources.querySelector(`a[href="${href}"]`)).not.toBeNull();
        const topic = LEARNING_TOPICS.find(topic => topic.slug === "nature")!;
        for (const item of [...topic.observationGuide!.canDo, ...topic.observationGuide!.avoid, ...topic.observationGuide!.optionalEquipment]) expect(document.body).toHaveTextContent(item);
        expect(document.querySelector("#building-equipment")).toBeNull();
        expect(listApprovedCourses).not.toHaveBeenCalled();
        expect(getProjects).not.toHaveBeenCalled();
    });

    it("finds Scratch courses by title or tags without unrelated courses", async () => {
        vi.mocked(listApprovedCourses).mockResolvedValue([
            makeCourse(20, "Scratch 小故事", []), makeCourse(40, "互动创作", ["SCRATCH"]), makeCourse(60, "Python 编程", ["编程"]),
        ]);
        const document = await renderTopic("scratch");
        for (const id of [20, 40]) expect(document.querySelector(`a[href="/courses/${id}"]`)).not.toBeNull();
        expect(document.querySelector('a[href="/courses/60"]')).toBeNull();
    });

    it("shows three choices by default and retains the rest in a disclosure", async () => {
        vi.mocked(listApprovedCourses).mockResolvedValue([1, 2, 3, 4, 5, 6].map(id => makeCourse(id, `积木 ${id}`, ["building_3d"])));
        const document = await renderTopic("blocks");
        const cards = Array.from(document.querySelectorAll('#start-learning a[href^="/courses/"]'));
        expect(cards).toHaveLength(6);
        expect(cards.filter(card => !card.closest("details"))).toHaveLength(3);
        expect(cards.slice(3).every(card => card.closest("details") && !card.closest("details")!.hasAttribute("open"))).toBe(true);
    });

    it("uses returned science projects rather than promoting a hard-coded guide example", async () => {
        // 测试目录故意不含纸桥，不能靠同名假数据掩盖固定推荐的问题。
        const project = { id: 91, title: "测试用光影观察", description: "观察光照方向变化。", author: "作者", author_id: "public-author", image: "", category: "科学", likes: 0 };
        vi.mocked(getProjects).mockResolvedValue({ projects: [project], total: 1, hasMore: false });
        vi.mocked(getProjectById).mockResolvedValue({ ...project, steps: [{ title: "观察影子", description: "记录光照方向与影子的变化。" }] });
        const document = await renderTopic("science");
        expect(getProjects).toHaveBeenCalledWith({ category: "科学" }, { sortBy: "latest", strictErrors: true, pageSize: 24 });
        const resources = document.querySelector("#start-learning")!;
        const card = resources.querySelector('a[href="/project/91"]')!;
        expect(card).toHaveTextContent("测试用光影观察");
        expect(card.closest("details")).toBeNull();
        expect(resources.querySelectorAll('a[href^="/project/"]')).toHaveLength(1);
        expect(document.querySelector("header a")).toHaveTextContent("选择一个科学项目");
        expect(document.querySelector("header a")).toHaveAttribute("href", "#start-learning");
        expect(document.querySelector("header")).not.toHaveTextContent("纸桥");
        expect(document.querySelector('a[href="#first-try"]')).toBeNull();
        expect(document.querySelector("#first-try-heading")).toBeNull();
        expect(document.querySelector("#first-try")!.closest("section")).toBe(resources);
        expect(resources).toHaveTextContent("由成人承担相应操作");
        expect(resources).not.toHaveTextContent("两个稳定支撑物");
        const method = document.querySelector("#learning-method")!.closest("section")!;
        expect(method).toHaveTextContent("方法示例（非站内项目）");
        expect(method.closest("details")).not.toHaveAttribute("open");
        expect(resources.compareDocumentPosition(method)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(listApprovedCourses).not.toHaveBeenCalled();
    });

    it("does not invent a starter project or keep an empty primary CTA when science resources are absent", async () => {
        const document = await renderTopic("science");
        const resources = document.querySelector("#start-learning")!;
        expect(resources).toHaveTextContent("暂时没有可展示的科学项目");
        expect(resources.querySelectorAll('a[href^="/project/"]')).toHaveLength(0);
        expect(resources.querySelector('a[href="/explore"]')).toHaveTextContent("去探索其他项目");
        expect(document.querySelector("header a")).toBeNull();
        expect(document.body).not.toHaveTextContent("先试试纸桥");
        expect(resources).not.toHaveTextContent("本页的小挑战");
        expect(Array.from(document.querySelectorAll("summary")).some(item => item.textContent?.includes("能托住更多"))).toBe(false);
    });

    it("rejects unknown page slugs before requesting resources", async () => {
        await expect(LearningTopicPage({ params: Promise.resolve({ topic: "unknown" }) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
        expect(listApprovedCourses).not.toHaveBeenCalled();
        expect(getProjects).not.toHaveBeenCalled();
    });

    it.each(["blocks", "scratch", "science"])("does not disguise a %s resource failure as an empty catalog", async topic => {
        vi.mocked(listApprovedCourses).mockRejectedValue(new Error("database unavailable"));
        vi.mocked(getProjects).mockRejectedValue(new Error("database unavailable"));
        await expect(LearningTopicPage({ params: Promise.resolve({ topic }) })).rejects.toThrow("database unavailable");
    });
});
