"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Blocks, CheckCircle2, ChevronRight, Clock, ListFilter, Search, X } from "lucide-react";
import { OptimizedImage } from "@/components/ui/optimized-image";

import {
  collectLessonInitials,
  filterLessonCatalog,
  groupLessonCatalog,
  groupLessonCatalogByStage,
  type LessonCatalogFilter,
  type LessonCatalogItem,
} from "@/lib/courses/lesson-catalog";
import { cn } from "@/lib/utils";

const FILTER_OPTIONS: { key: LessonCatalogFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "model", label: "有 3D 分步" },
  { key: "todo", label: "还没做" },
  { key: "done", label: "已完成" },
];

function letterAnchorId(courseId: number, initial: string) {
  return `course-${courseId}-letter-${initial === "#" ? "other" : initial}`;
}

export function CourseLessonCatalog({
  courseId,
  lessons,
  showProgressFilters,
  desktopCards = false,
  groupByStage = false,
}: {
  courseId: number;
  lessons: LessonCatalogItem[];
  /** 未登录用户没有完成态，只显示「全部 / 有 3D 分步」 */
  showProgressFilters: boolean;
  /** 大颗粒积木目录在桌面使用成品图卡，其它大目录保留紧凑列表。 */
  desktopCards?: boolean;
  groupByStage?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LessonCatalogFilter>("all");
  const deferredQuery = useDeferredValue(query);

  const modelCount = useMemo(() => lessons.filter((lesson) => lesson.hasModel).length, [lessons]);
  const hasMixedModels = modelCount > 0 && modelCount < lessons.length;
  const visible = useMemo(
    () => filterLessonCatalog(lessons, { query: deferredQuery, filter }),
    [lessons, deferredQuery, filter],
  );
  const groups = useMemo(
    () => groupByStage ? groupLessonCatalogByStage(visible) : groupLessonCatalog(visible),
    [visible, groupByStage],
  );
  const desktopItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const initials = useMemo(() => groupByStage ? groups.map((group) => group.initial) : collectLessonInitials(visible), [visible, groups, groupByStage]);

  const options = (
    showProgressFilters
      ? FILTER_OPTIONS
      : FILTER_OPTIONS.filter((option) => option.key === "all" || option.key === "model")
  ).filter((option) => option.key !== "model" || hasMixedModels);
  const isFiltered = Boolean(query.trim()) || filter !== "all";

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="relative flex-1 md:max-w-sm">
          <span className="sr-only">在本课程内搜索课时</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="text"
            inputMode="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜课时，如「恐龙」「konglong」「kl」"
            className="h-10 w-full rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted))] pl-9 pr-9 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-[hsl(var(--brand-blue))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue)/0.25)]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="清空搜索"
              className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-[hsl(var(--surface-border)/0.6)] hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="课时筛选">
          {options.map((option) => {
            const active = filter === option.key;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option.key)}
                className={cn(
                  "inline-flex min-h-[34px] items-center gap-1 rounded-full px-3 text-xs font-bold transition",
                  active
                    ? "bg-[hsl(var(--brand-blue))] text-[hsl(var(--brand-blue-foreground))] shadow-[0_8px_18px_-14px_hsl(var(--brand-blue)/0.9)]"
                    : "bg-[hsl(var(--surface-muted))] text-muted-foreground hover:text-foreground",
                )}
              >
                {option.key === "model" ? <Blocks className="h-3.5 w-3.5" aria-hidden /> : null}
                {option.label}
                {option.key === "model" ? (
                  <span className="tabular-nums opacity-70">{modelCount}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {isFiltered ? (
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          找到 {visible.length} 节课时
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="surface-card mt-4 flex flex-col items-center gap-3 rounded-md px-6 py-12 text-center">
          <ListFilter className="h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold text-foreground">没有匹配的课时</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
            className="text-xs font-bold text-[hsl(var(--brand-blue))] hover:underline"
          >
            清除筛选
          </button>
        </div>
      ) : (
        <div className="mt-4 flex gap-4">
          {desktopCards ? (
            <ul className="hidden min-w-0 flex-1 grid-cols-2 gap-3 lg:grid xl:grid-cols-3 2xl:grid-cols-4">
              {desktopItems.map((lesson, index) => {
                const previous = desktopItems[index - 1];
                const startsGroup = !previous || previous.initial !== lesson.initial;
                return (
                  <li
                    key={lesson.id}
                    id={startsGroup ? `${letterAnchorId(courseId, lesson.initial)}-desktop` : undefined}
                    className={startsGroup ? "scroll-mt-24" : undefined}
                  >
                    {startsGroup ? <h3 className="sr-only">{lesson.initial}</h3> : null}
                    <LessonCard courseId={courseId} lesson={lesson} />
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div className={cn("min-w-0 flex-1 space-y-5", desktopCards && "lg:hidden")}>
            {groups.map((group) => (
              <section
                key={group.initial}
                id={letterAnchorId(courseId, group.initial)}
                className="scroll-mt-20"
                aria-labelledby={`${letterAnchorId(courseId, group.initial)}-heading`}
              >
                <h3
                  id={`${letterAnchorId(courseId, group.initial)}-heading`}
                  className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground"
                >
                  {groupByStage ? `第 ${group.initial} 阶段 · ${group.items[0]?.stageTitle ?? "学习与创作"}` : group.initial}
                </h3>
                <ul className="space-y-2">
                  {group.items.map((lesson) => (
                    <li key={lesson.id}>
                      <LessonRow courseId={courseId} lesson={lesson} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <nav
            aria-label={groupByStage ? "按学习阶段跳转" : "按名称首字母跳转"}
            className="sticky top-20 hidden h-fit shrink-0 flex-col items-center gap-0.5 rounded-full bg-[hsl(var(--surface-muted))] px-1.5 py-2 text-[10px] font-bold text-muted-foreground lg:flex"
          >
            {initials.map((initial) => (
              <a
                key={initial}
                href={`#${letterAnchorId(courseId, initial)}${desktopCards ? "-desktop" : ""}`}
                className={cn("grid h-5 place-items-center rounded-full transition hover:bg-[hsl(var(--brand-blue)/0.12)] hover:text-[hsl(var(--brand-blue))]", groupByStage ? "min-w-12 px-1" : "w-5")}
              >
                {groupByStage ? `第${initial}阶段` : initial}
              </a>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

function LessonRow({ courseId, lesson }: { courseId: number; lesson: LessonCatalogItem }) {
  return (
    <Link
      href={`/courses/${courseId}/lessons/${lesson.id}`}
      prefetch={false}
      className="surface-card surface-card-interactive group flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 transition-all hover:border-[hsl(var(--brand-blue)/0.4)] md:px-4 md:py-3"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="min-w-0 break-words text-sm font-bold text-foreground transition-colors group-hover:text-[hsl(var(--brand-blue))] md:text-[15px]">
          {lesson.title}
        </span>
        {lesson.isCompleted ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[hsl(var(--status-success)/0.1)] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--status-success))]">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            已完成
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        {lesson.durationMinutes ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="h-3 w-3" aria-hidden />
            约 {lesson.durationMinutes} 分钟
          </span>
        ) : null}
        <ChevronRight
          aria-hidden
          className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(var(--brand-blue))]"
        />
      </div>
    </Link>
  );
}

function LessonCard({ courseId, lesson }: { courseId: number; lesson: LessonCatalogItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(lesson.finishedImageUrl) && !imageFailed;

  return (
    <Link
      href={`/courses/${courseId}/lessons/${lesson.id}`}
      prefetch={false}
      className="surface-card surface-card-interactive group flex h-full min-w-0 flex-col overflow-hidden rounded-xl transition-all hover:border-[hsl(var(--brand-blue)/0.4)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue)/0.45)]"
    >
      <div className={cn("relative w-full overflow-hidden bg-[hsl(var(--surface-muted))]", hasImage ? "aspect-[4/3]" : "min-h-14")}>
        {hasImage ? (
          <OptimizedImage
            src={lesson.finishedImageUrl as string}
            alt={`${lesson.title}成品参考图`}
            fill
            variant="card"
            sizes="(max-width: 1279px) 45vw, (max-width: 1535px) 30vw, 23vw"
            className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="grid min-h-14 place-items-center px-5 py-3 text-center text-sm font-semibold text-muted-foreground">
            {imageFailed ? "图片暂时无法显示" : "暂无成品图"}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h4 className="min-w-0 break-words text-[15px] font-bold leading-snug text-foreground transition-colors group-hover:text-[hsl(var(--brand-blue))]">
            {lesson.title}
          </h4>
          {lesson.isCompleted ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--status-success))]" aria-label="已完成" />
          ) : null}
        </div>
        <div className="mt-auto flex min-h-5 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {lesson.durationMinutes ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="h-3 w-3" aria-hidden />
              约 {lesson.durationMinutes} 分钟
            </span>
          ) : null}
          {lesson.hasModel ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--brand-blue)/0.11)] px-2 py-0.5 font-bold text-[hsl(var(--brand-blue))]">
              <Blocks className="h-3 w-3" aria-hidden />
              3D
            </span>
          ) : null}
          {lesson.isCompleted ? <span className="font-semibold text-[hsl(var(--status-success))]">已完成</span> : null}
        </div>
      </div>
    </Link>
  );
}
