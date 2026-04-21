import Link from "next/link";
import { notFound } from "next/navigation";

import { NatureShell } from "@/app/nature/_components/nature-shell";
import { getObservationById } from "@/lib/api/nature-observation-data";

interface ObservationSubmittedPageProps {
  params: Promise<{ id: string }>;
}

export default async function ObservationSubmittedPage({ params }: ObservationSubmittedPageProps) {
  const { id } = await params;
  const observation = await getObservationById(id);

  if (!observation) {
    notFound();
  }

  return (
    <NatureShell
      title="观察记录已保存"
      description="这条记录已经进入平台内容流。接下来可以查看详情、继续补下一条，或回到物种与观察流继续整理。"
      fallbackHref="/nature"
      aside={
        <>
          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">下一步</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">继续补充你的观察节奏</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              保持同一地点的连续记录，比一次性写很多说明更能积累有效观察样本。
            </p>
            <div className="mt-5 space-y-3">
              <Link
                href={`/nature/observations/${observation.id}`}
                className="surface-subtle block px-4 py-3 text-sm font-medium transition-transform hover:-translate-y-0.5"
              >
                查看这条记录详情
              </Link>
              <Link
                href="/nature/submit"
                className="surface-subtle block px-4 py-3 text-sm font-medium transition-transform hover:-translate-y-0.5"
              >
                继续记录下一条
              </Link>
            </div>
          </section>

          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">记录状态</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">已纳入观察内容</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              你可以在详情页继续查看图片、地点和物种信息，也可以从公开观察流中找到这条记录。
            </p>
          </section>
        </>
      }
    >
      <section className="surface-panel overflow-hidden p-5 sm:p-6 md:p-8">
        <div className="inline-flex rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-sm font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          记录已完成
        </div>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">你的观察已经保存</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
          这条记录已经进入平台内容流，可在详情页查看完整信息与互动，或继续提交下一条记录。
        </p>

        <div className="mt-8 surface-subtle p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{new Date(observation.observedAt).toLocaleString("zh-CN")}</span>
            <span>·</span>
            <span>{observation.locationName}</span>
            {observation.habitat ? (
              <>
                <span>·</span>
                <span>{observation.habitat}</span>
              </>
            ) : null}
          </div>
          {observation.species.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {observation.species.map((item) => (
                <span
                  key={`${observation.id}-${item.speciesId}`}
                  className="rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {item.commonName}
                  {item.count ? ` × ${item.count}` : ""}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/nature/observations/${observation.id}`}
            className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            查看这条记录详情
          </Link>
          <Link
            href="/nature/submit"
            className="inline-flex items-center rounded-full border border-border/80 bg-background/80 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted/70"
          >
            继续记录下一条
          </Link>
        </div>
      </section>
    </NatureShell>
  );
}
