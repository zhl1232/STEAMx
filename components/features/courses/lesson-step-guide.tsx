import Link from "next/link";

import type { CourseLessonStep } from "@/lib/courses/types";
import { LessonRichText } from "./lesson-rich-text";

/** Native disclosure keeps every step in the initial HTML and works before hydration. */
export function LessonStepGuide({
    steps,
    partsHref,
}: {
    steps: CourseLessonStep[];
    partsHref?: string;
}) {
    if (steps.length === 0 && !partsHref) return null;

    return (
        <details className="shrink-0 border-b border-border bg-card">
            <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--brand-blue))]">
                <h2 className="inline font-semibold">
                    本课步骤与提示
                    {steps.length > 0 ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">共 {steps.length} 步</span>
                    ) : null}
                </h2>
            </summary>
            <div
                role="region"
                aria-label="本课全部步骤与提示"
                tabIndex={0}
                className="max-h-[min(40dvh,24rem)] overflow-y-auto overscroll-contain px-4 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--brand-blue))]"
            >
                {partsHref ? (
                    <Link
                        href={partsHref}
                        prefetch={false}
                        className="mb-3 inline-flex min-h-11 items-center text-sm font-medium text-[hsl(var(--nav-active))] underline underline-offset-4"
                    >
                        查看本课零件清单
                    </Link>
                ) : null}
                {steps.length > 0 ? (
                    <ol className="space-y-4">
                        {steps.map((step, index) => (
                            <li key={`${step.title}-${index}`}>
                                <h3 className="text-sm font-semibold text-foreground">
                                    {index + 1}. {step.title}
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
    );
}
