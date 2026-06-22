import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, MapPin, Navigation } from "lucide-react"

import { AmapAppLauncher } from "@/app/navigate/amap-app-launcher"
import { Button } from "@/components/ui/button"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { normalizeNatureFrom } from "@/lib/utils/nature-navigation"

interface NavigatePageProps {
  searchParams: Promise<{
    lat?: string
    lng?: string
    name?: string
    from?: string
  }>
}

export const metadata: Metadata = buildPageMetadata({
  title: "打开地图导航",
  description: "在站内确认观察地点坐标，并按需打开高德地图 App。",
  path: "/navigate",
  noIndex: true,
})

function parseCoordinate(value: string | undefined, min: number, max: number) {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null
  return parsed
}

export default async function NavigatePage({ searchParams }: NavigatePageProps) {
  const query = await searchParams
  const latitude = parseCoordinate(query.lat, -90, 90)
  const longitude = parseCoordinate(query.lng, -180, 180)
  const name = query.name?.trim().slice(0, 80) || "观察地点"
  const fallbackHref = normalizeNatureFrom(query.from, "/nature/map")
  const hasValidCoordinates = latitude != null && longitude != null
  const coordinateText = hasValidCoordinates
    ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    : null

  return (
    <main className="page-shell flex min-h-[calc(100dvh-var(--mobile-global-header-height,0rem))] items-center py-6 md:py-10">
      <section className="mx-auto w-full max-w-2xl rounded-[var(--radius-lg)] border border-border/70 bg-background p-5 shadow-sm sm:p-7">
        <Button asChild variant="ghost" className="-ml-2 mb-5 h-11 gap-2 px-2 text-muted-foreground">
          <Link href={fallbackHref}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            返回
          </Link>
        </Button>

        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-200">
            <Navigation className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="section-kicker">地图导航</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              这里不会自动离开 STEAM 探索。需要导航时，手动打开高德 App；也可以复制坐标后在地图里搜索。
            </p>
          </div>
        </div>

        {hasValidCoordinates ? (
          <>
            <div className="mt-6 rounded-[var(--radius-sm)] border border-border/70 bg-muted/35 p-4">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                坐标
              </p>
              <p className="mt-2 font-mono text-base font-semibold tabular-nums text-foreground">{coordinateText}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                公开自然观察坐标使用高德地图兼容坐标，可用于 App 定位查看。
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start">
              <AmapAppLauncher latitude={latitude} longitude={longitude} name={name} />
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            坐标参数无效，无法打开地图。请返回观察记录重新进入。
          </div>
        )}
      </section>
    </main>
  )
}
