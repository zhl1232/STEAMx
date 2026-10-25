import { LessonPartsUnavailable } from "@/components/features/courses/lesson-parts-unavailable";
import { prepareLessonBomForCourse } from "@/lib/courses/lesson-materials";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContextualStoreProducts } from "@/components/store/contextual-store-products";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getLessonInCourse } from "@/lib/api/courses";
import { hasKitComparison } from "@/lib/courses/course-kit-config";
import { lookupLdrawBom } from "@/lib/courses/ldraw-bom-source";
import { listStoreProductsForContext } from "@/lib/store/service";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { createClient } from "@/lib/supabase/server";
import { LessonMaterialsPreparation, MaterialPartTable as PartTable } from "@/components/features/courses/lesson-materials-preparation";

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
        <main id="lesson-parts" className="app-shell-standard space-y-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 md:space-y-6 md:pt-6 [&_h1]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_h2]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_h3]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_details]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_summary]:scroll-mt-[calc(4rem+env(safe-area-inset-top))]">
          <LessonPartsUnavailable key={lessonHref} lessonHref={lessonHref} />
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
      <main id="lesson-parts" className="app-shell-standard space-y-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 md:space-y-6 md:pt-6 [&_h1]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_h2]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_h3]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_details]:scroll-mt-[calc(4rem+env(safe-area-inset-top))] [&_summary]:scroll-mt-[calc(4rem+env(safe-area-inset-top))]">
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
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{context.course.title}</p>
                  <h1 className="mt-1 text-xl font-semibold leading-8 tracking-tight text-foreground md:text-3xl md:leading-10">
                    {context.lesson.title} · 零件清单
                  </h1>
                </div>
                <Button asChild variant="outline" className="min-h-11 shrink-0 gap-1">
                  <Link href={lessonHref} prefetch={false}>
                    去搭建
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
        >

        <details className="group rounded-md bg-background" open>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4 md:p-5 [&::-webkit-details-marker]:hidden">
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id="all-parts-heading" className="text-base font-semibold text-foreground md:text-lg">
                完整零件清单
              </h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {bom.kindCount} 种 · {bom.partCount} 块
              </span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="px-1 pb-2 md:px-2 md:pb-3">
            <PartTable entries={bom.entries} showAvailability={hasKitComparison(courseId)} />
          </div>
        </details>

        {bom.steps.length > 0 ? (
          <details className="group border-t border-border/70">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-4 [&::-webkit-details-marker]:hidden">
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 id="step-parts-heading" className="text-sm font-semibold text-foreground">
                  每步用到的零件
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground">{bom.stepCount} 步</span>
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="pb-3 md:px-5 md:pb-5">
              <ol className="divide-y divide-border/70">
                {bom.steps.map((step) => (
                  <li key={step.stepIndex} className="py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground">第 {step.stepIndex + 1} 步</h3>
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        新增 {step.partCount} 块
                      </span>
                    </div>
                    {step.entries.length > 0 ? (
                      <div className="mt-3">
                        <PartTable entries={step.entries} />
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">无新增零件</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </details>
        ) : null}
        </LessonMaterialsPreparation>
      </main>
    </div>
  );
}
