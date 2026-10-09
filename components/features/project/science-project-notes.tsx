import type { ScienceSample } from '@/lib/project/science-samples'

export function ScienceProjectNotes({ sample }: { sample: ScienceSample }) {
  return (
    <section className="surface-panel space-y-5 rounded-lg p-4 md:p-6" aria-label="实验观察与思考">
      <div>
        <h2 className="text-lg font-semibold">观察与记录</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{sample.observation}</p>
      </div>
      <div>
        <h2 className="text-lg font-semibold">想一想，为什么？</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{sample.principle}</p>
      </div>
      <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">拓展探索（选做）</summary>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{sample.extension}</p>
      </details>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">实验中遇到的问题</h2>
        {sample.faq.map(item => (
          <details key={item.question} className="rounded-md border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">{item.question}</summary>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function ScienceProjectSafety({ sample }: { sample: ScienceSample }) {
  return (
    <aside className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-7" aria-label="动手前先检查">
      <h2 className="font-semibold">动手前先检查</h2>
      <p className="mt-1">{sample.safety}</p>
    </aside>
  )
}
