"use client"

import { useRef, useState, type MouseEvent } from 'react'
import { Balloon, Check, CirclePlus, CupSoda, Droplets, Flashlight, Paintbrush, Pipette, ScrollText, Search, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { HOUSEHOLD_MATERIALS } from '@/lib/explore/material-matching'
import { cn } from '@/lib/utils'

const MATERIAL_ICONS: Record<string, LucideIcon> = {
    tissue: ScrollText,
    balloon: Balloon,
    straw: Pipette,
    water: Droplets,
    'paper-cup': CupSoda,
    watercolor: Paintbrush,
    flashlight: Flashlight,
}

interface HouseholdMaterialPickerProps {
    selectedIds: string[]
    onChange: (ids: string[]) => void
    matchedCount: number
}

export function HouseholdMaterialPicker({ selectedIds, onChange, matchedCount }: HouseholdMaterialPickerProps) {
    const [moreOpen, setMoreOpen] = useState(false)
    const [search, setSearch] = useState('')
    const moreTrigger = useRef<HTMLButtonElement>(null)
    const selected = new Set(selectedIds)
    const extraSelected = HOUSEHOLD_MATERIALS.filter((material) => !material.common && selected.has(material.id))
    const query = search.trim().toLocaleLowerCase()
    const visibleMaterials = HOUSEHOLD_MATERIALS.filter((material) =>
        !query || `${material.label} ${material.description ?? ''}`.toLocaleLowerCase().includes(query))

    const toggle = (id: string) => {
        onChange(selected.has(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id])
    }

    const openMore = (event: MouseEvent<HTMLButtonElement>) => {
        moreTrigger.current = event.currentTarget
        setSearch('')
        setMoreOpen(true)
    }

    return (
        <section aria-labelledby="household-materials-title" className="relative mb-5 space-y-3" data-testid="household-material-picker">
            <div className="flex items-center justify-between gap-3 pr-28 md:pr-12">
                <div className="space-y-1">
                    <h2 id="household-materials-title" className="text-base font-semibold text-foreground">我家有什么</h2>
                    <p className="text-xs leading-5 text-muted-foreground">点选已有材料</p>
                </div>
            </div>

            <div className="flex min-w-0 items-center gap-2">
                <div role="group" aria-label="常见材料" className="flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:thin]" data-testid="common-materials-strip">
                    {HOUSEHOLD_MATERIALS.filter((material) => material.common).map((material) => {
                        const Icon = MATERIAL_ICONS[material.id]
                        const active = selected.has(material.id)
                        return (
                            <FilterChip
                                key={material.id}
                                active={active}
                                aria-pressed={active}
                                aria-label={material.label}
                                onClick={() => toggle(material.id)}
                                size="md"
                                shape="pill"
                                className="h-11 shrink-0 gap-1.5 px-3 md:h-11"
                            >
                                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                                {material.label}
                                {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                            </FilterChip>
                        )
                    })}
                </div>
                <Button variant="outline" shape="pill" className="absolute right-0 top-0 h-11 shrink-0 gap-1.5 px-3 md:static" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={openMore}>
                    <CirclePlus className="h-4 w-4" aria-hidden />更多材料
                </Button>
            </div>

            {extraSelected.length > 0 && (
                <div role="group" aria-label="其他已选材料" className="flex flex-wrap gap-1.5">
                    {extraSelected.map((material) => (
                        <FilterChip key={material.id} active shape="pill" className="min-h-9 gap-1.5" aria-label={`移除${material.label}`} onClick={() => toggle(material.id)}>
                            {material.label}<X className="h-3 w-3" aria-hidden />
                        </FilterChip>
                    ))}
                </div>
            )}

            {selectedIds.length > 0 && <div className="flex items-center justify-between gap-3 text-xs leading-5 text-muted-foreground">
                <p aria-live="polite" aria-atomic="true">
                    已选 {selectedIds.length} 样 · <span className={cn(matchedCount > 0 && 'font-medium text-[hsl(var(--status-success))]')}>{matchedCount > 0 ? `${matchedCount} 个项目材料已匹配` : '还没有全部匹配的项目'}</span>
                </p>
                <Button variant="ghost" size="sm" className="h-11 shrink-0 px-2 text-muted-foreground md:absolute md:right-0 md:top-0" aria-label="清空已选材料" onClick={() => onChange([])}>清空</Button>
            </div>}

            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                <SheetContent className="flex w-full flex-col sm:max-w-md" onCloseAutoFocus={(event) => {
                    event.preventDefault()
                    moreTrigger.current?.focus()
                }}>
                    <SheetHeader className="text-left">
                        <SheetTitle>选择家里已有的材料</SheetTitle>
                        <SheetDescription>可多选。数量和使用要求，请在项目清单里核对。</SheetDescription>
                    </SheetHeader>
                    <div className="relative shrink-0">
                        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
                        <Input aria-label="搜索材料" placeholder="搜索材料，如胶带、白纸" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 pl-9" />
                    </div>
                    <div role="group" aria-label="全部材料" className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto py-2">
                        {visibleMaterials.map((material) => (
                            <FilterChip
                                key={material.id}
                                active={selected.has(material.id)}
                                aria-pressed={selected.has(material.id)}
                                aria-label={material.label}
                                aria-describedby={material.description ? `household-material-${material.id}-description` : undefined}
                                onClick={() => toggle(material.id)}
                                className="min-h-12 min-w-0 justify-between gap-1 whitespace-normal px-3 py-2 text-left text-sm"
                            >
                                <span className="min-w-0">
                                    <span className="block">{material.label}</span>
                                    {material.description && <span id={`household-material-${material.id}-description`} className="mt-0.5 block text-xs font-normal leading-4">{material.description}</span>}
                                </span>
                                {selected.has(material.id) && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                            </FilterChip>
                        ))}
                        {visibleMaterials.length === 0 && <p role="status" className="col-span-2 py-6 text-center text-sm text-muted-foreground">没有找到这个材料，换个名称试试。</p>}
                    </div>
                    <Button shape="pill" className="mt-auto h-11 shrink-0" onClick={() => setMoreOpen(false)}>选好了，查看项目</Button>
                </SheetContent>
            </Sheet>
        </section>
    )
}
