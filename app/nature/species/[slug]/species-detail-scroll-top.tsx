"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

export function SpeciesDetailScrollTop() {
  const pathname = usePathname();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  useLayoutEffect(() => {
    scrollToTop();
  }, [pathname]);

  useEffect(() => {
    scrollToTop();

    const frame = requestAnimationFrame(() => {
      scrollToTop();
      requestAnimationFrame(scrollToTop);
    });
    const timers = [80, 180, 360].map((delay) => window.setTimeout(scrollToTop, delay));

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(window.clearTimeout);
    };
  }, [pathname]);

  return null;
}
