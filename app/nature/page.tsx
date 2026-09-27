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
  Telescope,
  Trees,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { NatureHomeMapPair } from "@/components/features/bird-observation/nature-home-map-pair";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { Button } from "@/components/ui/button";
import { getSpeciesAtlasProgress } from "@/lib/api/nature-observation-atlas";
import { getBirdObservationHomepageData } from "@/lib/api/nature-observation-data";
import type {
  NatureObservationStats,
  NatureTopicSummary,
  ObservationHotspotSummary,
} from "@/lib/api/nature-observation-data";
import type { ObservationEvent } from "@/lib/mappers/types";
import type { SpeciesAtlasTopicKey } from "@/lib/nature-species-atlas";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getAssetDisplayUrl, rewriteAssetUrl, shouldBypassAssetImageOptimization } from "@/lib/utils/asset-url";
import { buildNatureSubmitHref } from "@/lib/utils/nature-navigation";

const heroImage = "/assets/nature-hero-lakeside-observation.png";

const topicCardImages: Record<SpeciesAtlasTopicKey, string> = {
  birds: "/assets/nature-topic-birds.webp",
  insects: "/assets/nature-topic-insects.webp",
  plants: "/assets/nature-topic-plants.webp",
};

export const metadata: Metadata = buildPageMetadata({
  title: "自然观察",
  description:
    "在创探空间记录鸟类、植物和昆虫等真实自然观察，查看社区热点、物种档案和公开观察记录，把身边生态变化积累成可追踪的数据。",
  path: "/nature",
  keywords: ["创探空间 自然观察", "自然观察", "鸟类观察", "物种识别", "观察记录", "校园自然"],
});

type ImageSource = string | StaticImageData;

interface TopicCardBase {
  key: SpeciesAtlasTopicKey;
  title: string;
  subtitle: string;
  href: string;
  image: ImageSource;
  icon: LucideIcon;
  tint: string;
}

interface TopicCard extends TopicCardBase {
  observationCount: number;
  speciesCount: number;
  observedCount: number | null;
  progressState: "ready" | "anonymous" | "unavailable" | null;
}

const natureBlurDataUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 12'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23dff1e4'/%3E%3Cstop offset='.55' stop-color='%23cfe7ee'/%3E%3Cstop offset='1' stop-color='%23f4ead1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='16' height='12' fill='url(%23g)'/%3E%3C/svg%3E";

const topicCardBase: TopicCardBase[] = [
  {
    key: "birds",
    title: "鸟类",
    subtitle: "发现天空的精灵",
    href: "/nature/birds",
    image: topicCardImages.birds,
    icon: Feather,
    tint: "from-[#e9f6ff]/90 via-[#bfe5f6]/34 to-transparent dark:from-[#123b64]/95 dark:via-[#1e5f91]/72 dark:to-[#071d32]/42",
  },
  {
    key: "insects",
    title: "昆虫",
    subtitle: "微观世界的生命",
    href: "/nature/insects",
    image: topicCardImages.insects,
    icon: Bug,
    tint: "from-[#e5fbf2]/90 via-[#9ee8d0]/34 to-transparent dark:from-[#07405a]/85 dark:via-[#1684a6]/48 dark:to-[#081f2a]/22",
  },
  {
    key: "plants",
    title: "植物",
    subtitle: "读懂叶片、花果与种子",
    href: "/nature/plants",
    image: topicCardImages.plants,
    icon: Trees,
    tint: "from-[#eff8d8]/90 via-[#cdeba0]/36 to-transparent dark:from-[#243f12]/94 dark:via-[#51721c]/66 dark:to-[#17230c]/38",
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
    { label: "图鉴物种", value: formatCount(stats.speciesCount), icon: Bug },
    { label: "参与人数", value: formatCount(stats.observerCount), icon: Users },
    { label: "观察地点", value: formatCount(stats.hotspotLocationCount), icon: MapPin },
  ];
}

function buildTopicCards(
  topicSummaries: NatureTopicSummary[],
  atlasProgress: Awaited<ReturnType<typeof getSpeciesAtlasProgress>> | null,
): TopicCard[] {
  const summaryByKey = new Map(topicSummaries.map((summary) => [summary.key, summary]));
  const progressByKey = new Map(atlasProgress?.groups.map((group) => [group.key, group]) ?? []);

  return topicCardBase.map((topic) => {
    const summary = summaryByKey.get(topic.key);
    const progress = progressByKey.get(topic.key);
    return {
      ...topic,
      observationCount: summary?.observationCount ?? 0,
      speciesCount: progress?.total ?? summary?.speciesCount ?? 0,
      observedCount: progress?.observedCount ?? null,
      progressState: progress ? atlasProgress?.viewer.progressState ?? null : null,
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

function NatureHeroSection({ submitHref }: { submitHref: string }) {
  return (
    <section
      aria-label="自然观察频道"
      className="relative isolate w-full overflow-hidden bg-[hsl(var(--surface-raised))] md:rounded-(--radius-sm) md:border md:border-[hsl(var(--surface-border)/0.5)] md:shadow-[0_20px_60px_-35px_hsl(var(--primary)/0.28)]"
    >
      {/* 头图保留原始亮度；桌面向下取景，确保前景笔记本可见。 */}
      <Image
        src={heroImage}
        alt=""
        fill
        priority
        placeholder="blur"
        blurDataURL={natureBlurDataUrl}
        className="pointer-events-none select-none object-cover object-[center_36%] md:object-[center_78%]"
        sizes="(max-width: 1024px) 100vw, 1400px"
      />

      {/* 桌面保护左侧文字，暗色手机头图在底部融入页面底色。 */}
      <div className="hidden md:block absolute inset-0 bg-[linear-gradient(90deg,rgba(10,18,28,0.48)_0%,rgba(10,18,28,0.25)_28%,transparent_58%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(180deg,transparent_0%,transparent_65%,hsl(var(--app-canvas)/0.15)_82%,hsl(var(--app-canvas)/0.6)_100%)] dark:block md:dark:hidden" />

      {/* 移动端专属通透 Header：直接融入背景大图顶端 */}
      <div className="relative z-20 md:hidden">
        <MobileGlobalHeader
          variant="title"
          title={
            <span className="font-sans font-bold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.85),0_2px_12px_rgba(0,0,0,0.65)] dark:text-white/95 dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
              自然观察
            </span>
          }
          showSearch={false}
          showNotification={false}
          showUserButton={false}
          className="border-none bg-transparent shadow-none"
          rightSlot={
            <Button
              asChild
              tone="brand"
              size="sm"
              className="h-11! min-h-11! gap-1 px-3 text-xs font-semibold shadow-md min-[390px]:px-3.5 min-[390px]:text-sm"
            >
              <Link href={submitHref}>
                <Camera className="h-3.5 w-3.5 min-[390px]:h-4 min-[390px]:w-4" />
                发布观察
              </Link>
            </Button>
          }
        />
      </div>

      {/* Hero 导语与排版：加大高度以展现更开阔的湖光水色与探索装备 */}
      <div className="relative z-10 flex min-h-[140px] flex-col justify-end px-4 pb-5 pt-2 min-[390px]:min-h-[160px] min-[390px]:pb-6 min-[430px]:min-h-[175px] md:min-h-[300px] md:justify-center md:px-10 md:py-8 lg:min-h-[clamp(330px,25vw,460px)] lg:px-12">
        <div className="max-w-2xl">
          {/* 移动端导语 */}
          <p className="text-[13.5px] font-bold leading-relaxed text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.9),0_2px_14px_rgba(0,0,0,0.75)] dark:font-medium dark:text-white/85 dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)] min-[390px]:text-[14.5px] md:hidden">
            记录身边的生命，和社区一起守护环境
          </p>
          <Link
            href="/learn/nature"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-white underline decoration-white/70 underline-offset-4 [text-shadow:0_1px_6px_rgba(0,0,0,0.9),0_2px_14px_rgba(0,0,0,0.75)] dark:font-medium dark:text-white/85 dark:decoration-white/40 dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)] transition hover:text-white/85 md:hidden"
          >
            第一次观察？从这里开始 →
          </Link>

          {/* 桌面端大标题与导语 */}
          <h1 className="hidden text-[38px] font-black leading-none text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.8)] dark:text-white/95 dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)] md:block md:text-[46px] lg:text-[50px]">
            自然观察
          </h1>

          <p className="mt-3 hidden text-[18px] font-semibold leading-7 text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.85)] dark:font-medium dark:text-white/85 dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)] md:block">
            记录身边的生命，和社区一起守护环境
          </p>

          <div className="mt-6 hidden items-center gap-4 md:flex">
            <Button
              asChild
              tone="brand"
              shape="pill"
              size="lg"
              className="gap-2 font-extrabold focus-visible:ring-white/70 focus-visible:ring-offset-[hsl(var(--background))]"
            >
              <Link href={submitHref}>
                <Camera className="h-5 w-5" />
                发布观察
              </Link>
            </Button>
            <Link
              href="/learn/nature"
              className="inline-flex min-h-11 items-center rounded-full border border-white/65 bg-black/15 px-5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-black/25 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30"
            >
              自然观察入门
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function TopicCardsSection({ topicCards }: { topicCards: TopicCard[] }) {
  return (
    <section aria-labelledby="nature-topics-heading">
      <h2 id="nature-topics-heading" className="sr-only">选择观察专题</h2>
      <div className="grid grid-cols-3 gap-2 md:gap-4">
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
  const progressLabel = topic.progressState === "ready"
    ? `已观察 ${formatCount(topic.observedCount ?? 0)} / ${formatCount(topic.speciesCount)}`
    : `图鉴 ${formatCount(topic.speciesCount)} 种`;

  return (
    <Link
      href={topic.href}
      className="group nature-topic-card"
      aria-label={`进入${topic.title}专题，${formatCount(topic.observationCount)} 条观察记录，${progressLabel}`}
    >
      <div className="relative h-20 overflow-hidden min-[390px]:h-24 md:absolute md:inset-0 md:h-full">
        <Image
          src={topicImage.src}
          alt=""
          fill
          unoptimized={topicImage.unoptimized}
          placeholder="blur"
          blurDataURL={natureBlurDataUrl}
          className="object-cover object-right opacity-95 transition-transform duration-700 dark:brightness-[0.82] dark:saturate-[0.8] motion-safe:group-hover:scale-[1.03] md:mask-[linear-gradient(100deg,transparent_0%,transparent_40%,rgba(0,0,0,0.28)_56%,rgba(0,0,0,0.88)_72%,#000_86%)]"
          sizes="(max-width: 767px) 33vw, (max-width: 1536px) 32vw, 480px"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(180deg,hsl(var(--surface-raised)/0.08)_30%,hsl(var(--surface-raised)/0.3)_70%,hsl(var(--surface-raised))_100%)] dark:block md:dark:hidden" />
        <div className={`absolute inset-0 hidden bg-linear-to-r md:block ${topic.tint}`} />
        <div className="absolute inset-0 hidden bg-[linear-gradient(100deg,hsl(var(--surface-raised)/0.94)_0%,hsl(var(--surface-raised)/0.82)_36%,hsl(var(--surface-raised)/0.34)_52%,transparent_70%)] md:block dark:bg-[linear-gradient(100deg,hsl(var(--surface-raised)/0.92)_0%,hsl(var(--surface-raised)/0.78)_38%,hsl(var(--surface-raised)/0.28)_54%,transparent_72%)]" />
      </div>
      <div className="relative z-10 flex flex-col gap-1 p-2 min-[390px]:p-3 md:min-h-[188px] md:justify-between md:p-5">
        <div>
          <div className="flex items-center justify-between gap-1 md:justify-start md:gap-2">
            <Icon className="hidden h-5 w-5 shrink-0 text-primary md:block" strokeWidth={2.2} />
            <h3 className="font-sans text-sm font-bold leading-5 text-foreground min-[390px]:text-base md:text-lg md:leading-6">{topic.title}</h3>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground md:hidden" aria-hidden />
          </div>
          <p className="mt-1 hidden text-sm leading-5 text-muted-foreground md:block">{topic.subtitle}</p>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
            <p className="hidden md:block">{formatCount(topic.observationCount)} 条观察记录</p>
            <p>{progressLabel}</p>
            {topic.progressState === "anonymous" ? <p className="mt-0.5 hidden text-primary/80 md:block">登录后查看观察状态</p> : null}
          </div>
          <span
            className="hidden h-9 w-9 shrink-0 place-items-center rounded-full border border-[hsl(var(--surface-border))] bg-background text-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground md:grid"
            aria-hidden
          >
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function MobileStatsBar({ stats }: { stats: NatureObservationStats }) {
  const contributionStats = buildContributionStats(stats);

  return (
    <section aria-label="社区贡献统计" className="nature-section-card grid grid-cols-4 gap-2 md:hidden">
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
    ? `发布 ${formatDate(latestObservation.createdAt)} · ${latestObservation.locationName || "未知地点"}`
    : "暂无公开记录";
  const topHotspotLabel = topHotspot ? `${topHotspot.locationName} · ${topHotspot.observationCount} 条` : "暂无热点地点";
  const items = [
    { title: "近 7 天发布", value: `${formatCount(stats.weeklyObservationCount)} 条`, icon: Clock3, href: "/nature/observations" },
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
            <Link
              key={item.title}
              href={item.href}
              className="group/status-action flex min-h-11 min-w-0 items-center gap-2.5 rounded-sm py-3 first:pt-0 last:pb-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="nature-stat-icon">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-bold leading-5 text-[hsl(var(--foreground))]">{item.title}</p>
                <p className="mt-1 line-clamp-2 break-words text-xs leading-5 nature-text-muted">{item.value}</p>
              </div>
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-primary transition-transform group-hover/status-action:translate-x-0.5" />
            </Link>
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
    <aside className="hidden min-w-0 md:block">
      <div className="grid items-start gap-5 md:grid-cols-2 xl:sticky xl:top-20 xl:grid-cols-1">
        <ContributionCard stats={stats} />
        <DataStatusCard stats={stats} latestObservation={latestObservation} topHotspot={topHotspot} />
      </div>
    </aside>
  );
}


export default async function NaturePage() {
  const [homepage, atlasProgress] = await Promise.all([
    getBirdObservationHomepageData(),
    getSpeciesAtlasProgress().catch(() => null),
  ]);
  const topicCards = buildTopicCards(homepage.topicSummaries, atlasProgress);
  const latestObservation = homepage.recentObservations[0];
  const topHotspot = homepage.hotspots[0];
  const submitHref = buildNatureSubmitHref({});

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "首页", url: "/" },
          { name: "自然观察", url: "/nature" },
        ])}
      />
    <div className="app-canvas min-h-[calc(100dvh-var(--mobile-global-header-height,0rem))]">
      {/* 沉浸式 Hero 头部：移动端通顶满宽渲染（内置透明 Header），桌面端在 app-shell-wide 容器内居中 */}
      <div className="md:app-shell-wide md:pt-6">
        <NatureHeroSection submitHref={submitHref} />
      </div>

      <div className="app-shell-wide pb-28 pt-4 md:pb-14 md:pt-6">
        <div className="space-y-4 md:space-y-6">
          <TopicCardsSection topicCards={topicCards} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-6">
            <main className="min-w-0 space-y-4 md:space-y-6">
              <NatureHomeMapPair observations={homepage.recentObservations} mapObservations={homepage.mapObservations} />
              <MobileStatsBar stats={homepage.stats} />
            </main>

            <DesktopSidebar stats={homepage.stats} latestObservation={latestObservation} topHotspot={topHotspot} />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
