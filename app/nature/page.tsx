import Link from "next/link";
import {
  ArrowRight,
  Binoculars,
  Compass,
  Heart,
  Leaf,
  MapPin,
  MessageCircle,
  MoveHorizontal,
  Sparkles,
} from "lucide-react";

import { NatureShell } from "@/app/nature/_components/nature-shell";
import { ObservationPhotoFrame } from "@/components/features/bird-observation/observation-photo-frame";
import { getBirdObservationHomepageData } from "@/lib/api/nature-observation-data";
import { natureTopics } from "@/lib/config/nature-topics";

export default async function NaturePage() {
  const homepage = await getBirdObservationHomepageData();
  const recentObservations = homepage.recentObservations.slice(0, 8);

  const topicIcons = {
    birds: Binoculars,
    insects: Sparkles,
    plants: Leaf,
    fungi: Compass,
  } as const;
  const topicCardClassName =
    "group relative isolate block w-[clamp(15.5rem,78vw,21.5rem)] shrink-0 snap-start overflow-hidden rounded-3xl border border-border/70 bg-card/88 p-4 mt-2 shadow-[0_18px_50px_-34px_rgba(21,60,45,0.48)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_26px_64px_-34px_rgba(26,91,64,0.56)] sm:w-[clamp(17.5rem,62vw,23rem)] md:w-auto";

  return (
    <NatureShell
      title="自然观察"
      description="先浏览专题，再看社区最新观察；想发布记录可直接使用底部观察入口。"
    >
      <section className="surface-panel relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-r from-emerald-200/35 via-lime-100/20 to-cyan-100/35 dark:from-emerald-900/20 dark:via-lime-900/10 dark:to-cyan-900/20" />

        <div className="relative z-10 mb-4">
          <p className="section-kicker">专题</p>
        </div>

        <div className="relative z-10">
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-card/95 via-card/60 to-transparent md:hidden" />
          <div
            className="no-scrollbar flex max-w-full snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pr-8 touch-pan-x md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:pr-0"
            aria-label="可用专题，左右滑动查看更多"
          >
            {natureTopics.map((topic) => {
              const isAvailable = topic.status === "available";
              const TopicIcon = topicIcons[topic.slug as keyof typeof topicIcons] ?? Sparkles;
              const statusClassName = isAvailable
                ? "inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50/90 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";

              const content = (
                <>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -left-16 bottom-[-4.5rem] h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/12"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal-300/25 blur-2xl dark:bg-teal-500/15"
                  />
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div className={statusClassName}>
                      <Sparkles className="h-3.5 w-3.5" />
                      {isAvailable ? "已上线" : "即将上线"}
                    </div>
                    <div>
                      <TopicIcon className="h-[18px] w-[18px]" />
                    </div>
                  </div>
                  <h3 className="relative z-10 mt-5 text-lg font-semibold tracking-tight">
                    {topic.title}
                  </h3>
                  <p className="relative z-10 mt-1 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    {topic.subtitle}
                  </p>
                  <p className="relative z-10 mt-3 text-sm leading-6 text-muted-foreground">
                    {topic.description}
                  </p>
                  <div className="relative z-10 mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">
                    {isAvailable ? "进入专题并开始记录" : "已加入专题路线图"}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </div>
                </>
              );

              if (isAvailable && topic.href) {
                return (
                  <Link key={topic.id} href={topic.href} className={topicCardClassName}>
                    {content}
                  </Link>
                );
              }

              return (
                <div key={topic.id} className={`${topicCardClassName} opacity-95`} aria-disabled>
                  {content}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground md:hidden">
          <MoveHorizontal className="h-3.5 w-3.5" />
          左右滑动查看更多专题
        </div>
      </section>

      {recentObservations.length > 0 ? (
        <section className="surface-panel relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-cyan-200/28 via-teal-100/15 to-emerald-200/24 dark:from-cyan-900/15 dark:via-teal-900/10 dark:to-emerald-900/15" />
          <div className="pointer-events-none absolute -right-12 bottom-[-4rem] h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/12" />

          <div className="relative z-10 mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="section-kicker">最近记录</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">社区最新观察</h2>
            </div>
            <Link
              href="/nature/observations"
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
            >
              查看全部
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative z-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recentObservations.map((observation, index) => (
              <Link
                key={observation.id}
                href={`/nature/observations/${observation.id}`}
                className="surface-subtle group block overflow-hidden rounded-3xl border border-border/70 bg-card/90 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_24px_60px_-34px_rgba(34,89,67,0.5)]"
              >
                {observation.mediaUrls[0] ? (
                  <ObservationPhotoFrame
                    src={observation.mediaUrls[0]}
                    alt={observation.locationName}
                    className="aspect-[16/9]"
                    paddingClassName="p-2.5"
                    imageClassName="transition duration-500 group-hover:scale-[1.04]"
                    priority={index === 0}
                    sizes="(min-width: 1280px) 30vw, (min-width: 640px) 46vw, 100vw"
                  />
                ) : null}

                <div className="space-y-3 p-4">
                  {observation.species.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {observation.species.slice(0, 3).map((item) => (
                        <span
                          key={`${observation.id}-${item.speciesId}`}
                          className="rounded-full border border-border/70 bg-background/85 px-2.5 py-1 text-xs font-medium text-foreground/90"
                        >
                          {item.commonName}
                          {item.count ? ` ×${item.count}` : ""}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(observation.observedAt).toLocaleDateString("zh-CN")}</span>
                    <span>·</span>
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{observation.locationName}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-1">
                      <Heart className="h-3.5 w-3.5" />
                      {observation.likesCount}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {observation.commentsCount}
                    </span>
                  </div>

                  {observation.notes ? (
                    <p className="line-clamp-2 text-sm leading-6 text-foreground/85">
                      {observation.notes}
                    </p>
                  ) : null}

                  {observation.notes ? null : (
                    <p className="text-sm leading-6 text-muted-foreground">
                      暂无备注，点击查看完整记录。
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </NatureShell>
  );
}
