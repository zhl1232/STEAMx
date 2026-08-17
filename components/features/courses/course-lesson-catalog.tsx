"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Blocks, CheckCircle2, ChevronRight, Clock, ListFilter, Search, X } from "lucide-react";

import {
  collectLessonInitials,
  filterLessonCatalog,
  groupLessonCatalog,
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
}: {
  courseId: number;
  lessons: LessonCatalogItem[];
  /** 未登录用户没有完成态，只显示「全部 / 有 3D 分步」 */
  showProgressFilters: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LessonCatalogFilter>("all");
  const deferredQuery = useDeferredValue(query);

  const modelCount = useMemo(() => lessons.filter((lesson) => lesson.hasModel).length, [lessons]);
  const visible = useMemo(
    () => filterLessonCatalog(lessons, { query: deferredQuery, filter }),
    [lessons, deferredQuery, filter],
  );
  const groups = useMemo(() => groupLessonCatalog(visible), [visible]);
  const initials = useMemo(() => collectLessonInitials(visible), [visible]);

  const options = showProgressFilters
    ? FILTER_OPTIONS
    : FILTER_OPTIONS.filter((option) => option.key === "all" || option.key === "model");
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
                    ? "bg-foreground text-background"
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

      <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
        {isFiltered ? `筛出 ${visible.length} 节` : `共 ${lessons.length} 节，按名称首字母排列`}
      </p>

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
          <div className="min-w-0 flex-1 space-y-5">
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
                  {group.initial}
                </h3>
                <ul className="space-y-2.5">
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
            aria-label="按名称首字母跳转"
            className="sticky top-20 hidden h-fit shrink-0 flex-col items-center gap-0.5 rounded-full bg-[hsl(var(--surface-muted))] px-1.5 py-2 text-[10px] font-bold text-muted-foreground lg:flex"
          >
            {initials.map((initial) => (
              <a
                key={initial}
                href={`#${letterAnchorId(courseId, initial)}`}
                className="grid h-5 w-5 place-items-center rounded-full transition hover:bg-[hsl(var(--brand-blue)/0.12)] hover:text-[hsl(var(--brand-blue))]"
              >
                {initial}
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
    <div className="surface-card surface-card-interactive group relative flex items-center gap-3 rounded-md p-3.5 md:gap-4 md:p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {/* 整张卡可点：标题链接铺满卡片，零件清单入口叠在它上层 */}
          <Link
            href={`/courses/${courseId}/lessons/${lesson.id}`}
            prefetch={false}
            className="truncate text-[15px] font-bold leading-snug text-foreground outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline md:text-base"
          >
            {lesson.title}
          </Link>
          {lesson.isCompleted ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[hsl(var(--status-success))]">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              已完成
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {lesson.durationMinutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />约 {lesson.durationMinutes} 分钟
            </span>
          ) : null}
          {lesson.hasModel ? (
            <Link
              href={`/courses/${courseId}/lessons/${lesson.id}/parts`}
              prefetch={false}
              className="relative z-10 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--tone-engineering)/0.12)] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--tone-engineering))] transition hover:bg-[hsl(var(--tone-engineering)/0.2)]"
            >
              <Blocks className="h-3 w-3" aria-hidden />
              零件清单
            </Link>
          ) : null}
          {lesson.typeLabel ? (
            <span className="inline-flex items-center rounded-full bg-[hsl(var(--surface-muted))] px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
              {lesson.typeLabel}
            </span>
          ) : null}
          {lesson.trackLabel ? (
            <span className="inline-flex items-center rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--brand-blue))]">
              {lesson.trackLabel}
            </span>
          ) : null}
        </div>
      </div>
      <ChevronRight
        aria-hidden
        className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-[hsl(var(--brand-blue))]"
      />
    </div>
  );
}
