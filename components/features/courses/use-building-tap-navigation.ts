"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

const TAP_SLOP_PX = 8;
const TAP_MAX_MS = 350;

/** Observe taps without capturing pointers or consuming OrbitControls events. */
export function useBuildingTapNavigation({
    surfaceRef,
    enabled,
    pageKey,
    onTap,
}: {
    surfaceRef: RefObject<HTMLDivElement | null>;
    enabled: boolean;
    pageKey: number;
    onTap: (xRatio: number) => void;
}) {
    const latest = useRef({ enabled, pageKey, onTap });
    useLayoutEffect(() => { latest.current = { enabled, pageKey, onTap }; });

    useLayoutEffect(() => {
        const surface = surfaceRef.current;
        if (!enabled || !surface) return;
        const doc = surface.ownerDocument;
        const win = doc.defaultView;
        const pointers = new Set<number>();
        let candidate: { id: number; x: number; y: number; started: number } | null = null;
        let generation = 0;
        let disposed = false;
        const cancel = () => { candidate = null; generation += 1; };
        const inside = (target: EventTarget | null) => target instanceof Node && surface.contains(target);
        const down = (event: PointerEvent) => {
            cancel();
            pointers.add(event.pointerId);
            if (pointers.size !== 1 || !event.isPrimary || event.button !== 0 ||
                event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !inside(event.target)) return;
            candidate = { id: event.pointerId, x: event.clientX, y: event.clientY, started: Date.now() };
        };
        const move = (event: PointerEvent) => {
            if (candidate?.id !== event.pointerId) return;
            // Check every sample, including a drag that returns to its starting point.
            const samples = [...(event.getCoalescedEvents?.() ?? []), event];
            if (samples.some((sample) => Math.hypot(sample.clientX - candidate!.x, sample.clientY - candidate!.y) >= TAP_SLOP_PX)) cancel();
        };
        const up = (event: PointerEvent) => {
            move(event);
            const tap = candidate;
            candidate = null;
            pointers.delete(event.pointerId);
            if (!tap || tap.id !== event.pointerId || pointers.size || Date.now() - tap.started > TAP_MAX_MS) return;
            const rect = surface.getBoundingClientRect();
            if (rect.width <= 0 || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
            // Pointer capture can target the canvas even when the finger ends over a panel.
            if (doc.elementFromPoint && !inside(doc.elementFromPoint(event.clientX, event.clientY))) return;
            const currentGeneration = generation;
            const xRatio = (event.clientX - rect.left) / rect.width;
            // Let OrbitControls finish pointerup/releasePointerCapture before changing pages.
            queueMicrotask(() => {
                if (!disposed && generation === currentGeneration && latest.current.enabled && latest.current.pageKey === pageKey) {
                    latest.current.onTap(xRatio);
                }
            });
        };
        const pointerCancel = (event: PointerEvent) => { pointers.delete(event.pointerId); cancel(); };
        const lostCapture = (event: PointerEvent) => {
            // The normal release after pointerup must not cancel an already completed tap.
            if (candidate?.id === event.pointerId) cancel();
        };
        doc.addEventListener("pointerdown", down, true);
        doc.addEventListener("pointermove", move, true);
        doc.addEventListener("pointerup", up, true);
        doc.addEventListener("pointercancel", pointerCancel, true);
        doc.addEventListener("lostpointercapture", lostCapture, true);
        doc.addEventListener("contextmenu", cancel, true);
        doc.addEventListener("wheel", cancel, { capture: true, passive: true });
        doc.addEventListener("visibilitychange", cancel);
        win?.addEventListener("blur", cancel);
        win?.addEventListener("resize", cancel);
        return () => {
            disposed = true;
            doc.removeEventListener("pointerdown", down, true);
            doc.removeEventListener("pointermove", move, true);
            doc.removeEventListener("pointerup", up, true);
            doc.removeEventListener("pointercancel", pointerCancel, true);
            doc.removeEventListener("lostpointercapture", lostCapture, true);
            doc.removeEventListener("contextmenu", cancel, true);
            doc.removeEventListener("wheel", cancel, true);
            doc.removeEventListener("visibilitychange", cancel);
            win?.removeEventListener("blur", cancel);
            win?.removeEventListener("resize", cancel);
        };
    }, [enabled, pageKey, surfaceRef]);
}
