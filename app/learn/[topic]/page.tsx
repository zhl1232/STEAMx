import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Blocks, Code2, FlaskConical } from "lucide-react";

import { JsonLd } from "@/components/seo/json-ld";
import { listApprovedCourses } from "@/lib/api/courses";
import { getProjects } from "@/lib/api/explore-data";
import type { CourseListItem } from "@/lib/courses/types";
import { buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import {
    getLearningTopic,
    LEARNING_TOPICS,
    type LearningTopicSlug,
} from "@/lib/seo/learning-topics";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { createPublicClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ topic: string }> };

type LearningResource = {
    id: string | number;
    title: string;
    description: string | null | undefined;
    href: string;
    detail: string;
};

const TOPIC_APPEARANCE = {
    blocks: { icon: Blocks, accent: "var(--tone-engineering)" },
    scratch: { icon: Code2, accent: "var(--tone-tech)" },
    science: { icon: FlaskConical, accent: "var(--tone-science)" },
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
    if (topic === "science") {
        const { projects } = await getProjects(
            { category: "科学" },
            { sortBy: "latest", strictErrors: true, pageSize: 6 },
        );
        return projects.map((project) => ({
            id: project.id,
            title: project.title,
            description: project.description,
            href: `/project/${project.id}`,
            detail: "科学项目",
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
            detail: `${course.lesson_count} 节课时`,
        }));
}

export default async function LearningTopicPage({ params }: PageProps) {
    const { topic: slug } = await params;
    const topic = getLearningTopic(slug);
    if (!topic) notFound();

    // Query failures must remain failures, rather than a misleading empty public catalog.
    const resources = await loadTopicResources(topic.slug);
    const { icon: TopicIcon, accent } = TOPIC_APPEARANCE[topic.slug];

    return (
        <div
            className="min-h-screen app-canvas-community"
            style={{ "--topic-accent": accent } as CSSProperties}
        >
            <JsonLd data={buildBreadcrumbJsonLd([
                { name: "首页", url: "/" },
                { name: "技能课程", url: "/courses" },
                { name: topic.label, url: `/learn/${topic.slug}` },
            ])} />
            <article className="app-shell-wide pb-24 pt-4 md:pb-12 md:pt-6">
                <nav aria-label="面包屑" className="mb-5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <Link href="/courses" className="inline-flex min-h-11 items-center hover:text-foreground">技能课程</Link>
                    <span aria-hidden="true">/</span>
                    <span aria-current="page">{topic.label}</span>
                </nav>

                <header className="grid items-start gap-6 border-b border-border pb-8 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:gap-10 md:pb-10">
                    <div className="min-w-0">
                        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--topic-accent))]">
                            <TopicIcon className="h-5 w-5" aria-hidden="true" />
                            从兴趣开始 · 动手指南
                        </p>
                        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">{topic.label}</h1>
                        <p className="mt-4 max-w-3xl text-sm leading-7 text-foreground/85 md:text-base md:leading-8">{topic.introduction}</p>
                        <a
                            href="#start-learning"
                            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-sm bg-[hsl(var(--topic-accent)/0.12)] px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-[hsl(var(--topic-accent)/0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--topic-accent))]"
                        >
                            {topic.slug === "science" ? "选择一个科学项目" : "选择一门课程"}
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </a>
                    </div>
                    <div className="border-l-4 border-[hsl(var(--topic-accent))] bg-[hsl(var(--topic-accent)/0.06)] p-5 md:p-6">
                        <p className="text-xs font-semibold text-muted-foreground">先试一个小问题</p>
                        <h2 className="mt-3 text-xl font-bold leading-relaxed text-foreground">{topic.firstQuestion}</h2>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">{topic.firstChallenge}</p>
                    </div>
                </header>

                <div className="grid gap-8 py-8 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:gap-10 md:py-10">
                    <section aria-labelledby="learning-sequence">
                        <h2 id="learning-sequence" className="text-xl font-bold text-foreground">可以这样一步步开始</h2>
                        <ol className="mt-5 space-y-6">
                            {topic.sequence.map((step, index) => (
                                <li key={step.title} className="flex gap-4">
                                    <span aria-hidden="true" className="mt-0.5 w-7 shrink-0 text-xl font-black tabular-nums text-[hsl(var(--topic-accent))]">
                                        {String(index + 1).padStart(2, "0")}
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-bold text-foreground">{step.title}</h3>
                                        <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{step.description}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>

                    <aside className="space-y-7">
                        <section aria-labelledby="learning-preparation" className="rounded-sm border border-border bg-card p-5 md:p-6">
                            <h2 id="learning-preparation" className="text-lg font-bold text-foreground">开始前准备什么</h2>
                            <ul className="mt-4 list-disc space-y-3 pl-4 text-sm leading-7 text-muted-foreground marker:text-[hsl(var(--topic-accent))]">
                                {topic.preparation.map((item) => <li key={item} className="pl-1">{item}</li>)}
                            </ul>
                        </section>
                        <section aria-labelledby="learning-companion" className="px-1">
                            <h2 id="learning-companion" className="text-base font-bold text-foreground">家长和同伴可以怎样陪伴</h2>
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">{topic.companionNote}</p>
                        </section>
                    </aside>
                </div>

                <section id="start-learning" aria-labelledby="learning-resources" className="scroll-mt-24 border-t border-border py-8 md:py-10">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h2 id="learning-resources" className="text-xl font-bold text-foreground">{topic.resourceHeading}</h2>
                            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{topic.resourceIntroduction}</p>
                        </div>
                        <Link href={topic.browseHref} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[hsl(var(--nav-active))] hover:underline">
                            {topic.browseLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>
                    {resources.length > 0 ? (
                        <ul className="mt-5 grid gap-3 md:grid-cols-2">
                            {resources.map((resource) => (
                                <li key={resource.id}>
                                    <Link
                                        href={resource.href}
                                        prefetch={false}
                                        className="group flex h-full items-start justify-between gap-4 rounded-sm border border-border bg-card p-5 transition hover:border-[hsl(var(--topic-accent)/0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--topic-accent))]"
                                    >
                                        <div className="min-w-0">
                                            <span className="text-xs text-muted-foreground">{resource.detail}</span>
                                            <h3 className="mt-1 text-base font-bold text-foreground">{resource.title}</h3>
                                            {resource.description ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{resource.description}</p> : null}
                                        </div>
                                        <ArrowRight className="mt-5 h-4 w-4 shrink-0 text-[hsl(var(--topic-accent))] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-5 rounded-sm border border-dashed border-border p-5 text-sm leading-7 text-muted-foreground">
                            这个主题暂时没有可展示的{topic.slug === "science" ? "项目" : "课程"}。可以先试试上面的小挑战，或从其他主题继续探索。
                        </p>
                    )}
                </section>

                <section aria-labelledby="learning-reflection" className="border-t border-border py-8 md:py-10">
                    <h2 id="learning-reflection" className="text-xl font-bold text-foreground">做完以后，把发现说清楚</h2>
                    <ul className="mt-4 grid gap-3 md:grid-cols-3">
                        {topic.reflection.map((question) => <li key={question} className="border-l-2 border-[hsl(var(--topic-accent)/0.5)] pl-4 text-sm leading-7 text-foreground/85">{question}</li>)}
                    </ul>
                </section>

                <nav aria-label="继续探索学习主题" className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border pt-5 text-sm">
                    <span className="mr-1 text-muted-foreground">换一种方式继续探索</span>
                    {LEARNING_TOPICS.filter((item) => item.slug !== topic.slug).map((item) => (
                        <Link key={item.slug} href={`/learn/${item.slug}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-[hsl(var(--nav-active))] hover:underline">
                            {item.label}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                    ))}
                    <Link href="/explore" className="inline-flex min-h-11 items-center font-semibold text-[hsl(var(--nav-active))] hover:underline">探索全部项目</Link>
                </nav>
            </article>
        </div>
    );
}
