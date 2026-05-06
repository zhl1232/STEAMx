import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Bird, Camera, MapPin } from "lucide-react";

import { NatureShell } from "@/app/nature/_components/nature-shell";
import { ObservationPhotoFrame } from "@/components/features/bird-observation/observation-photo-frame";
import { TopicHotspotPanel } from "@/components/features/bird-observation/topic-hotspot-panel";
import { getBirdObservationFeaturedSpecies, getBirdObservationRecentObservations } from "@/lib/api/nature-observation-data";
import type { ObservationEvent, ObservationLocationSummary } from "@/lib/mappers/types";
import { appendNatureFrom, buildNatureSubmitHref } from "@/lib/utils/nature-navigation";

const FEATURED_SPECIES_LIMIT = 6;
const HOTSPOT_SAMPLE_LIMIT = 30;
const HOTSPOT_DISPLAY_LIMIT = 6;
const OBSERVATION_DISPLAY_LIMIT = 12;

function buildTopicHotspots(observations: ObservationEvent[]): ObservationLocationSummary[] {
  const grouped = new Map<string, ObservationLocationSummary>();

  for (const observation of observations) {
    const locationName = observation.locationName?.trim() || "未命名地点";
    const existing = grouped.get(locationName);

    if (!existing) {
      grouped.set(locationName, {
        locationName,
        observationCount: 1,
        latestObservedAt: observation.observedAt,
        latitude: observation.latitude ?? null,
        longitude: observation.longitude ?? null,
      });
      continue;
    }

    grouped.set(locationName, {
      ...existing,
      observationCount: existing.observationCount + 1,
      latestObservedAt:
        new Date(observation.observedAt).getTime() > new Date(existing.latestObservedAt).getTime()
          ? observation.observedAt
          : existing.latestObservedAt,
      latitude: existing.latitude ?? observation.latitude ?? null,
      longitude: existing.longitude ?? observation.longitude ?? null,
    });
  }

  return Array.from(grouped.values())
    .sort((left, right) => {
      if (right.observationCount !== left.observationCount) {
        return right.observationCount - left.observationCount;
      }
      return new Date(right.latestObservedAt).getTime() - new Date(left.latestObservedAt).getTime();
    })
    .slice(0, HOTSPOT_DISPLAY_LIMIT);
}

export default async function NatureBirdsPage() {
  const [spotlightSpecies, recentObservations] = await Promise.all([
    getBirdObservationFeaturedSpecies(FEATURED_SPECIES_LIMIT),
    getBirdObservationRecentObservations(HOTSPOT_SAMPLE_LIMIT),
  ]);

  const firstSpecies = spotlightSpecies[0] ?? null;
  const submitHref = buildNatureSubmitHref({
    topic: "birds",
    speciesId: firstSpecies?.id,
    from: "/nature/birds",
  });
  const displayObservations = recentObservations.slice(0, OBSERVATION_DISPLAY_LIMIT);
  const hotspots = buildTopicHotspots(recentObservations);

  return (
    <NatureShell
      title="鸟类"
      description="从能反复到达的校园、公园和社区开始，记录时间、地点、物种与行为，把鸟类观察作为自然观察频道里的第一个专题。"
      fallbackHref="/nature"
    >
      <section className="surface-panel relative overflow-hidden p-0">
        <div className="grid min-h-[260px] gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative min-h-[260px]">
            <Image
              src="/assets/bird-topic-campus-lake-hero.png"
              alt=""
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1024px) 760px, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/88 via-background/44 to-background/10" />
            <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7">
              <p className="section-kicker">鸟类专题</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">从校园水岸开始观察鸟类</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                记录物种、行为和地点，把一次散步变成可复盘的自然观察档案。
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={submitHref}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
                >
                  开始记录
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/nature/species"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border/80 bg-background/72 px-5 py-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  查看鸟类图鉴
                </Link>
              </div>
            </div>
          </div>

          <div className="grid content-center gap-3 border-t border-border/60 bg-background/62 p-5 lg:border-l lg:border-t-0">
            {[
              { icon: Bird, label: "专题物种", value: spotlightSpecies.length },
              { icon: Camera, label: "近期记录", value: displayObservations.length },
              { icon: MapPin, label: "热点地点", value: hotspots.length },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-2xl bg-background/80 px-4 py-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xl font-semibold tabular-nums">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="section-kicker">专题物种</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">鸟类物种</h2>
          </div>
          <Link
            href="/nature/species"
            className="hidden items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80 sm:inline-flex"
          >
            查看全部
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {spotlightSpecies.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {spotlightSpecies.map((species) => (
              <Link
                key={species.id}
                href={appendNatureFrom(`/nature/species/${species.slug}`, "/nature/birds")}
                className="surface-subtle group block overflow-hidden rounded-2xl border border-border/70 bg-background/80 transition-transform hover:-translate-y-0.5 hover:border-primary/35"
              >
                <div className="relative aspect-[4/3] bg-muted/40">
                  {species.coverImageUrl ? (
                    <Image
                      src={species.coverImageUrl}
                      alt={species.commonName}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(min-width: 1280px) 260px, (min-width: 640px) 50vw, 100vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Bird className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-base font-medium text-foreground">{species.commonName}</p>
                  {species.scientificName ? (
                    <p className="mt-1 text-xs italic leading-5 text-muted-foreground">{species.scientificName}</p>
                  ) : null}
                  {species.taxonGroup ? (
                    <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{species.taxonGroup}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="surface-subtle mt-5 rounded-2xl px-4 py-6 text-sm text-muted-foreground">
            暂无可展示的专题物种。
          </div>
        )}

        <div className="mt-5 sm:hidden">
          <Link
            href="/nature/species"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            查看全部物种
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <TopicHotspotPanel locations={hotspots} />

      <section className="surface-panel overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">专题观察记录</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">最近公开记录</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={submitHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
            >
              开始记录
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/nature/observations"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              查看全部
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {displayObservations.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {displayObservations.map((observation) => (
              <Link
                key={observation.id}
                href={appendNatureFrom(`/nature/observations/${observation.id}`, "/nature/birds")}
                className="surface-subtle block overflow-hidden transition-transform hover:-translate-y-0.5"
              >
                {observation.mediaUrls[0] ? (
                  <ObservationPhotoFrame
                    src={observation.mediaUrls[0]}
                    alt={observation.locationName}
                    className="aspect-[16/9]"
                    paddingClassName="p-2.5"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                ) : null}

                <div className="p-4">
                  {observation.species.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {observation.species.map((item) => (
                        <span
                          key={`${observation.id}-${item.speciesId}`}
                          className="rounded-full border border-border/80 bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground/85"
                        >
                          {item.commonName}
                          {item.count ? ` ×${item.count}` : ""}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(observation.observedAt).toLocaleDateString("zh-CN")}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {observation.locationName}
                    </span>
                  </div>

                  {observation.notes ? (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-foreground/80">{observation.notes}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="surface-subtle mt-5 rounded-2xl border border-dashed border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
            暂无可展示的专题观察记录。
          </div>
        )}
      </section>
    </NatureShell>
  );
}
