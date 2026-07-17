import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  FlaskConical,
  Heart,
  Leaf,
  Lightbulb,
  MapPin,
  UsersRound,
} from "lucide-react";

import { MobileShortcutCarousel } from "@/components/home/mobile-shortcut-carousel";
import { HomeWorksSection } from "@/components/home/home-works-section";
import { buttonVariants } from "@/components/ui/button";
import { categoryToneClasses } from "@/components/ui/tone-badge";
import { SteamLogo } from "@/components/layout/logo";
import { CATEGORY_META } from "@/lib/config/categories";
import { formatRelativeTime } from "@/lib/date-utils";
import { type HomeCategoryTileCounts, type HomeSteamCategoryKey } from "@/lib/home/category-tiles";
import { type HomeCommunityFeedItem, type HomeCommunityFeedKind } from "@/lib/home/community-feed";
import { type ObservationEvent, type Work } from "@/lib/mappers/types";
import { getObservationDisplayTitle } from "@/lib/observations/display";
import { cn } from "@/lib/utils";

const heroImage = "/assets/home-hero-steam-lake.png";
const heroWideImage = "/assets/home-hero-steam-lake-banner.webp";
const natureForegroundImage = "/assets/home-nature-channel-bird-foreground-v8.png";
const leaderboardForegroundImage = "/assets/home-leaderboard-card-foreground-v2.png";

type HomeCategoryCountSource = { type: "projects"; category: HomeSteamCategoryKey } | { type: "playground" };

const homeCategoryTiles: Array<{
  metaKey: keyof typeof CATEGORY_META;
  href: string;
  labelOverride?: string;
  countSource: HomeCategoryCountSource;
}> = [
  {
    metaKey: "科学",
    href: "/explore?category=科学",
    countSource: { type: "projects", category: "科学" },
  },
  {
    metaKey: "技术",
    href: "/explore?category=技术",
    countSource: { type: "projects", category: "技术" },
  },
  {
    metaKey: "工程",
    href: "/explore?category=工程",
    countSource: { type: "projects", category: "工程" },
  },
  {
    metaKey: "艺术",
    href: "/explore?category=艺术",
    countSource: { type: "projects", category: "艺术" },
  },
  {
    metaKey: "数学",
    href: "/explore?category=数学",
    countSource: { type: "projects", category: "数学" },
  },
  {
    metaKey: "其他",
    href: "/playground",
    labelOverride: "游乐场",
    countSource: { type: "playground" },
  },
];

function formatCategoryTileCountLabel(source: HomeCategoryCountSource, counts: HomeCategoryTileCounts): string {
  const nf = new Intl.NumberFormat("zh-CN");
  if (source.type === "playground") {
    return `${nf.format(counts.playgroundGames)} 个玩法`;
  }
  return `${nf.format(counts[source.category])} 个项目`;
}

const homeHeroFeatures = [
  { icon: FlaskConical, label: "动手实践", color: "text-[hsl(var(--brand-blue))]" },
  { icon: Lightbulb, label: "跨学科融合", color: "text-[hsl(var(--brand-amber))]" },
  { icon: UsersRound, label: "社区协作", color: "text-[hsl(var(--tone-science))]" },
  { icon: Leaf, label: "自然探索", color: "text-[hsl(var(--brand-green))]" },
] as const;

function HomeHero({ image }: { image: string }) {
  return (
    <section className="surface-card relative overflow-hidden rounded-sm">
      <div className="relative min-h-[176px] max-[379px]:min-h-[164px] min-[390px]:min-h-[184px] md:min-h-[248px] lg:min-h-[260px]">
        <Image
          src={image}
          alt="孩子们在湖边进行 STEAM 实验"
          width={1672}
          height={941}
          priority
          loading="eager"
          sizes="(max-width: 768px) 100vw, 1800px"
          className="absolute inset-0 h-full w-full object-cover object-[74%_center] dark:brightness-90 md:hidden"
        />
        <Image
          src={heroWideImage}
          alt="孩子们在湖边进行 STEAM 实验"
          fill
          priority
          loading="eager"
          sizes="1800px"
          className="hidden object-cover object-center dark:brightness-90 md:block"
        />
        <div className="absolute inset-x-0 top-0 h-[112px] bg-[linear-gradient(180deg,rgba(248,252,255,0.78)_0%,rgba(248,252,255,0.62)_38%,rgba(248,252,255,0.24)_72%,rgba(248,252,255,0)_100%)] dark:bg-[linear-gradient(180deg,rgba(6,12,22,0.62)_0%,rgba(6,12,22,0.46)_38%,rgba(6,12,22,0.16)_72%,rgba(6,12,22,0)_100%)] md:inset-0 md:h-auto md:bg-[linear-gradient(90deg,rgba(248,252,255,0.94)_0%,rgba(248,252,255,0.82)_22%,rgba(248,252,255,0.52)_40%,rgba(248,252,255,0.18)_57%,rgba(248,252,255,0)_72%)] md:dark:bg-[linear-gradient(90deg,rgba(6,12,22,0.82)_0%,rgba(6,12,22,0.68)_24%,rgba(6,12,22,0.4)_42%,rgba(6,12,22,0.14)_60%,rgba(6,12,22,0)_76%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/40 to-transparent md:hidden" />

        <div className="relative z-10 flex min-h-[176px] flex-col justify-start px-4 pb-0 pt-3.5 max-[379px]:min-h-[164px] min-[390px]:min-h-[184px] md:min-h-[248px] md:justify-center md:px-10 md:py-7 lg:min-h-[260px]">
          <div className="max-w-[276px] min-[390px]:max-w-[308px] md:max-w-[600px] lg:max-w-[680px]">
            <p className="hidden text-[12px] font-bold tracking-normal text-[hsl(var(--brand-blue))] md:block">
              STEAM 项目式学习社区
            </p>
            <h1 className="font-heading text-[22px] font-black leading-none tracking-normal text-foreground dark:[text-shadow:0_2px_10px_rgba(0,0,0,0.28)] min-[390px]:text-[24px] md:mt-2.5 md:text-[36px] md:leading-[1.08] lg:text-[42px]">
              <span className="md:hidden">
                <span className="text-[hsl(var(--brand-blue))]">探索</span>
                <span className="px-1.5 text-foreground">·</span>
                <span className="text-[hsl(var(--brand-green))]">创造</span>
                <span className="px-1.5 text-foreground">·</span>
                <span className="text-[hsl(var(--brand-amber))]">成长</span>
              </span>
              <span className="hidden md:block">把好奇心做成作品</span>
            </h1>

            <p className="mt-1.5 inline-flex whitespace-nowrap text-[11px] font-normal leading-4 tracking-normal text-muted-foreground min-[390px]:text-[12px] md:hidden">
              在 STEAM 的世界里发现无限可能
            </p>
            <p className="mt-3 hidden max-w-[540px] text-[15px] font-medium leading-7 tracking-normal text-muted-foreground md:block lg:text-[16px]">
              选一个真实项目，记录实验过程，和同伴一起把科学、编程、工程、艺术与自然观察变成可展示的成果。
            </p>

            <div className="mt-5 hidden flex-wrap gap-3 md:flex">
              <Link
                href="/explore"
                className={cn(
                  buttonVariants({ tone: "brand", size: "lg", shape: "pill" }),
                  "h-11 gap-2 px-5 text-[14px] font-bold shadow-[0_18px_34px_-24px_hsl(var(--brand-blue)/0.9)]",
                )}
              >
                开始探索项目
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/create"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg", shape: "pill" }),
                  "h-11 gap-2 border-[hsl(var(--brand-green)/0.36)] bg-[hsl(var(--surface-raised)/0.82)] px-5 text-[14px] font-bold text-[hsl(var(--brand-green))] hover:bg-[hsl(var(--brand-green)/0.1)]",
                )}
              >
                进入创造营
              </Link>
            </div>

            <div className="mt-4 hidden max-w-[500px] grid-cols-4 gap-3 text-muted-foreground md:grid">
              {homeHeroFeatures.map((item) => (
                <div key={item.label} className="flex flex-col items-start gap-1 text-left md:flex-row md:items-center md:gap-1.5">
                  <item.icon className={cn("h-[18px] w-[18px] shrink-0", item.color)} strokeWidth={2.2} />
                  <span className="text-[12px] font-medium leading-4">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto grid w-full max-w-[300px] grid-cols-4 gap-1.5 pt-2 text-white/80 max-[379px]:hidden min-[390px]:max-w-[320px] min-[390px]:gap-2 md:hidden">
            {homeHeroFeatures.map((item) => (
              <div
                key={item.label}
                className="flex min-h-[28px] items-center justify-center gap-0.5 px-0.5 py-0.5 text-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] min-[390px]:gap-1"
              >
                <item.icon className="h-[11px] w-[11px] shrink-0 text-white/76 min-[390px]:h-3 min-[390px]:w-3" strokeWidth={2.2} />
                <span className="whitespace-nowrap text-[10px] font-semibold leading-none tracking-normal text-white/78">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

function MobileLeaderboardEntry({ className }: { className?: string }) {
  return (
    <Link
      href="/leaderboard"
      className={cn(
        "surface-card-interactive group relative block min-h-[90px] overflow-hidden rounded-sm border border-[hsl(var(--brand-amber)/0.42)] bg-[linear-gradient(120deg,hsl(var(--brand-amber)/0.18)_0%,hsl(var(--surface-raised))_44%,hsl(var(--brand-blue)/0.16)_100%)] shadow-[0_18px_36px_-30px_hsl(var(--brand-amber)/0.8)] min-[390px]:min-h-[94px]",
        className,
      )}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_78%_34%,hsl(var(--brand-blue)/0.2),transparent_34%),radial-gradient(circle_at_18%_0%,hsl(var(--brand-amber)/0.24),transparent_38%)]" />
      <span className="absolute inset-0 opacity-55 mix-blend-soft-light bg-[linear-gradient(145deg,transparent_0%,transparent_46%,rgba(255,255,255,0.5)_47%,transparent_58%),repeating-linear-gradient(100deg,rgba(255,255,255,0.32)_0_1px,transparent_1px_20px)]" />
      <span className="pointer-events-none absolute bottom-[-8px] right-[-10px] top-0 w-[56%] min-[390px]:w-[54%]">
        <Image
          src={leaderboardForegroundImage}
          alt=""
          fill
          sizes="220px"
          className="object-contain object-bottom-right drop-shadow-[0_16px_22px_rgba(146,64,14,0.2)] transition duration-500 group-hover:scale-[1.04]"
        />
      </span>
      <span className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--surface-raised)/0.96)_0%,hsl(var(--surface-raised)/0.88)_48%,hsl(var(--surface-raised)/0.18)_74%,transparent_100%)]" />
      <span className="relative z-10 flex h-full min-h-[90px] max-w-[220px] flex-col justify-center px-4 py-2 min-[390px]:min-h-[94px]">
        <span className="block font-sans text-[15px] font-extrabold leading-none text-foreground min-[390px]:text-[16px]">社区排行榜</span>
        <span className="mt-1 block whitespace-nowrap text-[11px] font-medium leading-4 text-muted-foreground">积分、徽章和项目高手榜</span>
        <span
          className={cn(
            buttonVariants({ variant: "default", tone: "brand", size: "sm" }),
            "mt-2 h-6 w-fit gap-1 rounded-full px-3 text-[10px] font-bold shadow-[0_10px_18px_-14px_hsl(var(--brand-blue)/0.95)] transition group-hover:translate-x-0.5 min-[390px]:h-7 min-[390px]:text-[11px]",
          )}
        >
          查看榜单
          <ArrowRight className="h-3 w-3" />
        </span>
      </span>
    </Link>
  );
}

function CategoryGrid({ categoryTileCounts }: { categoryTileCounts: HomeCategoryTileCounts }) {
  return (
    <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 md:gap-3 lg:grid-cols-6 lg:gap-3">
      {homeCategoryTiles.map((category) => {
        const meta = CATEGORY_META[category.metaKey];
        const Icon = meta.icon;
        const tone = categoryToneClasses[meta.tone ?? "science"];
        const countLabel = formatCategoryTileCountLabel(category.countSource, categoryTileCounts);

        return (
          <Link
            key={category.metaKey}
            href={category.href}
            className={cn(
              "group flex min-h-[62px] min-w-0 items-center justify-start gap-2 rounded-sm border bg-[hsl(var(--surface-raised)/0.52)] px-2.5 py-2.5 text-left transition hover:-translate-y-0.5 hover:bg-[hsl(var(--surface-raised)/0.9)] hover:shadow-[0_18px_34px_-30px_hsl(var(--surface-shadow)/0.4)] min-[390px]:gap-2.5 md:min-h-[88px] md:gap-3 md:px-4 md:py-3 lg:min-h-[84px] min-[1480px]:min-h-[96px] min-[1480px]:gap-3.5 min-[1480px]:px-4",
              tone.border,
            )}
          >
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full transition group-hover:scale-105 md:h-10 md:w-10", tone.bg)}>
              <Icon className={cn("h-5 w-5 md:h-[22px] md:w-[22px]", tone.text)} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <span className={cn("block whitespace-nowrap font-sans text-[12px] font-bold leading-none md:text-[16px] min-[1480px]:text-[17px]", tone.text)}>{category.labelOverride ?? meta.label}</span>
              <p className="mt-1.5 hidden text-[12px] text-muted-foreground min-[1480px]:block">{meta.description}</p>
              <p className="mt-0.5 whitespace-nowrap text-[10px] font-medium leading-4 text-muted-foreground md:mt-1.5 md:text-[12px]">{countLabel}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function StartExploreSection({ categoryTileCounts }: { categoryTileCounts: HomeCategoryTileCounts }) {
  return (
    <section aria-labelledby="home-start-heading">
      <div className="mb-2 flex items-center justify-between md:mb-3">
        <div>
          <p className="hidden text-[11px] font-bold text-[hsl(var(--brand-blue))] md:block">选择一个方向</p>
          <h2 id="home-start-heading" className="text-[17px] font-extrabold text-foreground md:mt-1 md:text-[20px]">
            从这里开始
          </h2>
        </div>
        <Link
          href="/explore"
          className="inline-flex min-h-11 items-center gap-1 px-1.5 text-[13px] font-semibold text-[hsl(var(--brand-blue))]"
        >
          全部项目
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <CategoryGrid categoryTileCounts={categoryTileCounts} />
    </section>
  );
}

function NatureChannel({ className }: { className?: string }) {
  return (
    <Link
      href="/nature"
      className={cn(
        "group relative block min-h-[90px] overflow-hidden rounded-sm bg-[hsl(var(--brand-green))] shadow-[0_14px_30px_-24px_hsl(var(--brand-green)/0.65)] min-[390px]:min-h-[94px] md:min-h-[172px] md:rounded-sm lg:min-h-full",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(12,76,31,0.99)_0%,rgba(13,79,34,0.99)_58%,rgba(19,98,43,0.98)_100%)]" />
      <div className="absolute inset-0 opacity-25 mix-blend-soft-light bg-[linear-gradient(150deg,transparent_0%,transparent_48%,rgba(255,255,255,0.18)_49%,transparent_58%),repeating-linear-gradient(112deg,rgba(255,255,255,0.07)_0_1px,transparent_1px_18px)]" />
      <div className="pointer-events-none absolute inset-y-[-18%] right-[-46px] w-[72%] min-[390px]:right-[-52px] min-[390px]:w-[68%] md:inset-y-[-10%] md:right-[-16px] md:w-[64%] lg:right-[-16px] lg:w-[78%] min-[1640px]:right-[-32px] min-[1640px]:w-[76%]">
        <Image
          src={natureForegroundImage}
          alt=""
          fill
          sizes="(max-width: 768px) 320px, (min-width: 1640px) 420px, (min-width: 1024px) 320px, 430px"
          className="object-contain object-right-center drop-shadow-[0_18px_24px_rgba(3,34,12,0.28)] transition duration-500 group-hover:scale-[1.03] dark:brightness-95"
        />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,64,27,0.98)_0%,rgba(11,64,27,0.9)_42%,rgba(11,64,27,0.34)_58%,transparent_76%)] md:bg-[linear-gradient(90deg,rgba(11,64,27,0.98)_0%,rgba(11,64,27,0.9)_45%,rgba(11,64,27,0.26)_62%,transparent_78%)] min-[1480px]:bg-[linear-gradient(90deg,rgba(11,64,27,0.96)_0%,rgba(11,64,27,0.78)_36%,rgba(11,64,27,0.18)_58%,transparent_74%)]" />
      <div className="relative z-10 flex h-full min-h-[90px] max-w-[186px] flex-col justify-center px-4 py-2 text-white/90 min-[390px]:min-h-[94px] min-[390px]:max-w-[206px] md:min-h-[172px] md:max-w-none md:px-6 md:py-5 md:text-white">
        <h2 className="font-sans text-[14px] font-extrabold leading-none min-[390px]:text-[15px] md:text-[20px]">自然观察频道</h2>
        <p className="mt-1 whitespace-nowrap text-[10px] font-medium leading-4 text-white/74 min-[390px]:text-[11px] md:mt-3 md:text-[13px] md:text-white/92">观察自然 · 记录生命 · 保护环境</p>
        <span className="mt-1.5 inline-flex h-6 w-fit items-center gap-1 rounded-full bg-white px-2.5 text-[10px] font-bold text-[hsl(var(--brand-green))] shadow-[0_6px_14px_-10px_rgba(0,0,0,0.45)] md:mt-5 md:h-8 md:gap-2 md:px-4 md:text-[13px]">
          立即进入
          <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
        </span>
      </div>
    </Link>
  );
}

function HomeObservationCard({ observation, priority }: { observation: ObservationEvent; priority: boolean }) {
  const image = observation.mediaUrls[0];
  const title = getObservationDisplayTitle(observation.species);

  return (
    <Link
      href={`/nature/observations/${observation.id}?from=${encodeURIComponent("/")}`}
      prefetch={false}
      className="group grid min-h-[112px] grid-cols-[108px_minmax(0,1fr)] overflow-hidden rounded-sm border border-border bg-card transition hover:border-[hsl(var(--surface-border-strong))] sm:grid-cols-[124px_minmax(0,1fr)] lg:grid-cols-[112px_minmax(0,1fr)]"
    >
      <div className="relative min-h-[112px] bg-[hsl(var(--surface-muted))]">
        {image ? (
          <Image
            src={image}
            alt={title}
            fill
            sizes="140px"
            quality={60}
            priority={priority}
            className="object-cover transition duration-500 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="grid h-full place-items-center text-[hsl(var(--brand-green))]">
            <Leaf className="h-7 w-7" />
          </div>
        )}
      </div>
      <div className="min-w-0 p-3">
        <h3 className="truncate text-sm font-bold text-foreground">{title}</h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {observation.authorDisplayName || "自然观察者"}
        </p>
        <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
          <p className="flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0 text-[hsl(var(--brand-green))]" />
            <span className="truncate">{observation.locationName || "未标注地点"}</span>
          </p>
          <p className="flex items-center gap-1">
            <Clock3 className="h-3 w-3 shrink-0" />
            {formatRelativeTime(observation.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function HomeNatureSection({ observations }: { observations: ObservationEvent[] }) {
  return (
    <section className="min-w-0" aria-labelledby="home-nature-heading">
      <div className="mb-2 flex items-center justify-between md:mb-3">
        <div>
          <p className="hidden text-[11px] font-bold text-[hsl(var(--brand-green))] md:block">身边的真实发现</p>
          <h2 id="home-nature-heading" className="text-[17px] font-extrabold text-foreground md:mt-1 md:text-[20px]">
            自然新发现
          </h2>
        </div>
        <Link
          href="/nature/observations"
          className="inline-flex min-h-11 items-center gap-1 px-1.5 text-[13px] font-semibold text-[hsl(var(--brand-green))]"
        >
          全部观察
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {observations.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {observations.slice(0, 3).map((observation, index) => (
            <HomeObservationCard key={observation.id} observation={observation} priority={index === 0} />
          ))}
        </div>
      ) : (
        <div className="grid min-h-[180px] place-items-center rounded-sm border border-dashed border-border bg-card/45 px-5 text-center">
          <div>
            <p className="text-sm font-semibold text-foreground">还没有新的自然记录</p>
            <Link href="/nature/submit" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[hsl(var(--brand-green))]">
              发布一次观察
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function communityFeedIconWrap(kind: HomeCommunityFeedKind) {
  switch (kind) {
    case "observation":
      return {
        wrap: "bg-[hsl(var(--brand-green)/0.12)] text-[hsl(var(--brand-green))]",
        icon: <Leaf className="h-5 w-5" />,
      };
    case "project_like":
      return {
        wrap: "bg-[hsl(var(--brand-amber)/0.14)] text-[hsl(var(--brand-amber))]",
        icon: <Heart className="h-5 w-5 fill-current" />,
      };
    case "project_new":
    default:
      return {
        wrap: "bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]",
        icon: <FlaskConical className="h-5 w-5" />,
      };
  }
}

function CommunityAndActivity({ communityFeed }: { communityFeed: HomeCommunityFeedItem[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <section className="rounded-md border border-[hsl(var(--surface-border)/0.72)] bg-[hsl(var(--surface-raised)/0.58)] p-4 shadow-none">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-foreground">社区动态</h2>
          <Link href="/create" className="text-[13px] font-medium text-[hsl(var(--brand-blue))]">查看全部</Link>
        </div>
        {communityFeed.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted-foreground">
            暂无最新动态。
            <Link href="/create" className="font-medium text-[hsl(var(--brand-blue))]"> 去创造营看看</Link>
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {communityFeed.map((item) => {
              const { wrap, icon } = communityFeedIconWrap(item.kind);
              return (
                <Link key={item.key} href={item.href} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-sm p-2 transition hover:bg-[hsl(var(--surface-muted))]">
                  <span className={cn("grid h-10 w-10 place-items-center rounded-full", wrap)}>{icon}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-muted-foreground">
                      <span className="font-semibold text-[hsl(var(--brand-blue))]">{item.actorName}</span> {item.action}
                    </p>
                    <h3 className="mt-1 truncate text-[15px] font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-[12px] text-muted-foreground">{item.timeLabel}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-md border border-[hsl(var(--brand-amber)/0.28)] bg-[linear-gradient(135deg,hsl(var(--brand-amber)/0.1),hsl(var(--surface-raised)/0.76)_46%,hsl(var(--brand-green)/0.08))] p-4 shadow-none">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-foreground">本周挑战</h2>
          <Link href="/create" className="text-[13px] font-medium text-[hsl(var(--brand-blue))]">查看全部</Link>
        </div>
        <Link href="/create" className="grid grid-cols-[86px_minmax(0,1fr)] gap-3 rounded-sm p-2 transition hover:bg-[hsl(var(--surface-raised)/0.72)]">
          <div className="relative h-[64px] overflow-hidden rounded-xs bg-[hsl(var(--surface-muted))]">
            <Image src={heroImage} alt="STEAM 创新大赛" fill sizes="120px" className="object-cover object-[62%_center]" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-bold text-foreground">用一个实验解释身边现象</h3>
            <p className="mt-2 text-[12px] leading-5 text-muted-foreground">每周开放 · 提交过程记录和作品成果</p>
          </div>
        </Link>
      </section>
    </div>
  );
}

const homeFooterColumns = [
  {
    title: "关于我们",
    links: [
      { label: "关于我们", href: "/settings/about" },
      { label: "联系我们", href: "/settings/about" },
      { label: "加入我们", href: "/settings/about" },
    ],
  },
  {
    title: "帮助中心",
    links: [
      { label: "使用指南", href: "/explore" },
      { label: "常见问题", href: "/settings/about" },
      { label: "安全与隐私", href: "/legal/privacy" },
    ],
  },
  {
    title: "合作伙伴",
    links: [
      { label: "学校合作", href: "/settings/about" },
      { label: "机构合作", href: "/settings/about" },
      { label: "赞助我们", href: "/settings/about" },
    ],
  },
  {
    title: "反馈与支持",
    links: [
      { label: "提交反馈", href: "/settings/about" },
      { label: "服务条款", href: "/legal/terms" },
      { label: "隐私政策", href: "/legal/privacy" },
    ],
  },
] as const;

function HomeFooter() {
  return (
    <footer className="hidden border-t border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.7)] py-6 md:block">
      <div className="app-shell-wide grid grid-cols-2 gap-x-10 gap-y-7 px-8 text-[13px] text-muted-foreground lg:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div>
          <Link href="/" className="mb-3 flex items-center gap-2">
            <SteamLogo className="h-8 w-8" />
            <span className="text-[22px] font-extrabold text-[hsl(var(--brand-blue))]">STEAM 探索</span>
          </Link>
          <p>连接全球青少年，探索 STEAM 的无限可能</p>
        </div>
        {homeFooterColumns.map((column) => (
          <div key={column.title}>
            <h3 className="mb-3 font-bold text-foreground">{column.title}</h3>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-[12px] text-muted-foreground">© 2026 STEAM 探索 · 面向青少年的项目式学习社区</p>
    </footer>
  );
}

export function HomeShowcase({
  works,
  worksNextOffset,
  worksHasMore,
  recentNatureObservations,
  communityFeed,
  categoryTileCounts,
}: {
  works: Work[];
  worksNextOffset: number;
  worksHasMore: boolean;
  recentNatureObservations: ObservationEvent[];
  communityFeed: HomeCommunityFeedItem[];
  categoryTileCounts: HomeCategoryTileCounts;
}) {
  return (
    <div className="app-canvas min-h-screen">
      <div className="app-shell-wide flex flex-col gap-2.5 pb-2.5 pt-1 min-[390px]:gap-3 min-[390px]:pb-3 min-[390px]:pt-1.5 md:gap-5 md:py-6 lg:gap-5">
        <HomeHero image={heroImage} />
        <MobileShortcutCarousel>
          <NatureChannel className="h-full" />
          <MobileLeaderboardEntry className="h-full min-h-[90px] min-[390px]:min-h-[94px]" />
        </MobileShortcutCarousel>

        <StartExploreSection categoryTileCounts={categoryTileCounts} />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
          <HomeWorksSection
            initialData={{ works, nextOffset: worksNextOffset, hasMore: worksHasMore }}
          />
          <HomeNatureSection observations={recentNatureObservations} />
        </div>

        <div className="hidden md:block">
          <CommunityAndActivity communityFeed={communityFeed} />
        </div>
      </div>
      <HomeFooter />
    </div>
  );
}
