export const observationLifecycleStageValues = [
  'egg',
  'larva',
  'pupa',
  'juvenile',
  'adult',
  'unknown',
] as const

export const observationSexValues = ['male', 'female', 'unknown'] as const

export type ObservationLifecycleStage = (typeof observationLifecycleStageValues)[number]
export type ObservationSex = (typeof observationSexValues)[number]

export const observationLifecycleStageLabels: Record<ObservationLifecycleStage, string> = {
  egg: '卵',
  larva: '幼虫',
  pupa: '蛹',
  juvenile: '幼体',
  adult: '成体',
  unknown: '无法判断',
}

export const observationSexLabels: Record<ObservationSex, string> = {
  male: '雄',
  female: '雌',
  unknown: '无法判断',
}

export const observationLifecycleStageOptions = [
  { value: 'adult', label: observationLifecycleStageLabels.adult },
  { value: 'juvenile', label: observationLifecycleStageLabels.juvenile },
  { value: 'larva', label: observationLifecycleStageLabels.larva },
  { value: 'pupa', label: observationLifecycleStageLabels.pupa },
  { value: 'egg', label: observationLifecycleStageLabels.egg },
  { value: 'unknown', label: observationLifecycleStageLabels.unknown },
] as const satisfies ReadonlyArray<{ value: ObservationLifecycleStage; label: string }>

export const observationSexOptions = [
  { value: 'male', label: observationSexLabels.male },
  { value: 'female', label: observationSexLabels.female },
  { value: 'unknown', label: observationSexLabels.unknown },
] as const satisfies ReadonlyArray<{ value: ObservationSex; label: string }>

export function formatObservationLifecycleStage(
  stage: ObservationLifecycleStage | null | undefined,
): string | null {
  return stage ? observationLifecycleStageLabels[stage] ?? null : null
}

export function formatObservationSex(sex: ObservationSex | null | undefined): string | null {
  return sex ? observationSexLabels[sex] ?? null : null
}
