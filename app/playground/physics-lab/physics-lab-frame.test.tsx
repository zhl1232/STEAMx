import { act, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import PhysicsLabFrame from "./physics-lab-frame";

it("only accepts finite, bounded heights from the embedded lab on the same origin", () => {
  render(<PhysicsLabFrame />);
  const frame = screen.getByTitle("物理实验室交互工作台") as HTMLIFrameElement;
  const send = (height: unknown, origin = window.location.origin, source = frame.contentWindow) => {
    act(() => window.dispatchEvent(new MessageEvent("message", {
      origin, source, data: { type: "steamx-physics-height", height },
    })));
  };
  send(900); expect(frame.style.height).toBe("900px");
  send(1200, "https://unrelated.example"); expect(frame.style.height).toBe("900px");
  send(1200, window.location.origin, window); expect(frame.style.height).toBe("900px");
  send(Infinity); send("1200"); expect(frame.style.height).toBe("900px");
  send(1); expect(frame.style.height).toBe("600px");
  send(100000); expect(frame.style.height).toBe("6000px");
});
