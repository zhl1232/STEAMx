"use client"

import { CircleHelp, Gamepad2, Medal, Target } from "lucide-react"

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export type GameHelpShortcut = {
    key: string
    label: string
}

type GameHelpProps = {
    name: string
    description: string
    mission: string
    controls: string
    badgeGoal: string
    shortcuts: GameHelpShortcut[]
    triggerClassName?: string
}

export function GameHelp({
    name,
    description,
    mission,
    controls,
    badgeGoal,
    shortcuts,
    triggerClassName,
}: GameHelpProps) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "grid h-11 w-11 place-items-center rounded-sm border border-[hsl(var(--surface-border))] bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        triggerClassName,
                    )}
                    aria-label={`${name}玩法说明`}
                    title="玩法说明"
                >
                    <CircleHelp className="h-5 w-5" />
                </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[82dvh] overflow-y-auto rounded-t-xl px-4 pb-8 pt-5 sm:mx-auto sm:max-w-lg sm:px-6">
                <SheetHeader className="pr-8 text-left">
                    <SheetTitle>{name}怎么玩</SheetTitle>
                    <SheetDescription>{description}</SheetDescription>
                </SheetHeader>

                <div className="mt-5 space-y-3">
                    <HelpSection icon={Target} label="本局目标">
                        {mission}
                    </HelpSection>
                    <HelpSection icon={Gamepad2} label="操作说明">
                        {controls}
                    </HelpSection>

                    <div className="rounded-md border border-border bg-muted/20 p-4">
                        <h3 className="text-xs font-black text-foreground">快捷操作</h3>
                        <ul className="mt-3 space-y-2">
                            {shortcuts.map((shortcut) => (
                                <li key={`${shortcut.key}-${shortcut.label}`} className="flex items-center justify-between gap-4 text-sm">
                                    <kbd className="shrink-0 rounded-sm border border-border bg-background px-2 py-1 font-mono text-xs font-bold shadow-xs">
                                        {shortcut.key}
                                    </kbd>
                                    <span className="text-right text-muted-foreground">{shortcut.label}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <HelpSection icon={Medal} label="挑战目标">
                        {badgeGoal}
                    </HelpSection>
                </div>
            </SheetContent>
        </Sheet>
    )
}

function HelpSection({
    icon: Icon,
    label,
    children,
}: {
    icon: typeof Target
    label: string
    children: string
}) {
    return (
        <section className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
                <h3 className="text-xs font-black text-foreground">{label}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p>
            </div>
        </section>
    )
}
