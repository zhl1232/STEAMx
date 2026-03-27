import { ObservationSubmitForm } from '@/components/features/bird-observation/observation-submit-form'
import { MobileBackButton } from '@/components/ui/mobile-back-button'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { getSpeciesList } from '@/lib/api/nature-observation-data'
import { createClient } from '@/lib/supabase/server'

interface ObservationSubmitPageProps {
  searchParams: Promise<{
    project?: string
    challenge?: string
    species?: string
  }>
}

export default async function ObservationSubmitPage({ searchParams }: ObservationSubmitPageProps) {
  const params = await searchParams
  const parsedProjectId = params.project ? Number(params.project) : null
  const parsedChallengeId = params.challenge ? Number(params.challenge) : null
  const parsedSpeciesId = params.species ? Number(params.species) : null
  const projectId = parsedProjectId && Number.isInteger(parsedProjectId) && parsedProjectId > 0 ? parsedProjectId : null
  const challengeId = parsedChallengeId && Number.isInteger(parsedChallengeId) && parsedChallengeId > 0 ? parsedChallengeId : null
  const defaultSpeciesId = parsedSpeciesId && Number.isInteger(parsedSpeciesId) && parsedSpeciesId > 0 ? parsedSpeciesId : null
  const supabase = await createClient()
  const { species } = await getSpeciesList({ page: 0, pageSize: 50 })

  const [projectResult, challengeResult] = await Promise.all([
    projectId
      ? supabase.from('projects').select('id, title').eq('id', projectId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    challengeId
      ? supabase.from('challenges').select('id, title').eq('id', challengeId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10 md:py-14">
      <MobilePageHeader
        title="提交观察记录"
        fallbackHref="/bird-observation"
        className="-mx-4 -mt-10 mb-4 md:hidden"
      />
      <MobileBackButton fallbackHref="/bird-observation" className="hidden md:block" />

      <div className="mt-4 rounded-3xl border bg-card px-6 py-8 shadow-sm md:px-10 md:py-10">
        <div className="mb-8">
          <div className="mb-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
            鸟类观察记录
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">提交观察记录</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
            把时间、地点、物种、数量和行为写清楚，这条记录以后就能在物种页和观察记录页里被继续查看、对比和整理。
          </p>
        </div>

        <ObservationSubmitForm
          speciesOptions={species.map((item) => ({
            id: item.id,
            commonName: item.commonName,
            scientificName: item.scientificName,
          }))}
          defaultProjectId={projectResult.data?.id ?? null}
          defaultChallengeId={challengeResult.data?.id ?? null}
          defaultProjectTitle={projectResult.data?.title ?? null}
          defaultChallengeTitle={challengeResult.data?.title ?? null}
          defaultSpeciesId={defaultSpeciesId}
        />
      </div>
    </div>
  )
}
