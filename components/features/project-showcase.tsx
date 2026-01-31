"use client"

import { useState, useEffect, useRef } from "react"
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
// import { useToast } from "@/components/ui/use-toast" // Assuming this exists, or use simple alert/log

// Danmaku helper types
interface DanmakuItem {
    id: number | string
    content: string
    top: string
    color: string
    duration: string
    startTime: number
}

interface ProjectShowcaseProps {
    completions: ProjectCompletion[]
}

const DANMAKU_COLORS = [
    "#FEF3C7", // amber-100
    "#D1FAE5", // emerald-100
    "#DBEAFE", // blue-100
    "#FCE7F3", // pink-100
    "#FFFFFF", // white
    "#F3F4F6", // gray-100
    "#FFEDD5", // orange-100
]

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
                <DialogContent className="max-w-4xl overflow-hidden p-0 gap-0 border-none sm:rounded-2xl bg-black">
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

    // State
    const [likes, setLikes] = useState(completion.likes || 0)
    const [isLiked, setIsLiked] = useState(false)
    const [danmakuList, setDanmakuList] = useState<DanmakuItem[]>([])
    const [inputText, setInputText] = useState("")
    const [showDanmaku, setShowDanmaku] = useState(true)

    // Derived state for optimistic UI
    const [sending, setSending] = useState(false)

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            if (!completion.id) return // Should not happen ideally

            // 1. Fetch Likes status
            if (user) {
                const { data: likeData } = await supabase
                    .from('completion_likes')
                    .select('*')
                    .eq('completed_project_id', completion.id)
                    .eq('user_id', user.id)
                    .single()

                setIsLiked(!!likeData)
            }

            // 2. Fetch Likes count (optional, can simplify by just trusting props initially, but real-time is better)
            const { count } = await supabase
                .from('completion_likes')
                .select('*', { count: 'exact', head: true })
                .eq('completed_project_id', completion.id)

            if (count !== null) setLikes(count)

            // 3. Fetch Comments for Danmaku
            const { data: comments } = await supabase
                .from('completion_comments')
                .select('*')
                .eq('completed_project_id', completion.id)
                .order('created_at', { ascending: true })

            if (comments) {
                const formattedDanmaku: DanmakuItem[] = comments.map((c, i) => ({
                    id: c.id,
                    content: c.content,
                    top: `${Math.random() * 80 + 5}%`, // Random top 5-85%
                    color: DANMAKU_COLORS[Math.floor(Math.random() * DANMAKU_COLORS.length)],
                    duration: `${Math.random() * 4 + 6}s`, // 6-10s
                    startTime: Date.now() + i * 500 // Stagger initial load
                }))
                setDanmakuList(formattedDanmaku)
            }
        }

        fetchData()
    }, [completion.id, user, supabase])

    const handleLike = async () => {
        if (!user) {
            promptLogin(() => { }, { title: '点赞', description: '登录后即可点赞喜欢的作品' })
            return
        }

        // Optimistic update
        const previousIsLiked = isLiked
        const previousLikes = likes

        setIsLiked(!isLiked)
        setLikes(isLiked ? likes - 1 : likes + 1)

        try {
            if (previousIsLiked) {
                await supabase
                    .from('completion_likes')
                    .delete()
                    .eq('completed_project_id', completion.id)
                    .eq('user_id', user.id)
            } else {
                await supabase
                    .from('completion_likes')
                    .insert({
                        completed_project_id: completion.id,
                        user_id: user.id
                    })
            }
        } catch (error) {
            // Revert on error
            setIsLiked(previousIsLiked)
            setLikes(previousLikes)
            console.error('Like failed', error)
        }
    }

    const handleSendDanmaku = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inputText.trim() || sending) return

        if (!user) {
            promptLogin(() => { }, { title: '发送弹幕', description: '登录后即可发送弹幕' })
            return
        }

        // 1. Lock and Reset UI immediately
        setSending(true)
        const content = inputText
        const optimisticId = Date.now()

        const newDanmaku: DanmakuItem = {
            id: optimisticId,
            content: content,
            top: `${Math.random() * 80 + 5}%`,
            color: '#FFFFFF',
            duration: '8s',
            startTime: Date.now()
        }

        setDanmakuList(prev => [...prev, newDanmaku])
        setInputText("")

        // 2. Unlock UI after cooldown (independent of network)
        setTimeout(() => setSending(false), 500)

        console.log('Sending danmaku...', { completed_project_id: completion.id, author_id: user.id, content })

        // 3. Network Request (Fire and Forget but handle error)
        try {
            const { data, error } = await supabase
                .from('completion_comments')
                .insert({
                    completed_project_id: completion.id,
                    author_id: user.id,
                    content: content
                })
                .select()

            if (error) throw error
            console.log('Danmaku sent successfully', data)
        } catch (error) {
            console.error('Failed to send danmaku:', error)
            setDanmakuList(prev => prev.filter(d => d.id !== optimisticId))
            setInputText(content) // Restore text on failure
            alert('发送失败，请重试') // Temporary simple feedback
        }
    }

    return (
        <div className="flex flex-col md:flex-row h-[85vh] md:h-[600px] w-full bg-background relative">
            {/* Styling for Danmaku Animation */}
            <style jsx>{`
                @keyframes danmaku-slide {
                    from { transform: translateX(100%); }
                    to { transform: translateX(-400%); } /* Ensure it goes way off screen */
                }
                .danmaku-item {
                    position: absolute;
                    white-space: nowrap;
                    will-change: transform;
                    animation-name: danmaku-slide;
                    animation-timing-function: linear;
                    animation-fill-mode: forwards;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
                    pointer-events: none; /* Let clicks pass through to image/video */
                    z-index: 10;
                    right: 0; 
                }
            `}</style>

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
                        {showDanmaku && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                {danmakuList.map((item) => (
                                    <div
                                        key={item.id}
                                        className="danmaku-item text-lg font-bold opacity-90"
                                        style={{
                                            top: item.top,
                                            color: item.color,
                                            animationDuration: item.duration,
                                            // Consider adding animationDelay if we want to stagger re-renders, 
                                            // but for new items they start immediately
                                        }}
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
                        onClick={() => setShowDanmaku(!showDanmaku)}
                    >
                        <MessageCircle className={cn("h-4 w-4 mr-2", showDanmaku ? "text-green-400" : "text-white/70")} />
                        {showDanmaku ? "弹幕开" : "弹幕关"}
                    </Button>

                    {/* Danmaku Input - Integrated into image area for "immersive" feel */}
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
                            disabled={!inputText.trim() || sending}
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
                        >
                            <Heart className={cn("h-4 w-4", isLiked ? "fill-current" : "")} />
                            {isLiked ? "已点赞" : "点赞"} ({likes})
                        </Button>
                        <Button variant="outline" className="flex-1 gap-2" onClick={() => setShowDanmaku(!showDanmaku)}>
                            <MessageCircle className="h-4 w-4" />
                            弹幕 {danmakuList.length}
                        </Button>
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
