import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Blocks, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getLessonInCourse } from "@/lib/api/courses";
import { lookupLdrawBom } from "@/lib/courses/ldraw-bom-source";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { createClient } from "@/lib/supabase/server";
import type { LdrawBom } from "@/lib/utils/ldraw-bom";

type PageProps = { params: Promise<{ courseId: string; lessonId: string }> };

function readLdrawModelUrl(content: unknown): string | null {
  const building3d = (content as { building3d?: { ldrawModelUrl?: unknown } } | null)?.building3d;
  return typeof building3d?.ldrawModelUrl === "string" ? building3d.ldrawModelUrl : null;
}

export async function generateMetadata({ params }: PageProps) {
  const { courseId, lessonId } = await params;
  const supabase = await createClient();
  const context = await getLessonInCourse(supabase, Number(courseId), Number(lessonId));
  const path = `/courses/${courseId}/lessons/${lessonId}/parts`;
  if (!context) {
    return buildPageMetadata({ title: "零件清单", description: "大颗粒积木课零件清单", path });
  }
  return buildPageMetadata({
    title: `${context.lesson.title} 零件清单`,
    description: `搭「${context.lesson.title}」需要哪些积木：按颜色和形状列出全部零件与数量，开搭前先配齐。`,
    path,
  });
}

/**
 * 零件清单页：家长在开搭前（或在玩具店里）确认这节课要用哪些积木。
 * 服务端直出，不加载 three.js，也不需要登录。
 */
export default async function LessonPartsPage({ params }: PageProps) {
  const { courseId: cRaw, lessonId: lRaw } = await params;
  const courseId = Number(cRaw);
  const lessonId = Number(lRaw);
  if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) notFound();

  const supabase = await createClient();
  const context = await getLessonInCourse(supabase, courseId, lessonId);
  if (!context) notFound();

  const lookup = await lookupLdrawBom(readLdrawModelUrl(context.lesson.content));
  if (lookup.status === "missing") notFound();

  const lessonHref = `/courses/${courseId}/lessons/${lessonId}`;

  // 有模型但一时算不出清单：给个可重试的说明，别把这个 URL 变成 404
  if (lookup.status === "unavailable") {
    return (
      <div className="min-h-screen app-canvas-community">
        <div className="md:hidden">
          <MobilePageHeader title="零件清单" fallbackHref={lessonHref} />
        </div>
        <main className="app-shell pb-28 pt-4 md:py-6">
          <div className="surface-card rounded-xl p-6 text-center md:p-10">
            <h1 className="text-xl font-black tracking-tight text-foreground">零件清单正在生成</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              这节课的清单一时没算出来，刷新一下通常就好了。着急的话也可以直接进课时，搭建界面里同样能看到每一步用的零件。
            </p>
            <Button asChild className="mt-5">
              <Link href={lessonHref} prefetch={false}>
                进入课时
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const bom = lookup.bom;

  return (
    <div className="min-h-screen app-canvas-community">
      <div className="md:hidden">
        <MobilePageHeader title="零件清单" fallbackHref={lessonHref} />
      </div>
      <main className="app-shell pb-28 pt-4 md:py-6">
        <Link
          href={lessonHref}
          className="mb-3 hidden items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground md:mb-4 md:inline-flex md:text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回课时
        </Link>

        <header className="surface-card rounded-xl p-5 md:p-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--tone-engineering)/0.12)] px-2.5 py-1 text-[11px] font-bold text-[hsl(var(--tone-engineering))]">
            <Blocks className="h-3 w-3" aria-hidden />
            {context.course.title}
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-foreground md:text-[1.75rem]">
            {context.lesson.title} · 零件清单
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            开搭前照这份清单把零件找齐，中途就不用停下来翻盒子。数量按 3D 模型统计，和课上的分步搭建一致。
          </p>
          <dl className="mt-4 flex flex-wrap gap-2">
            <Stat label="零件总数" value={`${bom.partCount} 块`} />
            <Stat label="零件种类" value={`${bom.kindCount} 种`} />
            <Stat label="搭建步数" value={`${bom.stepCount} 步`} />
          </dl>
          <Button asChild tone="brand" shape="pill" className="mt-5 gap-2 font-bold">
            <Link href={lessonHref} prefetch={false}>
              去搭这一课
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </header>

        <section className="mt-6" aria-labelledby="all-parts-heading">
          <h2 id="all-parts-heading" className="mb-3 text-base font-black tracking-tight text-foreground md:text-lg">
            全部零件
          </h2>
          <PartTable entries={bom.entries} />
        </section>

        {bom.steps.length > 0 ? (
          <section className="mt-8" aria-labelledby="step-parts-heading">
            <h2
              id="step-parts-heading"
              className="mb-1 text-base font-black tracking-tight text-foreground md:text-lg"
            >
              每步用到的零件
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">没有新增零件的步骤是对照检查步，跳过即可。</p>
            <ol className="space-y-3">
              {bom.steps.map((step) => (
                <li key={step.stepIndex} className="surface-card rounded-md p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-bold text-foreground">第 {step.stepIndex + 1} 步</h3>
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                      新增 {step.partCount} 块
                    </span>
                  </div>
                  {step.entries.length > 0 ? (
                    <div className="mt-3">
                      <PartTable entries={step.entries} />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">这一步只做对照检查，没有新增零件。</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full bg-[hsl(var(--surface-muted))] px-3 py-1.5">
      <dt className="inline text-xs text-muted-foreground">{label} </dt>
      <dd className="inline text-xs font-bold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function PartTable({ entries }: { entries: LdrawBom["entries"] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {entries.map((entry) => (
        <li
          key={`${entry.partId}|${entry.colorCode}`}
          className="flex items-center justify-between gap-3 rounded-sm border border-border bg-background px-3 py-2"
          title={entry.partDescription || undefined}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 rounded-sm border border-black/15 dark:border-white/25"
              style={{ backgroundColor: entry.colorHex }}
            />
            <span className="min-w-0 text-sm font-medium leading-snug text-foreground">
              {entry.colorName}
              {entry.partName}
            </span>
          </span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
            ×{entry.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
