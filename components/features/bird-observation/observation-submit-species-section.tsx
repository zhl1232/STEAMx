import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import type { SpeciesEntryFormState, SpeciesOption } from "./observation-form-types"

interface ObservationSubmitSpeciesSectionProps {
  speciesOptions: SpeciesOption[]
  speciesEntries: SpeciesEntryFormState[]
  showAdvancedFields: boolean
  selectedSpeciesIds: Set<string>
  onUpdateEntry: (index: number, field: keyof SpeciesEntryFormState, value: string) => void
  onAddSpecies: () => void
  onRemoveSpecies: (index: number) => void
}

export function ObservationSubmitSpeciesSection({
  speciesOptions,
  speciesEntries,
  showAdvancedFields,
  selectedSpeciesIds,
  onUpdateEntry,
  onAddSpecies,
  onRemoveSpecies,
}: ObservationSubmitSpeciesSectionProps) {
  return (
    <section className="surface-subtle p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            2
          </div>
          <div>
            <h2 className="text-lg font-semibold">再选择物种</h2>
            <p className="mt-1 text-sm text-muted-foreground">先填一个物种就能提交，之后再补更多细节。</p>
          </div>
        </div>
        {showAdvancedFields && (
          <Button type="button" variant="outline" onClick={onAddSpecies}>
            新增物种
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {speciesEntries.map((entry, index) => (
          <div key={index} className="rounded-2xl border border-border/70 bg-background/75 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>物种</Label>
                <select
                  value={entry.speciesId}
                  onChange={(e) => onUpdateEntry(index, "speciesId", e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">请选择物种</option>
                  {speciesOptions.map((option) => {
                    const disabled = selectedSpeciesIds.has(String(option.id)) && entry.speciesId !== String(option.id)
                    return (
                      <option key={option.id} value={option.id} disabled={disabled}>
                        {option.commonName}
                        {option.scientificName ? ` / ${option.scientificName}` : ""}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div className="space-y-2">
                <Label>数量</Label>
                <Input
                  value={entry.count}
                  onChange={(e) => onUpdateEntry(index, "count", e.target.value)}
                  placeholder="可选，例如 3"
                />
              </div>

              {showAdvancedFields && (
                <>
                  <div className="space-y-2 md:col-span-2">
                    <Label>行为标签</Label>
                    <Input
                      value={entry.behaviorTags}
                      onChange={(e) => onUpdateEntry(index, "behaviorTags", e.target.value)}
                      placeholder="例如：觅食, 梳羽, 潜水"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>补充说明</Label>
                    <Textarea
                      value={entry.notes}
                      onChange={(e) => onUpdateEntry(index, "notes", e.target.value)}
                      placeholder="可选，补充这一物种的观察情况"
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>

            {showAdvancedFields && speciesEntries.length > 1 && (
              <div className="mt-3 flex justify-end">
                <Button type="button" variant="ghost" onClick={() => onRemoveSpecies(index)}>
                  删除这一物种
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
