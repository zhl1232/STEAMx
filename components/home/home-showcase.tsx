import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  FlaskConical,
  Heart,
  Leaf,
  Lightbulb,
  Flame,
  UsersRound,
} from "lucide-react";

import { RecommendationPanel } from "@/components/home/recommendation-panel";
import { buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { categoryToneClasses } from "@/components/ui/tone-badge";
import { SteamLogo } from "@/components/layout/logo";
import {
  COMPACT_VERTICAL_PROJECT_CARD_CLASS,
  COMPACT_VERTICAL_PROJECT_GRID_CLASS,
} from "@/components/features/compact-project-grid-styles";
import { ProjectCard } from "@/components/features/project-card";
import { CATEGORY_META } from "@/lib/config/categories";
import { type HomeCategoryTileCounts, type HomeSteamCategoryKey } from "@/lib/home/category-tiles";
import { type HomeCommunityFeedItem, type HomeCommunityFeedKind } from "@/lib/home/community-feed";
import { type HomepageRecommendationMode } from "@/lib/home/recommendations";
import { type Project } from "@/lib/mappers/types";
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

const fallbackProjects: Project[] = [
  {
    id: "home-water-rocket",
    title: "自制水火箭",
    author: "小科学家",
    author_id: "home",
    image: "/projects/generated/project-0010.webp",
    category: "工程",
    likes: 1200,
    comments_count: 128,
  },
  {
    id: "home-campus-bird",
    title: "校园鸟类观察",
    author: "自然小队",
    author_id: "home",
    image: "/birds/images/tarsiger-cyanurus.jpg",
    category: "科学",
    likes: 862,
    comments_count: 95,
  },
  {
    id: "home-geometry-art",
    title: "几何艺术装置",
    author: "创意工坊",
    author_id: "home",
    image: "/projects/generated/project-0337.webp",
    category: "艺术",
    likes: 673,
    comments_count: 72,
  },
  {
    id: "home-led",
    title: "电路小实验：让 LED 发光",
    author: "电学小子",
    author_id: "home",
    image: "/projects/generated/project-0143.webp",
    category: "技术",
    likes: 1500,
    comments_count: 160,
  },
  {
    id: "home-paper-bridge",
    title: "纸桥承重挑战",
    author: "工程达人",
    author_id: "home",
    image: "/projects/generated/project-0227.webp",
    category: "工程",
    likes: 1100,
    comments_count: 108,
  },
  {
    id: "home-math-curve",
    title: "数学曲线绘图机",
    author: "数感实验室",
    author_id: "home",
    image: "/projects/generated/project-0268.webp",
    category: "数学",
    likes: 920,
    comments_count: 84,
  },
];

const homeHeroFeatures = [
  { icon: FlaskConical, label: "动手实践", color: "text-[hsl(var(--brand-blue))]" },
  { icon: Lightbulb, label: "跨学科融合", color: "text-[hsl(var(--brand-amber))]" },
  { icon: UsersRound, label: "社区协作", color: "text-[hsl(var(--tone-science))]" },
  { icon: Leaf, label: "自然探索", color: "text-[hsl(var(--brand-green))]" },
] as const;

function projectHref(project: Project) {
  return typeof project.id === "string" && project.id.startsWith("home-") ? "/explore" : `/project/${project.id}`;
}

function getShowcaseProjects(projects: Project[]) {
  return fallbackProjects.map((fallback, index) => {
    const project = projects[index];
    if (!project) {
      return fallback;
    }

    return {
      ...fallback,
      ...project,
      title: project.title?.trim() || fallback.title,
      author: project.author?.trim() || fallback.author,
      author_id: project.author_id?.trim() || fallback.author_id,
      image: project.image?.trim() || fallback.image,
      category: project.category?.trim() || fallback.category,
      likes: project.likes ?? 0,
      views_count: project.views_count ?? 0,
      comments_count: project.comments_count ?? 0,
    };
  });
}

function HomeHero({ image }: { image: string }) {
  return (
    <section className="surface-card relative overflow-hidden rounded-lg md:rounded-md">
      <div className="relative min-h-[176px] max-[379px]:min-h-[164px] min-[390px]:min-h-[184px] md:min-h-[220px]">
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
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent md:hidden" />

        <div className="relative z-10 flex min-h-[176px] flex-col justify-start px-4 pb-0 pt-3.5 max-[379px]:min-h-[164px] min-[390px]:min-h-[184px] md:min-h-[220px] md:justify-center md:px-12 md:py-6">
          <div className="max-w-[276px] min-[390px]:max-w-[308px] md:max-w-[760px]">
            <h1 className="whitespace-nowrap font-sans text-[22px] font-black leading-none tracking-normal text-foreground dark:[text-shadow:0_2px_10px_rgba(0,0,0,0.28)] min-[390px]:text-[24px] md:text-[40px] lg:text-[44px]">
              <span className="text-[hsl(var(--brand-blue))]">探索</span>
              <span className="px-1.5 text-foreground md:px-4">·</span>
              <span className="text-[hsl(var(--brand-green))]">创造</span>
              <span className="px-1.5 text-foreground md:px-4">·</span>
              <span className="text-[hsl(var(--brand-amber))]">成长</span>
            </h1>

            <p className="mt-1.5 inline-flex whitespace-nowrap text-[11px] font-normal leading-4 tracking-normal text-muted-foreground min-[390px]:text-[12px] md:hidden">
              在 STEAM 的世界里发现无限可能
            </p>
            <p className="mt-3 hidden max-w-none text-[21px] font-medium leading-7 tracking-normal text-muted-foreground md:block">
              在 STEAM 的世界里发现无限可能
            </p>

            <div className="mt-4 hidden max-w-[500px] grid-cols-4 gap-3.5 text-muted-foreground md:grid">
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
          className="object-contain object-right-bottom drop-shadow-[0_16px_22px_rgba(146,64,14,0.2)] transition duration-500 group-hover:scale-[1.04]"
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
    <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 md:grid-cols-3 md:gap-4 md:pb-1 min-[1280px]:grid-cols-6">
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
              "surface-card-interactive group flex min-h-[62px] min-w-0 items-center justify-start gap-2 rounded-md border px-2.5 py-2.5 text-left transition hover:-translate-y-0.5 min-[390px]:gap-2.5 md:min-h-[116px] md:gap-3 md:rounded-sm md:px-4 md:py-4 min-[1480px]:gap-4 min-[1480px]:px-5",
              tone.border,
              tone.bg,
            )}
          >
            <Icon className={cn("h-5 w-5 shrink-0 transition group-hover:scale-105 min-[390px]:h-5 min-[390px]:w-5 md:h-10 md:w-10 min-[1480px]:h-11 min-[1480px]:w-11", tone.text)} strokeWidth={2.2} />
            <div className="min-w-0">
              <h2 className={cn("whitespace-nowrap font-sans text-[12px] font-bold leading-none md:text-[18px] min-[1480px]:text-[20px]", tone.text)}>{category.labelOverride ?? meta.label}</h2>
              <p className="mt-2 hidden text-[12px] text-muted-foreground md:block min-[1480px]:text-[13px]">{meta.description}</p>
              <p className="mt-0.5 whitespace-nowrap text-[10px] font-medium leading-4 text-muted-foreground md:mt-3 md:text-[12px] min-[1480px]:text-[14px]">{countLabel}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function NatureChannel({ className }: { className?: string }) {
  return (
    <Link
      href="/nature"
      className={cn(
        "group relative block min-h-[90px] overflow-hidden rounded-sm bg-[hsl(var(--brand-green))] shadow-[0_14px_30px_-24px_hsl(var(--brand-green)/0.65)] min-[390px]:min-h-[94px] md:min-h-[176px] md:rounded-sm min-[1480px]:h-full",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(12,76,31,0.99)_0%,rgba(13,79,34,0.99)_58%,rgba(19,98,43,0.98)_100%)]" />
      <div className="absolute inset-0 opacity-25 mix-blend-soft-light bg-[linear-gradient(150deg,transparent_0%,transparent_48%,rgba(255,255,255,0.18)_49%,transparent_58%),repeating-linear-gradient(112deg,rgba(255,255,255,0.07)_0_1px,transparent_1px_18px)]" />
      <div className="pointer-events-none absolute inset-y-[-18%] right-[-46px] w-[72%] min-[390px]:right-[-52px] min-[390px]:w-[68%] md:inset-y-[-10%] md:right-[-150px] md:w-[50%] lg:right-[-180px] min-[1480px]:right-[-84px] min-[1480px]:w-[78%] min-[1640px]:right-[-96px] min-[1640px]:w-[76%]">
        <Image
          src={natureForegroundImage}
          alt=""
          fill
          sizes="(max-width: 768px) 320px, (min-width: 1640px) 420px, (min-width: 1480px) 370px, 430px"
          className="object-contain object-right-center drop-shadow-[0_18px_24px_rgba(3,34,12,0.28)] transition duration-500 group-hover:scale-[1.03] dark:brightness-95"
        />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,64,27,0.98)_0%,rgba(11,64,27,0.9)_42%,rgba(11,64,27,0.34)_58%,transparent_76%)] md:bg-[linear-gradient(90deg,rgba(11,64,27,0.98)_0%,rgba(11,64,27,0.9)_45%,rgba(11,64,27,0.26)_62%,transparent_78%)] min-[1480px]:bg-[linear-gradient(90deg,rgba(11,64,27,0.96)_0%,rgba(11,64,27,0.78)_36%,rgba(11,64,27,0.18)_58%,transparent_74%)]" />
      <div className="relative z-10 flex h-full min-h-[90px] max-w-[186px] flex-col justify-center px-4 py-2 text-white/90 min-[390px]:min-h-[94px] min-[390px]:max-w-[206px] md:min-h-[176px] md:max-w-none md:px-7 md:py-6 md:text-white">
        <h2 className="font-sans text-[14px] font-extrabold leading-none min-[390px]:text-[15px] md:text-[22px]">自然观察频道</h2>
        <p className="mt-1 whitespace-nowrap text-[10px] font-medium leading-4 text-white/74 min-[390px]:text-[11px] md:mt-4 md:text-[14px] md:text-white/92">观察自然 · 记录生命 · 保护环境</p>
        <span className="mt-1.5 inline-flex h-6 w-fit items-center gap-1 rounded-full bg-white px-2.5 text-[10px] font-bold text-[hsl(var(--brand-green))] shadow-[0_6px_14px_-10px_rgba(0,0,0,0.45)] md:mt-6 md:h-9 md:gap-2 md:px-5 md:text-[14px]">
          立即进入
          <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
        </span>
      </div>
    </Link>
  );
}

function MobileShortcutCarousel() {
  return (
    <section className="md:hidden" aria-label="首页快捷入口">
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-0 grow-0 shrink-0 basis-[calc(100%-2rem)] snap-start">
          <NatureChannel className="h-full" />
        </div>
        <div className="min-w-0 grow-0 shrink-0 basis-[calc(100%-2rem)] snap-start">
          <MobileLeaderboardEntry className="h-full min-h-[90px] min-[390px]:min-h-[94px]" />
        </div>
      </div>
      <div className="mt-0.5 flex justify-center gap-1" aria-hidden="true">
        <span className="h-1 w-4 rounded-full bg-[hsl(var(--brand-green)/0.72)]" />
        <span className="h-1 w-1 rounded-full bg-[hsl(var(--surface-border-strong))]" />
      </div>
    </section>
  );
}

function HomeProjectCard({ project, index }: { project: Project; index: number }) {
  return (
    <ProjectCard
      project={project}
      href={projectHref(project)}
      priority={index < 4}
      variant="compact"
      compactLayout="vertical"
      className={COMPACT_VERTICAL_PROJECT_CARD_CLASS}
    />
  );
}

function ProjectSection({ projects }: { projects: Project[] }) {
  const visible = getShowcaseProjects(projects);

  return (
    <Surface
      className={cn(
        "overflow-hidden py-1",
        "max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:rounded-none",
        "md:p-5",
      )}
    >
      <div className="mb-2 flex items-center justify-between md:mb-4">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 shrink-0 text-[hsl(var(--brand-amber))] md:h-6 md:w-6" aria-hidden />
          <h2 className="font-sans text-[17px] font-extrabold tracking-normal text-foreground md:text-[20px]">热门项目</h2>
        </div>
        <Link
          href="/explore"
          className="-my-3 inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-3 text-[13px] font-medium text-[hsl(var(--brand-blue))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          查看全部
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className={COMPACT_VERTICAL_PROJECT_GRID_CLASS}>
        {visible.map((project, index) => (
          <HomeProjectCard key={project.id} project={project} index={index} />
        ))}
      </div>
    </Surface>
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
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Surface className="p-4">
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
      </Surface>

      <Surface className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-foreground">活动推荐</h2>
          <Link href="/create" className="text-[13px] font-medium text-[hsl(var(--brand-blue))]">查看全部</Link>
        </div>
        <Link href="/create" className="grid grid-cols-[86px_minmax(0,1fr)] gap-3 rounded-sm border border-[hsl(var(--surface-border))] p-2 transition hover:bg-[hsl(var(--surface-muted))]">
          <div className="relative h-[58px] overflow-hidden rounded-xs bg-[hsl(var(--surface-muted))]">
            <Image src={heroImage} alt="STEAM 创新大赛" fill sizes="120px" className="object-cover object-[62%_center]" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-bold text-foreground">全国青少年 STEAM 创新大赛</h3>
            <p className="mt-2 text-[12px] text-muted-foreground">2024.06.01 - 2024.08.31 · 线上活动</p>
          </div>
        </Link>
      </Surface>
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
      <div className="app-shell-wide grid grid-cols-[1.5fr_repeat(4,1fr)_1.2fr] gap-10 px-8 text-[13px] text-muted-foreground">
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
        <div className="flex items-center gap-4">
          <div className="grid h-[86px] w-[86px] grid-cols-5 grid-rows-5 gap-1 rounded-xs border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised))] p-2">
            {Array.from({ length: 25 }).map((_, index) => (
              <span key={index} className={cn("rounded-[1px]", index % 3 === 0 || index % 7 === 0 ? "bg-foreground" : "bg-[hsl(var(--surface-border))]")} />
            ))}
          </div>
          <div>
            <h3 className="font-bold text-foreground">关注我们</h3>
            <p className="mt-2">获取更多内容和活动信息</p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-[12px] text-muted-foreground">© 2024 STEAM 探索 · 粤ICP备 2024001234 号-1</p>
    </footer>
  );
}

export function HomeShowcase({
  recentHotProjects,
  communityFeed,
  categoryTileCounts,
  initialRecommendations,
  initialRecommendationMode,
  initialRecommendationNextOffset,
  initialRecommendationHasMore,
}: {
  recentHotProjects: Project[];
  communityFeed: HomeCommunityFeedItem[];
  categoryTileCounts: HomeCategoryTileCounts;
  initialRecommendations: Project[];
  initialRecommendationMode: HomepageRecommendationMode;
  initialRecommendationNextOffset: number;
  initialRecommendationHasMore: boolean;
}) {
  return (
    <div className="app-canvas min-h-screen">
      <div className="app-shell-wide flex flex-col gap-2.5 pb-2.5 pt-1 min-[390px]:gap-3 min-[390px]:pb-3 min-[390px]:pt-1.5 md:gap-7 md:py-8">
        <HomeHero image={heroImage} />
        <MobileShortcutCarousel />

        <div className="grid gap-2.5 min-[1480px]:grid-cols-[minmax(0,1fr)_420px] min-[1480px]:gap-5 min-[1640px]:grid-cols-[minmax(0,1fr)_480px]">
          <CategoryGrid categoryTileCounts={categoryTileCounts} />
          <div className="hidden md:block">
            <NatureChannel />
          </div>
        </div>

        <div className="grid items-stretch gap-2.5 md:gap-5 xl:grid-cols-[minmax(0,1fr)_480px]">
          <ProjectSection projects={recentHotProjects} />
          <div className="hidden xl:block">
            <RecommendationPanel
              className="h-full"
              initialProjects={initialRecommendations}
              initialMode={initialRecommendationMode}
              initialNextOffset={initialRecommendationNextOffset}
              initialHasMore={initialRecommendationHasMore}
              excludeProjectIds={recentHotProjects.map((project) => project.id)}
            />
          </div>
        </div>

        <div className="hidden md:block">
          <CommunityAndActivity communityFeed={communityFeed} />
        </div>
      </div>
      <HomeFooter />
    </div>
  );
}
