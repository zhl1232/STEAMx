"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import {
    SLIDE_MIN_ZOOM,
    clampPan,
    clampZoom,
    pinchScale,
    pointerDistance,
    swipePageDelta,
    type Point,
} from "@/lib/courses/slide-viewer";
import { cn } from "@/lib/utils";

/**
 * 换页时由父组件用 key 重新挂载来还原缩放。
 * 课件图片：双指放大、放大后拖动、双击还原；没放大时左右滑翻页。
 */
export function ZoomableSlide({
    src,
    alt,
    onError,
    onSwipe,
    className,
}: {
    src: string;
    alt: string;
    onError?: () => void;
    onSwipe?: (delta: -1 | 1) => void;
    className?: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pointers = useRef(new Map<number, Point>());
    const gesture = useRef<{
        start: Point;
        startScale: number;
        startOffset: Point;
        startDistance: number;
        pinched: boolean;
    } | null>(null);
    const lastTap = useRef(0);
    const [scale, setScale] = useState(SLIDE_MIN_ZOOM);
    const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

    const size = () => {
        const rect = containerRef.current?.getBoundingClientRect();
        return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
    };

    const begin = () => {
        const points = [...pointers.current.values()];
        gesture.current = {
            start: points[0] ?? { x: 0, y: 0 },
            startScale: scale,
            startOffset: offset,
            startDistance: points.length >= 2 ? pointerDistance(points[0], points[1]) : 0,
            pinched: gesture.current?.pinched ?? false,
        };
        if (points.length >= 2 && gesture.current) gesture.current.pinched = true;
    };

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        event.currentTarget.setPointerCapture?.(event.pointerId);
        begin();
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(event.pointerId) || !gesture.current) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const points = [...pointers.current.values()];
        const g = gesture.current;
        if (points.length >= 2 && g.startDistance > 0) {
            const next = pinchScale(g.startScale, g.startDistance, pointerDistance(points[0], points[1]));
            setScale(next);
            setOffset((current) => clampPan(current, next, size()));
        } else if (points.length === 1 && g.startScale > SLIDE_MIN_ZOOM) {
            const p = points[0];
            setOffset(clampPan(
                { x: g.startOffset.x + p.x - g.start.x, y: g.startOffset.y + p.y - g.start.y },
                g.startScale,
                size(),
            ));
        }
    };

    const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        const g = gesture.current;
        pointers.current.delete(event.pointerId);
        if (pointers.current.size > 0) {
            begin();
            return;
        }
        gesture.current = null;
        if (!g) return;
        const end = { x: event.clientX, y: event.clientY };
        if (!g.pinched) {
            const delta = swipePageDelta(g.start, end, scale);
            if (delta !== 0) {
                onSwipe?.(delta);
                return;
            }
            // 双击还原 / 放大
            const now = Date.now();
            if (now - lastTap.current < 300 && pointerDistance(g.start, end) < 10) {
                const next = scale > SLIDE_MIN_ZOOM ? SLIDE_MIN_ZOOM : clampZoom(2);
                setScale(next);
                setOffset({ x: 0, y: 0 });
                lastTap.current = 0;
                return;
            }
            lastTap.current = now;
        }
    };

    return (
        <div
            ref={containerRef}
            data-testid="zoomable-slide"
            data-zoom={scale.toFixed(2)}
            className={cn("absolute inset-0 touch-none select-none overflow-hidden", className)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={alt}
                draggable={false}
                onError={onError}
                className="pointer-events-none h-full w-full object-contain transition-transform duration-75"
                style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
            />
        </div>
    );
}
