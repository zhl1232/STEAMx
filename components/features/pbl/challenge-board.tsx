"use client";

import Link from "next/link";
import { ChevronRight, Trophy, UsersRound } from "lucide-react";

import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { ChallengeCardSkeleton } from "@/components/ui/loading-skeleton";
import { cn } from "@/lib/utils";
import type { Challenge } from "@/lib/mappers/types";

export function getChallengeSubmissionCount(challenge: Challenge) {
    return challenge.submissionsCount ?? challenge.completionsCount ?? 0;
}

export function getChallengeMeta(challenge: Challenge) {
    const participantText = `${challenge.participants.toLocaleString("zh-CN")} 人参与`;
    const submissionText = `${getChallengeSubmissionCount(challenge).toLocaleString("zh-CN")} 次提交`;

    return { participantText, submissionText };
}

export function CompactChallengeCard({
    challenge,
    ended = false,
    action = false,
}: {
    challenge: Challenge;
    ended?: boolean;
    action?: boolean;
}) {
    const { participantText, submissionText } = getChallengeMeta(challenge);
    const imageSrc = challenge.image || "/projects/generated/project-0010.webp";

    return (
        <article className="group community-challenge-card md:grid-cols-[132px_minmax(0,1fr)]">
            <Link
                href={`/pbl/${challenge.id}`}
                className="absolute inset-0 z-10 rounded-[var(--radius-sm)]"
                aria-label={`进入挑战：${challenge.title}`}
            />
            <div className="relative min-h-[102px] overflow-hidden rounded-[var(--radius-xs)] bg-[hsl(var(--status-info-surface))] md:min-h-[98px] md:rounded-[var(--radius-sm)]">
                <OptimizedImage
                    src={imageSrc}
                    alt={challenge.title}
                    fill
                    variant="thumbnail"
                    className="object-cover transition duration-500 group-hover:scale-105"
                />
                {challenge.challengeType === "timed" && !ended ? (
                    <span className="absolute left-2 top-2 rounded-[var(--radius-xs)] bg-[hsl(var(--surface-shadow)/0.92)] px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
                        {challenge.daysLeft > 0 ? `剩余 ${challenge.daysLeft} 天` : "即将截止"}
                    </span>
                ) : null}
                {ended ? (
                    <span className="absolute left-2 top-2 rounded-xs bg-black/58 px-2 py-1 text-[11px] font-semibold text-white">
                        已结束
                    </span>
                ) : null}
            </div>

            <div className="pointer-events-none relative z-0 flex min-w-0 flex-col justify-center py-1 pr-1">
                <h3 className="line-clamp-2 whitespace-normal break-words text-[15px] font-black leading-[1.45] text-foreground transition group-hover:text-[hsl(var(--nav-active))] min-[390px]:text-[16px] md:min-h-[48px] md:text-[17px] md:leading-6">
                    {challenge.title}
                </h3>
                <p className="mt-1 hidden text-[13px] leading-5 text-muted-foreground xl:line-clamp-1">
                    {challenge.description}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                        <UsersRound className="h-3.5 w-3.5" />
                        {participantText}
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1">
                        <Trophy className="h-3.5 w-3.5 text-[hsl(var(--brand-amber))]" />
                        <span className="truncate">{submissionText}</span>
                    </span>
                </div>
            </div>

            {action && !ended ? (
                <>
                    <span className="pointer-events-none absolute bottom-3 right-3 z-0 inline-flex items-center gap-0.5 text-[12px] font-bold text-[hsl(var(--brand-blue))] min-[560px]:hidden">
                        参与挑战
                        <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                    <span className="pointer-events-none absolute bottom-3 right-3 z-0 hidden h-9 items-center rounded-[var(--radius-sm)] bg-[hsl(var(--brand-blue))] px-4 text-[13px] font-bold text-[hsl(var(--brand-blue-foreground))] shadow-[0_14px_28px_-20px_hsl(var(--brand-blue)/0.78)] min-[560px]:inline-flex">
                        参与挑战
                    </span>
                </>
            ) : null}
        </article>
    );
}

export function ChallengeRailSection({
    title,
    challenges,
    ended = false,
    onMore,
    action = false,
    showMore = true,
}: {
    title: string;
    challenges: Challenge[];
    ended?: boolean;
    onMore: () => void;
    action?: boolean;
    showMore?: boolean;
}) {
    if (challenges.length === 0) return null;

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-panel-title font-black text-foreground md:text-[20px]">{title}</h2>
                {showMore ? (
                    <button
                        type="button"
                        onClick={onMore}
                        className="inline-flex items-center gap-1 text-[13px] font-semibold text-[hsl(var(--brand-blue))] transition hover:text-[hsl(var(--brand-blue)/0.85)]"
                    >
                        查看更多
                        <ChevronRight className="h-4 w-4" />
                    </button>
                ) : null}
            </div>
            <div className="space-y-3">
                {challenges.slice(0, 2).map((challenge) => (
                    <CompactChallengeCard key={challenge.id} challenge={challenge} ended={ended} action={action} />
                ))}
            </div>
        </section>
    );
}

export function ChallengeBoard({
    activeTimed,
    evergreen,
    ended,
    isLoading,
    challengesError,
    reloadChallenges,
}: {
    activeTimed: Challenge[];
    evergreen: Challenge[];
    ended: Challenge[];
    isLoading: boolean;
    challengesError: string | null;
    reloadChallenges: () => void;
}) {
    const hasChallenges = activeTimed.length > 0 || evergreen.length > 0 || ended.length > 0;

    return (
        <section className="overflow-hidden">
            <div className="space-y-7 py-4 md:p-6">
                {challengesError && !isLoading ? (
                    <div className="rounded-md border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
                        <p className="text-lg font-bold">挑战加载失败</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{challengesError}</p>
                        <Button className="mt-4" onClick={() => void reloadChallenges()}>
                            重试
                        </Button>
                    </div>
                ) : null}

                {isLoading ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        {[1, 2, 3, 4].map((item) => (
                            <ChallengeCardSkeleton key={item} className="!rounded-[var(--radius-sm)]" />
                        ))}
                    </div>
                ) : null}

                {!challengesError && !isLoading ? (
                    <>
                        {activeTimed.length > 0 ? (
                            <ChallengeRailSection title="进行中的限时挑战" challenges={activeTimed} onMore={() => {}} action showMore={false} />
                        ) : null}
                        {evergreen.length > 0 ? (
                            <ChallengeRailSection title="长期挑战" challenges={evergreen} onMore={() => {}} action showMore={false} />
                        ) : null}
                        {ended.length > 0 ? (
                            <ChallengeRailSection title="已结束挑战" challenges={ended} ended onMore={() => {}} showMore={false} />
                        ) : null}
                        {!hasChallenges ? (
                            <div className="surface-card rounded-[var(--radius-sm)] px-6 py-14 text-center">
                                <p className="text-lg font-bold">暂无挑战</p>
                                <p className="mt-2 text-sm text-muted-foreground">敬请期待新的挑战。</p>
                            </div>
                        ) : null}
                    </>
                ) : null}
            </div>
        </section>
    );
}

export function ChallengeRail({
    activeTimed,
    evergreen,
    ended,
    isLoading,
    challengesError,
    reloadChallenges,
    onMore,
    className,
    action = false,
}: {
    activeTimed: Challenge[];
    evergreen: Challenge[];
    ended: Challenge[];
    isLoading: boolean;
    challengesError: string | null;
    reloadChallenges: () => void;
    onMore: () => void;
    className?: string;
    action?: boolean;
}) {
    return (
        <aside className={cn("surface-panel space-y-7 overflow-hidden p-4 md:p-5", className)}>
            {challengesError && !isLoading ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-8 text-center">
                    <p className="text-base font-bold">挑战加载失败</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{challengesError}</p>
                    <Button className="mt-4" onClick={() => void reloadChallenges()}>
                        重试
                    </Button>
                </div>
            ) : null}

            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                        <div key={item} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 rounded-[var(--radius-md)] border border-border/80 bg-[hsl(var(--surface-raised)/0.7)] p-2">
                            <div className="h-[98px] animate-pulse rounded-sm bg-muted" />
                            <div className="space-y-3 py-2">
                                <div className="h-4 w-3/4 animate-pulse rounded-full bg-muted" />
                                <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
                                <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {!challengesError && !isLoading ? (
                <>
                    <ChallengeRailSection title="进行中的限时挑战" challenges={activeTimed} onMore={onMore} action={action} />
                    <ChallengeRailSection title="长期挑战" challenges={evergreen} onMore={onMore} action={action} />
                    <ChallengeRailSection title="已结束挑战" challenges={ended} ended onMore={onMore} />
                    {activeTimed.length === 0 && evergreen.length === 0 && ended.length === 0 ? (
                        <div className="rounded-[var(--radius-md)] border border-border/80 bg-[hsl(var(--surface-raised)/0.7)] px-5 py-10 text-center text-sm text-muted-foreground">
                            暂无挑战
                        </div>
                    ) : null}
                </>
            ) : null}
        </aside>
    );
}
