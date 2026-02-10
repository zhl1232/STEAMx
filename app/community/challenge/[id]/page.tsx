"use client";

import * as React from "react";

import { useCommunity } from "@/context/community-context";

import { Button } from "@/components/ui/button";
import { Users, Trophy, ArrowLeft, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { useAuth } from "@/context/auth-context";
import { useLoginPrompt } from "@/context/login-prompt-context";
import { CountdownTimer } from "@/components/ui/countdown-timer";

export default function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = React.use(params);
    const { challenges, joinChallenge } = useCommunity();
    const { user } = useAuth();
    const { promptLogin } = useLoginPrompt();
    const router = useRouter();
    const [id, setId] = useState<string | number | null>(null);

    useEffect(() => {
        if (unwrappedParams.id) {
            setId(unwrappedParams.id);
        }
    }, [unwrappedParams]);

    if (!id) return null;

    const challenge = challenges.find(c => c.id.toString() === id.toString());

    if (!challenge) {
        return (
            <div className="container mx-auto py-12 text-center">
                <h1 className="text-2xl font-bold mb-4">挑战不存在</h1>
                <Button onClick={() => router.back()}>返回列表</Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-12 max-w-5xl">
            <Button variant="ghost" onClick={() => router.back()} className="mb-6 pl-0 hover:pl-2 transition-all">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回社区
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="relative aspect-video rounded-xl overflow-hidden shadow-lg">
                        <OptimizedImage
                            src={challenge.image}
                            alt={challenge.title}
                            fill
                            variant="cover"
                            className="object-cover"
                        />
                        {challenge.endDate && (
                            <div className="absolute top-4 right-4">
                                <CountdownTimer endDate={challenge.endDate} />
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {challenge.tags.map(tag => (
                                    <span key={tag} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            <h1 className="text-4xl font-bold mb-4">{challenge.title}</h1>
                            <p className="text-xl text-muted-foreground leading-relaxed">
                                {challenge.description}
                            </p>
                        </div>

                        <div className="bg-card border rounded-xl p-8 shadow-sm">
                            <h2 className="text-2xl font-bold mb-6">挑战规则</h2>
                            <ul className="space-y-4 text-muted-foreground">
                                <li className="flex gap-3">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-bold">1</div>
                                    <p>根据挑战主题进行创作，形式不限（实物制作、设计图、程序等）。</p>
                                </li>
                                <li className="flex gap-3">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-bold">2</div>
                                    <p>在截止日期前提交你的作品，并添加相应的标签。</p>
                                </li>
                                <li className="flex gap-3">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-bold">3</div>
                                    <p>邀请朋友为你的作品点赞，人气最高的作品将获得限定徽章！</p>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-24 space-y-6">
                        <div className="bg-card border rounded-xl p-6 shadow-sm">
                            <div className="text-center mb-6">
                                <div className="text-4xl font-bold mb-2">{challenge.participants}</div>
                                <div className="text-muted-foreground flex items-center justify-center gap-2">
                                    <Users className="h-4 w-4" />
                                    已报名参与
                                </div>
                            </div>

                            <Button
                                onClick={() => {
                                    if (!user) {
                                        promptLogin(() => joinChallenge(challenge.id), {
                                            title: '登录以参与挑战',
                                            description: '登录后即可报名参与挑战，赢取徽章'
                                        });
                                        return;
                                    }
                                    joinChallenge(challenge.id);
                                }}
                                className={cn(
                                    "w-full h-12 text-lg font-semibold transition-all",
                                    challenge.joined ? "bg-green-600 hover:bg-green-700 text-white" : ""
                                )}
                                variant={challenge.joined ? "default" : "default"}
                            >
                                {challenge.joined ? (
                                    <>
                                        <CheckCircle className="mr-2 h-5 w-5" />
                                        已报名参赛
                                    </>
                                ) : (
                                    <>
                                        <Trophy className="mr-2 h-5 w-5" />
                                        立即报名
                                    </>
                                )}
                            </Button>

                            {challenge.joined && (
                                <div className="mt-4 text-center">
                                    <p className="text-sm text-muted-foreground mb-3">准备好提交作品了吗？</p>
                                    <Button variant="outline" className="w-full" onClick={() => router.push('/share')}>
                                        发布作品
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="bg-muted/30 rounded-xl p-6 border">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-yellow-500" />
                                奖励
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl border-2 border-yellow-200">
                                    🏅
                                </div>
                                <div>
                                    <div className="font-semibold">挑战者徽章</div>
                                    <div className="text-xs text-muted-foreground">完成挑战即可获得</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
