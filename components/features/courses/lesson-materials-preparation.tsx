"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CheckCircle2, ChevronDown, Minus, PackageSearch, Plus, ShoppingBasket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { describeLdrawColorName, type LdrawBomEntry } from "@/lib/utils/ldraw-bom";
import {
  KIT_CATALOG,
  getDefaultKitCounts,
  hasKitComparison,
  kitCountsToSelections,
  type KitCounts,
  type KitSetNum,
} from "@/lib/courses/course-kit-config";
import {
  MAX_KIT_COPIES,
  mergeLessonMaterialPreferences,
  readStoredKitCounts,
  writeStoredKitCounts,
} from "@/lib/courses/lesson-material-preferences";
import {
  compareLessonMaterials,
  mergeKitInventories,
  summarizeMaterialOutcome,
  type MaterialRequirement,
} from "@/lib/courses/lesson-materials";
import { getPartThumbnail } from "@/lib/courses/part-thumbnails";

/** 套装里没有、也不在 LDraw 官方库的特殊件，给一个家长能看懂的名字。 */
const SPECIAL_PART_NAMES: Record<string, string> = {
  "31196c01.dat": "Toolo 座舱（4×6）",
};

export interface LessonMaterialsPreparationProps {
  courseId: number;
  entries: LdrawBomEntry[];
  partCount: number;
  /** 测试/预览用：跳过 localStorage，直接用这组套数 */
  initialCounts?: KitCounts;
}

export function LessonMaterialsPreparation({
  courseId,
  entries,
  partCount,
  initialCounts,
}: LessonMaterialsPreparationProps) {
  const [counts, setCounts] = useState<KitCounts>(() => initialCounts ?? getDefaultKitCounts(courseId));
  const [loaded, setLoaded] = useState(Boolean(initialCounts));

  // 服务端先按课程默认值渲染，挂载后再读本地记忆，避免水合不一致。
  useEffect(() => {
    if (initialCounts) return;
    // localStorage 是外部存储，只能在挂载后读取；服务端用默认值保证水合一致。
    // oxlint-disable-next-line react/set-state-in-effect
    setCounts(readStoredKitCounts(safeLocalStorage(), courseId));
    setLoaded(true);
  }, [courseId, initialCounts]);

  useEffect(() => {
    if (loaded && !initialCounts) writeStoredKitCounts(safeLocalStorage(), courseId, counts);
  }, [counts, courseId, loaded, initialCounts]);

  const result = useMemo(() => {
    const prefs = mergeLessonMaterialPreferences(courseId, { kits: kitCountsToSelections(counts) });
    return compareLessonMaterials(
      { entries, partCount, kindCount: entries.length, stepCount: 0, steps: [] },
      mergeKitInventories(prefs.kits),
      prefs,
    );
  }, [counts, courseId, entries, partCount]);

  if (!hasKitComparison(courseId)) return null;

  const outcome = summarizeMaterialOutcome(result);
  const totalKits = Object.values(counts).reduce((n, c) => n + c, 0);
  const shortage = [...result.requiredMissing].sort((a, b) => b.missing - a.missing);
  const isComplete = outcome.status === "complete";

  // 用函数式更新，连续快速点击也不会丢次数。
  const adjustCount = (setNum: KitSetNum, delta: number) =>
    setCounts((prev) => ({ ...prev, [setNum]: Math.min(MAX_KIT_COPIES, Math.max(0, prev[setNum] + delta)) }));

  return (
    <section className="mt-6 space-y-4" aria-labelledby="kit-check-heading">
      <h2 id="kit-check-heading" className="sr-only">
        用我的套装能不能搭
      </h2>

      {/* 一句话结论 */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-start gap-3 rounded-xl border p-4 md:p-5",
          isComplete
            ? "border-[hsl(var(--status-success-border))] bg-[hsl(var(--status-success-surface))]"
            : "border-[hsl(var(--brand-amber-border))] bg-[hsl(var(--brand-amber-soft))]",
        )}
      >
        {isComplete ? (
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[hsl(var(--status-success))]" aria-hidden />
        ) : (
          <ShoppingBasket className="mt-0.5 h-6 w-6 shrink-0 text-[hsl(var(--brand-amber))]" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="text-lg font-black leading-snug text-foreground md:text-xl">
            {totalKits === 0
              ? "先在下面填上你有几套积木"
              : isComplete
                ? "用你的套装可以搭完"
                : `还差 ${outcome.missingKinds} 种、共 ${outcome.missingPieces} 块`}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {isComplete
              ? "套装里的积木数量够用，颜色不一样的地方可以换着用。"
              : "按你填的套装数量算出来的，补齐下面「需要补买」的积木就能搭完。"}
            {outcome.specialPieces > 0 ? ` 另有 ${outcome.specialPieces} 块特殊零件需要单独准备。` : null}
          </p>
        </div>
      </div>

      {/* 套装数量 */}
      <div className="surface-card rounded-xl p-4 md:p-5">
        <h3 className="text-base font-black text-foreground">你有几套？</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">没有的填 0，改完马上重新计算，会记在这台设备上。</p>
        <ul className="mt-3 grid gap-2 pr-14 sm:grid-cols-2 sm:pr-0">
          {KIT_CATALOG.map((kit) => (
            <li
              key={kit.setNum}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-2.5 transition-colors",
                counts[kit.setNum] > 0
                  ? "border-[hsl(var(--brand-blue-border))] bg-[hsl(var(--brand-blue-soft))]"
                  : "border-border bg-background",
              )}
            >
              <Image
                src={kit.image}
                alt=""
                width={56}
                height={40}
                className="h-10 w-14 shrink-0 rounded-sm bg-white object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{kit.name}</p>
                <p className="text-xs text-muted-foreground">{kit.code}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  aria-label={`${kit.name}减少一套`}
                  disabled={counts[kit.setNum] <= 0}
                  onClick={() => adjustCount(kit.setNum, -1)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <output
                  aria-label={`${kit.name}套数`}
                  className="w-7 text-center text-base font-black tabular-nums text-foreground"
                >
                  {counts[kit.setNum]}
                </output>
                <Button
                  type="button"
                  tone="brand"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  aria-label={`${kit.name}增加一套`}
                  disabled={counts[kit.setNum] >= MAX_KIT_COPIES}
                  onClick={() => adjustCount(kit.setNum, 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 需要补买 */}
      {shortage.length > 0 ? (
        <div className="surface-card rounded-xl p-4 md:p-5">
          <h3 className="text-base font-black text-foreground">需要补买</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">按还差的块数排序，颜色以色块为准。</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {shortage.map((entry) => (
              <PartRow key={rowKey(entry)} entry={entry}>
                <span className="shrink-0 rounded-full bg-[hsl(var(--brand-amber-soft))] px-2.5 py-1 text-sm font-black tabular-nums text-[hsl(var(--brand-amber-foreground))]">
                  还差 {entry.missing} 块
                </span>
              </PartRow>
            ))}
          </ul>
        </div>
      ) : null}

      {result.figureDemand > 0 ? (
        <p className="rounded-lg bg-[hsl(var(--surface-muted))] px-4 py-3 text-sm leading-6 text-foreground">
          这一课里有 <strong>{result.figureDemand}</strong> 个小人。小人按整个算，用套装里的小人就行，衣服颜色不用一样。
        </p>
      ) : null}

      {/* 可替代 */}
      {result.colorSubstitutes.length > 0 ? (
        <Fold
          title="可以用其它颜色或零件代替"
          count={result.stats.substituted}
          hint="颜色或图案不一样可以换着用，大的薄板可以拼成小的，按下面的提示搭就不用另买。"
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {result.colorSubstitutes.map((entry) => (
              <PartRow key={rowKey(entry)} entry={entry} detail={substituteDetail(entry)}>
                <span className="shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
                  {entry.substituted} 块
                </span>
              </PartRow>
            ))}
          </ul>
        </Fold>
      ) : null}

      {/* 可选底板 */}
      {result.optionalMissing.length > 0 ? (
        <Fold
          title="可选（底板等）"
          count={result.stats.optionalMissing}
          hint="底板主要用来摆放和展示，没有也能搭；想做得和图里一样再补。"
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {result.optionalMissing.map((entry) => (
              <PartRow key={rowKey(entry)} entry={entry}>
                <span className="shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
                  {entry.missing} 块
                </span>
              </PartRow>
            ))}
          </ul>
        </Fold>
      ) : null}

      {/* 套装里没有的零件 */}
      {result.unknown.length > 0 ? (
        <p className="flex items-start gap-2 px-1 text-xs leading-5 text-muted-foreground">
          <PackageSearch className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            套装里没有的零件：
            {result.unknown
              .map((entry) => `${entry.colorName}${SPECIAL_PART_NAMES[entry.partId] ?? entry.partName} ${entry.missing} 块`)
              .join("、")}
            。这是课件里的特殊零件，可以用手边的积木自由搭一个代替。
          </span>
        </p>
      ) : null}
    </section>
  );
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function rowKey(entry: MaterialRequirement) {
  return `${entry.partId}|${entry.colorCode}`;
}

function substituteDetail(entry: MaterialRequirement): string {
  const substitutions = entry.allocations.filter((a) => a.substitute);
  if (substitutions.some((a) => a.areaLabel)) {
    const used = substitutions.map((a) =>
      `${a.quantity} 块${describeLdrawColorName(a.colorName)}${a.areaLabel ? ` ${a.areaLabel}` : "同款零件"}`,
    );
    return `用 ${used.join("、")}代替`;
  }
  const used = substitutions.map((a) => `${describeLdrawColorName(a.colorName)} ${a.quantity} 块`);
  return used.length ? `可以用 ${used.join("、")}` : "";
}

function PartRow({
  entry,
  detail,
  children,
}: {
  entry: MaterialRequirement;
  detail?: string;
  children: React.ReactNode;
}) {
  const thumb = getPartThumbnail(entry.partId, entry.colorCode);
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5">
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/5">
        {thumb ? (
          <Image src={thumb.src} alt="" width={48} height={48} className="h-12 w-12 object-contain" />
        ) : (
          <span aria-hidden className="h-7 w-9 rounded-sm" style={{ backgroundColor: entry.colorHex }} />
        )}
        {thumb && !thumb.exactColor ? (
          <span
            aria-hidden
            className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border border-white"
            style={{ backgroundColor: entry.colorHex }}
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-bold leading-snug text-foreground">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-sm border border-black/15"
            style={{ backgroundColor: entry.colorHex }}
          />
          <span className="min-w-0">
            {entry.figureFolded ? "" : entry.colorName}
            {SPECIAL_PART_NAMES[entry.partId] ?? entry.partName}
          </span>
        </span>
        {detail ? <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      {children}
    </li>
  );
}

function Fold({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count: number;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group surface-card rounded-xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 md:p-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-base font-black text-foreground">
            {title} <span className="text-sm font-bold text-muted-foreground">· {count} 块</span>
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{hint}</span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-4 pb-4 md:px-5 md:pb-5">{children}</div>
    </details>
  );
}
