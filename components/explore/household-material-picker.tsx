"use client"

import { useRef, useState, type MouseEvent } from 'react'
import { Balloon, Check, ChevronDown, ChevronRight, CupSoda, Droplets, Box, Flashlight, Paintbrush, Pipette, ScrollText, Search, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { HOUSEHOLD_MATERIAL_GROUPS, getMaterialSelectionCount } from '@/lib/explore/material-matching'
import { MATERIAL_SECTIONS } from '@/lib/explore/material-groups'
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
    const [openSections, setOpenSections] = useState<ReadonlySet<string>>(new Set())
    const moreTrigger = useRef<HTMLButtonElement>(null)
    const selected = new Set(selectedIds)
    const selectedGroups = HOUSEHOLD_MATERIAL_GROUPS.filter((group) => selected.has(group.id) || group.memberIds.some((id) => selected.has(id)))
    const selectedGroupIds = new Set(selectedGroups.map(({ id }) => id))
    const quickMaterials = HOUSEHOLD_MATERIAL_GROUPS.filter((group) => group.common).slice(0, 5)
    const quickIds = new Set(quickMaterials.map((group) => group.id))
    const extraSelected = selectedGroups.filter((group) => !quickIds.has(group.id))
    const selectedCount = getMaterialSelectionCount(selectedIds)
    const query = search.trim().toLocaleLowerCase()
    const featuredMaterials = HOUSEHOLD_MATERIAL_GROUPS.filter((material) => material.featured)
    const visibleMaterials = HOUSEHOLD_MATERIAL_GROUPS.filter((material) =>
        query && `${material.label} ${material.aliases?.join(' ') ?? ''}`.toLocaleLowerCase().includes(query))

    const toggle = (id: string) => {
        const group = HOUSEHOLD_MATERIAL_GROUPS.find((material) => material.id === id)!
        const remaining = selectedIds.filter((value) => value !== id && !group.memberIds.includes(value))
        onChange(selectedGroupIds.has(id) ? remaining : [...remaining, id])
    }

    const openMore = (event: MouseEvent<HTMLButtonElement>) => {
        moreTrigger.current = event.currentTarget
        setSearch('')
        setOpenSections(new Set())
        setMoreOpen(true)
    }

    const materialGrid = (materials: typeof HOUSEHOLD_MATERIAL_GROUPS, label: string) => (
        <div role="group" aria-label={label} className="grid auto-rows-max grid-cols-2 content-start items-start gap-2">
            {materials.map((material) => (
                <FilterChip
                    key={material.id}
                    active={selectedGroupIds.has(material.id)}
                    aria-pressed={selectedGroupIds.has(material.id)}
                    aria-label={material.label}
                    onClick={() => toggle(material.id)}
                    className="h-auto min-h-12 min-w-0 self-start justify-between gap-1 whitespace-normal px-3 py-2 text-left text-sm leading-5"
                >
                    <span className="min-w-0 [overflow-wrap:anywhere]">{material.label}</span>
                    {selectedGroupIds.has(material.id) && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                </FilterChip>
            ))}
        </div>
    )

    const toggleSection = (id: string) => {
        setOpenSections((previous) => {
            const next = new Set(previous)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    return (
        <section aria-labelledby="household-materials-title" className="mb-4 space-y-0" data-testid="household-material-picker">
            <div className="flex items-center justify-between gap-3">
                <h2 id="household-materials-title" className="text-base font-semibold text-foreground">我家有什么</h2>
                <Button variant="ghost" className="-mr-2 h-11 shrink-0 gap-0.5 px-2 text-muted-foreground hover:text-foreground" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={openMore}>
                    更多材料<ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
            </div>

            <div className="flex min-w-0 items-center gap-2">
                <div role="group" aria-label="常见材料" className="flex min-w-0 flex-1 gap-1 md:gap-1.5" data-testid="common-materials-strip">
                    {quickMaterials.map((material) => {
                        const Icon = material.memberIds.map((id) => MATERIAL_ICONS[id]).find(Boolean) ?? Box
                        const active = selectedGroupIds.has(material.id)
                        return (
                            <FilterChip
                                key={material.id}
                                active={active}
                                aria-pressed={active}
                                aria-label={material.label}
                                onClick={() => toggle(material.id)}
                                size="md"
                                shape="pill"
                                className="relative my-1.5 h-8 min-w-0 flex-1 gap-1 px-1 text-xs font-medium shadow-none after:absolute after:inset-x-0 after:-inset-y-1.5 md:h-8 md:flex-none md:px-2.5"
                            >
                                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                {material.label}
                            </FilterChip>
                        )
                    })}
                </div>
            </div>

            {extraSelected.length > 0 && (
                <div role="group" aria-label="其他已选材料" className="flex flex-wrap gap-x-1.5 gap-y-0">
                    {extraSelected.map((material) => (
                        <FilterChip key={material.id} active shape="pill" className="relative my-1.5 h-8 gap-1 px-2.5 py-0 shadow-none after:absolute after:inset-x-0 after:-inset-y-1.5" aria-label={`移除${material.label}`} onClick={() => toggle(material.id)}>
                            {material.label}<X className="h-3 w-3" aria-hidden />
                        </FilterChip>
                    ))}
                </div>
            )}

            {selectedCount > 0 && <div className="flex items-center justify-between gap-3 text-xs leading-5 text-muted-foreground">
                <p aria-live="polite" aria-atomic="true">
                    已选 {selectedCount} 样 · <span className={cn(matchedCount > 0 && 'font-medium text-[hsl(var(--status-success))]')}>{matchedCount > 0 ? `${matchedCount} 个项目材料已匹配` : '已按已有材料排序'}</span>
                </p>
                <Button variant="ghost" size="sm" className="h-11 shrink-0 px-2 text-muted-foreground" aria-label="清空已选材料" onClick={() => onChange([])}>清空</Button>
            </div>}

            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                <SheetContent className="flex w-full flex-col sm:max-w-md" onCloseAutoFocus={(event) => {
                    event.preventDefault()
                    moreTrigger.current?.focus()
                }}>
                    <SheetHeader className="text-left">
                        <SheetTitle>选择家里已有的材料</SheetTitle>
                        <SheetDescription>选择家里有的材料，具体要求在项目里查看。</SheetDescription>
                    </SheetHeader>
                    <div className="relative shrink-0">
                        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
                        <Input aria-label="搜索材料" placeholder="搜索材料，如胶带、白纸" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 pl-9" />
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-2" data-testid="material-options-scroll">
                        <div role="group" aria-label="全部材料" className="space-y-4">
                            {query ? (
                                visibleMaterials.length > 0
                                    ? materialGrid(visibleMaterials, '搜索结果')
                                    : <p role="status" className="py-6 text-center text-sm text-muted-foreground">没有找到这个材料，换个名称试试。</p>
                            ) : (
                                <>
                                    <div>
                                        <h3 className="mb-2 text-sm font-medium text-muted-foreground">常用材料</h3>
                                        {materialGrid(featuredMaterials, '常用材料')}
                                    </div>
                                    <div>
                                        {MATERIAL_SECTIONS.map((section) => {
                                            const materials = HOUSEHOLD_MATERIAL_GROUPS.filter((material) => material.section === section.id)
                                            if (materials.length === 0) return null
                                            const open = openSections.has(section.id)
                                            return (
                                                <details key={section.id} open={open} className="group border-b border-border/60 last:border-b-0">
                                                    <summary
                                                        className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
                                                        onClick={(event) => {
                                                            event.preventDefault()
                                                            toggleSection(section.id)
                                                        }}
                                                    >
                                                        {section.label}
                                                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                                                    </summary>
                                                    {open && <div className="pb-3">{materialGrid(materials, section.label)}</div>}
                                                </details>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <Button shape="pill" className="mt-auto h-11 shrink-0" onClick={() => setMoreOpen(false)}>选好了，查看项目</Button>
                </SheetContent>
            </Sheet>
        </section>
    )
}
