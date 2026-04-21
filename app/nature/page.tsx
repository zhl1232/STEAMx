import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Compass, Feather, PlusCircle } from "lucide-react";

import { NatureShell } from "@/app/nature/_components/nature-shell";
import { getBirdObservationHomepageData } from "@/lib/api/nature-observation-data";

const channelCards = [
  {
    title: "鸟类专题",
    description: "进入当前专题",
    href: "/nature/birds",
    icon: Feather,
  },
  {
    title: "物种",
    description: "浏览物种档案",
    href: "/nature/species",
    icon: Compass,
  },
  {
    title: "观察记录",
    description: "看大家最近看到了什么",
    href: "/nature/observations",
    icon: ArrowRight,
  },
  {
    title: "提交记录",
    description: "记录这次观察",
    href: "/nature/submit",
    icon: PlusCircle,
  },
];

export default async function NaturePage() {
  const homepage = await getBirdObservationHomepageData();
  const featuredSpecies = homepage.featuredSpecies.slice(0, 6);
  const recentObservations = homepage.recentObservations.slice(0, 4);

  return (
    <NatureShell
      title="自然观察"
      description="看物种、翻记录，或者把这次观察直接记下来。"
      aside={
        <>
          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">当前可用</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">鸟类专题已上线</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">从校园、公园和社区开始，先留下第一条鸟类观察。</p>
            <Link
              href="/nature/birds"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              进入鸟类专题
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">快速入口</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">现在就可以开始</h2>
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
            自然观察
          </div>
          <div className="mt-4 max-w-3xl">
            <p className="text-sm font-medium tracking-[0.22em] text-emerald-700/80 dark:text-emerald-300/80">物种 · 记录 · 提交</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">先看见，再记下来</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">从常见物种开始认识环境，再把时间、地点和照片整理成自己的观察记录。</p>
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
              href="/nature/species"
              className="inline-flex items-center justify-center rounded-full border border-border/80 bg-background/80 px-5 py-3 text-sm font-medium transition-colors hover:bg-muted/70"
            >
              浏览物种
            </Link>
          </div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden p-5 sm:p-6">
        <div>
          <p className="section-kicker">快速入口</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">从这里进入</h2>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              <p className="section-kicker">常见物种</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">先从熟悉的名字开始</h2>
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
              <p className="section-kicker">最近观察</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">看看别人刚记录了什么</h2>
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
