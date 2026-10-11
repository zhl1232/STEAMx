"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import { OptimizedImage } from "@/components/ui/optimized-image"
import { ProjectStepCopy } from "@/components/features/project/project-step-copy"
import { ProjectStepImage } from "@/components/features/project/project-step-image"
import type { ProjectStep } from "@/lib/mappers/types"

const SUMMARY_GRID_WITH_THUMB =
  "grid min-h-[54px] cursor-pointer list-none grid-cols-[30px_minmax(0,1fr)_72px_20px] items-center gap-2.5 px-2.5 py-2 group-open/details:grid-cols-[30px_minmax(0,1fr)_20px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
const SUMMARY_GRID_NO_THUMB =
  "grid min-h-[54px] cursor-pointer list-none grid-cols-[30px_minmax(0,1fr)_20px] items-center gap-2.5 px-2.5 py-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"

export function MobileProjectSteps({ steps, observationOnly = false }: { steps: ProjectStep[]; observationOnly?: boolean; practicePending?: boolean }) {
  const [openStates, setOpenStates] = useState<boolean[]>(() => steps.map((_, index) => index === 0))
  const allExpanded = steps.length > 0 && openStates.length === steps.length && openStates.every(Boolean)
  const toggleExpandAll = () => {
    setOpenStates(steps.map(() => !allExpanded))
  }

  return (
    <section
      id="project-steps-mobile"
      className="scroll-mt-32 rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-sans text-base font-bold tracking-tight text-foreground">
          {`${observationOnly ? "观看要点" : "探索步骤"}${steps.length > 0 ? `（共 ${steps.length} ${observationOnly ? "项" : "步"}）` : ""}`}
        </h2>
        {steps.length > 0 ? (
          <button
            type="button"
            onClick={toggleExpandAll}
            className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-sm px-2 text-sm font-semibold text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            {allExpanded ? "全部收起" : "全部展开"}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {steps.length > 0 ? (
        <ol className="space-y-2">
          {steps.map((step, index) => {
            const stepTitle = step.title || `${observationOnly ? "观看要点" : "步骤"} ${index + 1}`
            const imageUrl = step.image_url
            const displayIndex = index + 1

            return (
              <li
                key={`${stepTitle}-${index}`}
                id={`project-step-mobile-${displayIndex}`}
                className="rounded-sm border border-[hsl(var(--surface-border)/0.78)] bg-background/76"
              >
                <details
                  open={openStates[index] ?? false}
                  onToggle={(event) => {
                    const isOpen = event.currentTarget.open
                    setOpenStates((current) => current[index] === isOpen ? current : current.map((value, itemIndex) => itemIndex === index ? isOpen : value))
                  }}
                  className="group/details"
                >
                  <summary className={imageUrl ? SUMMARY_GRID_WITH_THUMB : SUMMARY_GRID_NO_THUMB}>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[hsl(var(--brand-green))] text-xs font-bold text-white">
                      {displayIndex}
                    </span>
                    <div className="min-w-0">
                      <h3 className="break-words font-sans text-sm font-bold text-foreground">{stepTitle}</h3>
                      {step.description ? (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground group-open/details:hidden">
                          {step.checkpoint?.includes(' → ') ? step.description : step.checkpoint || step.description}
                        </p>
                      ) : null}
                    </div>
                    {imageUrl ? (
                      <div className="relative h-10 w-[72px] shrink-0 overflow-hidden rounded-xs bg-muted group-open/details:hidden">
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
                        <div className="relative aspect-16/10 overflow-hidden rounded-sm bg-muted">
                          <ProjectStepImage
                            src={imageUrl}
                            alt={stepTitle}
                            className="aspect-[16/10] w-full"
                            sizes="(max-width: 767px) calc(100vw - 88px), 320px"
                          />
                        </div>
                      ) : null}
                      {step.description ? (
                        <ProjectStepCopy step={step} className="whitespace-pre-line text-sm leading-6 text-foreground/85 wrap-anywhere" />
                      ) : null}
                    </div>
                  )}
                </details>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="rounded-sm border border-dashed border-border bg-background/50 px-5 py-8 text-center text-sm text-muted-foreground">
          {observationOnly ? "暂无观看要点" : "暂无步骤说明"}
        </div>
      )}
    </section>
  )
}
