import { useCommunity } from "@/context/community-context";
import { Challenge } from "@/lib/types";
import Link from "next/link";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { Users, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountdownTimer } from "@/components/ui/countdown-timer";

interface ChallengeCardProps {
    challenge: Challenge;
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
    const { joinChallenge } = useCommunity();

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
                    {challenge.endDate && (
                        <CountdownTimer 
                            endDate={challenge.endDate} 
                            compact={true}
                            className="absolute top-2 right-2 bg-black/60 text-white px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-md"
                        />
                    )}
                </div>
                <div className="p-6 pb-2">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-bold text-xl mb-2 group-hover:text-primary transition-colors">{challenge.title}</h3>
                            <div className="flex gap-2 mb-3">
                                {challenge.tags.map(tag => (
                                    <span key={tag} className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {challenge.description}
                    </p>
                </div>
            </Link>

            <div className="px-6 pb-6 pt-0">
                <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{challenge.participants} 人参与</span>
                    </div>
                    <Button
                        onClick={() => joinChallenge(challenge.id)}
                        variant={challenge.joined ? "secondary" : "default"}
                        className={cn(
                            "transition-all",
                            challenge.joined && "bg-green-100 text-green-700 hover:bg-green-200"
                        )}
                    >
                        {challenge.joined ? (
                            <>
                                <Trophy className="mr-2 h-4 w-4" />
                                已报名
                            </>
                        ) : (
                            "立即挑战"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
