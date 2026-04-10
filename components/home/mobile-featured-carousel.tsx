"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Leaf } from "lucide-react";

import { homeFeaturedSlides } from "@/lib/home-featured-slides";
import { cn } from "@/lib/utils";

export function MobileFeaturedCarousel() {
    const [activeIndex, setActiveIndex] = useState(0);
    const hasMultiple = homeFeaturedSlides.length > 1;

    const goTo = (nextIndex: number) => {
        const total = homeFeaturedSlides.length;
        setActiveIndex(((nextIndex % total) + total) % total);
    };

    useEffect(() => {
        if (!hasMultiple) return;

        const timer = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % homeFeaturedSlides.length);
        }, 3000);

        return () => window.clearInterval(timer);
    }, [hasMultiple]);

    return (
        <div className="px-4 pt-4 pb-2">
            <div className="relative overflow-hidden rounded-2xl">
                <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${activeIndex * 100}%)` }}
                >
                    {homeFeaturedSlides.map((slide) => (
                        <div key={slide.id} className="min-w-full">
                            <Link href={slide.primaryHref} className="group block">
                            <div className="relative aspect-[21/9] overflow-hidden rounded-2xl border shadow-sm transition-transform duration-300 group-active:scale-[0.99]">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,245,210,0.85),transparent_20%),linear-gradient(180deg,#f5efe2_0%,#dce8d8_36%,#8eb39e_70%,#587f74_100%)]" />
                                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.6),transparent_24%),radial-gradient(circle_at_75%_30%,rgba(255,255,255,0.35),transparent_18%)]" />
                                <div className="absolute inset-x-0 bottom-0 h-[48%] bg-[linear-gradient(180deg,rgba(42,67,60,0.02),rgba(42,67,60,0.38))]" />
                                <div className="absolute right-0 bottom-0 h-[42%] w-[34%] opacity-80">
                                    <div className="absolute left-[18%] bottom-0 h-[64%] w-[2px] bg-[#40695b]" />
                                    <div className="absolute left-[34%] bottom-0 h-[80%] w-[2px] bg-[#487360]" />
                                    <div className="absolute left-[50%] bottom-0 h-[56%] w-[2px] bg-[#3f6a59]" />
                                    <div className="absolute left-[68%] bottom-0 h-[72%] w-[2px] bg-[#4b7765]" />
                                    <div className="absolute left-[84%] bottom-0 h-[60%] w-[2px] bg-[#426c5d]" />
                                </div>
                                <div className="absolute left-[73%] top-[26%] h-4 w-8 rotate-6 rounded-full border-t-2 border-[#28463f]/65" />
                                <div className="absolute left-[80%] top-[23%] h-3 w-5 -rotate-3 rounded-full border-t-2 border-[#28463f]/55" />
                                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(24,41,36,0.9)_0%,rgba(24,41,36,0.72)_38%,rgba(24,41,36,0.24)_66%,rgba(24,41,36,0)_86%)]" />

                                <div className="relative z-10 flex h-full flex-col p-4 text-white">
                                    <div className="pt-1">
                                        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/65 bg-white px-2.5 py-1 text-[10px] font-semibold text-[#16372d] shadow-sm">
                                            <Leaf className="h-3 w-3 text-[#16372d]" />
                                            {slide.eyebrow}
                                        </div>
                                    </div>

                                    <div className="mt-5">
                                        <h3 className="max-w-[60%] text-[30px] font-bold leading-[1.02] tracking-[-0.03em] text-[#fffdf8]">
                                            {slide.title}
                                        </h3>
                                    </div>

                                    <div className="mt-auto max-w-[62%]">
                                        <p className="text-[13px] leading-[1.55] text-[#fff8ee]">
                                            {slide.description}
                                        </p>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <span
                                                className="inline-flex items-center rounded-full bg-[#fffdf6] px-3.5 py-2 text-xs font-semibold text-[#31574b] shadow-sm"
                                            >
                                                {slide.primaryLabel}
                                                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                            </span>
                                            <span className="inline-flex items-center rounded-full border border-white/45 bg-white/8 px-3 py-2 text-[11px] font-medium text-white/92 backdrop-blur-sm">
                                                {slide.secondaryLabel}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </Link>
                        </div>
                    ))}
                </div>

            </div>

            <div className="mt-3 flex items-center justify-center gap-2">
                {homeFeaturedSlides.map((slide, index) => (
                    <button
                        key={slide.id}
                        type="button"
                        onClick={() => goTo(index)}
                        className={cn(
                            "h-2 rounded-full transition-all",
                            index === activeIndex ? "w-6 bg-emerald-500" : "w-2 bg-muted-foreground/25"
                        )}
                        aria-label={`查看专题 ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}
