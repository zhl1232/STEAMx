import { Textarea } from "@/components/ui/textarea"

interface ObservationSubmitNotesSectionProps {
  notes: string
  onNotesChange: (v: string) => void
}

export function ObservationSubmitNotesSection({ notes, onNotesChange }: ObservationSubmitNotesSectionProps) {
  return (
    <section className="surface-subtle p-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          4
        </div>
        <div>
          <h2 className="text-lg font-semibold">最后写下看到的情况</h2>
          <p className="mt-2 text-sm text-muted-foreground">这不是长报告，用一两句话写清你看到了什么就可以。</p>
        </div>
      </div>
      <div className="mt-4">
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="例如：湖边看到 3 只绿头鸭在觅食和梳羽。"
          rows={3}
        />
      </div>
    </section>
  )
}
