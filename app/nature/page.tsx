import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Compass, Feather, Map, PlusCircle } from "lucide-react";

import { NatureShell } from "@/app/nature/_components/nature-shell";
import { getBirdObservationHomepageData } from "@/lib/api/nature-observation-data";

const channelCards = [
  {
    title: "鸟类专题",
    description: "从观鸟开始进入自然观察，后续再扩到更多类群。",
    href: "/nature/birds",
    icon: Feather,
  },
  {
    title: "物种检索",
    description: "从物种页进入最近记录、地点线索与后续观察行动。",
    href: "/nature/species",
    icon: Compass,
  },
  {
    title: "观察记录",
    description: "查看大家最近在什么时间、什么地点观察到了什么。",
    href: "/nature/observations",
    icon: ArrowRight,
  },
  {
    title: "提交记录",
    description: "把照片、时间、地点和物种整理成一条结构化记录。",
    href: "/nature/submit",
    icon: PlusCircle,
  },
  {
    title: "观察地图",
    description: "地图入口先占位，后续承接热区、点位与时间筛选。",
    href: "/nature/map",
    icon: Map,
  },
];

export default async function NaturePage() {
  const homepage = await getBirdObservationHomepageData();
  const featuredSpecies = homepage.featuredSpecies.slice(0, 6);
  const recentObservations = homepage.recentObservations.slice(0, 4);

  return (
    <NatureShell
      title="自然观察"
      description="把物种、观察记录、专题活动和地图能力收在同一个频道里。先从熟悉的地点开始，再慢慢形成自己的长期观察节奏。"
      aside={
        <>
          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">当前专题</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">已上线鸟类观察</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              鸟类是当前已经落地的二级专题。后续频道会继续补植物、昆虫和更多自然观察内容。
            </p>
            <Link
              href="/nature/birds"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              进入鸟类专题
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">频道入口</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">先用公共能力，再进入专题</h2>
            <div className="mt-4 space-y-3">
              <Link
                href="/nature/species"
                className="surface-subtle block px-4 py-3 text-sm font-medium transition-transform hover:-translate-y-0.5"
              >
                浏览物种
              </Link>
              <Link
                href="/nature/observations"
                className="surface-subtle block px-4 py-3 text-sm font-medium transition-transform hover:-translate-y-0.5"
              >
                查看观察记录
              </Link>
              <Link
                href="/nature/submit"
                className="surface-subtle block px-4 py-3 text-sm font-medium transition-transform hover:-translate-y-0.5"
              >
                提交一条记录
              </Link>
            </div>
          </section>
        </>
      }
    >
      <section className="surface-panel overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-50/90 via-background/95 to-sky-50/90 px-5 py-6 dark:from-emerald-950/24 dark:via-card/95 dark:to-sky-950/24 sm:px-7 sm:py-7 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            <Feather className="h-3.5 w-3.5" />
            一级频道
          </div>
          <div className="mt-4 max-w-3xl">
            <p className="text-sm font-medium tracking-[0.22em] text-emerald-700/80 dark:text-emerald-300/80">
              物种 · 记录 · 地图 · 专题
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">把自然观察放到一个统一入口里</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
              自然观察不再分散在专题页和探索页之间。现在物种、记录、专题与后续地图能力都收敛到同一个频道。
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/nature/submit"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
            >
              开始记录
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/nature/birds"
              className="inline-flex items-center justify-center rounded-full border border-border/80 bg-background/80 px-5 py-3 text-sm font-medium transition-colors hover:bg-muted/70"
            >
              进入鸟类专题
            </Link>
          </div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden p-5 sm:p-6">
        <div>
          <p className="section-kicker">频道结构</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">一级频道 + 二级专题 + 公共能力页</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            专题负责导览和上下文，物种、记录、地图和提交作为整个频道共享的公共能力存在。
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {channelCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="surface-subtle block p-5 transition-transform hover:-translate-y-0.5"
              >
                <div className="inline-flex rounded-full border border-border/80 bg-background/80 p-3">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {featuredSpecies.length > 0 ? (
        <section className="surface-panel overflow-hidden p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="section-kicker">当前专题样本</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">鸟类专题里的常见物种</h2>
            </div>
            <Link href="/nature/species" className="hidden text-sm font-medium text-primary hover:text-primary/80 sm:inline-flex">
              查看全部物种
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {featuredSpecies.map((species) => (
              <Link
                key={species.id}
                href={`/nature/species/${species.slug}`}
                className="inline-flex rounded-full border border-border/80 bg-background/80 px-3 py-2 text-sm transition-colors hover:bg-muted/70"
              >
                {species.commonName}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {recentObservations.length > 0 ? (
        <section className="surface-panel overflow-hidden p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="section-kicker">最近动态</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">频道里最近新增的观察</h2>
            </div>
            <Link href="/nature/observations" className="hidden text-sm font-medium text-primary hover:text-primary/80 sm:inline-flex">
              查看全部
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {recentObservations.map((observation) => (
              <Link
                key={observation.id}
                href={`/nature/observations/${observation.id}`}
                className="surface-subtle block overflow-hidden transition-transform hover:-translate-y-0.5"
              >
                {observation.mediaUrls[0] ? (
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image
                      src={observation.mediaUrls[0]}
                      alt={observation.locationName}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                ) : null}
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(observation.observedAt).toLocaleDateString("zh-CN")}</span>
                    <span>·</span>
                    <span>{observation.locationName}</span>
                  </div>
                  {observation.notes ? (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-foreground/80">{observation.notes}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </NatureShell>
  );
}
