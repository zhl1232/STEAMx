import { BirdObservationShell } from "@/app/bird-observation/_components/bird-observation-shell";
import { ObservationSubmitForm } from "@/components/features/bird-observation/observation-submit-form";
import { getSpeciesList } from "@/lib/api/nature-observation-data";

interface ObservationSubmitPageProps {
  searchParams: Promise<{
    species?: string;
  }>;
}

export default async function ObservationSubmitPage({ searchParams }: ObservationSubmitPageProps) {
  const params = await searchParams;
  const parsedSpeciesId = params.species ? Number(params.species) : null;
  const defaultSpeciesId = parsedSpeciesId && Number.isInteger(parsedSpeciesId) && parsedSpeciesId > 0 ? parsedSpeciesId : null;
  const { species } = await getSpeciesList({ page: 0, pageSize: 50 });

  return (
    <BirdObservationShell
      title="提交观察记录"
      description="把照片、物种、时间和地点整理成一条清晰记录。先完成核心信息，后续细节可以再补。"
      fallbackHref="/bird-observation"
      aside={
        <>
          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">提交建议</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">先完成，再优化</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              第一条记录不需要写得很满。优先确保照片、物种和定位完整，再逐步补行为和环境信息。
            </p>
            <div className="mt-5 grid gap-3">
              <div className="surface-subtle px-4 py-3 text-sm leading-6 text-foreground/90">
                每条记录至少上传一张照片，方便后续核对物种。
              </div>
              <div className="surface-subtle px-4 py-3 text-sm leading-6 text-foreground/90">
                如果不确定具体地点，可先记录近似位置并注明。
              </div>
            </div>
          </section>

          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">提交后</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">记录会回流到平台内容里</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              保存成功后，可继续前往观察详情页、物种页和公开观察流，不会停留在独立专题链路中。
            </p>
          </section>
        </>
      }
    >
      <section className="surface-panel overflow-hidden p-5 sm:p-6 md:p-8">
        <div className="mb-8">
          <div className="inline-flex rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-sm font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            鸟类观察记录
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">把看到的内容整理成一条可回看的记录</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
            照片、物种、地点和时间是最核心的四项。提交成功后，平台会把它作为自然观察内容的一部分继续展示和管理。
          </p>
        </div>

        <ObservationSubmitForm
          speciesOptions={species.map((item) => ({
            id: item.id,
            commonName: item.commonName,
            scientificName: item.scientificName,
          }))}
          defaultSpeciesId={defaultSpeciesId}
        />
      </section>
    </BirdObservationShell>
  );
}
