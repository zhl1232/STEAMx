import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, CircleDashed, ListFilter, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { natureTopicLabels } from "@/lib/config/nature-topics";
import { getSpeciesList } from "@/lib/api/nature-observation-data";
import {
  normalizeSpeciesObservationStatusFilter,
  type SpeciesObservationStatusFilter,
} from "@/lib/observations/progress";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { cn } from "@/lib/utils";
import { normalizeSpeciesTopicFilter, type SpeciesTopicFilter } from "@/lib/utils/nature-topic-classification";
import { SpeciesListLoadMore } from "./species-list-load-more";

const SPECIES_PAGE_SIZE = 12;

export const metadata: Metadata = buildPageMetadata({
  title: "物种探索清单",
  description: "浏览自然观察频道中的物种探索清单，查看已观察、待观察和各专题物种进度。",
  path: "/nature/species",
  keywords: ["物种探索清单", "自然观察", "物种识别", "观察进度"],
});

interface SpeciesPageProps {
  searchParams: Promise<{ q?: string; page?: string; topic?: string; status?: string }>;
}

function buildSpeciesHref({
  query,
  topic,
  status,
}: {
  query?: string;
  topic?: string;
  status?: SpeciesObservationStatusFilter;
}) {
  const queryParams = new URLSearchParams();
  if (query) queryParams.set("q", query);
  if (topic && topic !== "all") queryParams.set("topic", topic);
  if (status && status !== "all") queryParams.set("status", status);
  const serialized = queryParams.toString();
  return serialized ? `/nature/species?${serialized}` : "/nature/species";
}

function getTopicPageCopy(topic: SpeciesTopicFilter) {
  if (topic === "all") {
    return {
      title: "物种探索清单",
      label: "全部物种",
      image: "/assets/species-archive-blue-tech-bg.png",
    };
  }

  const label = natureTopicLabels[topic];
  return {
    title: `${label}探索清单`,
    label,
    image: "/assets/species-archive-blue-tech-bg.png",
  };
}

const STATUS_FILTERS: Array<{
  key: SpeciesObservationStatusFilter;
  label: string;
  summaryLabel: string;
}> = [
  { key: "all", label: "全部", summaryLabel: "全部物种" },
  { key: "unobserved", label: "待观察", summaryLabel: "待观察" },
  { key: "observed", label: "已观察", summaryLabel: "已观察" },
];

export default async function SpeciesPage({ searchParams }: SpeciesPageProps) {
  const params = await searchParams;
  const page = Math.max(0, parseInt(params.page || "0", 10) || 0);
  const query = params.q || undefined;
  const topic = normalizeSpeciesTopicFilter(params.topic);
  const status = normalizeSpeciesObservationStatusFilter(params.status);
  const isProgressStatusRequested = status !== "all";
  const fromHref = (() => {
    const queryParams = new URLSearchParams();
    if (query) queryParams.set("q", query);
    if (topic !== "all") queryParams.set("topic", topic);
    if (isProgressStatusRequested) queryParams.set("status", status);
    if (page > 0) queryParams.set("page", String(page));
    const serialized = queryParams.toString();
    return serialized ? `/nature/species?${serialized}` : "/nature/species";
  })();
  const {
    species,
    hasMore,
    total,
    topicCounts,
    observedCount,
    unobservedCount,
    progressPercent,
    isProgressAvailable,
  } = await getSpeciesList({
    query,
    topic,
    status,
    page,
    pageSize: SPECIES_PAGE_SIZE,
  });
  const activeTopicCount = topicCounts.find((item) => item.key === topic);
  const topicCopy = getTopicPageCopy(topic);
  const activeTopicLabel = activeTopicCount?.label ?? topicCopy.label;
  const effectiveStatus = isProgressAvailable ? status : "all";
  const progressLabel = isProgressAvailable
    ? "审核通过的观察记录会点亮这个范围内的物种"
    : "登录后会显示你的自然观察点亮进度";
  const activeStatusLabel = STATUS_FILTERS.find((item) => item.key === effectiveStatus)?.summaryLabel ?? "全部物种";
  const listHeading = effectiveStatus === "all" ? activeTopicLabel : `${activeTopicLabel} · ${activeStatusLabel}`;
  const allStatusCount = isProgressAvailable ? observedCount + unobservedCount : activeTopicCount?.count ?? total;

  return (
    <div className="app-shell-wide pb-24 pt-0 md:px-8 md:pb-10 md:pt-8">
      <MobilePageHeader
        title="物种"
        fallbackHref="/nature"
      />

      <section className="nature-species-hero relative overflow-hidden">
        <Image
          src={topicCopy.image}
          alt=""
          fill
          priority
          className="object-cover opacity-30 dark:opacity-16"
          sizes="(min-width: 1840px) 1776px, (min-width: 768px) calc(100vw - 4rem), 100vw"
        />
        <div className="nature-species-hero-overlay absolute inset-0" />

        <div className="relative grid gap-6 px-5 py-6 sm:px-7 sm:py-7 lg:min-h-[300px] lg:grid-cols-[minmax(0,1fr)_minmax(380px,560px)] lg:items-center lg:px-8">
          <div className="min-w-0">
            <p className="nature-species-kicker text-[11px] font-semibold uppercase tracking-[0.28em]">自然观察</p>
            <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight md:text-5xl">{topicCopy.title}</h1>
          </div>

          <div className="nature-species-control-panel w-full">
            <div className="nature-species-progress-block">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">自然观察进度</p>
                  <p className="mt-1 text-xs text-muted-foreground">{progressLabel}</p>
                </div>
                <span className="nature-species-progress-badge">
                  {isProgressAvailable ? `${progressPercent}%` : "未登录"}
                </span>
              </div>
              <div
                className="nature-species-progress-track"
                role="progressbar"
                aria-label="自然观察进度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={isProgressAvailable ? progressPercent : 0}
              >
                <div
                  className="nature-species-progress-fill"
                  style={{ width: `${isProgressAvailable ? progressPercent : 0}%` }}
                />
              </div>
            </div>

            <form className="mt-5" action="/nature/species" method="get">
              <div className="flex items-center gap-2.5">
                {topic !== "all" ? <input type="hidden" name="topic" value={topic} /> : null}
                {effectiveStatus !== "all" ? <input type="hidden" name="status" value={effectiveStatus} /> : null}
                <div className="group relative flex-1">
                  <div className="pointer-events-none absolute bottom-0 left-3.5 top-0 flex items-center text-muted-foreground transition-colors group-focus-within:text-[hsl(var(--brand-blue))]">
                    <Search className="h-4 w-4" aria-hidden />
                  </div>
                  <input
                    type="text"
                    name="q"
                    defaultValue={query || ""}
                    placeholder="搜索物种名称、学名或科属"
                    className="block w-full rounded-md border border-[hsl(var(--surface-border))] bg-background/70 py-2.5 pl-10 pr-3 text-sm text-foreground shadow-sm transition-all placeholder:text-muted-foreground/80 hover:bg-background focus:border-[hsl(var(--brand-blue)/0.6)] focus:bg-background focus:outline-none focus:ring-[3px] focus:ring-[hsl(var(--brand-blue)/0.12)]"
                    autoComplete="off"
                  />
                </div>
                <Button
                  type="submit"
                  tone="brand"
                  shape="soft"
                  className="shrink-0 self-stretch px-5 text-sm font-semibold tracking-wide active:scale-95"
                >
                  搜索
                </Button>
              </div>
              {query ? (
                <Link
                  href={buildSpeciesHref({ topic, status: effectiveStatus })}
                  className="mt-3 inline-flex text-sm font-medium text-[hsl(var(--primary))] underline-offset-4 transition-colors hover:text-[hsl(var(--primary)/0.82)] hover:underline"
                >
                  清除筛选
                </Link>
              ) : null}
            </form>

            <div className="nature-species-filter-stack">
              <div className="nature-species-topic-row" aria-label="物种分类筛选">
                {topicCounts.map((item) => {
                  const active = item.key === topic;
                  return (
                    <Link
                      key={item.key}
                      href={buildSpeciesHref({ query, topic: item.key, status: effectiveStatus })}
                      className={cn("nature-species-topic-chip", active && "nature-species-topic-chip-active")}
                      aria-current={active ? "page" : undefined}
                    >
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div className="nature-species-status-toggle" aria-label="观察状态筛选">
                {STATUS_FILTERS.map((item) => {
                  const active = item.key === effectiveStatus;
                  const count =
                    item.key === "observed"
                      ? observedCount
                      : item.key === "unobserved"
                        ? unobservedCount
                        : allStatusCount;
                  const Icon = item.key === "observed" ? CheckCircle2 : item.key === "unobserved" ? CircleDashed : ListFilter;
                  return (
                    <Link
                      key={item.key}
                      href={buildSpeciesHref({ query, topic, status: item.key })}
                      className={cn(
                        "nature-species-status-option",
                        active && "nature-species-status-option-active",
                        item.key === "unobserved" && "nature-species-status-option-unobserved",
                      )}
                      aria-label={
                        isProgressAvailable
                          ? `${item.label}，${count.toLocaleString()} 个物种`
                          : item.key === "all"
                            ? `全部，${count.toLocaleString()} 个物种`
                            : `${item.label}，登录后可用`
                      }
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        <span>{item.label}</span>
                      </span>
                      <span className="nature-species-status-count">
                        {isProgressAvailable || item.key === "all" ? count.toLocaleString() : "登录"}
                      </span>
                    </Link>
                  );
                })}
              </div>

              {!isProgressAvailable ? (
                <p className="nature-species-login-note">
                  登录后，审核通过的观察记录在社群确认物种或 AI 高置信度鉴定后会点亮对应物种，并启用“待观察 / 已观察”筛选。
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {listHeading}
          </p>
          {query ? (
            <p className="mt-1 text-xs leading-5 text-[hsl(var(--primary))]">
              关键词「{query}」
            </p>
          ) : null}
        </div>
      </div>

      {species.length > 0 ? (
        <SpeciesListLoadMore
          key={`${query ?? ""}-${topic}-${effectiveStatus}-${page}`}
          initialSpecies={species}
          initialPage={page}
          pageSize={SPECIES_PAGE_SIZE}
          query={query}
          topic={topic}
          status={effectiveStatus}
          initialHasMore={hasMore}
          total={total}
          fromHref={fromHref}
        />
      ) : null}

      {species.length === 0 ? (
        <div className="nature-empty-state mt-6 flex flex-col items-center gap-4 px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-sm)] border border-[hsl(var(--surface-border)/0.72)] bg-[hsl(var(--surface-raised)/0.8)] text-[hsl(var(--primary))]">
            <Search className="h-6 w-6" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-medium text-foreground">
              {query ? "没有找到匹配的物种" : status !== "all" ? "这个筛选下暂时没有物种" : topic !== "all" ? "这个分类暂时还没有可展示的物种" : "暂无可展示的物种"}
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              {query
                ? `试试缩短或更换关键词。当前搜索：「${query}」`
                : status !== "all"
                  ? "切换到全部物种，或去提交新的自然观察记录后再回来查看。"
                : topic !== "all"
                  ? `${activeTopicLabel}物种数据上线后会自动出现在这里。`
                : "物种数据上线后会自动出现在这里。"}
            </p>
          </div>
          {query ? (
            <Button asChild variant="outline" className="border-[hsl(var(--surface-border)/0.84)] bg-[hsl(var(--surface-raised)/0.9)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--status-info-surface)/0.58)]">
              <Link href={buildSpeciesHref({ topic, status: effectiveStatus })}>查看全部物种</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
