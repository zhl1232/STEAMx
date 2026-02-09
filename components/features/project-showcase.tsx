"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { ProjectCompletion } from "@/lib/mappers/types"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExternalLink, Quote, X, Heart, Send, MessageCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
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
                            <Image
                                src={completion.proofImages[0]}
                                alt={`${completion.author}的作品`}
                                fill
                                className="object-cover transition-transform group-hover:scale-105"
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                                无图
                            </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="flex items-center gap-2 text-white">
                                <Avatar className="h-6 w-6 border border-white/50">
                                    <AvatarImage src={completion.avatar || ""} />
                                    <AvatarFallback>{completion.author[0]}</AvatarFallback>
                                </Avatar>
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
    const { user } = useAuth()
    const { promptLogin } = useLoginPrompt()
    const queryClient = useQueryClient()

    // -- React Query Data Fetching --

    // 1. Fetch Like Status
    const { data: isLiked } = useQuery({
        queryKey: ['completion_like', completion.id, user?.id],
        queryFn: async () => {
            if (!user) return false;
            const { data } = await (supabase
                .from('completion_likes') as any)
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
            const { data } = await (supabase
                .from('completion_comments') as any)
                .select('*')
                .eq('completed_project_id', completion.id)
                .order('created_at', { ascending: true });
            return data || [];
        }
    });

    // -- Mutations --

    const likeMutation = useMutation({
        mutationFn: async (vars: { isLiked: boolean }) => {
            if (!user) throw new Error("Unauthorized");
            if (vars.isLiked) {
                // Was liked, delete it
                await (supabase.from('completion_likes') as any).delete()
                    .eq('completed_project_id', completion.id).eq('user_id', user.id);
            } else {
                // Not liked, insert it
                await (supabase.from('completion_likes') as any).insert({
                    completed_project_id: completion.id,
                    user_id: user.id
                });
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
            return await (supabase
                .from('completion_comments') as any)
                .insert({
                    completed_project_id: completion.id,
                    author_id: user.id,
                    content: content
                });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['completion_comments', completion.id] });
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
        initialComments: comments.map((c: any) => ({ id: c.id, content: c.content })),
        autoPlay: true
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
                        <Image
                            src={completion.proofImages[0]}
                            alt=""
                            fill
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
                    <Button
                        size="sm"
                        variant="outline"
                        className="bg-black/40 border-white/20 text-white hover:bg-black/60 hover:text-white backdrop-blur-sm transition-colors"
                        onClick={togglePlay}
                    >
                        <MessageCircle className={cn("h-4 w-4 mr-2", isPlaying ? "text-green-400" : "text-white/70")} />
                        {isPlaying ? "弹幕开" : "弹幕关"}
                    </Button>

                    {/* Danmaku Input */}
                    <form onSubmit={handleSendDanmaku} className="flex-1 flex gap-2 max-w-md">
                        <Input
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="发个弹幕夸夸他..."
                            className="bg-black/40 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-1 focus-visible:ring-white/50 h-9 backdrop-blur-sm"
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
            <div className="w-full md:w-80 bg-background flex flex-col border-l h-[40%] md:h-full">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-semibold">作品详情</h3>
                    <Button variant="ghost" size="icon" onClick={onClose} className="hidden md:flex h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <Avatar className="h-10 w-10 border">
                            <AvatarImage src={completion.avatar || ""} />
                            <AvatarFallback>{completion.author[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="font-semibold">{completion.author}</h3>
                            <p className="text-xs text-muted-foreground">
                                完成于 {completion.completedAt}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                        <Button
                            variant={isLiked ? "default" : "outline"}
                            className={cn("flex-1 gap-2", isLiked && "bg-pink-500 hover:bg-pink-600 text-white border-pink-600")}
                            onClick={handleLike}
                            disabled={likeMutation.isPending}
                        >
                            <Heart className={cn("h-4 w-4", isLiked ? "fill-current" : "")} />
                            {isLiked ? "已点赞" : "点赞"} ({likesCount})
                        </Button>
                        <div className="flex-1 flex items-center justify-center gap-2 border rounded-md text-sm font-medium h-10">
                            <MessageCircle className="h-4 w-4" />
                            弹幕 {comments.length}
                        </div>
                    </div>

                    {completion.notes ? (
                        <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                            <h4 className="text-sm font-medium flex items-center text-primary">
                                <Quote className="h-4 w-4 mr-2" /> 心得体会
                            </h4>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                                {completion.notes}
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic text-center py-8">
                            这个用户很懒，什么都没写~
                        </p>
                    )}

                    {completion.proofVideoUrl && (
                        <div className="mt-6">
                            <a
                                href={completion.proofVideoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-center p-3 rounded-lg border border-dashed hover:bg-muted/50 transition-colors text-sm text-foreground/80"
                            >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                观看制作视频
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
