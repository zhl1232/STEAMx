"use client"

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react"
import { SlidersHorizontal, X, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** An in-root disclosure so fullscreen and keyboard input remain available together. */
export function ImmersiveControls({ immersive, children, closeVersion = 0 }: { immersive: boolean; children: ReactNode; closeVersion?: number }) {
    const [open, setOpen] = useState(false)
    const [previousImmersive, setPreviousImmersive] = useState(immersive)
    const [previousCloseVersion, setPreviousCloseVersion] = useState(closeVersion)
    if (previousCloseVersion !== closeVersion) {
        setPreviousCloseVersion(closeVersion)
        setOpen(false)
    }
    const panelId = useId()
    const triggerRef = useRef<HTMLButtonElement>(null)
    const closeRef = useRef<HTMLButtonElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)
    const close = useCallback(() => {
        setOpen(false)
        triggerRef.current?.focus({ preventScroll: true })
    }, [])

    // Reset the disclosure when its layout changes, keeping the tools mounted.
    if (previousImmersive !== immersive) {
        setPreviousImmersive(immersive)
        setOpen(false)
    }

    useEffect(() => {
        if (!immersive || !open) return
        const onEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || panelRef.current?.closest("[hidden]")) return
            event.preventDefault()
            event.stopPropagation()
            close()
        }
        document.addEventListener("keydown", onEscape, true)
        return () => document.removeEventListener("keydown", onEscape, true)
    }, [close, immersive, open])

    return (
        <>
            <Button ref={triggerRef} type="button" variant="outline" hidden={!immersive} className="function-wars-operations-trigger min-h-11 gap-2" aria-expanded={open} aria-controls={panelId} onClick={() => {
                setOpen(true)
                requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }))
            }}><SlidersHorizontal className="h-4 w-4" aria-hidden />操作</Button>
            <div ref={panelRef} id={panelId} className="function-wars-tools" onClickCapture={(event) => {
                if (immersive && (event.target as HTMLElement).closest("[data-function-wars-mode]")) setOpen(false)
            }} hidden={immersive && !open} onKeyDownCapture={(event) => {
                if (immersive && open && event.key === "Escape") {
                    event.preventDefault()
                    event.stopPropagation()
                    close()
                }
            }}>
                <div className="function-wars-tools-heading" hidden={!immersive}>
                    <h2 className="text-sm font-semibold">战场操作</h2>
                    <Button ref={closeRef} type="button" variant="ghost" className="min-h-11 gap-1" onClick={close}><X className="h-4 w-4" aria-hidden />关闭操作</Button>
                </div>
                {children}
            </div>
        </>
    )
}

/** A compact chooser within the fullscreen root. */
export function BattleWeaponReadout({ name, icon: Icon, ammunition, children }: { name: string; icon: LucideIcon; ammunition: number | null | undefined; children?: ReactNode }) {
    const count = ammunition == null ? "∞" : ammunition
    const [open, setOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const panelId = useId()
    const close = () => { setOpen(false); triggerRef.current?.focus({ preventScroll: true }) }
    if (!children) return <div className="function-wars-current-weapon" aria-label={`当前武器：${name}，弹药 ${count}`}>
        <Icon className="function-wars-current-weapon-icon" aria-hidden /><span className="function-wars-current-weapon-name">{name}</span><span className="function-wars-current-ammo" aria-hidden>{count}</span>
    </div>
    return (
        <div className="function-wars-weapon-chooser" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
        }} onKeyDown={(event) => {
            if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close() }
        }}>
        <button ref={triggerRef} type="button" className="function-wars-current-weapon" aria-expanded={children ? open : undefined} aria-controls={children ? panelId : undefined} onClick={() => setOpen((value) => !value)} aria-label={`当前武器：${name}，弹药 ${count}`}>
            <Icon className="function-wars-current-weapon-icon" aria-hidden />
            <span className="function-wars-current-weapon-name">{name}</span>
            <span className="function-wars-current-ammo" aria-hidden>{count}</span>
        </button>
        {children ? <div id={panelId} className="function-wars-weapon-options" hidden={!open} onClick={(event) => {
            if ((event.target as HTMLElement).closest("button:not(:disabled)")) close()
        }}>{children}</div> : null}
        </div>
    )
}
