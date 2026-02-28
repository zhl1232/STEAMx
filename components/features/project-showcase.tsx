"use client"

import { useState } from "react"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { ProjectCompletion } from "@/lib/mappers/types"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExternalLink, Quote, X, Heart, Send, MessageCircle, Coins } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"
import { useGamification } from "@/context/gamification-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useDanmaku } from "@/hooks/use-danmaku"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

interface ProjectShowcaseProps {
    completions: ProjectCompletion[]
}

export function ProjectShowcase({ completions }: ProjectShowcaseProps) {
    const [selectedCompletion, setSelectedCompletion] = useState<ProjectCompletion | null>(null)

    if (!completions || completions.length === 0) {
        return null
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
                作品墙
                <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {completions.length}
                </span>
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {completions.map((completion, index) => (
                    <div
                        key={`${completion.id}-${index}`}
                        className="group relative aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer ring-offset-background transition-all hover:ring-2 hover:ring-primary"
                        onClick={() => setSelectedCompletion(completion)}
                    >
                        {completion.proofImages[0] ? (
                            <OptimizedImage
                                src={completion.proofImages[0]}
                                alt={`${completion.author}的作品`}
                                fill
                                variant="grid"
                                className="object-cover transition-transform group-hover:scale-105"
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                                无图
                            </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="flex items-center gap-2 text-white">
                                <AvatarWithFrame
                                    src={completion.avatar}
                                    fallback={completion.author[0]}
                                    avatarFrameId={completion.avatarFrameId}
                                    className="h-6 w-6 border border-white/50"
                                />
                                <span className="text-xs font-medium truncate">{completion.author}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Dialog open={!!selectedCompletion} onOpenChange={(open) => !open && setSelectedCompletion(null)}>
                <DialogContent className="max-w-4xl overflow-hidden p-0 gap-0 border-none sm:rounded-2xl bg-black [&>button]:hidden">
                    <DialogTitle className="sr-only">
                        {selectedCompletion?.author} 的作品详情
                    </DialogTitle>
                    {selectedCompletion && (
                        <CompletionDetail
                            completion={selectedCompletion}
                            onClose={() => setSelectedCompletion(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

function CompletionDetail({ completion, onClose }: { completion: ProjectCompletion, onClose: () => void }) {
    const supabase = createClient()
    const { user, refreshProfile } = useAuth()
    const gamification = useGamification()
    const coins = gamification?.coins ?? 0
    const { promptLogin } = useLoginPrompt()
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const isOwnCompletion = user?.id === completion.userId

    // -- React Query Data Fetching --

    // 1. Fetch Like Status
    const { data: isLiked } = useQuery({
        queryKey: ['completion_like', completion.id, user?.id],
        queryFn: async () => {
            if (!user) return false;
            const { data } = await supabase
                .from('completion_likes')
                .select('*')
                .eq('completed_project_id', completion.id)
                .eq('user_id', user.id)
                .single();
            return !!data;
        },
        enabled: !!user,
        initialData: false
    });

    // 2. Fetch Like Count
    const { data: likesCount = completion.likes || 0 } = useQuery({
        queryKey: ['completion_likes_count', completion.id],
        queryFn: async () => {
            const { count } = await supabase
                .from('completion_likes')
                .select('*', { count: 'exact', head: true })
                .eq('completed_project_id', completion.id);
            return count || 0;
        },
        initialData: completion.likes || 0
    });

    // 3. Fetch Comments (Danmaku)
    const { data: comments = [] } = useQuery({
        queryKey: ['completion_comments', completion.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('completion_comments')
                .select('*')
                .eq('completed_project_id', completion.id)
                .order('created_at', { ascending: true });
            return data || [];
        }
    });

    // 4. 作品收到的总硬币数（展示用）
    const { data: tipReceived = 0 } = useQuery({
        queryKey: ['completion_tip_received', completion.id],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_tip_received_for_resource', {
                p_resource_type: 'completion',
                p_resource_id: completion.id
            } as never);
            if (error) return 0;
            return (data as number) ?? 0;
        }
    });
    // 5. 当前用户对该作品已投多少（每人最多 2，用于显示投币按钮）
    const { data: myTipped = 0 } = useQuery({
        queryKey: ['my_tip_for_resource', 'completion', completion.id, user?.id],
        queryFn: async () => {
            if (!user) return 0;
            const { data, error } = await supabase.rpc('get_my_tip_for_resource', {
                p_resource_type: 'completion',
                p_resource_id: completion.id
            } as never);
            if (error) return 0;
            return (data as number) ?? 0;
        },
        enabled: !!user
    });
    const tipRemaining = Math.max(0, 2 - myTipped);

    // -- Mutations --

    const likeMutation = useMutation({
        mutationFn: async (vars: { isLiked: boolean }) => {
            if (!user) throw new Error("Unauthorized");
            if (vars.isLiked) {
                // Was liked, delete it
                await supabase.from('completion_likes').delete()
                    .eq('completed_project_id', completion.id).eq('user_id', user.id);
            } else {
                // Not liked, insert it
                await supabase.from('completion_likes').insert({
                    completed_project_id: completion.id,
                    user_id: user.id
                } as never);
            }
        },
        onMutate: async (vars) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['completion_like', completion.id, user?.id] });
            await queryClient.cancelQueries({ queryKey: ['completion_likes_count', completion.id] });

            // Snapshot previous values
            const prevLikeStatus = queryClient.getQueryData(['completion_like', completion.id, user?.id]);
            const prevCount: number = queryClient.getQueryData(['completion_likes_count', completion.id]) || 0;

            // Optimistic update
            queryClient.setQueryData(['completion_like', completion.id, user?.id], !vars.isLiked);
            queryClient.setQueryData(['completion_likes_count', completion.id], vars.isLiked ? prevCount - 1 : prevCount + 1);

            return { prevLikeStatus, prevCount };
        },
        onError: (err, newTodo, context) => {
            queryClient.setQueryData(['completion_like', completion.id, user?.id], context?.prevLikeStatus);
            queryClient.setQueryData(['completion_likes_count', completion.id], context?.prevCount);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['completion_like', completion.id, user?.id] });
            queryClient.invalidateQueries({ queryKey: ['completion_likes_count', completion.id] });
        }
    });

    const commentMutation = useMutation({
        mutationFn: async (content: string) => {
            if (!user) throw new Error("Unauthorized");
            return await supabase
                .from('completion_comments')
                .insert({
                    completed_project_id: completion.id,
                    author_id: user.id,
                    content: content
                } as never);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['completion_comments', completion.id] });
        }
    });

    const tipMutation = useMutation({
        mutationFn: async (amount: number) => {
            if (!user) throw new Error("Unauthorized");
            const { data, error } = await supabase.rpc('tip_resource', {
                p_resource_type: 'completion',
                p_resource_id: completion.id,
                p_amount: amount
            } as never);
            if (error) throw error;
            const res = data as { ok?: boolean; error?: string };
            if (!res?.ok) throw new Error(res?.error || 'tip_failed');
        },
        onSuccess: (_, amount) => {
            queryClient.invalidateQueries({ queryKey: ['completion_tip_received', completion.id] });
            queryClient.invalidateQueries({ queryKey: ['my_tip_for_resource', 'completion', completion.id] });
            refreshProfile();
            toast({ title: "投币成功", description: `已赞赏 ${amount} 硬币` });
        },
        onError: (err: Error) => {
            const msg = err.message === "insufficient_coins" ? "硬币余额不足" : err.message === "tip_limit_reached" ? "已达该作品投币上限" : err.message === "cannot_tip_self" ? "不能给自己投币" : "投币失败";
            toast({ variant: "destructive", title: "投币失败", description: msg });
        }
    });

    // -- Danmaku Hook --
    const {
        activeDanmaku,
        sendDanmaku: displayDanmaku,
        removeDanmaku,
        isPlaying,
        togglePlay,
        danmakuClass
    } = useDanmaku({
        initialComments: comments.map((c: { id: number; content: string }) => ({ id: c.id, content: c.content })),
        autoPlay: true,
        runOnce: true,
        resourceId: completion.id
    });

    const [inputText, setInputText] = useState("");

    const handleLike = () => {
        if (!user) {
            promptLogin(() => { }, { title: '点赞', description: '登录后即可点赞喜欢的作品' });
            return;
        }
        likeMutation.mutate({ isLiked: !!isLiked });
    };

    const handleSendDanmaku = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        if (!user) {
            promptLogin(() => { }, { title: '发送弹幕', description: '登录后即可发送弹幕' });
            return;
        }

        const content = inputText;
        // 1. 本地展示
        displayDanmaku(content);
        setInputText("");

        // 2. 提交到服务器
        commentMutation.mutate(content);
    };

    return (
        <div className="flex flex-col md:flex-row h-[85vh] md:h-[600px] w-full bg-background relative">
            {/* Close button for mobile */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-50 p-2 bg-black/50 rounded-full text-white md:hidden"
            >
                <X className="h-4 w-4" />
            </button>

            {/* Left: Images & Danmaku Area */}
            <div className="flex-1 bg-black relative overflow-hidden flex flex-col justify-center items-center group">
                {completion.proofImages[0] && (
                    <div className="relative w-full h-full">
                        <OptimizedImage
                            src={completion.proofImages[0]}
                            alt=""
                            fill
                            variant="cover"
                            className="object-contain"
                        />
                        {/* Danmaku Layer */}
                        {isPlaying && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                {activeDanmaku.map((item) => (
                                    <div
                                        key={item.uniqueKey || item.id}
                                        className={danmakuClass}
                                        style={{
                                            top: item.top,
                                            color: item.color,
                                            animationDuration: item.duration,
                                        }}
                                        onAnimationEnd={() => removeDanmaku(item.uniqueKey!)}
                                    >
                                        {item.content}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Control Overlay (Bottom Left) */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {/* 弹幕开关：状态指示样式（文字 + 状态小圆点），避免像普通按钮 */}
                    <button
                        type="button"
                        onClick={togglePlay}
                        className="flex items-center gap-2 text-white/90 hover:text-white transition-colors"
                        aria-label={isPlaying ? "关闭弹幕" : "开启弹幕"}
                    >
                        <span className={cn("h-2 w-2 rounded-full shrink-0", isPlaying ? "bg-green-400" : "bg-white/40")} aria-hidden />
                        <span className="text-sm">{isPlaying ? "弹幕开" : "弹幕关"}</span>
                    </button>

                    {/* Danmaku Input */}
                    <form onSubmit={handleSendDanmaku} className="flex-1 flex gap-2 max-w-md">
                        <Input
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="发个弹幕夸夸他..."
                            className="bg-black/50 border-white/10 text-white placeholder:text-white/50 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/20 h-9 backdrop-blur-sm"
                        />
                        <Button
                            type="submit"
                            size="sm"
                            disabled={!inputText.trim() || commentMutation.isPending}
                            className="bg-primary/90 hover:bg-primary h-9"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </div>

            {/* Right: Info Panel */}
            <div className="w-full md:w-80 bg-background flex flex-col border-l border-border/80 h-[40%] md:h-full">
                <div className="flex justify-between items-center py-3.5 px-5 border-b border-border/80 shrink-0">
                    <h3 className="text-base font-semibold tracking-tight">作品详情</h3>
                    <Button variant="ghost" size="icon" onClick={onClose} className="hidden md:flex h-8 w-8 -mr-1 rounded-full" aria-label="关闭">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="p-5 flex-1 overflow-y-auto space-y-5">
                    {/* 作者信息 */}
                    <div className="flex items-center gap-4">
                        <AvatarWithFrame
                            src={completion.avatar}
                            fallback={completion.author[0]}
                            avatarFrameId={completion.avatarFrameId}
                            className="h-11 w-11 shrink-0 border-2 border-border/60 rounded-full"
                        />
                        <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{completion.author}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                完成于 {completion.completedAt}
                            </p>
                        </div>
                    </div>

                    {/* 互动区：点赞 + 数据展示 + 赞赏 */}
                    <div className="rounded-xl bg-muted/25 border border-border/50 overflow-hidden">
                        <div className="p-4 space-y-4">
                            {/* 第一行：点赞按钮 + 弹幕/硬币统计 */}
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    variant={isLiked ? "default" : "outline"}
                                    size="sm"
                                    className={cn(
                                        "gap-2 h-9 shrink-0 font-medium",
                                        isLiked && "bg-pink-500 hover:bg-pink-600 text-white border-0"
                                    )}
                                    onClick={handleLike}
                                    disabled={likeMutation.isPending}
                                >
                                    <Heart className={cn("h-4 w-4", isLiked ? "fill-current" : "")} />
                                    <span className="text-sm">{isLiked ? "已点赞" : "点赞"}</span>
                                    <span className="tabular-nums opacity-90">({likesCount})</span>
                                </Button>
                                <div className="flex items-center gap-3 text-muted-foreground text-sm">
                                    <span className="inline-flex items-center gap-1.5">
                                        <MessageCircle className="h-4 w-4 shrink-0 opacity-70" />
                                        <span className="tabular-nums">{comments.length}</span>
                                        <span>弹幕</span>
                                    </span>
                                    {!isOwnCompletion && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <Coins className="h-4 w-4 text-amber-500 shrink-0" />
                                            <span>共</span>
                                            <strong className="text-foreground/90 tabular-nums">{tipReceived}</strong>
                                            <span>硬币</span>
                                            {user != null && (
                                                <span className="text-muted-foreground/80">(我已投 {myTipped} 枚)</span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* 赞赏操作：仅非本人作品 */}
                            {!isOwnCompletion && (
                                <div className="pt-3 border-t border-border/50 flex items-center gap-2">
                                    {!user ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2 h-8 text-xs"
                                            onClick={() => promptLogin(() => {}, { title: '赞赏', description: '登录后即可用硬币赞赏创作者' })}
                                        >
                                            <Coins className="h-3.5 w-3.5" />
                                            赞赏
                                        </Button>
                                    ) : tipRemaining > 0 ? (
                                        <div className="flex gap-2">
                                            {[1, 2].filter((a) => a <= tipRemaining && coins >= a).map((amount) => (
                                                <Button
                                                    key={amount}
                                                    variant="default"
                                                    size="sm"
                                                    className="h-8 min-w-8 bg-amber-500 hover:bg-amber-600 text-white font-medium"
                                                    disabled={tipMutation.isPending || coins < amount}
                                                    onClick={() => tipMutation.mutate(amount)}
                                                    title={`赞赏 ${amount} 硬币`}
                                                >
                                                    {amount}
                                                </Button>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">已投满</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 心得体会 */}
                    {completion.notes ? (
                        <div className="rounded-xl border border-border/50 bg-muted/10 overflow-hidden">
                            <div className="pl-4 border-l-4 border-primary/40 py-4 pr-4 space-y-3">
                                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Quote className="h-4 w-4 text-primary shrink-0" aria-hidden />
                                    心得体会
                                </h4>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
                                    {completion.notes}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic text-center py-10">
                            这个用户很懒，什么都没写~
                        </p>
                    )}

                    {completion.proofVideoUrl && (
                        <a
                            href={completion.proofVideoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-border/60 hover:bg-muted/30 transition-colors text-sm text-foreground/85"
                        >
                            <ExternalLink className="h-4 w-4 shrink-0" />
                            观看制作视频
                        </a>
                    )}
                </div>
            </div>
        </div>
    )
}
