import Link from "next/link";
import { CheckCircle, Play, Trophy, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CountdownTimer } from "@/components/ui/countdown-timer";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { useCommunity } from "@/context/community-context";
import type { Challenge } from "@/lib/mappers/types";
import { cn } from "@/lib/utils";

interface ChallengeCardProps {
    challenge: Challenge;
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
    const { joinChallenge } = useCommunity();

    const isTimed = challenge.challengeType === 'timed';
    const isEnded = challenge.status === 'ended';
    const previewTag = challenge.tags[0];
    const remainingTagCount = Math.max(challenge.tags.length - 1, 0);
    const primaryMetric = isTimed
        ? `${challenge.participants} 人参与`
        : `已有 ${challenge.submissionsCount || 0} 件作品`;
    const secondaryMeta = isTimed
        ? (challenge.daysLeft > 0 ? `剩余 ${challenge.daysLeft} 天` : '即将截止')
        : '随时开始，自主完成';

  return (
    <div className="transition-transform duration-300 hover:-translate-y-1.5">
      <article className="group relative flex h-full flex-col overflow-hidden rounded-[24px] border border-border/70 bg-card/88 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.25)] transition-all hover:shadow-[0_24px_55px_-28px_rgba(15,23,42,0.34)]">
        <Link
          href={`/community/challenge/${challenge.id}`}
          className="absolute inset-0 z-10 rounded-[24px]"
          aria-label={`进入挑战：${challenge.title}`}
        />

        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted pointer-events-none">
          <OptimizedImage
            src={challenge.image}
            alt={challenge.title}
            fill
            variant="card"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/12 to-transparent opacity-95" />

          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-white/18 bg-black/32 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-md">
              {isTimed ? '限时挑战' : '常驻挑战'}
            </span>
            {previewTag ? (
              <span
                key={previewTag}
                className="inline-flex items-center rounded-full border border-white/12 bg-white/12 px-3 py-1 text-[11px] font-medium text-white/88 backdrop-blur-md"
              >
                {previewTag}
              </span>
            ) : null}
          </div>

          {isTimed && challenge.endDate && !isEnded ? (
            <CountdownTimer
              endDate={challenge.endDate}
              compact
              className="absolute right-4 top-4 rounded-full border border-white/18 bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md"
            />
          ) : null}

          {isEnded ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/38">
              <span className="rounded-full border border-white/18 bg-black/48 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md">
                挑战已结束
              </span>
            </div>
          ) : null}
        </div>

        <div className="relative z-0 flex flex-1 flex-col gap-4 bg-gradient-to-br from-background via-background to-muted/20 p-5 pointer-events-none">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="section-kicker text-[10px] tracking-[0.24em]">
                {isTimed ? '限时竞赛' : '长期练习'}
              </span>
              <span>{secondaryMeta}</span>
            </div>

            <div>
              <h3 className="text-xl font-semibold leading-snug transition-colors group-hover:text-primary">
                {challenge.title}
              </h3>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                {challenge.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {previewTag ? (
              <span
                key={previewTag}
                className="inline-flex items-center rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary"
              >
                {previewTag}
              </span>
            ) : null}
            {remainingTagCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                +{remainingTagCount} 个主题
              </span>
            ) : null}
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-4 text-sm text-muted-foreground">
            <div className="flex min-w-0 items-center gap-2">
              {isTimed ? <Users className="h-4 w-4 shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
              <span className="truncate">{primaryMetric}</span>
            </div>

            {!isEnded ? (
              <Button
                onClick={(event) => {
                  event.preventDefault();
                  void joinChallenge(challenge.id).catch(() => {});
                }}
                variant={challenge.joined || challenge.completed ? "secondary" : "default"}
                size="sm"
                className={cn(
                  "pointer-events-auto relative z-20 shrink-0 rounded-full px-4 transition-colors",
                  challenge.joined && "bg-muted text-foreground hover:bg-muted/80",
                  challenge.completed && "bg-primary/10 text-primary hover:bg-primary/15"
                )}
              >
                {challenge.completed ? (
                  <>
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    已完成
                  </>
                ) : challenge.mySubmissionStatus === 'pending' ? (
                  <>
                    <Trophy className="mr-1.5 h-4 w-4" />
                    审核中
                  </>
                ) : challenge.joined ? (
                  <>
                    <Trophy className="mr-1.5 h-4 w-4" />
                    {isTimed ? '已报名' : '已参与'}
                  </>
                ) : (
                  <>
                    {isTimed ? <Trophy className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
                    {isTimed ? '立即报名' : '开始挑战'}
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}
