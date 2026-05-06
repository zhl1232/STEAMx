import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Clock3, MapPin, Navigation } from "lucide-react";
import { notFound } from "next/navigation";

import { DomesticMiniMap } from "@/components/features/bird-observation/domestic-mini-map";
import { ObservationMediaGallery } from "@/components/features/bird-observation/observation-media-gallery";
import { ObservationOwnerActions } from "@/components/features/bird-observation/observation-owner-actions";
import { ObservationSocialSection } from "@/components/features/bird-observation/observation-social-section";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { ReportDialog } from "@/components/ui/report-dialog";
import { getObservationById } from "@/lib/api/nature-observation-data";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { appendNatureFrom, buildNatureSubmitHref, normalizeNatureFrom } from "@/lib/utils/nature-navigation";
import { HeroImagePreview } from "./hero-image-preview";

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
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const primarySpecies = observation.species[0];
  const title = primarySpecies?.commonName
    ? `${primarySpecies.commonName} 观察记录`
    : `观察记录 #${observation.id}`;
  const description = (observation.notes || `${observation.locationName} 的自然观察记录。`).slice(0, 160);

  return buildPageMetadata({
    title,
    description,
    path: `/nature/observations/${observation.id}`,
    image: observation.mediaUrls[0] || undefined,
    keywords: [
      primarySpecies?.commonName,
      primarySpecies?.scientificName,
      observation.locationName,
      "自然观察记录",
      "鸟类观察",
    ],
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

  const observedAtLabel = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(observation.observedAt));
  const primarySpecies = observation.species[0];
  const heroImage = observation.mediaUrls[0];
  const currentPath = `/nature/observations/${observation.id}`;
  const fallbackHref = normalizeNatureFrom(query.from, "/nature/observations");
  const primarySpeciesHref = primarySpecies?.speciesSlug
    ? appendNatureFrom(`/nature/species/${primarySpecies.speciesSlug}`, currentPath)
    : null;
  const submitHref = buildNatureSubmitHref({
    topic: "birds",
    speciesId: primarySpecies?.speciesId,
    from: currentPath,
  });
  const amapHref =
    observation.latitude != null && observation.longitude != null
      ? `https://uri.amap.com/marker?position=${observation.longitude},${observation.latitude}&name=${encodeURIComponent(observation.locationName)}&src=steam-explore`
      : null;

  return (
    <div className="page-shell pb-36 pt-0 md:pb-12 md:pt-6">
      <MobilePageHeader
        title="观察记录详情"
        fallbackHref={fallbackHref}
        className="-mx-4 mb-4 md:hidden"
      />

      <div className="mx-auto w-full max-w-5xl">
        <section className="surface-panel overflow-hidden">
          {heroImage ? (
            <HeroImagePreview
              heroImage={heroImage}
              primarySpecies={primarySpecies}
              observationId={observation.id}
            />
          ) : (
            <div className="flex aspect-[5/4] items-end bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_32%),linear-gradient(160deg,_rgba(255,255,255,0.96),_rgba(240,249,255,0.9))] p-6 dark:bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.14),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(96,165,250,0.14),_transparent_34%),linear-gradient(160deg,_rgba(10,18,26,0.96),_rgba(8,16,24,0.92))] sm:aspect-[16/10] md:aspect-[16/9]">
              <div className="rounded-3xl border border-border/70 bg-background/84 px-4 py-3 backdrop-blur">
                <div className="text-sm text-muted-foreground">暂未上传观察照片</div>
                <div className="mt-1 text-lg font-semibold">{primarySpecies?.commonName ?? `观察记录 #${observation.id}`}</div>
              </div>
            </div>
          )}

          <div className="space-y-5 px-6 py-5 sm:px-8 sm:py-6 md:px-9">
            <div className="flex flex-wrap items-center gap-2">
              <span className="section-kicker">自然观察</span>
              <span className="inline-flex rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                {observation.isPublic ? "公开观察记录" : "仅自己可见"}
              </span>
            </div>

            <div className="space-y-3.5">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground md:text-5xl">
                  {primarySpecies?.commonName ?? `观察记录 #${observation.id}`}
                </h1>
                {primarySpecies?.scientificName ? (
                  <div className="flex flex-wrap items-center gap-2 pb-1">
                    <p className="text-base italic text-muted-foreground md:text-lg">{primarySpecies.scientificName}</p>
                    {primarySpecies.speciesSlug ? (
                      <Link
                        href={primarySpeciesHref ?? `/nature/species/${primarySpecies.speciesSlug}`}
                        aria-label="查看物种百科"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-muted/45 text-muted-foreground transition-colors hover:bg-muted/75 hover:text-foreground"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        <span className="sr-only">查看物种百科</span>
                      </Link>
                    ) : null}
                  </div>
                ) : primarySpecies?.speciesSlug ? (
                  <Link
                    href={primarySpeciesHref ?? `/nature/species/${primarySpecies.speciesSlug}`}
                    aria-label="查看物种百科"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-muted/45 text-muted-foreground transition-colors hover:bg-muted/75 hover:text-foreground"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    <span className="sr-only">查看物种百科</span>
                  </Link>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground md:text-[15px]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/45 px-3.5 py-1.5">
                  <Clock3 className="h-4 w-4" />
                  {observedAtLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/45 px-3.5 py-1.5">
                  <MapPin className="h-4 w-4" />
                  {observation.locationName}
                </span>
                {observation.isPublic ? (
                  <>
                    <span className="inline-flex rounded-full bg-muted/45 px-3.5 py-1.5">点赞 {observation.likesCount}</span>
                    <span className="inline-flex rounded-full bg-muted/45 px-3.5 py-1.5">评论 {observation.commentsCount}</span>
                  </>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {primarySpeciesHref ? (
                  <Link
                    href={primarySpeciesHref}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-border/70 bg-muted/40 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/75 hover:text-foreground"
                  >
                    回到该物种
                  </Link>
                ) : null}
                <Link
                  href={submitHref}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-border/70 bg-muted/40 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/75 hover:text-foreground"
                >
                  再记一条
                </Link>
                <ObservationOwnerActions observationId={observation.id} ownerId={observation.userId} />
                {observation.isPublic ? (
                  <ReportDialog contentType="observation" contentId={observation.id}>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center rounded-full border border-border/70 bg-muted/40 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/75 hover:text-foreground"
                    >
                      举报记录
                    </button>
                  </ReportDialog>
                ) : null}
              </div>

              {observation.notes ? (
                <p className="max-w-3xl text-sm leading-7 text-foreground/85 md:text-base">{observation.notes}</p>
              ) : null}
            </div>

            {observation.isPublic ? (
              <ObservationSocialSection
                observationId={observation.id}
                initialLikesCount={observation.likesCount}
                initialCommentsCount={observation.commentsCount}
                className="mt-2 border-0 bg-transparent p-0 shadow-none"
                commentsClassName="mt-4 rounded-[24px] border border-border/70 bg-card/88 p-4 pt-4 sm:p-5"
                mobileFloatingBar
                submitHref={submitHref}
              />
            ) : null}
          </div>
        </section>

        {observation.mediaUrls.length > 1 ? (
          <div className="px-6 pb-2 sm:px-8 md:px-9">
            <section className="surface-subtle p-4 sm:p-5">
              <h2 className="text-sm font-medium text-foreground">更多观察照片</h2>
              <ObservationMediaGallery mediaUrls={observation.mediaUrls} />
            </section>
          </div>
        ) : null}

        <div className="px-6 py-5 sm:px-8 sm:py-6 md:px-9">
          <section className="surface-panel overflow-hidden">
            {observation.latitude != null && observation.longitude != null ? (
              <div className="relative">
                <DomesticMiniMap
                  markers={[
                    {
                      latitude: observation.latitude,
                      longitude: observation.longitude,
                      label: observation.locationName,
                    },
                  ]}
                  heightClassName="h-80 sm:h-[22rem]"
                />
                {amapHref ? (
                  <a
                    href={amapHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="打开导航"
                    className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-background/94 text-foreground shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] backdrop-blur transition-colors hover:bg-background"
                  >
                    <Navigation className="h-5 w-5" />
                    <span className="sr-only">打开导航</span>
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
                暂无定位信息
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
