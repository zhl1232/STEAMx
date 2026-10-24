import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZoomableSlide } from "./zoomable-slide";

function tap() {
    const slide = screen.getByTestId("zoomable-slide");
    fireEvent.pointerDown(slide, { pointerId: 1, clientX: 90, clientY: 50 });
    fireEvent.pointerUp(slide, { pointerId: 1, clientX: 90, clientY: 50 });
}

describe("slide tap lifecycle", () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-24T12:00:00Z")); });
    afterEach(() => { cleanup(); vi.useRealTimers(); });
    it("does not dispatch a delayed tap after switching to 3D / unmounting", () => {
        const onTap = vi.fn();
        const { unmount } = render(<ZoomableSlide src="/slide.png" alt="课件" onTap={onTap} />);
        tap();
        unmount();
        act(() => vi.advanceTimersByTime(300));
        expect(onTap).not.toHaveBeenCalled();
    });
    it("clears delayed taps on fullscreen exit and reentry", () => {
        const onTap = vi.fn();
        const { rerender } = render(<ZoomableSlide src="/slide.png" alt="课件" onTap={onTap} />);
        tap();
        rerender(<ZoomableSlide src="/slide.png" alt="课件" />);
        rerender(<ZoomableSlide src="/slide.png" alt="课件" onTap={onTap} />);
        act(() => vi.advanceTimersByTime(300));
        expect(onTap).not.toHaveBeenCalled();
        tap();
        act(() => vi.advanceTimersByTime(300));
        expect(onTap).toHaveBeenCalledOnce();
    });
    it("does not treat pointercancel as a swipe or a tap", () => {
        const onTap = vi.fn();
        const onSwipe = vi.fn();
        render(<ZoomableSlide src="/slide.png" alt="课件" onTap={onTap} onSwipe={onSwipe} />);
        const slide = screen.getByTestId("zoomable-slide");
        for (const clientX of [90, 10]) {
            fireEvent.pointerDown(slide, { pointerId: 1, clientX: 90, clientY: 50 });
            fireEvent.pointerCancel(slide, { pointerId: 1, clientX, clientY: 50 });
            fireEvent.pointerUp(slide, { pointerId: 1, clientX, clientY: 50 });
        }
        act(() => vi.advanceTimersByTime(300));
        expect(onTap).not.toHaveBeenCalled();
        expect(onSwipe).not.toHaveBeenCalled();
    });
});
