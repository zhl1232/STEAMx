import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  Bug,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Feather,
  Flower2,
  Heart,
  Leaf,
  MapPin,
  MessageCircle,
  NotebookPen,
  Search,
  Sprout,
  Telescope,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { MobileHotspotsCard } from "@/app/nature/_components/mobile-hotspots-card";
import { DomesticMiniMap } from "@/components/features/bird-observation/domestic-mini-map";
import { SteamLogo } from "@/components/layout/logo";
import { getBirdObservationHomepageData } from "@/lib/api/nature-observation-data";
import type {
  NatureObservationStats,
  NatureTopicKey,
  NatureTopicSummary,
  ObservationHotspotSummary,
} from "@/lib/api/nature-observation-data";
import type { ObservationEvent } from "@/lib/mappers/types";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { appendNatureFrom, buildNatureSubmitHref } from "@/lib/utils/nature-navigation";

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

interface ObservationPreview {
  id: string;
  title: string;
  date: string;
  location: string;
  author: string;
  badge: string;
  likes: number;
  comments: number;
  image?: ImageSource | null;
  href: string;
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
    href: "/nature/birds",
    image: "/birds/images/alcedo-atthis.jpg",
    icon: Feather,
    tint: "from-[#e9f6ff]/90 via-[#bfe5f6]/[0.34] to-transparent dark:from-[#123b64]/95 dark:via-[#1e5f91]/[0.72] dark:to-[#071d32]/[0.42]",
  },
  {
    key: "insects",
    title: "昆虫",
    subtitle: "微观世界的生命",
    image: speciesImage,
    icon: Bug,
    tint: "from-[#e5fbf2]/90 via-[#9ee8d0]/[0.34] to-transparent dark:from-[#07405a]/85 dark:via-[#1684a6]/[0.48] dark:to-[#081f2a]/[0.22]",
  },
  {
    key: "plants",
    title: "植物",
    subtitle: "认识身边的植物",
    image: "/projects/science_plants.webp",
    icon: Flower2,
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

function HeroGlassPanel({ children }: { children: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden rounded-lg border border-white/70 bg-[#f7f8f1] p-5 [box-shadow:0_26px_82px_-34px_rgba(5,24,15,0.58),inset_0_1px_0_rgba(255,255,255,0.84)] dark:border-white/15 dark:bg-[#102017]/[0.78] dark:[box-shadow:0_28px_86px_-34px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.12)]">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[rgba(255,255,255,0.18)] dark:bg-white/[0.03]" />
      <div className="pointer-events-none absolute inset-px z-0 rounded-[7px] border border-white/38 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),inset_0_-1px_0_rgba(255,255,255,0.16)] dark:border-white/[0.06] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />
      <div className="relative z-10">{children}</div>
    </section>
  );
}

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

function getSeasonalGuideItems(date = new Date()) {
  const month = date.getMonth() + 1;

  if (month >= 3 && month <= 5) {
    return {
      season: "春季",
      range: "3月 - 5月",
      items: ["留意候鸟迁徙和繁殖行为", "记录开花植物和传粉昆虫", "固定地点重复观察，便于比较变化"],
    };
  }

  if (month >= 6 && month <= 8) {
    return {
      season: "夏季",
      range: "6月 - 8月",
      items: ["清晨或傍晚观察更稳定", "湿地、草地和林缘昆虫活动频繁", "注意补充天气和栖息地信息"],
    };
  }

  if (month >= 9 && month <= 11) {
    return {
      season: "秋季",
      range: "9月 - 11月",
      items: ["关注迁徙鸟类和果实成熟", "记录叶色变化与种子传播", "同一地点连续记录更有价值"],
    };
  }

  return {
    season: "冬季",
    range: "12月 - 2月",
    items: ["优先观察越冬鸟类和常绿植物", "记录水域结冰、雪后足迹等线索", "低温户外观察注意缩短停留时间"],
  };
}

function buildObservationPreviews(observations: ObservationEvent[]): ObservationPreview[] {
  return observations.slice(0, 6).map((observation) => {
    const title = observation.species[0]?.commonName ?? `观察记录 #${observation.id}`;
    return {
      id: String(observation.id),
      title,
      date: formatDate(observation.observedAt),
      location: observation.locationName,
      author: observation.authorDisplayName || "匿名观察者",
      badge: observation.species.length > 0 ? `${observation.species.length} 种` : "未识别",
      likes: observation.likesCount,
      comments: observation.commentsCount,
      image: observation.mediaUrls[0] || null,
      href: appendNatureFrom(`/nature/observations/${observation.id}`, "/nature"),
    };
  });
}

function buildGalleryImages(images: string[]): ImageSource[] {
  return images.slice(0, 6);
}

function HeroStatsCard({ stats }: { stats: StatViewItem[] }) {
  return (
    <section className="relative z-20 mx-4 -mt-10 rounded-lg border border-[#dce9df] bg-white/[0.96] p-4 shadow-[0_24px_58px_-38px_rgba(27,69,49,0.5)] backdrop-blur md:hidden dark:border-[#2a4735] dark:bg-[#0f1f16]/[0.96] dark:shadow-[0_24px_58px_-38px_rgba(0,0,0,0.92)]">
      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e3f3e7] text-[#16844b] dark:bg-[#183b25] dark:text-[#74d79a]">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-[24px] font-extrabold leading-7 text-[#17251f] dark:text-[#eef8ef]">{stat.value}</div>
                <div className="text-xs font-medium leading-5 text-[#65736c] dark:text-[#9fb1a6]">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  href,
  action = "查看全部",
}: {
  icon: LucideIcon;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-5 w-5 shrink-0 text-[#16844b] dark:text-[#74d79a]" />
        <h2 className="truncate text-[20px] font-bold leading-7 text-[#18251f] dark:text-[#eef8ef] md:text-[22px]">{title}</h2>
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-[#16844b] transition-colors hover:text-[#0b6b38] dark:text-[#74d79a] dark:hover:text-[#9af0b7]"
        >
          {action}
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
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
        className="object-cover brightness-[1.04] saturate-[1.06] transition-transform duration-500 dark:brightness-[0.82] dark:saturate-[0.92] motion-safe:group-hover:scale-[1.04]"
        sizes="(max-width: 768px) 46vw, 20vw"
      />
      <div className={`absolute inset-0 bg-gradient-to-br ${topic.tint}`} />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.42)_0%,rgba(255,255,255,0.12)_42%,rgba(255,255,255,0)_68%)] dark:bg-none" />
      <div className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-[#f8fbf4]/[0.84] via-[#f8fbf4]/[0.36] to-transparent dark:from-black/[0.84] dark:via-black/[0.36] dark:to-transparent" />
      <div className="relative z-10 flex h-full min-h-[154px] flex-col justify-between p-4 text-[#213229] dark:text-white dark:[text-shadow:0_2px_12px_rgba(0,0,0,0.55)] md:min-h-[196px] md:p-5">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            <h3 className="text-[21px] font-bold leading-7">{topic.title}</h3>
          </div>
          <p className="mt-1 text-sm font-semibold text-[#2f4738] dark:text-white/[0.92]">{topic.subtitle}</p>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-bold leading-5 text-[#18251f] dark:text-white/95">
            <div>{topic.records}</div>
            <div>{topic.species}</div>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f8fbf4]/95 text-[#16844b] shadow-[0_10px_24px_-16px_rgba(28,77,50,0.45)] ring-1 ring-[#bddbc7] backdrop-blur dark:bg-white dark:text-[#16844b] dark:shadow-[0_10px_24px_-14px_rgba(0,0,0,0.5)] dark:ring-transparent">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </>
  );

  const className =
    "group relative block w-[206px] shrink-0 overflow-hidden rounded-lg shadow-[0_14px_36px_-28px_rgba(18,60,42,0.52)] ring-1 ring-[#c9dfcf] transition-all duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_22px_50px_-34px_rgba(18,60,42,0.64)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16844b]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5faf6] active:scale-[0.99] motion-safe:hover:-translate-y-1 dark:shadow-[0_18px_42px_-32px_rgba(0,0,0,0.8)] dark:ring-white/10 dark:hover:shadow-[0_24px_54px_-34px_rgba(0,0,0,0.9)] dark:focus-visible:ring-[#74d79a]/60 dark:focus-visible:ring-offset-[#07130d] md:w-auto";

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

function ObservationCard({ item, priority = false }: { item: ObservationPreview; priority?: boolean }) {
  return (
    <Link
      href={item.href}
      className="group block w-[78vw] max-w-[312px] shrink-0 snap-center overflow-hidden rounded-lg border border-[#d8e8dc] bg-white shadow-[0_16px_44px_-34px_rgba(23,58,41,0.55)] transition-all duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:border-[#9fceb0] hover:shadow-[0_24px_60px_-38px_rgba(23,58,41,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16844b]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5faf6] active:scale-[0.99] motion-safe:hover:-translate-y-1 dark:border-[#233f2e] dark:bg-[#0f1f16] dark:shadow-[0_18px_46px_-34px_rgba(0,0,0,0.8)] dark:hover:border-[#43865a] dark:hover:shadow-[0_24px_62px_-40px_rgba(0,0,0,0.95)] dark:focus-visible:ring-[#74d79a]/60 dark:focus-visible:ring-offset-[#07130d] md:w-auto md:max-w-none md:snap-align-none"
    >
      <div className="relative aspect-[1.12] overflow-hidden bg-[#e8f1e9] dark:bg-[#16251b] md:aspect-[1.32]">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.title}
            fill
            priority={priority}
            placeholder="blur"
            blurDataURL={natureBlurDataUrl}
            className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 42vw, 12vw"
          />
        ) : (
          <div className="flex h-full w-full items-end bg-[radial-gradient(circle_at_18%_20%,rgba(22,132,75,0.18),transparent_38%),radial-gradient(circle_at_78%_10%,rgba(56,189,248,0.18),transparent_42%),linear-gradient(150deg,#eef8ef,#dfeee7)] p-3 dark:bg-[radial-gradient(circle_at_18%_20%,rgba(116,215,154,0.14),transparent_38%),radial-gradient(circle_at_78%_10%,rgba(56,189,248,0.12),transparent_42%),linear-gradient(150deg,#122319,#172a1e)]">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-[#16844b] backdrop-blur dark:bg-[#102017]/80 dark:text-[#74d79a]">
              <Leaf className="h-3.5 w-3.5" />
              暂无照片
            </span>
          </div>
        )}
      </div>
      <div className="space-y-3 p-4 md:p-4 md:pb-5">
        <div>
          <h3 className="line-clamp-1 text-[15px] font-bold leading-5 text-[#1d2b24] transition-colors group-hover:text-[#0f6f3f] dark:text-[#eef8ef] dark:group-hover:text-[#9af0b7] md:text-[18px] md:leading-6">
            {item.title}
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-[#65736c] dark:text-[#a8b8ae]">
            <span>{item.date}</span>
            <span className="max-w-full truncate md:max-w-[15rem]">{item.location}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#dbeee0] text-[10px] font-bold text-[#16844b] dark:bg-[#183b25] dark:text-[#74d79a]">
            {item.author.slice(0, 1)}
          </span>
          <span className="min-w-0 truncate text-xs text-[#52645b] dark:text-[#b7c6bc]">{item.author}</span>
          <span className="rounded-full bg-[#e4f4e8] px-1.5 py-0.5 text-[10px] font-bold text-[#16844b] dark:bg-[#183b25] dark:text-[#8ee8ae]">{item.badge}</span>
        </div>
        <div className="flex items-center gap-2 pt-1 text-xs font-semibold text-[#40564b] dark:text-[#c5d6cb]">
          <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#f0f7f1] px-2.5 transition-colors group-hover:bg-[#e3f1e7] dark:bg-[#172a1e] dark:group-hover:bg-[#203c2a]">
            <Heart className="h-4 w-4" />
            {item.likes}
          </span>
          <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#f0f7f1] px-2.5 transition-colors group-hover:bg-[#e3f1e7] dark:bg-[#172a1e] dark:group-hover:bg-[#203c2a]">
            <MessageCircle className="h-4 w-4" />
            {item.comments}
          </span>
        </div>
      </div>
    </Link>
  );
}

function SeasonalGuideCard() {
  const guide = getSeasonalGuideItems();

  return (
    <HeroGlassPanel>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[20px] font-bold leading-7 text-[#17251f] dark:text-[#eef8ef]">季节观察指南</h2>
        <Link href="/nature/birds" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#16844b] transition-colors hover:text-[#0b6b38] dark:text-[#74d79a] dark:hover:text-[#9af0b7]">
          更多指南
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm text-[#2c4438] dark:text-[#bfd0c5]">
        <Leaf className="h-4 w-4 text-[#16844b] dark:text-[#74d79a]" />
        <span>
          当前时节：
          <strong className="font-bold text-[#16844b] dark:text-[#74d79a]">{guide.season}</strong>
          （{guide.range}）
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {guide.items.map((item) => (
          <div key={item} className="flex items-start gap-3 text-sm font-medium leading-6 text-[#2e4439] dark:text-[#c7d8cd]">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#dff1e4] text-[#0f6a3c] dark:bg-[#1f4a2c] dark:text-[#9af0b7]">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div className="pointer-events-none mt-1 flex justify-end">
        <div className="relative h-24 w-36">
          <Image src="/birds/images/passer-montanus.jpg" alt="" fill placeholder="blur" blurDataURL={natureBlurDataUrl} className="rounded-lg object-cover opacity-90 dark:opacity-80" sizes="144px" />
        </div>
      </div>
    </HeroGlassPanel>
  );
}

function HotspotMapCard({ hotspots }: { hotspots: ObservationHotspotSummary[] }) {
  const validHotspots = hotspots.filter((hotspot) => hotspot.latitude != null && hotspot.longitude != null);

  return (
    <HeroGlassPanel>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[20px] font-bold leading-7 text-[#17251f] dark:text-[#eef8ef]">本地热点观察地</h2>
        <Link href="/nature/map" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#16844b] transition-colors hover:text-[#0b6b38] dark:text-[#74d79a] dark:hover:text-[#9af0b7]">
          查看更多
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,0.94fr)_minmax(0,1.1fr)] lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.1fr)]">
        <div className="hidden md:block">
          {validHotspots.length > 0 ? (
            <DomesticMiniMap
              markers={validHotspots.slice(0, 8).map((hotspot) => ({
                latitude: hotspot.latitude as number,
                longitude: hotspot.longitude as number,
                label: hotspot.locationName,
                observedAt: hotspot.latestObservedAt,
                weight: hotspot.observationCount,
              }))}
              heightClassName="h-[210px]"
              enableTimeDecay
            />
          ) : (
            <div className="flex min-h-[210px] items-center rounded-lg border border-dashed border-[#d7eadb] bg-[#eef8ef] px-4 text-sm leading-6 text-[#65736c] dark:border-[#31503c] dark:bg-[#15271c] dark:text-[#9fb1a6]">
              公开观察记录里还没有可用于地图展示的坐标。
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          {hotspots.slice(0, 5).map((hotspot, index) => (
            <Link key={hotspot.locationName} href="/nature/map" title={hotspot.locationName} className="flex min-h-11 min-w-0 items-center gap-4 rounded-lg p-1 transition-colors hover:bg-[#eef7ef] dark:hover:bg-white/[0.06]">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eba93c] text-xs font-bold text-white dark:bg-[#d18a22]">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold leading-5 text-[#24342c] dark:text-[#edf7ef]">{hotspot.locationName}</p>
                <p className="text-xs leading-5 text-[#77867e] dark:text-[#9fb1a6]">公开记录 {hotspot.observationCount} 条</p>
              </div>
            </Link>
          ))}
          {hotspots.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#d7eadb] px-3 py-4 text-sm text-[#65736c] dark:border-[#31503c] dark:text-[#9fb1a6]">
              暂无真实热点地点。
            </div>
          ) : null}
        </div>
      </div>
    </HeroGlassPanel>
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
          : "rounded-lg border border-[#dce9df] bg-white/[0.94] p-5 shadow-[0_20px_54px_-38px_rgba(27,69,49,0.36)] dark:border-[#2a4735] dark:bg-[#0f1f16]/[0.94] dark:shadow-[0_24px_60px_-42px_rgba(0,0,0,0.9)]"
      }
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-[20px] font-bold leading-7 text-[#17251f] dark:text-[#eef8ef]">真实数据概览</h2>
        <span className="shrink-0 pt-1 text-xs font-medium text-[#65736c] dark:text-[#9fb1a6]">公开记录</span>
      </div>
      <div className="mt-4 divide-y divide-[#dfece3] dark:divide-[#274130]">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex min-w-0 items-center gap-2.5 py-3 first:pt-0 last:pb-0 sm:gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#dff0e3] text-[#16844b] dark:bg-[#183b25] dark:text-[#74d79a]">
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-bold leading-5 text-[#24342c] dark:text-[#edf7ef]">{item.title}</p>
                <p className="mt-1 line-clamp-1 text-xs text-[#65736c] dark:text-[#9fb1a6]">{item.value}</p>
              </div>
              <Link
                href={item.href}
                className="group/status-action inline-flex min-h-11 min-w-[76px] shrink-0 items-center justify-center gap-0.5 rounded-lg border border-[#91cfaa] bg-white px-3 text-sm font-semibold text-[#16844b] transition-all duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-[#16844b] hover:text-white hover:shadow-[0_12px_24px_-18px_rgba(22,132,75,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16844b]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5faf6] active:scale-[0.98] dark:border-[#3f8054] dark:bg-[#122319] dark:text-[#8ee8ae] dark:hover:bg-[#2fb76b] dark:hover:text-[#041208] dark:hover:shadow-[0_14px_28px_-20px_rgba(0,0,0,0.9)] dark:focus-visible:ring-[#74d79a]/60 dark:focus-visible:ring-offset-[#07130d]"
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
          : "relative overflow-hidden rounded-lg border border-[#dce9df] bg-[#f6fbf4] p-5 shadow-[0_16px_42px_-34px_rgba(27,69,49,0.36)] dark:border-[#2a4735] dark:bg-[#102017] dark:shadow-[0_24px_60px_-42px_rgba(0,0,0,0.9)]"
      }
    >
      <div className="absolute bottom-0 right-0 h-28 w-32 bg-[radial-gradient(circle_at_45%_80%,rgba(109,125,50,0.2),transparent_34%),radial-gradient(circle_at_72%_38%,rgba(22,132,75,0.18),transparent_28%)] dark:bg-[radial-gradient(circle_at_45%_80%,rgba(74,222,128,0.12),transparent_34%),radial-gradient(circle_at_72%_38%,rgba(45,212,191,0.1),transparent_28%)]" />
      <h2 className="text-[22px] font-bold leading-7 text-[#16844b] dark:text-[#74d79a]">社区贡献</h2>
      <div className="relative z-10 mt-5 grid grid-cols-2 gap-5">
        {contributionStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center gap-3">
              <Icon className="h-7 w-7 shrink-0 text-[#16844b] dark:text-[#74d79a]" />
              <div>
                <div className="text-[22px] font-bold leading-7 text-[#18251f] dark:text-[#eef8ef]">{stat.value}</div>
                <div className="text-sm text-[#52645b] dark:text-[#a8b8ae]">{stat.label}</div>
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
      <div className="sticky top-24 overflow-hidden rounded-lg border border-[#d6e9dc] bg-[#eef8ef]/90 p-5 shadow-[0_18px_56px_-40px_rgba(27,69,49,0.36)] dark:border-[#2a4735] dark:bg-[#0d1d14]/[0.92] dark:shadow-[0_24px_62px_-42px_rgba(0,0,0,0.95)]">
        <ContributionCard stats={stats} embedded />
        <div className="my-5 h-px bg-[#d4e7d9] dark:bg-[#274130]" />
        <DataStatusCard stats={stats} latestObservation={latestObservation} topHotspot={topHotspot} embedded />
      </div>
    </aside>
  );
}

function MobileNatureHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#dfe8e6] bg-white/[0.94] px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl dark:border-[#24382d] dark:bg-[#07130d]/[0.94] md:hidden">
      <div className="flex min-h-12 items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="返回首页">
          <SteamLogo className="h-9 w-9 shrink-0" />
          <span className="truncate text-[26px] font-black leading-none text-[#133f7a] dark:text-[#8bbdff]">STEAM 探索</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/explore" className="grid h-11 w-11 place-items-center rounded-full text-[#1f2b3a] transition-colors hover:bg-[#eef5ff] dark:text-[#d9e4f2] dark:hover:bg-white/[0.08]" aria-label="搜索">
            <Search className="h-7 w-7" />
          </Link>
          <Link href="/messages" className="relative grid h-11 w-11 place-items-center rounded-full text-[#1f2b3a] transition-colors hover:bg-[#eef5ff] dark:text-[#d9e4f2] dark:hover:bg-white/[0.08]" aria-label="消息">
            <Bell className="h-7 w-7" />
          </Link>
          <Link
            href="/profile"
            className="grid h-11 w-11 place-items-center rounded-full border border-[#8ab7ff]/55 bg-[linear-gradient(145deg,#f7fbff,#dcecff)] text-[#0f4ea8] shadow-[0_10px_24px_-16px_rgba(15,78,168,0.72),0_0_0_1px_rgba(255,255,255,0.72)_inset] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#6ea4ff] hover:bg-[linear-gradient(145deg,#ffffff,#cfe4ff)] hover:shadow-[0_16px_30px_-16px_rgba(15,78,168,0.8),0_0_0_1px_rgba(255,255,255,0.82)_inset] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bbdff] focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-0 dark:border-[#5a8ed8]/65 dark:bg-[linear-gradient(145deg,rgba(139,189,255,0.25),rgba(90,142,216,0.2))] dark:text-[#cfe5ff] dark:shadow-[0_16px_32px_-20px_rgba(0,0,0,0.78),0_0_0_1px_rgba(255,255,255,0.1)_inset] dark:hover:border-[#74a8f2] dark:hover:bg-[linear-gradient(145deg,rgba(139,189,255,0.34),rgba(90,142,216,0.28))] dark:hover:shadow-[0_20px_36px_-20px_rgba(0,0,0,0.84),0_0_0_1px_rgba(255,255,255,0.16)_inset] dark:focus-visible:ring-offset-[#07130d]"
            aria-label="个人中心"
          >
            <UserRound className="h-6 w-6 drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)] dark:drop-shadow-none" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export default async function NaturePage() {
  const homepage = await getBirdObservationHomepageData();
  const recentCards = buildObservationPreviews(homepage.recentObservations);
  const heroStats = buildHeroStats(homepage.stats);
  const topicCards = buildTopicCards(homepage.topicSummaries);
  const momentImages = buildGalleryImages(homepage.galleryImages);
  const latestObservation = homepage.recentObservations[0];
  const topHotspot = homepage.hotspots[0];
  const submitHref = buildNatureSubmitHref({
    topic: "birds",
    from: "/nature",
  });

  return (
    <div className="min-h-[calc(100dvh-var(--mobile-global-header-height,0rem))] bg-[#f5faf6] text-[#18251f] dark:bg-[#07130d] dark:text-[#eef8ef]">
      <MobileNatureHeader />

      <section className="relative isolate overflow-hidden md:min-h-[430px]">
        <Image src={heroImage} alt="" fill priority placeholder="blur" blurDataURL={natureBlurDataUrl} className="object-cover object-[center_36%] dark:brightness-75 md:object-center" sizes="100vw" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[42%] bg-gradient-to-t from-black/[0.62] via-black/[0.18] to-transparent md:h-[48%] md:from-black/[0.52] md:via-black/[0.16]" />

        <div className="relative z-10 mx-auto grid max-w-[1840px] gap-8 px-5 pb-16 pt-10 md:px-10 md:py-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:px-12">
          <div className="flex min-h-[284px] flex-col justify-between text-white md:min-h-[366px] md:justify-center">
            <div className="pt-1 md:pt-0">
              <h1 className="text-[44px] font-black leading-none [text-shadow:0_2px_6px_rgba(0,0,0,0.78)] md:text-[58px] lg:text-[66px]">自然观察</h1>
              <p className="mt-4 max-w-3xl text-[19px] font-semibold leading-7 text-white/[0.96] [text-shadow:0_2px_5px_rgba(0,0,0,0.7)] md:text-[22px]">
                记录身边的生命，和社区一起守护环境
              </p>
            </div>
            <div className="mb-[4.5rem] flex flex-wrap gap-3 md:mb-0 md:mt-8 md:gap-4">
              <Link
                href={submitHref}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#0f9a5a] px-5 text-[15px] font-extrabold text-white shadow-[0_22px_48px_-20px_rgba(15,154,90,0.95),0_0_0_1px_rgba(255,255,255,0.24)_inset] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0b844b] hover:shadow-[0_26px_58px_-22px_rgba(15,154,90,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07130d] active:scale-[0.98] dark:bg-[#2fb76b] dark:text-[#041208] dark:hover:bg-[#55d988] md:min-h-[56px] md:px-8 md:text-[17px]"
              >
                <Camera className="h-5 w-5" />
                发布观察
              </Link>
            </div>
            <div className="mt-9 hidden max-w-[720px] grid-cols-4 gap-7 md:grid">
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

          <div className="hidden space-y-4 self-start pt-0 lg:block">
            <SeasonalGuideCard />
            <HotspotMapCard hotspots={homepage.hotspots} />
          </div>
        </div>
      </section>

      <HeroStatsCard stats={heroStats} />

      <div className="mx-auto grid max-w-[1840px] gap-8 px-4 pb-24 pt-5 md:px-10 md:pb-14 md:pt-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:px-12">
        <main className="min-w-0 space-y-8">
          <section className="rounded-lg border border-[#dce9df] bg-white p-3 shadow-[0_18px_56px_-40px_rgba(27,69,49,0.38)] dark:border-[#2a4735] dark:bg-[#0d1d14] dark:shadow-[0_24px_62px_-42px_rgba(0,0,0,0.95)] md:p-5">
            <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible">
              {topicCards.map((topic) => (
                <TopicCardView key={topic.title} topic={topic} />
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[#dce9df] bg-white p-4 shadow-[0_18px_56px_-40px_rgba(27,69,49,0.38)] dark:border-[#2a4735] dark:bg-[#0d1d14] dark:shadow-[0_24px_62px_-42px_rgba(0,0,0,0.95)] md:p-6">
            <SectionHeader icon={Leaf} title="最近观察记录" href="/nature/observations" />
            <div className="no-scrollbar -mx-4 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-1 xl:grid-cols-3">
              {recentCards.map((item, index) => (
                <ObservationCard key={item.id} item={item} priority={index === 0} />
              ))}
            </div>
            {recentCards.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-[#d7eadb] bg-[#f6fbf4] px-4 py-8 text-center text-sm text-[#65736c] dark:border-[#31503c] dark:bg-[#102017] dark:text-[#9fb1a6]">
                暂无公开观察记录。发布后的真实记录会出现在这里。
              </div>
            ) : null}
          </section>

          {momentImages.length > 0 ? (
            <section className="hidden rounded-lg border border-[#dce9df] bg-white p-4 shadow-[0_18px_56px_-40px_rgba(27,69,49,0.38)] dark:border-[#2a4735] dark:bg-[#0d1d14] dark:shadow-[0_24px_62px_-42px_rgba(0,0,0,0.95)] md:block md:p-5">
              <SectionHeader icon={Telescope} title="精彩瞬间" href="/nature/observations" action="查看更多" />
              <div className="mt-4 grid grid-cols-6 gap-3">
                {momentImages.map((image, index) => (
                  <Link key={`${String(image)}-${index}`} href="/nature/observations" className="relative aspect-[1.35] overflow-hidden rounded-lg bg-[#e8f1e9] dark:bg-[#16251b]">
                    <Image src={image} alt="" fill placeholder="blur" blurDataURL={natureBlurDataUrl} className="object-cover transition-transform duration-500 hover:scale-[1.04] dark:brightness-[.85]" sizes="14vw" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:hidden">
            <DataStatusCard stats={homepage.stats} latestObservation={latestObservation} topHotspot={topHotspot} />
            <MobileHotspotsCard hotspots={homepage.hotspots} />
          </div>

          <div className="md:hidden">
            <ContributionCard stats={homepage.stats} />
          </div>
        </main>

        <DesktopSidebar stats={homepage.stats} latestObservation={latestObservation} topHotspot={topHotspot} />
      </div>
    </div>
  );
}
