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
  Sprout,
  Telescope,
  Trees,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { NatureHomeMapPair } from "@/components/features/bird-observation/nature-home-map-pair";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { Button } from "@/components/ui/button";
import { getBirdObservationHomepageData } from "@/lib/api/nature-observation-data";
import type {
  NatureObservationStats,
  NatureTopicKey,
  NatureTopicSummary,
  ObservationHotspotSummary,
} from "@/lib/api/nature-observation-data";
import type { ObservationEvent } from "@/lib/mappers/types";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getAssetDisplayUrl, rewriteAssetUrl, shouldBypassAssetImageOptimization } from "@/lib/utils/asset-url";
import { buildNatureSubmitHref } from "@/lib/utils/nature-navigation";

const heroImage = "/assets/nature-hero-lakeside-observation.png";
const lakeImage = "/assets/observation-list-reeds-sky-bg.png";

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
  observationCount: number;
  speciesCount: number;
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
    title: "植物",
    subtitle: "读懂叶片、花果与种子",
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

function buildContributionStats(stats: NatureObservationStats) {
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
      observationCount: summary?.observationCount ?? 0,
      speciesCount: summary?.speciesCount ?? 0,
    };
  });
}

function getTopicCardImageProps(image: ImageSource) {
  if (typeof image !== "string") {
    return { src: image, unoptimized: false };
  }

  const resolvedImage = rewriteAssetUrl(image) ?? image;

  return {
    src: getAssetDisplayUrl(resolvedImage) ?? resolvedImage,
    unoptimized: shouldBypassAssetImageOptimization(resolvedImage),
  };
}

const mobileHeaderClassName =
  "border-b border-[hsl(var(--surface-border)/0.42)] bg-[linear-gradient(180deg,hsl(var(--surface-raised)/0.92)_0%,hsl(var(--app-canvas)/0.78)_100%)] backdrop-blur-xl";

function MobileNatureHeader({ submitHref }: { submitHref: string }) {
  return (
    <MobileGlobalHeader
      variant="title"
      title={<span className="font-sans">自然观察</span>}
      showSearch={false}
      showNotification={false}
      showUserButton={false}
      className={mobileHeaderClassName}
      rightSlot={
        <Button asChild tone="brand" size="sm" className="h-8 gap-1 px-2.5 text-xs font-semibold min-[390px]:h-9 min-[390px]:px-3 min-[390px]:text-sm">
          <Link href={submitHref}>
            <Camera className="h-3.5 w-3.5 min-[390px]:h-4 min-[390px]:w-4" />
            发布观察
          </Link>
        </Button>
      }
    />
  );
}

function NatureHeroPanel({ submitHref }: { submitHref: string }) {
  return (
    <section className="nature-hero-panel min-h-[220px] md:min-h-[360px] lg:min-h-[374px]">
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
      <div className="relative z-10 flex min-h-[220px] flex-col justify-end p-4 text-white min-[390px]:min-h-[232px] md:min-h-[360px] md:justify-between md:px-8 md:py-9 lg:min-h-[374px] lg:px-10">
        <div>
          <h1 className="hidden text-[44px] font-black leading-none [text-shadow:0_2px_6px_rgba(0,0,0,0.78)] md:block md:text-[58px] lg:text-[62px]">
            自然观察
          </h1>
          <p className="max-w-md text-[15px] font-semibold leading-6 text-white/[0.96] [text-shadow:0_2px_5px_rgba(0,0,0,0.7)] line-clamp-2 md:mt-4 md:max-w-3xl md:text-[22px] md:leading-7">
            记录身边的生命，和社区一起守护环境
          </p>
          <Button
            asChild
            tone="brand"
            shape="pill"
            size="lg"
            className="mt-7 hidden gap-2 font-extrabold focus-visible:ring-white/70 focus-visible:ring-offset-[hsl(var(--background))] md:inline-flex"
          >
            <Link href={submitHref}>
              <Camera className="h-5 w-5" />
              发布观察
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function TopicCardsSection({ topicCards }: { topicCards: TopicCard[] }) {
  return (
    <section aria-label="自然专题分类">
      <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible">
        {topicCards.map((topic) => (
          <TopicCardView key={topic.title} topic={topic} />
        ))}
      </div>
    </section>
  );
}

function TopicCardView({ topic }: { topic: TopicCard }) {
  const Icon = topic.icon;
  const topicImage = getTopicCardImageProps(topic.image);
  const content = (
    <>
      <Image
        src={topicImage.src}
        alt=""
        fill
        unoptimized={topicImage.unoptimized}
        placeholder="blur"
        blurDataURL={natureBlurDataUrl}
        className="translate-x-[10%] scale-[1.04] object-cover object-center brightness-[1.04] saturate-[1.06] transition-transform duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] [mask-image:linear-gradient(100deg,transparent_0%,rgba(0,0,0,0.28)_18%,rgba(0,0,0,0.78)_36%,#000_52%)] [-webkit-mask-image:linear-gradient(100deg,transparent_0%,rgba(0,0,0,0.28)_18%,rgba(0,0,0,0.78)_36%,#000_52%)] dark:brightness-[0.82] dark:saturate-[0.92] motion-safe:group-hover:translate-x-[8%] motion-safe:group-hover:scale-[1.08]"
        sizes="(max-width: 768px) 68vw, 20vw"
      />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,hsl(var(--surface-raised)/0.97)_0%,hsl(var(--surface-raised)/0.82)_26%,hsl(var(--surface-raised)/0.16)_50%,transparent_62%)]" />
      <div className="relative z-10 flex h-full min-h-[132px] flex-col justify-between p-3.5 md:min-h-[188px] md:p-5">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--primary))] md:h-5 md:w-5" strokeWidth={2.2} />
            <h3 className="font-sans text-base font-bold leading-5 text-foreground md:text-lg md:leading-6">{topic.title}</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground md:text-sm">{topic.subtitle}</p>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0 flex-1 text-[11px] leading-[1.4] text-muted-foreground md:text-xs">
            <p>{formatCount(topic.observationCount)} 条观察记录</p>
            <p>{formatCount(topic.speciesCount)} 个物种</p>
          </div>
          {topic.href ? (
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[hsl(var(--surface-border))] bg-background text-foreground shadow-[0_4px_12px_-6px_hsl(var(--surface-shadow)/0.35)] transition-all duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] group-hover:border-[hsl(var(--primary)/0.5)] group-hover:bg-[hsl(var(--primary))] group-hover:text-[hsl(var(--primary-foreground))] motion-safe:group-hover:translate-x-0.5 md:h-9 md:w-9"
              aria-hidden
            >
              <ArrowRight className="h-4 w-4" />
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-[hsl(var(--status-info-surface))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--primary))]">
              即将上线
            </span>
          )}
        </div>
      </div>
    </>
  );

  const className = "group nature-topic-card";

  if (topic.href) {
    return (
      <Link href={topic.href} className={className} aria-label={`进入${topic.title}专题，${formatCount(topic.observationCount)} 条观察记录，${formatCount(topic.speciesCount)} 个物种`}>
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

function MobileStatsBar({ stats }: { stats: NatureObservationStats }) {
  const contributionStats = buildContributionStats(stats);

  return (
    <section aria-label="社区贡献统计" className="nature-section-card grid grid-cols-4 gap-2 lg:hidden">
      {contributionStats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="flex min-w-0 flex-col items-center gap-1 text-center">
            <Icon className="h-4 w-4 shrink-0 nature-icon-accent" />
            <span className="text-sm font-bold leading-5 text-[hsl(var(--foreground))]">{stat.value}</span>
            <span className="text-[11px] leading-4 nature-text-muted">{stat.label}</span>
          </div>
        );
      })}
    </section>
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
    ? `发布 ${formatDate(latestObservation.createdAt)} · ${latestObservation.locationName}`
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
                <p className="line-clamp-1 text-sm font-bold leading-5 text-[hsl(var(--foreground))]">{item.title}</p>
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
      <h2 className="nature-heading text-[22px] text-[hsl(var(--primary))]">社区贡献</h2>
      <div className="relative z-10 mt-5 grid grid-cols-2 gap-5">
        {contributionStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center gap-3">
              <Icon className="h-7 w-7 shrink-0 nature-icon-accent" />
              <div>
                <div className="text-metric text-[hsl(var(--foreground))]">{stat.value}</div>
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
  const topicCards = buildTopicCards(homepage.topicSummaries);
  const latestObservation = homepage.recentObservations[0];
  const topHotspot = homepage.hotspots[0];
  const submitHref = buildNatureSubmitHref({
    from: "/nature",
  });

  return (
    <div className="app-canvas min-h-[calc(100dvh-var(--mobile-global-header-height,0rem))]">
      <MobileNatureHeader submitHref={submitHref} />

      <div className="app-shell-wide grid gap-5 pb-28 pt-5 md:pb-14 md:pt-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-6">
        <main className="min-w-0 space-y-4 md:space-y-6">
          <NatureHeroPanel submitHref={submitHref} />
          <TopicCardsSection topicCards={topicCards} />
          <NatureHomeMapPair observations={homepage.mapObservations} />
          <MobileStatsBar stats={homepage.stats} />
        </main>

        <DesktopSidebar stats={homepage.stats} latestObservation={latestObservation} topHotspot={topHotspot} />
      </div>
    </div>
  );
}
