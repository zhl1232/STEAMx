import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bug,
  Camera,
  ChevronRight,
  Clock3,
  Feather,
  Leaf,
  MapPin,
  NotebookPen,
  Sprout,
  Telescope,
  Trees,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { NatureHomeMapPair } from "@/components/features/bird-observation/nature-home-map-pair";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { getBirdObservationHomepageData } from "@/lib/api/nature-observation-data";
import type {
  NatureObservationStats,
  NatureTopicKey,
  NatureTopicSummary,
  ObservationHotspotSummary,
} from "@/lib/api/nature-observation-data";
import type { ObservationEvent } from "@/lib/mappers/types";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { buildNatureSubmitHref } from "@/lib/utils/nature-navigation";

const heroImage = "/assets/nature-hero-lakeside-observation.png";
const lakeImage = "/assets/observation-list-reeds-sky-bg.png";
const speciesImage = "/assets/species-archive-blue-tech-bg.png";

export const metadata: Metadata = buildPageMetadata({
  title: "自然观察",
  description:
    "记录鸟类、植物、昆虫和真菌等真实自然观察，查看社区热点、物种档案和公开观察记录，把身边生态变化积累成可追踪的数据。",
  path: "/nature",
  keywords: ["自然观察", "鸟类观察", "物种识别", "观察记录", "校园自然"],
});

type ImageSource = string | StaticImageData;

interface TopicCardBase {
  key: NatureTopicKey;
  title: string;
  subtitle: string;
  href?: string;
  image: ImageSource;
  icon: LucideIcon;
  tint: string;
}

interface TopicCard extends TopicCardBase {
  records: string;
  species: string;
}

interface StatViewItem {
  label: string;
  value: string;
  icon: LucideIcon;
}

const natureBlurDataUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 12'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23dff1e4'/%3E%3Cstop offset='.55' stop-color='%23cfe7ee'/%3E%3Cstop offset='1' stop-color='%23f4ead1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='16' height='12' fill='url(%23g)'/%3E%3C/svg%3E";

const topicCardBase: TopicCardBase[] = [
  {
    key: "birds",
    title: "鸟类",
    subtitle: "发现天空的精灵",
    href: "/nature/species?topic=birds",
    image: "/birds/images/alcedo-atthis.jpg",
    icon: Feather,
    tint: "from-[#e9f6ff]/90 via-[#bfe5f6]/[0.34] to-transparent dark:from-[#123b64]/95 dark:via-[#1e5f91]/[0.72] dark:to-[#071d32]/[0.42]",
  },
  {
    key: "insects",
    title: "昆虫",
    subtitle: "微观世界的生命",
    href: "/nature/species?topic=insects",
    image: "/insects/images/pantala-flavescens-1.jpg",
    icon: Bug,
    tint: "from-[#e5fbf2]/90 via-[#9ee8d0]/[0.34] to-transparent dark:from-[#07405a]/85 dark:via-[#1684a6]/[0.48] dark:to-[#081f2a]/[0.22]",
  },
  {
    key: "plants",
    title: "树木",
    subtitle: "读懂树叶与年轮",
    href: "/nature/species?topic=plants",
    image: "/trees/images/ginkgo-biloba-1.jpg",
    icon: Trees,
    tint: "from-[#eff8d8]/90 via-[#cdeba0]/[0.36] to-transparent dark:from-[#243f12]/[0.94] dark:via-[#51721c]/[0.66] dark:to-[#17230c]/[0.38]",
  },
  {
    key: "fungi",
    title: "真菌",
    subtitle: "神秘而重要的分解者",
    image: lakeImage,
    icon: Leaf,
    tint: "from-[#fff3d8]/90 via-[#edc06e]/[0.32] to-transparent dark:from-[#51380f]/85 dark:via-[#a0712f]/[0.44] dark:to-[#1f1507]/[0.24]",
  },
];

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatCount(value: number) {
  return value.toLocaleString("zh-CN");
}

function buildHeroStats(stats: NatureObservationStats): StatViewItem[] {
  return [
    { label: "观察记录", value: formatCount(stats.observationCount), icon: NotebookPen },
    { label: "物种数", value: formatCount(stats.speciesCount), icon: Sprout },
    { label: "观察者", value: formatCount(stats.observerCount), icon: UsersRound },
    { label: "本周新增", value: formatCount(stats.weeklyObservationCount), icon: Clock3 },
  ];
}

function buildContributionStats(stats: NatureObservationStats): StatViewItem[] {
  return [
    { label: "公开记录", value: formatCount(stats.observationCount), icon: Telescope },
    { label: "活跃物种", value: formatCount(stats.speciesCount), icon: Bug },
    { label: "识别条目", value: formatCount(stats.identifiedRecordCount), icon: Sprout },
    { label: "热点地点", value: formatCount(stats.hotspotLocationCount), icon: MapPin },
  ];
}

function buildTopicCards(topicSummaries: NatureTopicSummary[]): TopicCard[] {
  const summaryByKey = new Map(topicSummaries.map((summary) => [summary.key, summary]));

  return topicCardBase.map((topic) => {
    const summary = summaryByKey.get(topic.key);
    return {
      ...topic,
      records: `${formatCount(summary?.observationCount ?? 0)} 条记录`,
      species: `${formatCount(summary?.speciesCount ?? 0)} 个物种`,
    };
  });
}



function HeroStatsCard({ stats }: { stats: StatViewItem[] }) {
  return (
    <section className="nature-section-card relative z-20 mx-4 !-mt-10 backdrop-blur md:hidden">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex min-w-0 items-center gap-2.5">
              <span className="nature-stat-icon">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-metric text-[hsl(var(--nature-foreground))]">{stat.value}</div>
                <div className="text-label text-[hsl(var(--nature-muted))]">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NatureHeroPanel({ heroStats, submitHref }: { heroStats: StatViewItem[]; submitHref: string }) {
  return (
    <section className="nature-hero-panel md:min-h-[360px] lg:min-h-[374px]">
      <Image
        src={heroImage}
        alt=""
        fill
        priority
        placeholder="blur"
        blurDataURL={natureBlurDataUrl}
        className="object-cover object-[center_36%] dark:brightness-75 md:object-center"
        sizes="(max-width: 1024px) 100vw, calc(100vw - 520px)"
      />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgba(0,0,0,0.58)_0%,rgba(0,0,0,0.28)_38%,rgba(0,0,0,0.04)_74%),linear-gradient(180deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.18)_100%)]" />

      <div className="relative z-10 flex min-h-[330px] flex-col justify-between px-6 pb-8 pt-12 text-white md:min-h-[360px] md:px-8 md:py-9 lg:min-h-[374px] lg:px-10">
        <div>
          <h1 className="text-[44px] font-black leading-none [text-shadow:0_2px_6px_rgba(0,0,0,0.78)] md:text-[58px] lg:text-[62px]">自然观察</h1>
          <p className="mt-4 max-w-3xl text-[18px] font-semibold leading-7 text-white/[0.96] [text-shadow:0_2px_5px_rgba(0,0,0,0.7)] md:text-[22px]">
            记录身边的生命，和社区一起守护环境
          </p>
          <Link
            href={submitHref}
            className="mt-7 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[hsl(var(--nature-accent))] px-6 text-[15px] font-extrabold text-[hsl(var(--nature-accent-foreground))] shadow-[0_22px_48px_-20px_hsl(var(--nature-accent)/0.95)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--nature-accent)/0.92)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--nature-hero-bg))] active:scale-[0.98] md:min-h-[52px] md:px-7 md:text-[16px]"
          >
            <Camera className="h-5 w-5" />
            发布观察
          </Link>
        </div>

        <div className="hidden max-w-[720px] grid-cols-4 gap-7 md:grid">
          {heroStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex min-w-0 items-center gap-2.5 [text-shadow:0_2px_6px_rgba(0,0,0,0.62)]">
                <Icon className="h-6 w-6 shrink-0 text-white/[0.86]" />
                <div className="min-w-0">
                  <div className="text-[26px] font-extrabold leading-7 text-white md:text-[30px] md:leading-8">{stat.value}</div>
                  <div className="text-xs font-medium leading-5 text-white/[0.64]">{stat.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TopicCardView({ topic }: { topic: TopicCard }) {
  const Icon = topic.icon;
  const content = (
    <>
      <Image
        src={topic.image}
        alt=""
        fill
        placeholder="blur"
        blurDataURL={natureBlurDataUrl}
        className="translate-x-[14%] scale-[1.08] object-cover object-[50%_center] brightness-[1.04] saturate-[1.06] transition-transform duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] [mask-image:linear-gradient(100deg,transparent_0%,rgba(0,0,0,0.34)_14%,rgba(0,0,0,0.84)_32%,#000_48%)] [-webkit-mask-image:linear-gradient(100deg,transparent_0%,rgba(0,0,0,0.34)_14%,rgba(0,0,0,0.84)_32%,#000_48%)] dark:brightness-[0.82] dark:saturate-[0.92] motion-safe:group-hover:translate-x-[12%] motion-safe:group-hover:scale-[1.13]"
        sizes="(max-width: 768px) 46vw, 20vw"
      />
      <div className={`absolute inset-0 bg-gradient-to-r opacity-45 ${topic.tint}`} />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(248,251,244,0.82)_0%,rgba(248,251,244,0.62)_22%,rgba(248,251,244,0.22)_42%,rgba(248,251,244,0.04)_56%,rgba(248,251,244,0)_66%)] dark:bg-[linear-gradient(100deg,rgba(15,31,22,0.82)_0%,rgba(15,31,22,0.58)_24%,rgba(15,31,22,0.22)_44%,rgba(15,31,22,0.06)_58%,rgba(15,31,22,0)_68%)]" />
      <div className="relative z-10 flex h-full min-h-[154px] flex-col justify-between p-4 text-[hsl(var(--nature-foreground))] dark:text-white dark:[text-shadow:0_2px_12px_rgba(0,0,0,0.55)] md:min-h-[196px] md:p-5">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            <h3 className="text-[21px] font-bold leading-7">{topic.title}</h3>
          </div>
          <p className="mt-1 text-sm font-semibold nature-text-muted dark:text-white/[0.92]">{topic.subtitle}</p>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-bold leading-5 text-[hsl(var(--nature-foreground))] dark:text-white/95">
            <div>{topic.records}</div>
            <div>{topic.species}</div>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--nature-surface))]/95 nature-icon-accent shadow-[0_10px_24px_-16px_hsl(var(--nature-accent)/0.45)] ring-1 ring-[hsl(var(--nature-border))] backdrop-blur transition-all duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] group-hover:bg-white group-hover:shadow-[0_16px_28px_-16px_rgba(22,132,75,0.65)] motion-safe:group-hover:translate-x-1 dark:bg-white dark:text-[#16844b] dark:shadow-[0_10px_24px_-14px_rgba(0,0,0,0.5)] dark:ring-transparent">
            <ArrowRight className="h-4 w-4 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </>
  );

  const className = "group nature-topic-card";

  if (topic.href) {
    return (
      <Link href={topic.href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className} aria-label={`${topic.title}专题即将上线`}>
      {content}
    </div>
  );
}

function DataStatusCard({
  stats,
  latestObservation,
  topHotspot,
  embedded = false,
}: {
  stats: NatureObservationStats;
  latestObservation?: ObservationEvent;
  topHotspot?: ObservationHotspotSummary;
  embedded?: boolean;
}) {
  const latestLabel = latestObservation
    ? `${formatDate(latestObservation.observedAt)} · ${latestObservation.locationName}`
    : "暂无公开记录";
  const topHotspotLabel = topHotspot ? `${topHotspot.locationName} · ${topHotspot.observationCount} 条` : "暂无热点地点";
  const items = [
    { title: "本周新增", value: `${formatCount(stats.weeklyObservationCount)} 条`, icon: Clock3, href: "/nature/observations" },
    { title: "最新记录", value: latestLabel, icon: Leaf, href: latestObservation ? `/nature/observations/${latestObservation.id}` : "/nature/observations" },
    { title: "最高热点", value: topHotspotLabel, icon: MapPin, href: "/nature/map" },
  ];

  return (
    <section
      className={
        embedded
          ? "p-0"
          : "nature-data-card"
      }
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="nature-heading text-[20px]">观察概览</h2>
        <span className="shrink-0 pt-1 text-label nature-text-muted">公开记录</span>
      </div>
      <div className="nature-divide mt-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex min-w-0 items-center gap-2.5 py-3 first:pt-0 last:pb-0 sm:gap-3">
              <span className="nature-stat-icon h-12 w-12">
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-bold leading-5 text-[hsl(var(--nature-foreground))]">{item.title}</p>
                <p className="mt-1 line-clamp-1 text-xs nature-text-muted">{item.value}</p>
              </div>
              <Link
                href={item.href}
                className="nature-action-link group/status-action"
              >
                查看
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/status-action:translate-x-0.5" />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ContributionCard({ stats, embedded = false }: { stats: NatureObservationStats; embedded?: boolean }) {
  const contributionStats = buildContributionStats(stats);

  return (
    <section
      className={
        embedded
          ? "relative overflow-hidden p-0"
          : "nature-contribution-card"
      }
    >
      <div className="absolute bottom-0 right-0 h-28 w-32 bg-[radial-gradient(circle_at_45%_80%,rgba(109,125,50,0.2),transparent_34%),radial-gradient(circle_at_72%_38%,rgba(22,132,75,0.18),transparent_28%)] dark:bg-[radial-gradient(circle_at_45%_80%,rgba(74,222,128,0.12),transparent_34%),radial-gradient(circle_at_72%_38%,rgba(45,212,191,0.1),transparent_28%)]" />
      <h2 className="nature-heading text-[22px] text-[hsl(var(--nature-accent))]">社区贡献</h2>
      <div className="relative z-10 mt-5 grid grid-cols-2 gap-5">
        {contributionStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center gap-3">
              <Icon className="h-7 w-7 shrink-0 nature-icon-accent" />
              <div>
                <div className="text-metric text-[hsl(var(--nature-foreground))]">{stat.value}</div>
                <div className="text-sm nature-text-muted">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DesktopSidebar({
  stats,
  latestObservation,
  topHotspot,
}: {
  stats: NatureObservationStats;
  latestObservation?: ObservationEvent;
  topHotspot?: ObservationHotspotSummary;
}) {
  return (
    <aside className="hidden min-w-0 lg:block">
      <div className="sticky top-20 space-y-5">
        <ContributionCard stats={stats} />
        <DataStatusCard stats={stats} latestObservation={latestObservation} topHotspot={topHotspot} />
      </div>
    </aside>
  );
}


export default async function NaturePage() {
  const homepage = await getBirdObservationHomepageData();
  const heroStats = buildHeroStats(homepage.stats);
  const topicCards = buildTopicCards(homepage.topicSummaries);
  const latestObservation = homepage.recentObservations[0];
  const topHotspot = homepage.hotspots[0];
  const submitHref = buildNatureSubmitHref({
    topic: "birds",
    from: "/nature",
  });

  return (
    <div className="theme-nature-page min-h-[calc(100dvh-var(--mobile-global-header-height,0rem))]">
      <MobileGlobalHeader
        variant="title"
        title="自然观察"
        showSearch={true}
        showNotification={false}
        showUserButton={false}
      />

      <div className="app-shell-wide grid gap-5 pb-24 pt-5 md:pb-14 md:pt-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-6">
        <main className="min-w-0 space-y-5 md:space-y-6">
          <NatureHeroPanel heroStats={heroStats} submitHref={submitHref} />
          <HeroStatsCard stats={heroStats} />

          <NatureHomeMapPair observations={homepage.mapObservations} />

          <section>
            <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible">
              {topicCards.map((topic) => (
                <TopicCardView key={topic.title} topic={topic} />
              ))}
            </div>
          </section>
        </main>

        <DesktopSidebar stats={homepage.stats} latestObservation={latestObservation} topHotspot={topHotspot} />
      </div>
    </div>
  );
}
