"use client"

import { Eye, Gift, HelpCircle, Lightbulb, Paintbrush, Sun } from "lucide-react"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { RECORD_TYPE_OPTIONS } from "@/lib/project/exploration-record-meta"
import { cn } from "@/lib/utils"

const ICONS = {
  observation: Eye,
  help: HelpCircle,
  insight: Lightbulb,
  discovery: Sun,
  decorate: Paintbrush,
  result: Gift,
} as const

interface RecordTypePickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (recordType: string) => void
}

export function RecordTypePickerSheet({ open, onOpenChange, onSelect }: RecordTypePickerSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-lg">
        <SheetHeader>
          <SheetTitle>选择记录类型</SheetTitle>
        </SheetHeader>
        <p className="mt-1 text-sm text-muted-foreground">选择最接近你这次探索的类型，便于大家快速浏览。</p>
        <RecordTypeGrid onSelect={onSelect} onOpenChange={onOpenChange} />
      </SheetContent>
    </Sheet>
  )
}

function RecordTypeGrid({
  onSelect,
  onOpenChange,
}: {
  onSelect: (recordType: string) => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-3">
      {RECORD_TYPE_OPTIONS.map((option) => {
        const Icon = ICONS[option.id]
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              onOpenChange(false)
              onSelect(option.id)
            }}
            className="flex flex-col items-center gap-2 rounded-sm border border-[hsl(var(--surface-border)/0.8)] bg-background/80 px-2 py-3 text-center transition active:scale-[0.98]"
          >
            <span className={cn("grid h-10 w-10 place-items-center rounded-full bg-muted/60 text-foreground")}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-xs font-semibold text-foreground">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
