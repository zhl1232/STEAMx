import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBuildingTapNavigation } from "./use-building-tap-navigation";

function Harness({ onTap, enabled = true, pageKey = 0 }: { onTap: (ratio: number) => void; enabled?: boolean; pageKey?: number }) {
    const surfaceRef = useRef<HTMLDivElement>(null);
    useBuildingTapNavigation({ surfaceRef, enabled, pageKey, onTap });
    return <><div ref={surfaceRef} data-testid="surface"><canvas /></div><button>面板操作</button></>;
}

async function pointer(type: string, x = 90, options: PointerEventInit = {}, target: Element = screen.getByTestId("surface")) {
    const event = new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: "touch", isPrimary: true, button: 0, clientX: x, clientY: 50, ...options });
    await act(async () => { fireEvent(target, event); });
    expect(event.defaultPrevented).toBe(false);
}

describe("3D short taps alongside OrbitControls", () => {
    let hit: Element;
    const onTap = vi.fn();
    beforeEach(() => {
        vi.useFakeTimers();
        onTap.mockClear();
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 } as DOMRect);
        vi.spyOn(document, "elementFromPoint").mockImplementation(() => hit);
    });
    afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
    function setup() {
        const result = render(<Harness onTap={onTap} />);
        hit = screen.getByTestId("surface");
        return result;
    }

    it("reports left, middle and right short taps, without swallowing pointer events", async () => {
        setup();
        for (const x of [10, 50, 90]) {
            await pointer("pointerdown", x);
            await pointer("pointerup", x);
        }
        expect(onTap.mock.calls).toEqual([[0.1], [0.5], [0.9]]);
    });

    it("rejects rotation even if the finger returns to its starting point", async () => {
        setup();
        await pointer("pointerdown");
        await pointer("pointermove", 60);
        await pointer("pointermove", 90);
        await pointer("pointerup");
        expect(onTap).not.toHaveBeenCalled();
    });

    it("rejects movement included only in coalesced samples", async () => {
        setup();
        await pointer("pointerdown");
        const event = new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: 90, clientY: 50 });
        Object.defineProperty(event, "getCoalescedEvents", { value: () => [{ clientX: 60, clientY: 50 }] });
        fireEvent(hit, event);
        await pointer("pointerup");
        expect(onTap).not.toHaveBeenCalled();
    });

    it.each([false, true])("rejects both pinch release orders, including a second finger on UI (%s)", async (secondFirst) => {
        setup();
        await pointer("pointerdown");
        await pointer("pointerdown", 10, { pointerId: 2, isPrimary: false }, screen.getByRole("button"));
        for (const id of secondFirst ? [2, 1] : [1, 2]) await pointer("pointerup", 90, { pointerId: id });
        expect(onTap).not.toHaveBeenCalled();
        await pointer("pointerdown");
        await pointer("pointerup");
        expect(onTap).toHaveBeenCalledOnce();
    });

    it("rejects long presses and non-primary / modified buttons", async () => {
        setup();
        await pointer("pointerdown");
        vi.advanceTimersByTime(351);
        await pointer("pointerup");
        for (const options of [{ button: 2 }, { isPrimary: false }, { ctrlKey: true }]) {
            await pointer("pointerdown", 90, options);
            await pointer("pointerup");
        }
        expect(onTap).not.toHaveBeenCalled();
    });

    it.each(["pointercancel", "lostpointercapture", "contextmenu", "wheel", "resize", "blur", "visibilitychange"])("rejects %s during a gesture", async (type) => {
        setup();
        await pointer("pointerdown");
        if (type.startsWith("pointer") || type === "lostpointercapture") await pointer(type);
        else fireEvent(type === "resize" || type === "blur" ? window : document, new Event(type));
        await pointer("pointerup");
        expect(onTap).not.toHaveBeenCalled();
    });

    it("ignores panel interactions and captured pointer releases over UI or outside the surface", async () => {
        setup();
        const button = screen.getByRole("button");
        await pointer("pointerdown", 90, {}, button);
        await pointer("pointerup", 90, {}, button);
        await pointer("pointerdown");
        hit = button;
        await pointer("pointerup");
        hit = screen.getByTestId("surface");
        await pointer("pointerdown", 99);
        await pointer("pointerup", 101);
        expect(onTap).not.toHaveBeenCalled();
    });

    it("invalidates held gestures across page changes, exit/reentry and unmount", async () => {
        const { rerender, unmount } = setup();
        await pointer("pointerdown");
        rerender(<Harness onTap={onTap} pageKey={1} />);
        await pointer("pointerup");
        await pointer("pointerdown");
        rerender(<Harness onTap={onTap} enabled={false} />);
        rerender(<Harness onTap={onTap} />);
        await pointer("pointerup");
        await pointer("pointerdown");
        unmount();
        await pointer("pointerup", 90, {}, document.body);
        expect(onTap).not.toHaveBeenCalled();
    });

    it("runs after native pointerup handlers and accepts their normal capture release", async () => {
        setup();
        const finished = vi.fn();
        const release = () => {
            expect(onTap).not.toHaveBeenCalled();
            fireEvent(hit, new PointerEvent("lostpointercapture", { bubbles: true, pointerId: 1 }));
            finished();
        };
        document.addEventListener("pointerup", release, { once: true });
        await pointer("pointerdown");
        await pointer("pointerup");
        expect(finished).toHaveBeenCalledOnce();
        expect(onTap).toHaveBeenCalledOnce();
    });
});
