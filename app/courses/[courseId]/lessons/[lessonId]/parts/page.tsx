import { prepareLessonBomForCourse } from "@/lib/courses/lesson-materials";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Blocks, ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContextualStoreProducts } from "@/components/store/contextual-store-products";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getLessonInCourse } from "@/lib/api/courses";
import { hasKitComparison } from "@/lib/courses/course-kit-config";
import { lookupLdrawBom } from "@/lib/courses/ldraw-bom-source";
import { listStoreProductsForContext } from "@/lib/store/service";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { createClient } from "@/lib/supabase/server";
import { LessonMaterialsPreparation } from "@/components/features/courses/lesson-materials-preparation";
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
    description: `搭「${context.lesson.title}」需要哪些积木：按颜色和形状列出全部零件与数量，开搭前先配齐。${Number(courseId) === 6 ? "工程搭建可参考 45002。" : ""}`,
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
        <main id="lesson-parts" className="mx-auto w-full max-w-5xl space-y-3 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 md:space-y-5 md:px-8 md:pt-6 [&_h1]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_h2]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_h3]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_details]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_summary]:scroll-mt-[calc(4rem+env(safe-area-inset-top))]">
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

  const bom = prepareLessonBomForCourse(courseId, lookup.bom);
  const contextualStoreProducts = await listStoreProductsForContext(supabase, `lesson:${lessonId}`);

  return (
    <div className="min-h-screen app-canvas-community">
      <div className="md:hidden">
        <MobilePageHeader title="零件清单" fallbackHref={lessonHref} />
      </div>
      <main id="lesson-parts" className="mx-auto w-full max-w-5xl space-y-3 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 md:space-y-5 md:px-8 md:pt-6 [&_h1]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_h2]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_h3]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_details]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_summary]:scroll-mt-[calc(4rem+env(safe-area-inset-top))]">
        <Link
          href={lessonHref}
          className="hidden min-h-10 items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground md:inline-flex md:text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回课时
        </Link>

        <LessonMaterialsPreparation
          courseId={courseId}
          entries={bom.entries}
          partCount={bom.partCount}
          intro={
            <>
              <header className="relative pb-1 md:pr-44">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--tone-engineering)/0.12)] mb-3 px-2.5 py-1 text-xs md:mb-0 font-bold text-[hsl(var(--tone-engineering))]">
                  <Blocks className="h-3 w-3" aria-hidden />
                  {context.course.title}
                </span>
                <h1 className="mt-2 text-xl font-black tracking-tight text-foreground md:text-[1.75rem]">
                  {context.lesson.title} · 零件清单
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-5 text-muted-foreground">
                  按课上 3D 模型统计，开搭前照着找齐零件。
                </p>
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <Stat label="零件总数" value={`${bom.partCount} 块`} />
                  <Stat label="零件种类" value={`${bom.kindCount} 种`} />
                  <Stat label="搭建步数" value={`${bom.stepCount} 步`} />
                </dl>
                <Button asChild tone="brand" shape="pill" className="absolute right-0 top-0 min-h-10 gap-2 font-bold">
                  <Link href={lessonHref} prefetch={false}>
                    去搭这一课
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </header>

              {contextualStoreProducts.length > 0 ? (
                <div className="py-1">
                  <ContextualStoreProducts products={contextualStoreProducts} contextLabel="这节课的" />
                </div>
              ) : null}

            </>
          }
        />

        <details className="group border-t border-border/70 md:rounded-xl md:border-0 md:bg-background" open={!hasKitComparison(courseId)}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 md:p-5 [&::-webkit-details-marker]:hidden">
            <span>
              <h2 id="all-parts-heading" className="text-base font-black tracking-tight text-foreground md:text-lg">
                完整零件清单
              </h2>
              <span className="text-xs text-muted-foreground">
                共 {bom.kindCount} 种、{bom.partCount} 块，开搭前对着找齐
              </span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="pb-3 md:px-5 md:pb-5">
            <PartTable entries={bom.entries} />
          </div>
        </details>

        {bom.steps.length > 0 ? (
          <details className="group border-t border-border/70 md:rounded-xl md:border-0 md:bg-background">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 md:p-5 [&::-webkit-details-marker]:hidden">
              <span>
                <h2 id="step-parts-heading" className="text-base font-black tracking-tight text-foreground md:text-lg">
                  每步用到的零件
                </h2>
                <span className="text-xs text-muted-foreground">没有新增零件的步骤是对照检查步，跳过即可。</span>
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="pb-3 md:px-5 md:pb-5">
              <ol className="divide-y divide-border/70">
                {bom.steps.map((step) => (
                  <li key={step.stepIndex} className="py-4">
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
            </div>
          </details>
        ) : null}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1">
      <dt className="inline text-xs text-muted-foreground">{label} </dt>
      <dd className="inline text-xs font-bold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function PartTable({ entries }: { entries: LdrawBom["entries"] }) {
  return (
    <ul className="grid divide-y divide-border/70 md:grid-cols-2 md:gap-x-8 md:[&>li:nth-last-child(2):nth-child(odd)]:border-b-0">
      {entries.map((entry) => (
        <li
          key={`${entry.partId}|${entry.colorCode}`}
          className="flex items-center justify-between gap-3 py-3"
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
