"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageCircle, Send, Trash2, ThumbsUp, MessageSquare, Loader2 } from "lucide-react"
import { useProjects } from "@/context/project-context"
import { useAuth } from "@/context/auth-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
import { type Comment, mapDbComment } from "@/lib/mappers/types"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface ProjectCommentsProps {
    projectId: string | number
    initialComments: Comment[]
    initialTotal?: number
    initialHasMore?: boolean
}

export function ProjectComments({ projectId, initialComments, initialTotal = 0, initialHasMore = false }: ProjectCommentsProps) {
    const { addComment, deleteComment } = useProjects()
    const { user, profile } = useAuth()
    const { promptLogin } = useLoginPrompt()
    const supabase = createClient()

    const [comments, setComments] = useState<Comment[]>(initialComments)
    const [total, setTotal] = useState(initialTotal || initialComments.length)
    const [hasMore, setHasMore] = useState(initialHasMore)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [page, setPage] = useState(1) // 0-indexed page 0 is initial, so next is 1
    const PAGE_SIZE = 5 // Should match initial fetch size usually, or be larger

    const [newComment, setNewComment] = useState("")
    const [replyingTo, setReplyingTo] = useState<number | string | null>(null)
    const [replyContent, setReplyContent] = useState("")
    const [isFocused, setIsFocused] = useState(false)

    const handleLoadMore = async () => {
        if (isLoadingMore || !hasMore) return
        setIsLoadingMore(true)

        try {
            const from = page * PAGE_SIZE
            const to = from + PAGE_SIZE - 1

            // 1. Fetch Root Comments
            const { data: roots, error, count } = await supabase
                .from('comments')
                .select(`
                    *,
                    profiles:author_id (display_name, avatar_url)
                `, { count: 'exact' })
                .eq('project_id', projectId)
                .is('parent_id', null)
                .order('created_at', { ascending: false })
                .range(from, to)

            if (error) throw error

            let newComments = (roots || []).map(mapDbComment)

            // 2. Fetch Replies for these roots
            if (roots && roots.length > 0) {
                const rootIds = roots.map(r => r.id)
                const { data: replies } = await supabase
                    .from('comments')
                    .select(`
                        *,
                        profiles:author_id (display_name, avatar_url)
                    `)
                    .in('parent_id', rootIds)
                    .order('created_at', { ascending: true })

                if (replies) {
                    const mappedReplies = replies.map(mapDbComment)
                    newComments = [...newComments, ...mappedReplies]
                }
            }

            setComments(prev => [...prev, ...newComments])
            setPage(prev => prev + 1)
            setHasMore((count || 0) > to + 1)
            // Update total just in case
            if (count !== null) setTotal(count) // This count is for root comments only, not total comments.
            // We rely on initialTotal for overall count.
            // If a new comment is added, we increment total.
            // If a comment is deleted, we decrement total.
            // So, we should not overwrite total here with root count.
        } catch (error) {
            console.error('Error loading more comments:', error)
        } finally {
            setIsLoadingMore(false)
        }
    }

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim()) return

        const submitComment = async () => {
            const addedComment = await addComment(projectId, {
                id: 0,
                author: "Me",
                content: newComment,
                date: "",
            })

            if (addedComment) {
                setComments((prev) => [addedComment, ...prev])
                setTotal(prev => prev + 1) // Increment total
                setNewComment("")
                setIsFocused(false)
            }
        }

        if (!user) {
            promptLogin(() => {
                submitComment()
            }, {
                title: '登录以发表评论',
                description: '登录后即可参与讨论，分享你的想法'
            })
            return
        }

        submitComment()
    }

    const handleSubmitReply = async (
        e: React.FormEvent,
        parentId: number,
        replyToUserId?: string,
        replyToUsername?: string
    ) => {
        e.preventDefault()
        if (!replyContent.trim()) return

        const submitReply = async () => {
            const addedReply = await addComment(
                projectId,
                {
                    id: 0,
                    author: "Me",
                    content: replyContent,
                    date: "",
                    reply_to_user_id: replyToUserId,
                    reply_to_username: replyToUsername,
                },
                parentId
            )

            if (addedReply) {
                setComments((prev) => [addedReply, ...prev])
                setTotal(prev => prev + 1)
                setReplyContent("")
                setReplyingTo(null)
            }
        }

        if (!user) {
            promptLogin(() => {
                submitReply()
            }, {
                title: '登录以回复评论',
                description: '登录后即可参与讨论，回复其他用户'
            })
            return
        }

        submitReply()
    }

    const handleDeleteComment = async (commentId: string | number) => {
        await deleteComment(commentId)
        setComments((prev) => prev.filter((c) => c.id !== commentId))
    }

    const handleCancelReply = () => {
        setReplyContent("")
        setReplyingTo(null)
    }

    const topLevelComments = comments.filter((c) => !c.parent_id)
    const getNestedComments = (parentId: number | string) => {
        return comments.filter((c) => c.parent_id === parentId)
    }

    // New Bilibili-style comment item
    const CommentItem = ({ comment, isNested = false }: { comment: Comment, isNested?: boolean }) => {
        const nestedComments = getNestedComments(comment.id)
        const isReplying = replyingTo === comment.id
        const [isExpanded, setIsExpanded] = useState(false)
        const DISPLAY_LIMIT = 2

        const displayedComments = isExpanded ? nestedComments : nestedComments.slice(0, DISPLAY_LIMIT)
        const hiddenCount = nestedComments.length - displayedComments.length

        return (
            <div className={cn("group flex gap-4", isNested ? "mt-4" : "py-6 border-b last:border-0")}>
                {/* Avatar */}
                <Avatar className={cn("shrink-0 border", isNested ? "h-8 w-8" : "h-10 w-10 sm:h-12 sm:w-12")}>
                    <AvatarImage src={comment.avatar || ""} />
                    <AvatarFallback className="bg-primary/5 text-primary">
                        {comment.author[0]?.toUpperCase()}
                    </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                    {/* User Info */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className={cn("font-semibold cursor-pointer hover:text-primary transition-colors",
                            isNested ? "text-sm" : "text-base"
                        )}>
                            {comment.author}
                        </span>
                    </div>

                    {/* Content */}
                    <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                        {comment.reply_to_username && (
                            <span className="inline-block bg-primary/10 text-primary px-1 rounded text-xs mr-2 align-middle">
                                回复 @{comment.reply_to_username}
                            </span>
                        )}
                        {comment.content}
                    </p>

                    {/* Footer Actions */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{comment.date}</span>

                        <button
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                            onClick={() => {/* Like logic would go here */ }}
                        >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            <span>赞</span>
                        </button>

                        <button
                            className={cn("flex items-center gap-1 hover:text-primary transition-colors", isReplying && "text-primary")}
                            onClick={() => setReplyingTo(comment.id)}
                        >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>回复</span>
                        </button>

                        {(user?.id === comment.userId || profile?.role === 'admin' || profile?.role === 'moderator') && (
                            <button
                                className="flex items-center gap-1 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                onClick={() => handleDeleteComment(comment.id)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>删除</span>
                            </button>
                        )}
                    </div>

                    {/* Reply Input Box */}
                    {isReplying && (
                        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <form
                                onSubmit={(e) =>
                                    handleSubmitReply(e, Number(comment.id), comment.userId, comment.author)
                                }
                                className="flex gap-3 items-start"
                            >
                                <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url || ""} />
                                    <AvatarFallback>M</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-2">
                                    <Textarea
                                        value={replyContent}
                                        onChange={(e) => setReplyContent(e.target.value)}
                                        placeholder={`回复 @${comment.author}...`}
                                        className="min-h-[80px] text-sm resize-none bg-background focus-visible:ring-1"
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button type="button" variant="ghost" size="sm" onClick={handleCancelReply} className="h-8">
                                            取消
                                        </Button>
                                        <Button type="submit" size="sm" className="h-8" disabled={!replyContent.trim()}>
                                            发布
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Nested Comments with Collapse Logic */}
                    {nestedComments.length > 0 && (
                        <div className="mt-3 bg-muted/30 rounded-lg p-3 space-y-4">
                            {displayedComments.map((nested) => (
                                <CommentItem key={nested.id} comment={nested} isNested={true} />
                            ))}

                            {!isExpanded && hiddenCount > 0 && (
                                <button
                                    onClick={() => setIsExpanded(true)}
                                    className="text-xs text-primary hover:underline font-medium"
                                >
                                    查看全部 {nestedComments.length} 条回复
                                </button>
                            )}

                            {isExpanded && nestedComments.length > DISPLAY_LIMIT && (
                                <button
                                    onClick={() => setIsExpanded(false)}
                                    className="text-xs text-muted-foreground hover:underline font-medium"
                                >
                                    收起回复
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="border-t pt-8 relative pb-20">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="text-primary">|</span>
                评论
                <span className="text-base font-normal text-muted-foreground ml-1">{total}</span>
            </h3>

            {/* Comments List */}
            <div className="space-y-2 mb-8">
                {comments.length > 0 ? (
                    <>
                        {topLevelComments.map((comment) => (
                            <CommentItem key={comment.id} comment={comment} />
                        ))}

                        {hasMore && (
                            <div className="text-center pt-4">
                                <Button
                                    variant="outline"
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="w-full sm:w-auto"
                                >
                                    {isLoadingMore ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            加载中...
                                        </>
                                    ) : (
                                        "加载更多评论"
                                    )}
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                        <MessageCircle className="h-10 w-10 mb-2 opacity-20" />
                        <p className="text-sm">还没有评论，快来抢沙发吧！</p>
                    </div>
                )}
            </div>

            {/* Main Input Area - Sticky Bottom */}
            <div className="fixed bottom-16 left-0 right-0 md:sticky md:bottom-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-t md:border-t-0 px-4 md:px-0 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] md:shadow-none">
                <div className="flex gap-4 max-w-4xl mx-auto w-full">
                    <Avatar className="h-10 w-10 border shadow-sm">
                        <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url || ""} />
                        <AvatarFallback className="bg-muted">
                            {profile?.display_name?.[0]?.toUpperCase() || "Me"}
                        </AvatarFallback>
                    </Avatar>
                    <form onSubmit={handleSubmitComment} className="flex-1 relative group">
                        <div className={cn(
                            "rounded-xl border bg-background transition-all duration-200 ease-in-out overflow-hidden focus-within:ring-2 focus-within:ring-primary/20",
                            isFocused || newComment ? "shadow-md" : "shadow-sm hover:shadow-md"
                        )}>
                            <Textarea
                                placeholder="发一条友善的评论..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => !newComment && setIsFocused(false)}
                                className="min-h-[50px] border-none resize-none focus-visible:ring-0 p-3 text-sm bg-transparent"
                            />
                            <div className={cn(
                                "flex justify-between items-center px-3 pb-2 transition-all duration-200",
                                isFocused || newComment ? "opacity-100 max-h-12" : "opacity-0 max-h-0 overflow-hidden"
                            )}>
                                <div className="text-xs text-muted-foreground">
                                    {/* Optional: Emoji trigger or limits could go here */}
                                </div>
                                <Button
                                    type="submit"
                                    disabled={!newComment.trim()}
                                    className="h-7 px-4 rounded-full text-xs"
                                >
                                    发布
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}


