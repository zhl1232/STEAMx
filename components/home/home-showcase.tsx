import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  FlaskConical,
  Heart,
  Leaf,
  Lightbulb,
  ThumbsUp,
  Trophy,
  UsersRound,
} from "lucide-react";

import { RecommendationPanel } from "@/components/home/recommendation-panel";
import { Surface } from "@/components/ui/surface";
import { categoryToneClasses } from "@/components/ui/tone-badge";
import { SteamLogo } from "@/components/layout/logo";
import { ProjectCard } from "@/components/features/project-card";
import { CATEGORY_META } from "@/lib/config/categories";
import { type HomeCategoryTileCounts, type HomeSteamCategoryKey } from "@/lib/home/category-tiles";
import { type HomeCommunityFeedItem, type HomeCommunityFeedKind } from "@/lib/home/community-feed";
import { type HomepageRecommendationMode } from "@/lib/home/recommendations";
import { type Project } from "@/lib/mappers/types";
import { cn } from "@/lib/utils";

const heroImage = "/assets/home-hero-steam-lake.png";
const heroWideImage = "/assets/home-hero-steam-lake-banner.webp";
const natureImage = "/assets/home-nature-channel-bird.png";

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
    <section className="surface-card relative overflow-hidden rounded-[18px] md:rounded-[16px]">
      <div className="relative min-h-[236px] md:min-h-[220px]">
        <Image
          src={image}
          alt="孩子们在湖边进行 STEAM 实验"
          fill
          priority
          loading="eager"
          sizes="(max-width: 768px) 100vw, 1800px"
          className="object-cover object-[74%_center] dark:brightness-90 md:hidden"
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
        <div className="absolute inset-x-0 top-0 h-[124px] bg-[linear-gradient(180deg,rgba(248,252,255,0.78)_0%,rgba(248,252,255,0.62)_38%,rgba(248,252,255,0.24)_72%,rgba(248,252,255,0)_100%)] dark:bg-[linear-gradient(180deg,rgba(6,12,22,0.62)_0%,rgba(6,12,22,0.46)_38%,rgba(6,12,22,0.16)_72%,rgba(6,12,22,0)_100%)] md:inset-0 md:h-auto md:bg-[linear-gradient(90deg,rgba(248,252,255,0.94)_0%,rgba(248,252,255,0.82)_22%,rgba(248,252,255,0.52)_40%,rgba(248,252,255,0.18)_57%,rgba(248,252,255,0)_72%)] md:dark:bg-[linear-gradient(90deg,rgba(6,12,22,0.82)_0%,rgba(6,12,22,0.68)_24%,rgba(6,12,22,0.4)_42%,rgba(6,12,22,0.14)_60%,rgba(6,12,22,0)_76%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent md:hidden" />

        <div className="relative z-10 flex min-h-[236px] flex-col justify-start px-5 pb-0 pt-5 min-[390px]:px-6 md:min-h-[220px] md:justify-center md:px-12 md:py-6">
          <div className="max-w-[276px] min-[390px]:max-w-[308px] md:max-w-[760px]">
            <h1 className="whitespace-nowrap font-sans text-[24px] font-black leading-none tracking-normal text-foreground dark:[text-shadow:0_2px_10px_rgba(0,0,0,0.28)] min-[390px]:text-[26px] md:text-[40px] lg:text-[44px]">
              <span className="text-[hsl(var(--brand-blue))]">探索</span>
              <span className="px-1.5 text-foreground md:px-4">·</span>
              <span className="text-[hsl(var(--brand-green))]">创造</span>
              <span className="px-1.5 text-foreground md:px-4">·</span>
              <span className="text-[hsl(var(--brand-amber))]">成长</span>
            </h1>

            <p className="mt-2 inline-flex whitespace-nowrap text-[12px] font-normal leading-4 tracking-normal text-muted-foreground min-[390px]:text-[13px] md:hidden">
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

          <div className="mt-auto grid w-full max-w-[306px] grid-cols-4 gap-2 pt-3.5 text-[#d7e2ee] min-[390px]:max-w-[328px] min-[390px]:gap-2.5 md:hidden">
            {homeHeroFeatures.map((item) => (
              <div
                key={item.label}
                className="flex min-h-[44px] flex-col items-center justify-center gap-1 px-1 py-1 text-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
              >
                <item.icon className="h-[13px] w-[13px] shrink-0 text-[#d7e2ee] min-[390px]:h-[14px] min-[390px]:w-[14px]" strokeWidth={2.2} />
                <span className="whitespace-nowrap text-[10px] font-medium leading-none tracking-[-0.02em] text-[#bcc9d8] min-[390px]:text-[11px]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

function MobileLeaderboardEntry() {
  return (
    <Link
      href="/leaderboard"
      className="surface-card-interactive group grid min-h-[76px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] border border-[hsl(var(--brand-amber)/0.34)] bg-[linear-gradient(135deg,hsl(var(--brand-amber)/0.16),hsl(var(--brand-blue)/0.08)_58%,hsl(var(--surface-raised))_100%)] px-4 py-3 shadow-[0_18px_42px_-32px_hsl(var(--brand-amber)/0.75)] md:hidden"
    >
      <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[hsl(var(--brand-amber)/0.18)] text-[hsl(var(--brand-amber))]">
        <Trophy className="h-5 w-5" strokeWidth={2.4} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-extrabold leading-5 text-foreground">社区排行榜</span>
        <span className="mt-1 block truncate text-[12px] font-medium leading-4 text-muted-foreground">查看积分、徽章和项目榜单</span>
      </span>
      <span className="inline-flex h-8 items-center gap-1 rounded-[12px] bg-[hsl(var(--brand-blue))] px-3 text-[12px] font-semibold text-[hsl(var(--brand-blue-foreground))] transition group-hover:brightness-95">
        查看
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

function CategoryGrid({ categoryTileCounts }: { categoryTileCounts: HomeCategoryTileCounts }) {
  return (
    <div className="grid grid-cols-2 gap-3 pb-1 min-[380px]:grid-cols-3 md:grid-cols-3 md:gap-4 min-[1280px]:grid-cols-6">
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
              "surface-card-interactive group flex min-w-0 flex-col items-center justify-center rounded-[18px] border px-3 py-3.5 text-center transition hover:-translate-y-0.5 min-[380px]:min-h-[114px] md:min-h-[116px] md:flex-row md:items-center md:justify-start md:gap-3 md:rounded-[10px] md:px-4 md:py-4 md:text-left min-[1480px]:gap-4 min-[1480px]:px-5",
              tone.border,
              tone.bg,
            )}
          >
            <Icon className={cn("h-6 w-6 shrink-0 transition group-hover:scale-105 min-[390px]:h-7 min-[390px]:w-7 md:h-10 md:w-10 min-[1480px]:h-11 min-[1480px]:w-11", tone.text)} strokeWidth={2.2} />
            <div className="mt-2 min-w-0 md:mt-0">
              <h2 className={cn("whitespace-nowrap font-sans text-[12px] font-bold leading-none min-[390px]:text-[13px] md:text-[18px] min-[1480px]:text-[20px]", tone.text)}>{category.labelOverride ?? meta.label}</h2>
              <p className="mt-2 hidden text-[12px] text-muted-foreground md:block min-[1480px]:text-[13px]">{meta.description}</p>
              <p className="mt-1.5 whitespace-nowrap text-[10px] font-medium leading-4 text-muted-foreground min-[390px]:text-[11px] md:mt-3 md:text-[12px] min-[1480px]:text-[14px]">{countLabel}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function NatureChannel() {
  return (
    <Link
      href="/nature"
      className="group relative block min-h-[156px] overflow-hidden rounded-[18px] bg-[hsl(var(--brand-green))] shadow-[0_16px_40px_-26px_hsl(var(--brand-green)/0.65)] md:rounded-[10px] min-[1480px]:h-full"
    >
      <Image
        src={natureImage}
        alt="蓝色鸟停在树枝上"
        fill
        sizes="(min-width: 1640px) 480px, (min-width: 1480px) 420px, 100vw"
        className="object-cover object-[72%_center] transition duration-500 dark:brightness-90 group-hover:scale-105 md:object-[64%_center]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(22,57,27,0.92)_0%,rgba(22,57,27,0.8)_42%,rgba(22,57,27,0.2)_78%)]" />
      <div className="relative z-10 flex h-full min-h-[156px] max-w-[198px] flex-col justify-center px-5 py-4 text-white min-[390px]:max-w-[214px] min-[390px]:px-6 md:min-h-[176px] md:max-w-none md:px-7 md:py-6">
        <h2 className="font-sans text-[17px] font-extrabold leading-none min-[390px]:text-[19px] md:text-[22px]">自然观察频道</h2>
        <p className="mt-2 text-[13px] font-medium leading-5 text-white/92 min-[390px]:text-[14px] md:mt-4 md:text-[14px]">观察自然 · 记录生命 · 保护环境</p>
        <span className="mt-3 inline-flex h-9 w-fit items-center gap-2 rounded-[12px] bg-[hsl(var(--surface-raised))] px-4 text-[14px] font-semibold text-foreground shadow-sm md:mt-6 md:h-9 md:px-5 md:text-[14px]">
          立即进入
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

function HomeProjectCard({ project, index }: { project: Project; index: number }) {
  return (
    <ProjectCard project={project} href={projectHref(project)} priority={index < 2} variant="compact" className="h-full" />
  );
}

function HomeFeaturedProjectCard({ project }: { project: Project }) {
  return (
    <ProjectCard project={project} href={projectHref(project)} priority variant="featured" className="h-full" />
  );
}

function ProjectSection({ projects }: { projects: Project[] }) {
  const visible = getShowcaseProjects(projects);
  const [featuredProject, ...compactProjects] = visible;

  return (
    <Surface className="p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ThumbsUp className="h-5 w-5 fill-[hsl(var(--brand-blue))] text-[hsl(var(--brand-blue))] min-[390px]:h-6 min-[390px]:w-6" />
          <h2 className="font-sans text-[18px] font-extrabold tracking-normal text-foreground min-[390px]:text-[20px] md:text-[20px]">热门项目</h2>
        </div>
        <Link href="/explore" className="inline-flex items-center gap-1 text-[13px] font-medium text-[hsl(var(--brand-blue))] min-[390px]:text-[14px] md:text-[13px]">
          查看全部
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)] md:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {featuredProject ? <HomeFeaturedProjectCard project={featuredProject} /> : null}
        <div className="grid auto-rows-fr gap-3 min-[720px]:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
          {compactProjects.map((project, index) => (
            <HomeProjectCard key={project.id} project={project} index={index + 1} />
          ))}
        </div>
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
                <Link key={item.key} href={item.href} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-[10px] p-2 transition hover:bg-[hsl(var(--surface-muted))]">
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
          <Link href="/community?tab=challenges" className="text-[13px] font-medium text-[hsl(var(--brand-blue))]">查看全部</Link>
        </div>
        <Link href="/community?tab=challenges" className="grid grid-cols-[86px_minmax(0,1fr)] gap-3 rounded-[10px] border border-[hsl(var(--surface-border))] p-2 transition hover:bg-[hsl(var(--surface-muted))]">
          <div className="relative h-[58px] overflow-hidden rounded-[8px] bg-[hsl(var(--surface-muted))]">
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
          <div className="grid h-[86px] w-[86px] grid-cols-5 grid-rows-5 gap-1 rounded-[8px] border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised))] p-2">
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
      <div className="app-shell-wide flex flex-col gap-5 px-4 py-5 min-[390px]:gap-6 min-[390px]:px-5 min-[390px]:py-6 md:gap-7 md:px-8 md:py-8">
        <HomeHero image={heroImage} />
        <MobileLeaderboardEntry />

        <div className="grid gap-5 min-[1480px]:grid-cols-[minmax(0,1fr)_420px] min-[1640px]:grid-cols-[minmax(0,1fr)_480px]">
          <CategoryGrid categoryTileCounts={categoryTileCounts} />
          <NatureChannel />
        </div>

        <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_480px]">
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
