"use client"

import { useCallback, useRef, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import { OptimizedImage } from "@/components/ui/optimized-image"
import { getMaterialMeta } from "@/lib/project/material-meta"
import type { ProjectStep } from "@/lib/mappers/types"

const SUMMARY_GRID_WITH_THUMB =
  "grid min-h-[54px] cursor-pointer list-none grid-cols-[30px_minmax(0,1fr)_72px_20px] items-center gap-2.5 px-2.5 py-2 [&::-webkit-details-marker]:hidden"
const SUMMARY_GRID_NO_THUMB =
  "grid min-h-[54px] cursor-pointer list-none grid-cols-[30px_minmax(0,1fr)_20px] items-center gap-2.5 px-2.5 py-2 [&::-webkit-details-marker]:hidden"

function formatMaterialsPreview(materials: string[]) {
  if (materials.length === 0) return "暂无材料清单"
  const names = materials.map((item) => getMaterialMeta(item).name)
  const preview = names.slice(0, 2).join("、")
  if (materials.length <= 2) return preview
  return `${preview} 等 ${materials.length} 种`
}

export function MobileProjectSteps({ steps, materials }: { steps: ProjectStep[]; materials: string[] }) {
  const hasMaterials = materials.length > 0
  const displayStepCount = steps.length + (hasMaterials ? 1 : 0)
  const detailsRefs = useRef<(HTMLDetailsElement | null)[]>([])
  const [allExpanded, setAllExpanded] = useState(false)
  const setDetailsRef = useCallback((index: number) => (element: HTMLDetailsElement | null) => {
    detailsRefs.current[index] = element
  }, [])
  const toggleExpandAll = () => {
    const next = !allExpanded
    detailsRefs.current.forEach((element) => {
      if (element) element.open = next
    })
    setAllExpanded(next)
  }
  let refIndex = 0
  const nextRef = () => setDetailsRef(refIndex++)

  return (
    <section
      id="project-steps-mobile"
      className="scroll-mt-20 rounded-[14px] border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-sans text-base font-bold tracking-tight text-foreground">
          {`探索步骤${displayStepCount > 0 ? `（共 ${displayStepCount} 步）` : ""}`}
        </h2>
        {displayStepCount > 0 ? (
          <button
            type="button"
            onClick={toggleExpandAll}
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-muted-foreground"
          >
            {allExpanded ? "全部收起" : "全部展开"}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {displayStepCount > 0 ? (
        <ol className="space-y-2">
          {hasMaterials ? (
            <li
              id="project-step-mobile-1"
              className="rounded-[10px] border border-[hsl(var(--surface-border)/0.78)] bg-background/76"
            >
              <details ref={nextRef()} className="group/details">
                <summary className={SUMMARY_GRID_NO_THUMB}>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[hsl(var(--brand-green))] text-xs font-bold text-white">
                    1
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-sans text-sm font-bold text-foreground">准备材料</h3>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground group-open/details:hidden">
                      {formatMaterialsPreview(materials)}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open/details:rotate-180" />
                </summary>
                <div className="border-t border-[hsl(var(--surface-border)/0.62)] px-3 pb-3 pt-2">
                  <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
                    共 {materials.length} 种材料
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {materials.map((material, index) => {
                      const meta = getMaterialMeta(material)
                      return (
                        <span
                          key={`${material}-${index}`}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-[8px] border border-[hsl(var(--surface-border)/0.78)] bg-[hsl(var(--surface-muted)/0.55)] px-2.5 py-1.5"
                        >
                          <span className="truncate text-xs font-medium text-foreground">{meta.name}</span>
                          {meta.amount ? (
                            <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">
                              {meta.amount}
                            </span>
                          ) : null}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </details>
            </li>
          ) : null}
          {steps.map((step, index) => {
            const stepTitle = step.title || `步骤 ${index + 1}`
            const imageUrl = step.image_url
            const displayIndex = index + (hasMaterials ? 2 : 1)

            return (
              <li
                key={`${stepTitle}-${index}`}
                id={`project-step-mobile-${displayIndex}`}
                className="rounded-[10px] border border-[hsl(var(--surface-border)/0.78)] bg-background/76"
              >
                <details ref={nextRef()} className="group/details">
                  <summary className={imageUrl ? SUMMARY_GRID_WITH_THUMB : SUMMARY_GRID_NO_THUMB}>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[hsl(var(--brand-green))] text-xs font-bold text-white">
                      {displayIndex}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-sans text-sm font-bold text-foreground">{stepTitle}</h3>
                      {step.description ? (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground group-open/details:hidden">
                          {step.description}
                        </p>
                      ) : null}
                    </div>
                    {imageUrl ? (
                      <div className="relative h-10 w-[72px] shrink-0 overflow-hidden rounded-[8px] bg-muted group-open/details:hidden">
                        <OptimizedImage
                          src={imageUrl}
                          alt={stepTitle}
                          fill
                          variant="thumbnail"
                          className="object-cover"
                        />
                      </div>
                    ) : null}
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open/details:rotate-180" />
                  </summary>
                  {(step.description || imageUrl) && (
                    <div className="space-y-2 border-t border-[hsl(var(--surface-border)/0.62)] px-3 pb-3 pt-2">
                      {imageUrl ? (
                        <div className="relative aspect-[16/10] overflow-hidden rounded-[10px] bg-muted">
                          <OptimizedImage
                            src={imageUrl}
                            alt={stepTitle}
                            fill
                            variant="grid"
                            className="object-cover"
                          />
                        </div>
                      ) : null}
                      {step.description ? (
                        <p className="text-xs leading-5 text-muted-foreground">{step.description}</p>
                      ) : null}
                    </div>
                  )}
                </details>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="rounded-[12px] border border-dashed border-border bg-background/50 px-5 py-8 text-center text-sm text-muted-foreground">
          暂无步骤说明
        </div>
      )}
    </section>
  )
}
