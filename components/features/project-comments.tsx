"use client"
import Link from "next/link"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"

import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { MessageCircle, Trash2, ThumbsUp, MessageSquare, Loader2 } from "lucide-react"
import { useProjects } from "@/context/project-context"
import { useAuth } from "@/context/auth-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
import { type Comment, mapDbComment } from "@/lib/mappers/types"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getNameColorClassName } from "@/lib/shop/items"

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
    const [page, setPage] = useState(1)
    const PAGE_SIZE = 5

    const [replyingTo, setReplyingTo] = useState<number | string | null>(null)

    // 底部评论框 ref（非受控）
    const mainTextareaRef = useRef<HTMLTextAreaElement>(null)
    const [mainHasContent, setMainHasContent] = useState(false)
    const [isFocused, setIsFocused] = useState(false)

    const handleLoadMore = async () => {
        if (isLoadingMore || !hasMore) return
        setIsLoadingMore(true)

        try {
            const from = page * PAGE_SIZE
            const to = from + PAGE_SIZE - 1

            const { data: roots, error, count } = await supabase
                .from('comments')
                .select(`
                    *,
                    profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id)
                `, { count: 'exact' })
                .eq('project_id', projectId)
                .is('parent_id', null)
                .order('created_at', { ascending: false })
                .range(from, to)

            if (error) throw error

            let newComments = (roots || []).map(mapDbComment)

            if (roots && roots.length > 0) {
                const rootIds = (roots as { id: number }[]).map(r => r.id)

                // 第 1 层：顶层评论的直接子评论
                const { data: replies } = await supabase
                    .from('comments')
                    .select(`
                        *,
                        profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id)
                    `)
                    .eq('project_id', projectId)
                    .in('parent_id', rootIds)
                    .order('created_at', { ascending: true })

                if (replies && replies.length > 0) {
                    const mappedReplies = replies.map(mapDbComment)
                    newComments = [...newComments, ...mappedReplies]

                    // 第 2 层：回复的回复
                    const firstLevelIds = (replies as { id: number }[]).map(r => r.id)
                    const { data: nestedReplies } = await supabase
                        .from('comments')
                        .select(`
                            *,
                            profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id)
                        `)
                        .eq('project_id', projectId)
                        .in('parent_id', firstLevelIds)
                        .order('created_at', { ascending: true })

                    if (nestedReplies && nestedReplies.length > 0) {
                        newComments = [...newComments, ...nestedReplies.map(mapDbComment)]
                    }
                }
            }

            setComments((prev: Comment[]) => [...prev, ...newComments])
            setPage((prev: number) => prev + 1)
            setHasMore((count || 0) > to + 1)
            if (count !== null) setTotal(count)
        } catch (error) {
            console.error('Error loading more comments:', error)
        } finally {
            setIsLoadingMore(false)
        }
    }

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault()
        const content = mainTextareaRef.current?.value || ""
        if (!content.trim()) return

        const submitComment = async () => {
            const addedComment = await addComment(projectId, {
                id: 0,
                author: profile?.display_name || user?.email?.split('@')[0] || "Me",
                userId: user?.id,
                avatar: profile?.avatar_url || user?.user_metadata?.avatar_url,
                content: content,
                date: "刚刚",
            })

            if (addedComment) {
                setComments((prev: Comment[]) => [addedComment, ...prev])
                setTotal((prev: number) => prev + 1)
                if (mainTextareaRef.current) {
                    mainTextareaRef.current.value = ""
                    setMainHasContent(false)
                }
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

    const handleSubmitReply = useCallback(async (
        e: React.FormEvent,
        content: string,
        parentId: number,
        replyToUserId?: string,
        replyToUsername?: string
    ) => {
        e.preventDefault()
        if (!content.trim()) return

        const submitReply = async () => {
            const addedReply = await addComment(
                projectId,
                {
                    id: 0,
                    author: profile?.display_name || user?.email?.split('@')[0] || "Me",
                    userId: user?.id,
                    avatar: profile?.avatar_url || user?.user_metadata?.avatar_url,
                    content: content,
                    date: "刚刚",
                    reply_to_user_id: replyToUserId,
                    reply_to_username: replyToUsername,
                },
                parentId
            )

            if (addedReply) {
                setComments((prev: Comment[]) => [addedReply, ...prev])
                setTotal((prev: number) => prev + 1)
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
    }, [addComment, projectId, user, profile, promptLogin])

    const handleDeleteComment = async (commentId: string | number) => {
        await deleteComment(commentId)
        setComments((prev: Comment[]) => prev.filter((c: Comment) => c.id !== commentId))
    }

    const handleCancelReply = useCallback(() => {
        setReplyingTo(null)
    }, [])

    const topLevelComments = comments.filter((c: Comment) => !c.parent_id)
    const getNestedComments = (parentId: number | string) => {
        const pid = Number(parentId)
        if (Number.isNaN(pid)) return []
        // 统一用数字比较，避免 string/number 类型不一致导致匹配不到
        return comments.filter((c: Comment) => c.parent_id != null && Number(c.parent_id) === pid)
    }

    const commentsListRef = useRef<HTMLDivElement>(null)

    // CommentItem 定义在内部（因为它依赖闭包访问 comments/replyingTo 等），
    // 关键修改：行内回复框使用原生 textarea + ref，不使用受控状态，
    // 这样即使 CommentItem 被重建，textarea 的输入也不会被干扰
    const CommentItem = ({ comment, isNested = false, rootId }: { comment: Comment, isNested?: boolean, rootId?: number | string }) => {
        const currentRootId = rootId ?? comment.id
        const nestedComments = getNestedComments(comment.id)
        const isReplying = replyingTo === comment.id
        const [isExpanded, setIsExpanded] = useState(false)
        const replyTextareaRef = useRef<HTMLTextAreaElement>(null)
        const DISPLAY_LIMIT = 2

        const displayedComments = isExpanded ? nestedComments : nestedComments.slice(0, DISPLAY_LIMIT)
        const hiddenCount = nestedComments.length - displayedComments.length

        const UserLink = ({ children, className }: { children: React.ReactNode, className?: string }) => {
            if (comment.userId) {
                return (
                    <Link href={`/users/${comment.userId}`} className={className}>
                        {children}
                    </Link>
                )
            }
            return <span className={className}>{children}</span>
        }

        return (
            <div className={cn("group flex gap-3 sm:gap-4", isNested ? "mt-3 sm:mt-4" : "py-4 sm:py-6 border-b border-border/60 last:border-0")}>
                {/* Avatar */}
                <UserLink className="shrink-0">
                    <AvatarWithFrame
                        src={comment.avatar}
                        fallback={comment.author[0]?.toUpperCase()}
                        avatarFrameId={comment.avatarFrameId}
                        className={cn("shrink-0 border transition-transform hover:scale-105", isNested ? "h-8 w-8" : "h-10 w-10 sm:h-12 sm:w-12")}
                        avatarClassName={cn(isNested ? "h-8 w-8" : "h-10 w-10 sm:h-12 sm:w-12")}
                    />
                </UserLink>

                <div className="flex-1 min-w-0 overflow-hidden">
                    {/* User Info */}
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1.5">
                        <UserLink className={cn("font-semibold cursor-pointer hover:text-primary transition-colors shrink-0",
                            isNested ? "text-sm" : "text-base",
                            getNameColorClassName(comment.nameColorId ?? null)
                        )}>
                            {comment.author}
                        </UserLink>
                        <span className="text-xs text-muted-foreground shrink-0">{comment.date}</span>
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
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-xs text-muted-foreground">
                        <button
                            className="flex items-center gap-1 shrink-0 hover:text-primary transition-colors"
                            onClick={() => {/* Like logic would go here */ }}
                        >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            <span>赞</span>
                        </button>

                        <button
                            className={cn("flex items-center gap-1 shrink-0 hover:text-primary transition-colors", isReplying && "text-primary")}
                            onClick={() => setReplyingTo(comment.id)}
                        >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>回复</span>
                        </button>

                        {(user?.id === comment.userId || profile?.role === 'admin' || profile?.role === 'moderator') && (
                            <button
                                className="flex items-center gap-1 shrink-0 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                onClick={() => handleDeleteComment(comment.id)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>删除</span>
                            </button>
                        )}
                    </div>

                    {/* Reply Input Box - 使用原生非受控 textarea，避免受控状态导致组件重建 */}
                    {isReplying && (
                        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    const content = replyTextareaRef.current?.value || ""
                                    if (!content.trim()) return
                                    // 以当前被回复的这条评论作为 parent_id，保证二级回复关系正确
                                    const parentIdForInsert = Number(comment.id)
                                    handleSubmitReply(e, content, parentIdForInsert, comment.userId, comment.author)
                                    if (replyTextareaRef.current) {
                                        replyTextareaRef.current.value = ""
                                    }
                                }}
                                className="flex gap-3 items-start"
                            >
                                <AvatarWithFrame
                                    src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                                    fallback="M"
                                    avatarFrameId={profile?.equipped_avatar_frame_id}
                                    className="h-8 w-8 shrink-0"
                                    avatarClassName="h-8 w-8"
                                />
                                <div className="flex-1 space-y-2">
                                    <textarea
                                        ref={replyTextareaRef}
                                        placeholder={`回复 @${comment.author}...`}
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button type="button" variant="ghost" size="sm" onClick={handleCancelReply} className="h-8">
                                            取消
                                        </Button>
                                        <Button type="submit" size="sm" className="h-8">
                                            发布
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Nested Comments with Collapse Logic */}
                    {nestedComments.length > 0 && (
                        <div className="mt-3 sm:mt-4 bg-muted/30 rounded-lg p-3 space-y-3 sm:space-y-4">
                            {displayedComments.map((nested: Comment) => (
                                <CommentItem key={nested.id} comment={nested} isNested={true} rootId={currentRootId} />
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

    const isExpanded = isFocused || mainHasContent

    return (
        <div className="border-t pt-8 relative pb-20 md:px-6 lg:px-8">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="text-primary">|</span>
                评论
                <span className="text-base font-normal text-muted-foreground ml-1">{total}</span>
            </h3>

            {/* Comments List */}
            <div className="mb-8">
                {comments.length > 0 ? (
                    <>
                        <div
                            ref={commentsListRef}
                            className="overflow-auto rounded-lg"
                            style={{ maxHeight: "60vh" }}
                        >
                            <div className="space-y-0">
                                {topLevelComments.map((comment: Comment) => (
                                    <div key={comment.id} className="pb-0">
                                        <CommentItem comment={comment} />
                                    </div>
                                ))}
                            </div>
                        </div>

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

            {/* Main Input Area - Sticky Bottom - 非受控 textarea */}
            <div className="fixed bottom-16 left-0 right-0 md:sticky md:bottom-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-t md:border-t-0 px-4 md:px-0 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] md:shadow-none">
                <div className="flex gap-4 max-w-4xl mx-auto w-full">
                    <AvatarWithFrame
                        src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                        fallback={profile?.display_name?.[0]?.toUpperCase() || "Me"}
                        avatarFrameId={profile?.equipped_avatar_frame_id}
                        className="h-10 w-10 border shadow-sm"
                        avatarClassName="h-10 w-10"
                    />
                    <form onSubmit={handleSubmitComment} className="flex-1 relative group">
                        <div className={cn(
                            "rounded-xl border bg-background overflow-hidden transition-shadow duration-200 focus-within:ring-2 focus-within:ring-primary/20",
                            isExpanded ? "shadow-md" : "shadow-sm hover:shadow-md"
                        )}>
                            <textarea
                                ref={mainTextareaRef}
                                placeholder="发一条友善的评论..."
                                onChange={(e) => setMainHasContent(e.target.value.trim().length > 0)}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => { if (!mainTextareaRef.current?.value) setIsFocused(false) }}
                                className="flex min-h-[50px] w-full border-none bg-transparent px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 resize-none"
                            />
                            {isExpanded && (
                                <div className="flex justify-between items-center px-3 pb-2">
                                    <div className="text-xs text-muted-foreground" />
                                    <Button
                                        type="submit"
                                        disabled={!mainHasContent}
                                        className="h-7 px-4 rounded-full text-xs"
                                    >
                                        发布
                                    </Button>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
