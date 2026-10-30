import { Box, ChevronDown } from 'lucide-react'

import { ProjectKitMatches } from '@/components/kits/project-kit-matches'
import { ContextualStoreProducts } from '@/components/store/contextual-store-products'
import type { getProjectKitMatches } from '@/lib/kits/service'
import { getMaterialMeta } from '@/lib/project/material-meta'
import { isStoreCatalogVisible } from '@/lib/store/config'
import type { PublicStoreProduct } from '@/lib/store/service'

type KitMatches = Awaited<ReturnType<typeof getProjectKitMatches>>

export function hasProjectMaterialPacks(matches: KitMatches, products: PublicStoreProduct[]) {
  return isStoreCatalogVisible() && (matches.some(match => match.linkedOffers.length || match.offers.length) || products.length > 0)
}

function MaterialsList({ materials }: { materials: string[] }) {
  return (
    <ul className="grid list-none gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
      {materials.map((material, index) => {
        const meta = getMaterialMeta(material)
        return (
          <li key={`${material}-${index}`} className="flex min-w-0 items-start gap-3 py-1">
            <Box className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-6 wrap-anywhere">{meta.name}</p>
              {meta.note && !meta.name.startsWith('自备：') ? <p className="text-sm leading-6 text-muted-foreground wrap-anywhere">{meta.note}</p> : null}
            </div>
            {meta.amount ? <span className="shrink-0 pt-0.5 text-sm leading-6 text-muted-foreground">{meta.amount}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Material requirements remain server-rendered and independent of store availability. */
export function ProjectMaterials({ materials, preparationNotes = [], kitMatches = [], products = [], projectTitle, idSuffix }: {
  materials: string[]
  preparationNotes?: string[]
  kitMatches?: KitMatches
  products?: PublicStoreProduct[]
  projectTitle: string
  idSuffix: string
}) {
  const catalogVisible = isStoreCatalogVisible()
  const linkedMatches = catalogVisible ? kitMatches.filter(match => match.linkedOffers.length || match.offers.length) : []
  const linkedProductIds = new Set(linkedMatches.flatMap(match => [...match.linkedOffers, ...match.offers].map(offer => offer.productId)))
  const otherProducts = catalogVisible ? products.filter(product => !linkedProductIds.has(product.id)) : []
  const materialPacks = linkedMatches.filter(match => match.kit.kind === 'material_pack')
  const readyPack = materialPacks.some(match => match.confirmed && match.preparationStatus === 'ready')
  const visibleMaterials: string[] = []
  const foldedMaterials: string[] = []

  for (const material of materials) {
    const meta = getMaterialMeta(material)
    // An association alone does not establish coverage. Only explicit kit parts
    // or a confirmed complete pack can be folded; self-preparation stays visible.
    const selfPrepared = /自备|另备|自带|自行准备|自行提供/.test(material)
    const kitPart = /^配套/.test(meta.name) || meta.name === `《${projectTitle}》对应实验材料包`
    const canFold = !selfPrepared && (readyPack || (materialPacks.length > 0 && kitPart))
    if (canFold) foldedMaterials.push(material)
    else visibleMaterials.push(material)
  }

  return (
    <div className="space-y-4">
      {linkedMatches.length > 0 ? <ProjectKitMatches matches={linkedMatches} embedded /> : null}
      {otherProducts.length > 0 ? <ContextualStoreProducts products={otherProducts} contextLabel="这个项目的" idSuffix={idSuffix} embedded materialAmount="" /> : null}

      {visibleMaterials.length > 0 ? <MaterialsList materials={visibleMaterials} /> : null}
      {!materials.length ? <p className="text-sm text-muted-foreground">暂无材料清单，请参考步骤中的准备说明。</p> : null}

      {preparationNotes.length > 0 ? (
        <div className="space-y-1">
          <h3 className="text-sm font-medium">准备要求</h3>
          {preparationNotes.map(note => <p key={note} className="text-sm leading-6 text-muted-foreground">{note}</p>)}
        </div>
      ) : null}

      {foldedMaterials.length > 0 ? (
        <details className="group border-t border-border/60">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-2 text-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            查看本项目材料明细
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
          </summary>
          <div className="pb-1 pt-2"><MaterialsList materials={foldedMaterials} /></div>
        </details>
      ) : null}
    </div>
  )
}
