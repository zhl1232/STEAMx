"use client";

import { useEffect, useRef, useState } from "react";

export default function PhysicsLabFrame() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1100);

  useEffect(() => {
    function resize(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const message = event.data;
      if (message?.type !== "steamx-physics-height" || typeof message.height !== "number" || !Number.isFinite(message.height)) return;
      setHeight(Math.max(600, Math.min(6000, Math.ceil(message.height))));
    }
    window.addEventListener("message", resize);
    return () => window.removeEventListener("message", resize);
  }, []);

  return (
    <iframe
      ref={frame}
      src="/physics-lab/index.html?host=steamx"
      title="物理实验室交互工作台"
      className="block w-full border-0"
      style={{ height }}
    />
  );
}
