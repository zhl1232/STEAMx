import { scienceSampleIds } from '@/lib/project/science-samples';
import { selectScienceResources, scienceResourceSummary } from '@/lib/seo/science-resources';
import { isPlaceholderProjectStep } from '@/lib/seo/project-description';
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { LearningGuide, type LearningResource } from "@/components/learning/learning-guide";
import { listApprovedCourses } from "@/lib/api/courses";
import { getProjectById, getProjects } from "@/lib/api/explore-data";
import type { CourseListItem } from "@/lib/courses/types";
import { buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { getLearningTopic, type LearningTopicSlug } from "@/lib/seo/learning-topics";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { createPublicClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ topic: string }> };

const TOPIC_ACCENT = {
    blocks: "var(--tone-engineering)",
    scratch: "var(--tone-tech)",
    science: "var(--tone-science)",
    nature: "var(--brand-green)",
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { topic: slug } = await params;
    const topic = getLearningTopic(slug);
    if (!topic) notFound();

    return buildPageMetadata({
        title: topic.title,
        description: topic.description,
        path: `/learn/${topic.slug}`,
        keywords: topic.keywords,
    });
}

function matchesCourseTopic(course: CourseListItem, topic: "blocks" | "scratch") {
    const text = [course.title, ...(course.tags ?? [])].join(" ");
    if (topic === "scratch") return /scratch/i.test(text);
    // Scratch's graphical blocks are not physical building bricks.
    if (/scratch|图形化编程/i.test(text)) return false;
    return /积木|乐高|得宝|building_3d|duplo|lego/i.test(text);
}

async function loadTopicResources(topic: LearningTopicSlug): Promise<LearningResource[]> {
    if (topic === "nature") {
        return [
            { id: "record", title: "记录第一次观察", description: "发布需要登录。上传自己的照片，核对时间和地点；不认识物种也可以记录。", href: "/nature/submit", detail: "动手记录" },
            { id: "atlas", title: "认识身边的物种", description: "浏览鸟类、昆虫、植物等物种资料，对照看得见的特征。", href: "/nature/species", detail: "物种图鉴" },
            { id: "community", title: "看看大家的发现", description: "看看别人怎样拍照、描述特征和记录环境。", href: "/nature/observations", detail: "公开观察" },
        ];
    }
    if (topic === "science") {
        const draftIds = process.env.NODE_ENV === 'development' ? scienceSampleIds().slice(0, 6) : [];
        // Review drafts are dev-only. Otherwise rank actual recent detail content;
        // list cards intentionally omit steps and cannot establish completeness.
        const ids = draftIds.length ? draftIds : (await getProjects(
            { category: "科学" },
            { sortBy: "latest", strictErrors: true, pageSize: 24 },
        )).projects.map(project => project.id);
        const candidates = (await Promise.all(ids.map(id => getProjectById(id))))
            .filter((project): project is NonNullable<typeof project> => project !== null);
        return selectScienceResources(candidates).map((project) => ({
            id: project.id,
            title: project.title,
            description: scienceResourceSummary(project),
            href: `/project/${project.id}`,
            image: project.image,
            detail: project.steps?.some(step => !isPlaceholderProjectStep(step))
                ? "有文字步骤" : "视频项目 · 请先核对操作说明",
        }));
    }

    const courses = await listApprovedCourses(createPublicClient());
    return courses
        .filter((course) => course.lesson_count > 0 && matchesCourseTopic(course, topic))
        .slice(0, 6)
        .map((course) => ({
            id: course.id,
            title: course.title,
            description: course.description,
            href: `/courses/${course.id}`,
            image: course.image_url,
            detail: `${course.lesson_count} 节课时`,
        }));
}

export default async function LearningTopicPage({ params }: PageProps) {
    const { topic: slug } = await params;
    const topic = getLearningTopic(slug);
    if (!topic) notFound();

    // Query failures must remain failures, rather than a misleading empty public catalog.
    const resources = await loadTopicResources(topic.slug);
    return (
        <div className="min-h-screen app-canvas-community" style={{ "--topic-accent": TOPIC_ACCENT[topic.slug] } as CSSProperties}>
            <JsonLd data={buildBreadcrumbJsonLd([
                { name: "首页", url: "/" },
                { name: topic.slug === "nature" ? "自然观察" : "技能课程", url: topic.slug === "nature" ? "/nature" : "/courses" },
                { name: topic.label, url: `/learn/${topic.slug}` },
            ])} />
            <article className="app-shell-wide pb-24 pt-4 md:pb-12 md:pt-6">
                <nav aria-label="面包屑" className="mb-3 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <Link href={topic.slug === "nature" ? "/nature" : "/courses"} className="inline-flex min-h-11 items-center hover:text-foreground">{topic.slug === "nature" ? "自然观察" : "技能课程"}</Link>
                    <span aria-hidden="true">/</span>
                    <span aria-current="page">{topic.label}</span>
                    <Link href="/start" className="ml-auto inline-flex min-h-11 items-center hover:text-foreground">换个方向</Link>
                </nav>
                <LearningGuide topic={topic} resources={resources} />
            </article>
        </div>
    );
}
