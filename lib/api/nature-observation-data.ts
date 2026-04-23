/**
 * 自然观察读模型聚合入口：自领域子模块 re-export，
 * 调用方仍可 `import { ... } from '@/lib/api/nature-observation-data'`。
 *
 * 子模块：
 * - `nature-observation-events.ts` — 观察事件列表/详情、物种批量加载
 * - `nature-observation-homepage.ts` — 观鸟首页、挑战项目
 * - `nature-observation-species.ts` — 物种列表与详情
 * - `nature-observation-internal-types.ts` — 内部类型
 */

export {
  loadObservationSpeciesForEvents,
  getObservations,
  getObservationById,
} from './nature-observation-events'
export type { ObservationListOptions } from './nature-observation-events'

export {
  getCuratedChallengeProjects,
  getBirdObservationFeaturedSpecies,
  getBirdObservationRecentObservations,
  getBirdObservationHomepageData,
} from './nature-observation-homepage'
export type { BirdHomepageData } from './nature-observation-homepage'

export { getSpeciesList, getSpeciesById, getSpeciesBySlug } from './nature-observation-species'
export type { SpeciesListOptions } from './nature-observation-species'
