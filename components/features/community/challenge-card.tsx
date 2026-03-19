import { useCommunity } from "@/context/community-context";
import type { Challenge } from "@/lib/mappers/types";
import Link from "next/link";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, CheckCircle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountdownTimer } from "@/components/ui/countdown-timer";

interface ChallengeCardProps {
    challenge: Challenge;
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
    const { joinChallenge } = useCommunity();

    const isTimed = challenge.challengeType === 'timed';
    const isEnded = challenge.status === 'ended';

    return (
        <div className="group relative overflow-hidden rounded-xl border bg-white/70 dark:bg-gray-800/70 backdrop-blur-md text-card-foreground shadow-sm transition-all hover:shadow-lg hover:scale-105 transform">
            <Link href={`/community/challenge/${challenge.id}`} className="block">
                <div className="aspect-video w-full overflow-hidden relative">
                    <OptimizedImage
                        src={challenge.image}
                        alt={challenge.title}
                        fill
                        variant="card"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {isTimed && challenge.endDate && !isEnded && (
                        <CountdownTimer
                            endDate={challenge.endDate}
                            compact={true}
                            className="absolute top-2 right-2 bg-black/60 text-white px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-md"
                        />
                    )}
                    {isEnded && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">已结束</span>
                        </div>
                    )}
                    <Badge className="absolute top-2 left-2" variant={isTimed ? 'default' : 'secondary'}>
                        {isTimed ? '限时' : '长期'}
                    </Badge>
                </div>
                <div className="p-6 pb-2">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="font-bold text-xl mb-2 group-hover:text-primary transition-colors">{challenge.title}</h3>
                            <div className="flex gap-2 mb-2">
                                {challenge.tags.map(tag => (
                                    <span key={tag} className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                        {challenge.description}
                    </p>
                </div>
            </Link>

            <div className="px-6 pb-6 pt-0">
                <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {isTimed ? (
                            <>
                                <Users className="h-4 w-4" />
                                <span>{challenge.participants} 人参与</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle className="h-4 w-4" />
                                <span>已有 {challenge.completionsCount || 0} 人完成</span>
                            </>
                        )}
                    </div>
                    {!isEnded && (
                        <Button
                            onClick={(e) => { e.preventDefault(); joinChallenge(challenge.id); }}
                            variant={challenge.joined ? "secondary" : "default"}
                            size="sm"
                            className={cn(
                                "transition-all",
                                challenge.joined && "bg-green-100 text-green-700 hover:bg-green-200",
                                challenge.completed && "bg-purple-100 text-purple-700 hover:bg-purple-200"
                            )}
                        >
                            {challenge.completed ? (
                                <>
                                    <CheckCircle className="mr-1.5 h-4 w-4" />
                                    已完成
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
                    )}
                </div>
            </div>
        </div>
    );
}
