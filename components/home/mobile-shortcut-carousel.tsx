"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface MobileShortcutCarouselProps {
  children: ReactNode;
  slideCount: number;
  className?: string;
}

export function MobileShortcutCarouselFrame({
  children,
  slideCount,
  className,
}: MobileShortcutCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateActiveIndex = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || slideCount <= 1) {
      setActiveIndex(0);
      return;
    }

    const slides = Array.from(scroller.children) as HTMLElement[];
    const current = slides.reduce(
      (nearest, slide, index) => {
        const distance = Math.abs(slide.offsetLeft - scroller.scrollLeft);
        return distance < nearest.distance ? { index, distance } : nearest;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    );

    setActiveIndex(current.index);
  }, [slideCount]);

  const scrollToSlide = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    const slide = scroller?.children[index] as HTMLElement | undefined;
    if (!scroller || !slide) return;

    scroller.scrollTo({
      left: slide.offsetLeft,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    updateActiveIndex();
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let frame = 0;
    const handleScroll = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateActiveIndex);
    };

    scroller.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [updateActiveIndex]);

  return (
    <section className={cn("md:hidden", className)} aria-label="首页快捷入口">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div className="mt-0.5 flex justify-center gap-1" aria-label="快捷入口位置">
        {Array.from({ length: slideCount }, (_, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={index}
              type="button"
              onClick={() => scrollToSlide(index)}
              className="grid h-4 w-5 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`显示第 ${index + 1} 个快捷入口`}
              aria-current={active ? "true" : undefined}
            >
              <span
                className={cn(
                  "block h-1 rounded-full transition-[width,background-color] duration-200",
                  active ? "w-4 bg-[hsl(var(--brand-green)/0.72)]" : "w-1 bg-[hsl(var(--surface-border-strong))]",
                )}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
