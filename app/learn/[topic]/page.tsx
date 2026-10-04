import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Blocks, Code2, FlaskConical, Leaf } from "lucide-react";

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
    nature: { icon: Leaf, accent: "var(--brand-green)" },
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
            { id: "record", title: "记录第一次观察", description: "上传你拍摄的照片，核对观察时间、地点。不认识物种也可以开始。", href: "/nature/submit", detail: "动手记录" },
            { id: "atlas", title: "认识身边的物种", description: "浏览鸟类、昆虫、植物等物种资料，对照看得见的特征。", href: "/nature/species", detail: "物种图鉴" },
            { id: "community", title: "看看大家的发现", description: "看看别人怎样拍照、描述特征和记录环境。", href: "/nature/observations", detail: "公开观察" },
        ];
    }
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

    const resourceSection = (
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
                <ul className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
    );

    return (
        <div
            className="min-h-screen app-canvas-community"
            style={{ "--topic-accent": accent } as CSSProperties}
        >
            <JsonLd data={buildBreadcrumbJsonLd([
                { name: "首页", url: "/" },
                { name: topic.slug === "nature" ? "自然观察" : "技能课程", url: topic.slug === "nature" ? "/nature" : "/courses" },
                { name: topic.label, url: `/learn/${topic.slug}` },
            ])} />
            <article className="app-shell-wide pb-24 pt-4 md:pb-12 md:pt-6">
                <nav aria-label="面包屑" className="mb-5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <Link href={topic.slug === "nature" ? "/nature" : "/courses"} className="inline-flex min-h-11 items-center hover:text-foreground">{topic.slug === "nature" ? "自然观察" : "技能课程"}</Link>
                    <span aria-hidden="true">/</span>
                    <span aria-current="page">{topic.label}</span>
                </nav>

                <header className="border-b border-border pb-6 md:pb-7">
                    <div className="min-w-0">
                        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--topic-accent))]">
                            <TopicIcon className="h-5 w-5" aria-hidden="true" />
                            从兴趣开始 · 动手指南
                        </p>
                        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">{topic.label}</h1>
                        <p className="mt-4 max-w-3xl text-sm leading-7 text-foreground/85 md:text-base md:leading-8">{topic.introduction}</p>
                        <a
                            href={topic.observationGuide ? "#observation-preparation" : "#start-learning"}
                            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-sm bg-[hsl(var(--topic-accent)/0.12)] px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-[hsl(var(--topic-accent)/0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--topic-accent))]"
                        >
                            {topic.slug === "nature" ? "先看出发准备" : topic.slug === "science" ? "选择一个科学项目" : "选择一门课程"}
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </a>
                        {topic.observationGuide ? (
                            <a href="#record-observation" className="ml-4 inline-flex min-h-11 items-center text-sm font-semibold text-[hsl(var(--nav-active))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--topic-accent))]">
                                查看页面用法
                            </a>
                        ) : null}
                    </div>
                </header>

                {topic.observationGuide ? (
                    <>
                        <section id="observation-preparation" aria-labelledby="learning-preparation" className="scroll-mt-24 border-t border-border py-8 md:py-10">
                            <h2 id="learning-preparation" className="text-xl font-bold text-foreground">观察前，最少准备什么</h2>
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">从身边的一次短观察开始，按地点、天气和想做的记录来准备。</p>
                            <div className="mt-5 grid gap-5 md:grid-cols-2">
                                <div className="rounded-sm border border-[hsl(var(--topic-accent)/0.35)] bg-[hsl(var(--topic-accent)/0.06)] p-5 md:p-6">
                                    <h3 className="text-base font-bold text-foreground">最小准备：一个观察点，十分钟</h3>
                                    <ul className="mt-4 list-disc space-y-3 pl-4 text-sm leading-7 text-foreground/85 marker:text-[hsl(var(--topic-accent))]">
                                        {topic.preparation.map((item) => <li key={item} className="pl-1">{item}</li>)}
                                    </ul>
                                </div>
                                <div className="rounded-sm border border-border bg-card p-5 md:p-6">
                                    <h3 className="text-base font-bold text-foreground">按需要再带这些</h3>
                                    <ul className="mt-4 list-disc space-y-3 pl-4 text-sm leading-7 text-muted-foreground marker:text-[hsl(var(--topic-accent))]">
                                        {topic.observationGuide.optionalEquipment.map((item) => <li key={item} className="pl-1">{item}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <section id="observation-boundaries" aria-labelledby="observation-rules" className="scroll-mt-24 border-t border-border py-8 md:py-10">
                            <h2 id="observation-rules" className="text-xl font-bold text-foreground">观察可以做什么，哪些事不要做</h2>
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">看完离开时，让它继续原来的生活，让环境保持原样。</p>
                            <div className="mt-5 grid gap-5 md:grid-cols-2">
                                <section aria-labelledby="observation-can-do" className="border-l-2 border-[hsl(var(--topic-accent)/0.5)] pl-4 md:pl-5">
                                    <h3 id="observation-can-do" className="text-base font-bold text-foreground">可以做</h3>
                                    <ul className="mt-3 list-disc space-y-3 pl-4 text-sm leading-7 text-muted-foreground">
                                        {topic.observationGuide.canDo.map((item) => <li key={item}>{item}</li>)}
                                    </ul>
                                </section>
                                <section aria-labelledby="observation-avoid" className="border-l-2 border-border pl-4 md:pl-5">
                                    <h3 id="observation-avoid" className="text-base font-bold text-foreground">不要做</h3>
                                    <ul className="mt-3 list-disc space-y-3 pl-4 text-sm leading-7 text-muted-foreground">
                                        {topic.observationGuide.avoid.map((item) => <li key={item}>{item}</li>)}
                                    </ul>
                                </section>
                            </div>
                        </section>
                    </>
                ) : resourceSection}

                {topic.equipmentSets ? (
                    <section aria-labelledby="building-equipment" className="border-t border-border py-8 md:py-10">
                        <h2 id="building-equipment" className="text-xl font-bold text-foreground">认识课程使用的教育套装</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">9090、9076、9656、45002 各有侧重。套装编号帮助识别零件组合；准备具体作品时，还要核对课时的零件清单、数量和连接方式，不能只凭套装编号判断零件是否齐全。</p>
                        <div className="mt-5 rounded-sm border border-border bg-card p-4 md:p-5">
                            <h3 className="text-base font-bold text-foreground">小班、中班、大班怎么选套？</h3>
                            <ul className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                                <li><strong className="font-semibold text-foreground">小班：主要使用 9090＋9076。</strong>从基础造型、生活场景和管道组合开始，练习拼接、互锁与简单结构。</li>
                                <li><strong className="font-semibold text-foreground">中班：工程搭建可参考 45002。</strong>车辆、吊车等装配活动可从这类工程套装入手，再按作品需要搭配基础积木。</li>
                                <li><strong className="font-semibold text-foreground">大班：机械探索可参考 9656。</strong>围绕齿轮、杠杆、滑轮和轮轴开展活动，再按作品需要补充结构零件。</li>
                            </ul>
                            <p className="mt-3 text-xs leading-6 text-muted-foreground">中班、大班为按学习内容给出的选套参考，尚未逐课核对全部作品所需零件；不代表单套即可完成整门课程。购买或准备前，请先查看选中课时的零件清单与搭建图。</p>
                            <a href="https://www.ndhy.com/lego/zone.shtml" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-xs text-[hsl(var(--nav-active))] hover:underline">分龄配置参考（外部教学方案）</a>
                        </div>
                        <dl className="mt-5 grid gap-x-8 gap-y-5 md:grid-cols-2">
                            {topic.equipmentSets.map((set) => (
                                <div key={set.code} className="border-l-2 border-[hsl(var(--topic-accent)/0.35)] pl-4">
                                    <dt className="text-base font-bold text-foreground"><span className="mr-2 tabular-nums text-[hsl(var(--topic-accent))]">{set.code}</span>{set.name}</dt>
                                    <dd className="mt-2 text-sm leading-7 text-muted-foreground">{set.use}</dd>
                                    <dd><a href={set.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-xs text-[hsl(var(--nav-active))] hover:underline">官方套装资料（英文）</a></dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                ) : null}

                {topic.concepts ? (
                    <section aria-labelledby="building-concepts" className="border-t border-border py-8 md:py-10">
                        <h2 id="building-concepts" className="text-xl font-bold text-foreground">搭得牢、站得稳、动得起来</h2>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">不只照着图完成造型，也用小实验理解结构。可以先从“互锁”开始。</p>
                        <dl className="mt-5 grid gap-6 md:grid-cols-2 md:gap-8">
                            {topic.concepts.map((concept) => (
                                <div key={concept.title}>
                                    <dt className="text-base font-bold text-foreground">{concept.title}</dt>
                                    <dd className="mt-2 text-sm leading-7 text-muted-foreground">{concept.description}</dd>
                                </div>
                            ))}
                        </dl>
                        <a className="mt-4 inline-flex min-h-11 items-center text-xs text-[hsl(var(--nav-active))] hover:underline" href="https://assets.education.lego.com/v3/assets/blt293eea581807678a/bltb2ff88770e40583b/613ab1b40f12922b05ea6df0/Engineering_Design_Notebook_Build_to_Launch_Printers_Marks.pdf?locale=en-us" target="_blank" rel="noopener noreferrer">互锁与加固参考：LEGO Education 搭建指南（英文 PDF）</a>
                    </section>
                ) : null}

                <section aria-labelledby="learning-method" className="scroll-mt-24 border-t border-border py-8 md:py-10">
                    <div className="grid gap-8 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:gap-10">
                        <div>
                            <h2 id="learning-method" className="text-xl font-bold text-foreground">可以这样一步步开始</h2>
                            <div className="mt-5 rounded-sm border border-[hsl(var(--topic-accent)/0.35)] bg-[hsl(var(--topic-accent)/0.06)] p-5 md:p-6">
                                <p className="text-xs font-semibold text-muted-foreground">先试一个小问题</p>
                                <h3 className="mt-3 text-xl font-bold leading-relaxed text-foreground">{topic.firstQuestion}</h3>
                                <p className="mt-3 text-sm leading-7 text-muted-foreground">{topic.firstChallenge}</p>
                            </div>
                            <ol className="mt-7 space-y-6">
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
                        </div>

                        <aside className="space-y-7">
                            {!topic.observationGuide ? <section aria-labelledby="learning-preparation" className="rounded-sm border border-border bg-card p-5 md:p-6">
                                <h2 id="learning-preparation" className="text-lg font-bold text-foreground">开始前准备什么</h2>
                                <ul className="mt-4 list-disc space-y-3 pl-4 text-sm leading-7 text-muted-foreground marker:text-[hsl(var(--topic-accent))]">
                                    {topic.preparation.map((item) => <li key={item} className="pl-1">{item}</li>)}
                                </ul>
                            </section> : null}
                            <section aria-labelledby="learning-companion" className="px-1">
                                <h2 id="learning-companion" className="text-base font-bold text-foreground">家长和同伴可以怎样陪伴</h2>
                                <p className="mt-2 text-sm leading-7 text-muted-foreground">{topic.companionNote}</p>
                            </section>
                        </aside>
                    </div>
                </section>

                <section aria-labelledby="learning-reflection" className="border-t border-border py-8 md:py-10">
                    <h2 id="learning-reflection" className="text-xl font-bold text-foreground">做完以后，把发现说清楚</h2>
                    <ul className="mt-4 grid gap-3 md:grid-cols-3">
                        {topic.reflection.map((question) => <li key={question} className="border-l-2 border-[hsl(var(--topic-accent)/0.5)] pl-4 text-sm leading-7 text-foreground/85">{question}</li>)}
                    </ul>
                </section>

                {topic.observationGuide ? (
                    <section id="record-observation" aria-labelledby="observation-site-usage" className="scroll-mt-24 border-t border-border py-8 md:py-10">
                        <h2 id="observation-site-usage" className="text-xl font-bold text-foreground">本站自然观察页面怎么用</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">想认识物种，可以先浏览；想把发现发布到这里，登录后按下面的步骤操作。</p>
                        <ol className="mt-6 max-w-3xl space-y-6">
                            {topic.observationGuide.siteUsage.map((step, index) => (
                                <li key={step.title} className="flex gap-4">
                                    <span aria-hidden="true" className="mt-0.5 w-7 shrink-0 text-xl font-black tabular-nums text-[hsl(var(--topic-accent))]">{String(index + 1).padStart(2, "0")}</span>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-bold text-foreground">{step.title}</h3>
                                        <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{step.description}</p>
                                        {step.links ? (
                                            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
                                                {step.links.map((link) => (
                                                    <Link key={link.href} href={link.href} prefetch={false} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[hsl(var(--nav-active))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--topic-accent))]">
                                                        {link.label}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>
                ) : null}

                {topic.observationGuide ? resourceSection : null}

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
