"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { List, Package, Sparkles, X } from "lucide-react";

import type { CourseLessonStep } from "@/lib/courses/types";
import { LessonRichText } from "./lesson-rich-text";
import { cn } from "@/lib/utils";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Native disclosure keeps every step in the initial HTML and works before hydration. */
export type LessonMenuExtra = {
    key: string;
    label: string;
    icon: "works" | "parts";
    href?: string;
    onSelect?: () => void;
};

export function LessonStepGuide({
    steps,
    partsHref,
    activeStepIndex,
    onStepClick,
    className,
    introduction,
    desktopLabel,
    mobileExtras,
}: {
    steps: CourseLessonStep[];
    partsHref?: string;
    activeStepIndex?: number;
    onStepClick?: (index: number) => void;
    className?: string;
    introduction?: string;
    desktopLabel?: string;
    /** 手机目录菜单顶部的额外入口（如作品、零件清单） */
    mobileExtras?: LessonMenuExtra[];
}) {
    const detailsRef = useRef<HTMLDetailsElement>(null);
    const [open, setOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [mobilePortalContainer, setMobilePortalContainer] = useState<HTMLElement | undefined>();
    const mobileListRef = useRef<HTMLOListElement>(null);

    useEffect(() => {
        const desktop = window.matchMedia("(min-width: 768px)");
        const handleResize = () => { if (desktop.matches) setMobileOpen(false); };
        desktop.addEventListener("change", handleResize);
        return () => desktop.removeEventListener("change", handleResize);
    }, []);
    const navigable = Boolean(onStepClick);
    const close = () => {
        if (!detailsRef.current) return;
        detailsRef.current.open = false;
        detailsRef.current.querySelector("summary")?.focus();
    };

    useEffect(() => {
        if (!open || !navigable) return;
        const dismiss = (event: PointerEvent) => {
            if (event.target instanceof Node && !detailsRef.current?.contains(event.target) && detailsRef.current) {
                detailsRef.current.open = false;
            }
        };
        document.addEventListener("pointerdown", dismiss);
        return () => document.removeEventListener("pointerdown", dismiss);
    }, [open, navigable]);

    useEffect(() => {
        if (!mobileOpen) return;
        const handleFullscreenChange = () => {
            const fullscreenElement = document.fullscreenElement;
            setMobilePortalContainer(fullscreenElement instanceof HTMLElement ? fullscreenElement : undefined);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, [mobileOpen]);

    const handleMobileOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            const fullscreenElement = document.fullscreenElement;
            setMobilePortalContainer(fullscreenElement instanceof HTMLElement ? fullscreenElement : undefined);
        }
        setMobileOpen(nextOpen);
    };

    if (steps.length === 0 && !partsHref) return null;

    return (
        <>
        {navigable ? (
            <Sheet open={mobileOpen} onOpenChange={handleMobileOpenChange}>
                <SheetTrigger asChild>
                    <button type="button" aria-label="课程目录" className={cn("inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-foreground/[0.06] px-4 text-sm font-semibold hover:bg-foreground/10 md:hidden", className)}>
                        <List className="h-4 w-4" aria-hidden />目录
                    </button>
                </SheetTrigger>
                <SheetContent container={mobilePortalContainer} side="bottom" showClose={false} aria-describedby={undefined}
                    className="flex max-h-[80dvh] flex-col gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] motion-reduce:animate-none motion-reduce:transition-none"
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        const current = mobileListRef.current?.querySelector<HTMLButtonElement>('[aria-current="step"]')
                            ?? mobileListRef.current?.querySelector<HTMLButtonElement>('button');
                        current?.focus({ preventScroll: true });
                        current?.scrollIntoView?.({ block: "center" });
                    }}
                >
                    <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
                        <SheetTitle className="text-base">课程目录 <span className="text-sm font-normal text-muted-foreground">· {steps.length} 页</span></SheetTitle>
                        <SheetClose asChild><button type="button" aria-label="关闭课程目录" className="inline-flex h-11 w-11 items-center justify-center rounded-sm hover:bg-muted"><X className="h-5 w-5" aria-hidden /></button></SheetClose>
                    </div>
                    {mobileExtras && mobileExtras.length > 0 ? (
                        <div className="flex shrink-0 gap-2 border-b border-border px-3 py-2.5">
                            {mobileExtras.map((extra) => {
                                const Icon = extra.icon === "works" ? Sparkles : Package;
                                const cls = "inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 text-sm font-semibold hover:bg-foreground/10";
                                return extra.href ? (
                                    <Link key={extra.key} href={extra.href} prefetch={false} className={cls} onClick={() => setMobileOpen(false)}>
                                        <Icon className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{extra.label}</span>
                                    </Link>
                                ) : (
                                    <button key={extra.key} type="button" className={cls} onClick={() => { setMobileOpen(false); extra.onSelect?.(); }}>
                                        <Icon className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{extra.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                    <ol ref={mobileListRef} className="min-h-0 overflow-y-auto overscroll-contain p-3">
                        {steps.map((step, index) => (
                            <li key={`${step.title}-${index}`}>
                                <button type="button" aria-current={index === activeStepIndex ? "step" : undefined}
                                    onClick={() => { onStepClick?.(index); setMobileOpen(false); }}
                                    className={cn("flex min-h-12 w-full items-start gap-3 rounded-md px-3 py-3 text-left text-base hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", index === activeStepIndex && "bg-[hsl(var(--brand-blue)/0.1)] font-semibold text-[hsl(var(--brand-blue))]")}
                                ><span className="w-6 shrink-0 tabular-nums">{index + 1}.</span><span className="min-w-0 break-words">{step.title}</span></button>
                            </li>
                        ))}
                    </ol>
                </SheetContent>
            </Sheet>
        ) : null}
        <details
            ref={detailsRef}
            onToggle={(event) => setOpen(event.currentTarget.open)}
            onKeyDown={(event) => { if (event.key === "Escape" && navigable) { event.preventDefault(); close(); } }}
            className={cn(navigable ? "relative hidden shrink-0 md:block" : "shrink-0 border-b border-border bg-card", className)}
        >
            <summary aria-label={navigable ? "桌面课程目录" : undefined} className={cn("min-h-11 cursor-pointer px-4 py-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--brand-blue))]", navigable && "flex h-10 min-h-0 list-none items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 py-0 font-semibold hover:bg-foreground/10 [&::-webkit-details-marker]:hidden")}>
                {navigable ? <List className="h-4 w-4" aria-hidden /> : null}
                <h2 className="inline font-semibold">
                    {navigable && desktopLabel ? <><span className="xl:hidden">目录</span><span className="hidden xl:inline">{desktopLabel}</span></> : navigable ? "目录" : "本课步骤与提示"}
                    {steps.length > 0 && !navigable ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">共 {steps.length} 步</span>
                    ) : null}
                </h2>
            </summary>
            <div
                role="region"
                aria-label="本课全部步骤与提示"
                tabIndex={0}
                className={cn("max-h-[min(50dvh,28rem)] overflow-y-auto overscroll-contain px-4 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--brand-blue))]", navigable && "absolute right-0 top-full z-50 w-[min(22rem,calc(100vw-6rem))] rounded-md border border-border bg-card p-3 shadow-lg")}
            >
                {navigable ? (
                    <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-2">
                        <p className="text-sm font-semibold">课程目录 <span className="font-normal text-muted-foreground">· {steps.length} 页</span></p>
                        <button type="button" aria-label="关闭课程目录" onClick={close} className="inline-flex h-11 w-11 items-center justify-center rounded-sm hover:bg-muted"><X className="h-4 w-4" /></button>
                    </div>
                ) : null}
                {partsHref ? (
                    <Link
                        href={partsHref}
                        prefetch={false}
                        className="mb-3 inline-flex min-h-11 items-center text-sm font-medium text-[hsl(var(--nav-active))] underline underline-offset-4"
                    >
                        查看本课零件清单
                    </Link>
                ) : null}
                {introduction ? <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{introduction}</p> : null}
                {steps.length > 0 ? (
                    <ol className="space-y-4">
                        {steps.map((step, index) => (
                            <li key={`${step.title}-${index}`}>
                                <h3 className="text-sm font-semibold text-foreground">
                                    {onStepClick ? <button
                                        type="button"
                                        aria-current={index === activeStepIndex ? "step" : undefined}
                                        onClick={() => { onStepClick(index); close(); }}
                                        className={cn("min-h-11 w-full rounded-sm px-2 py-2 text-left hover:bg-muted", index === activeStepIndex && "bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]")}
                                    >
                                        {index + 1}. {step.title}
                                    </button> : <>
                                    {index + 1}. {step.title}
                                    </>}
                                </h3>
                                {step.description ? (
                                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                                        <LessonRichText text={step.description} />
                                    </p>
                                ) : null}
                                {step.hint ? (
                                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                                        <span className="font-medium text-foreground">提示：</span>
                                        <LessonRichText text={step.hint} />
                                    </p>
                                ) : null}
                            </li>
                        ))}
                    </ol>
                ) : null}
            </div>
        </details>
        </>
    );
}
