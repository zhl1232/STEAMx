"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MobileShortcutCarouselProps {
  children: ReactNode;
}

const activeDotClasses = [
  "bg-[hsl(var(--brand-green)/0.72)]",
  "bg-[hsl(var(--brand-amber)/0.78)]",
];

export function MobileShortcutCarousel({ children }: MobileShortcutCarouselProps) {
  const slides = Children.toArray(children);
  const [activeIndex, setActiveIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);

  const updateActiveIndex = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const slideElements = Array.from(viewport.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    if (slideElements.length === 0) return;

    const viewportRect = viewport.getBoundingClientRect();
    const viewportCenter = viewportRect.left + viewportRect.width / 2;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    slideElements.forEach((slide, index) => {
      const slideRect = slide.getBoundingClientRect();
      const slideCenter = slideRect.left + slideRect.width / 2;
      const distance = Math.abs(slideCenter - viewportCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    setActiveIndex(nearestIndex);
  }, []);

  const scheduleActiveIndexUpdate = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      updateActiveIndex();
    });
  }, [updateActiveIndex]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateActiveIndex();
    viewport.addEventListener("scroll", scheduleActiveIndexUpdate, { passive: true });
    window.addEventListener("resize", scheduleActiveIndexUpdate);

    return () => {
      viewport.removeEventListener("scroll", scheduleActiveIndexUpdate);
      window.removeEventListener("resize", scheduleActiveIndexUpdate);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [scheduleActiveIndexUpdate, updateActiveIndex]);

  const scrollToSlide = useCallback((index: number) => {
    const viewport = viewportRef.current;
    const slide = viewport?.children[index];
    if (!(viewport && slide instanceof HTMLElement)) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const viewportRect = viewport.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    viewport.scrollTo({
      left: viewport.scrollLeft + slideRect.left - viewportRect.left,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, []);

  return (
    <section className="md:hidden" aria-label="首页快捷入口">
      <div
        ref={viewportRef}
        className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, index) => (
          <div key={index} className="min-w-0 grow-0 shrink-0 basis-full snap-start">
            {slide}
          </div>
        ))}
      </div>
      {slides.length > 1 ? (
        <div className="-mt-0.5 flex justify-center" aria-label="首页快捷入口分页">
          {slides.map((_, index) => {
            const active = index === activeIndex;
            return (
              <button
                key={index}
                type="button"
                onClick={() => scrollToSlide(index)}
                className="flex h-8 items-center justify-center px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`第 ${index + 1} 个快捷入口`}
                aria-current={active ? "true" : undefined}
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-[width,background-color] duration-200",
                    active
                      ? cn("w-4", activeDotClasses[index] ?? "bg-[hsl(var(--brand-blue)/0.78)]")
                      : "w-1.5 bg-[hsl(var(--surface-border-strong))]",
                  )}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
