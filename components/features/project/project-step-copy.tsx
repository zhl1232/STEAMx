import type { ProjectStep } from '@/lib/mappers/types'

export function ProjectStepCopy({ step, className }: { step: ProjectStep; className: string }) {
  const circuitParts = step.checkpoint?.includes(' → ') ? step.checkpoint.split(' → ') : null
  return (
    <div className="min-w-0 space-y-2">
      {step.checkpoint && !circuitParts ? <p className="whitespace-pre-line rounded-sm bg-primary/5 px-3 py-2 text-sm font-semibold leading-6 text-foreground wrap-anywhere">{step.checkpoint}</p> : null}
      <p className={className}>{step.description}</p>
      {circuitParts ? (
        <p aria-label="接线顺序" className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-sm bg-primary/5 px-3 py-2 text-sm font-semibold leading-6 text-foreground">
          {circuitParts.map((part, index) => <span key={`${index}-${part}`} className="inline-flex shrink-0 whitespace-nowrap">{index > 0 ? '→ ' : ''}{part}</span>)}
        </p>
      ) : null}
    </div>
  )
}
