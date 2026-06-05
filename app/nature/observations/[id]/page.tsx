import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Clock3, MapPin, Navigation } from "lucide-react";
import { notFound } from "next/navigation";

import { DomesticMiniMap } from "@/components/features/bird-observation/domestic-mini-map";
import { ObservationDetailActivity } from "@/components/features/bird-observation/observation-detail-activity";
import { ObservationDetailMoreMenu } from "@/components/features/bird-observation/observation-detail-more-menu";
import { ObservationMediaCarousel } from "@/components/features/bird-observation/observation-media-carousel";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { getObservationById } from "@/lib/api/nature-observation-data";
import {
  formatObservationDateTime,
  getObservationHeadline,
  getObservationTopicLabel,
} from "@/lib/observations/display";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { observationSubmitTopicFromNatureTopic } from "@/lib/observations/submit-topic";

import { appendNatureFrom, normalizeNatureFrom } from "@/lib/utils/nature-navigation";

interface ObservationDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export async function generateMetadata({ params }: ObservationDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const observation = await getObservationById(id);

  if (!observation) {
    return {
      title: "观察记录未找到",
      robots: { index: false, follow: false },
    };
  }

  const submitTopic = observationSubmitTopicFromNatureTopic(observation.natureTopic);
  const headline = getObservationHeadline(
    observation.species,
    observation.identifications || [],
    observation.identificationStatus,
    submitTopic,
  );
  const title = `${headline.title} · 自然观察记录`;
  const description = (observation.notes || `${observation.locationName} 的自然观察记录。`).slice(0, 160);

  return buildPageMetadata({
    title,
    description,
    path: `/nature/observations/${observation.id}`,
    image: observation.mediaUrls[0] || undefined,
    keywords: [headline.title, observation.locationName, "自然观察记录"],
    noIndex: !observation.isPublic,
  });
}

export default async function ObservationDetailPage({ params, searchParams }: ObservationDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const observation = await getObservationById(id);

  if (!observation) {
    notFound();
  }

  const submitTopic = observationSubmitTopicFromNatureTopic(observation.natureTopic);
  const headline = getObservationHeadline(
    observation.species,
    observation.identifications || [],
    observation.identificationStatus,
    submitTopic,
  );
  const primarySpecies = observation.species[0];
  const observedAtLabel = formatObservationDateTime(observation.observedAt);
  const submittedAtLabel = formatObservationDateTime(observation.createdAt);
  const currentPath = `/nature/observations/${observation.id}`;
  const fallbackHref = normalizeNatureFrom(query.from, "/nature/observations");
  const primarySpeciesHref = primarySpecies?.speciesSlug
    ? appendNatureFrom(`/nature/species/${primarySpecies.speciesSlug}`, currentPath)
    : null;
  const hasCoordinates = observation.latitude != null && observation.longitude != null;
  const amapHref = hasCoordinates
    ? `https://uri.amap.com/marker?position=${observation.longitude},${observation.latitude}&name=${encodeURIComponent(observation.locationName)}&src=steam-explore`
    : null;
  const isConfirmed = observation.identificationStatus === "community_confirmed";
  const hasMedia = observation.mediaUrls.length > 0;

  return (
    <div className="app-shell-wide px-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-0 md:px-8 md:pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-8">
      <MobilePageHeader
        title="观察记录"
        fallbackHref={fallbackHref}
        className="mb-0 md:hidden"
        contentClassName="px-2"
        rightSlot={
          <ObservationDetailMoreMenu
            observationId={observation.id}
            ownerId={observation.userId}
            isPublic={observation.isPublic}
            speciesHref={primarySpeciesHref}
          />
        }
      />

      <div className="md:surface-panel overflow-hidden md:rounded-[var(--radius-lg)]">
        <div className="-mx-4 md:mx-0">
          {hasMedia ? (
            <ObservationMediaCarousel mediaUrls={observation.mediaUrls} alt={headline.title} />
          ) : (
            <div className="flex aspect-[4/3] min-h-[200px] items-end bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.18),transparent_42%),linear-gradient(160deg,rgba(248,250,252,0.96),rgba(238,242,255,0.9))] p-5 dark:bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.14),transparent_44%),linear-gradient(160deg,rgba(8,14,22,0.94),rgba(12,20,30,0.9))] sm:aspect-[16/10]">
              <p className="text-sm text-muted-foreground">暂未上传观察照片</p>
            </div>
          )}
        </div>

        <div className="hidden gap-4 border-b border-border/60 px-5 py-3 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:px-7">
          <Link href={fallbackHref} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            ← 返回
          </Link>
          <p className="truncate text-center text-base font-semibold tracking-tight text-foreground">
            观察记录
          </p>
          <ObservationDetailMoreMenu
            observationId={observation.id}
            ownerId={observation.userId}
            isPublic={observation.isPublic}
            speciesHref={primarySpeciesHref}
          />
        </div>

        <article className="space-y-6 px-4 py-5 sm:space-y-7 sm:px-7 sm:py-6">
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {!isConfirmed ? (
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  待鉴定
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                  已确认
                </span>
              )}
              <span className="inline-flex rounded-full bg-muted/80 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {observation.isPublic ? "公开记录" : "仅自己可见"}
              </span>
              <span className="inline-flex rounded-full bg-muted/80 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {getObservationTopicLabel(submitTopic)}
              </span>
            </div>

            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{headline.title}</h1>
              {headline.scientificName ? (
                <p className="pb-0.5 text-base italic text-muted-foreground">{headline.scientificName}</p>
              ) : null}
              {primarySpeciesHref ? (
                <Link
                  href={primarySpeciesHref}
                  aria-label="查看物种百科"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>

            <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                观察于{" "}
                <time className="tabular-nums text-foreground/90">{observedAtLabel}</time>
              </span>
              <span className="text-border/80" aria-hidden>
                ·
              </span>
              <span className="text-xs text-muted-foreground/70">
                提交于 <time className="tabular-nums">{submittedAtLabel}</time>
              </span>
            </p>
          </header>

          {observation.notes ? (
            <section>
              <p className="text-sm leading-7 text-foreground/90 sm:text-base">{observation.notes}</p>
            </section>
          ) : null}

          <ObservationDetailActivity
            observationId={observation.id}
            ownerId={observation.userId}
            topic={submitTopic}
            isPublic={observation.isPublic}
            initialStatus={observation.identificationStatus}
            initialConfirmedSpecies={primarySpecies}
            initialIdentifications={observation.identifications || []}
            currentPath={currentPath}
            headlineTitle={headline.title}
            headlineScientificName={headline.scientificName}
            observationMediaUrls={observation.mediaUrls}
          />

          <section id="observation-location" className="border-t border-border/60 pt-6">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                观察地点
              </p>
              <p className="text-base font-semibold leading-snug text-foreground">{observation.locationName}</p>
            </div>
            {hasCoordinates ? (
              <div className="relative mt-4 overflow-hidden rounded-sm border border-border/60">
                <DomesticMiniMap
                  markers={[
                    {
                      latitude: observation.latitude as number,
                      longitude: observation.longitude as number,
                      label: observation.locationName,
                    },
                  ]}
                  heightClassName="h-48 sm:h-56"
                />
                {amapHref ? (
                  <a
                    href={amapHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="打开导航"
                    className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/94 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
                  >
                    <Navigation className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">暂无 GPS 定位，仅保留文字地点。</p>
            )}
          </section>
        </article>
      </div>
    </div>
  );
}
