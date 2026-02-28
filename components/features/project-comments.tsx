"use client"
import Link from "next/link"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"

import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { MessageCircle, Trash2, ThumbsUp, MessageSquare, Loader2, ChevronRight, ChevronLeft } from "lucide-react"
import { useProjects } from "@/context/project-context"
import { useAuth } from "@/context/auth-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
import { type Comment, mapDbComment } from "@/lib/mappers/types"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getNameColorClassName } from "@/lib/shop/items"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface ProjectCommentsProps {
    projectId: string | number
    initialComments: Comment[]
    initialTotal?: number
    initialHasMore?: boolean
    /** 与回复框同行的操作区（服务端不能传函数给客户端，故仅支持 ReactNode） */
    actionsSlot?: React.ReactNode
}

export function ProjectComments({ projectId, initialComments, initialTotal = 0, initialHasMore = false, actionsSlot }: ProjectCommentsProps) {
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
    const [detailRootIdStack, setDetailRootIdStack] = useState<(number | string)[]>([])

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

    /** 某条评论下的全部回复（含多级），平铺列表，用于「共 N 条」与详情页 */
    const getRepliesUnderRoot = useCallback((rootId: number | string): Comment[] => {
        const rid = Number(rootId)
        if (Number.isNaN(rid)) return []
        const byParent = new Map<number, Comment[]>()
        for (const c of comments) {
            if (c.parent_id == null) continue
            const pid = Number(c.parent_id)
            if (!byParent.has(pid)) byParent.set(pid, [])
            byParent.get(pid)!.push(c)
        }
        const result: Comment[] = []
        const queue = [rid]
        while (queue.length > 0) {
            const id = queue.shift()!
            const children = byParent.get(id) || []
            for (const child of children) {
                result.push(child)
                queue.push(Number(child.id))
            }
        }
        return result
    }, [comments])

    const commentsListRef = useRef<HTMLDivElement>(null)
    const sheetReplyRef = useRef<HTMLTextAreaElement>(null)

    /** 单条评论卡片：展示 + 可选回复框，无嵌套列表 */
    const CommentCard = ({ comment, showReplyForm = true, readOnly = false, noBorder = false }: {
        comment: Comment
        showReplyForm?: boolean
        readOnly?: boolean
        noBorder?: boolean
    }) => {
        const isReplying = replyingTo === comment.id
        const replyTextareaRef = useRef<HTMLTextAreaElement>(null)

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
            <div className={cn("group flex gap-2 sm:gap-4 py-4 sm:py-6", !noBorder && "border-b border-border/60 last:border-0")}>
                <UserLink className="shrink-0">
                    <AvatarWithFrame
                        src={comment.avatar}
                        fallback={comment.author[0]?.toUpperCase()}
                        avatarFrameId={comment.avatarFrameId}
                        className="shrink-0 border transition-transform hover:scale-105 h-10 w-10 sm:h-12 sm:w-12"
                        avatarClassName="h-10 w-10 sm:h-12 sm:w-12"
                    />
                </UserLink>

                <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="mb-1.5">
                        <UserLink className={cn("font-semibold cursor-pointer hover:text-primary transition-colors text-base", getNameColorClassName(comment.nameColorId ?? null))}>
                            {comment.author}
                        </UserLink>
                    </div>

                    <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                        {comment.reply_to_username && (
                            <span className="inline-block bg-primary/10 text-primary px-1 rounded text-xs mr-2 align-middle">
                                回复 @{comment.reply_to_username}
                            </span>
                        )}
                        {comment.content}
                    </p>

                    {!readOnly && (
                        <div className="flex justify-between items-center gap-2 mt-2.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-3 shrink-0 min-w-0">
                                <span className="shrink-0">{comment.date}</span>
                                {showReplyForm && (
                                    <button
                                        type="button"
                                        className={cn("shrink-0 flex items-center gap-1 hover:text-primary transition-colors", isReplying && "text-primary")}
                                        onClick={() => setReplyingTo(comment.id)}
                                    >
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        <span>回复</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-x-4 shrink-0">
<button type="button" className="flex items-center gap-1 hover:text-primary transition-colors" title="赞" aria-label="赞">
                                <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                                {(user?.id === comment.userId || profile?.role === 'admin' || profile?.role === 'moderator') && (
                                    <button
                                        type="button"
                                        className="flex items-center gap-1 hover:text-destructive transition-colors text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDeleteComment(comment.id)}
                                        title="删除"
                                        aria-label="删除"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {showReplyForm && !readOnly && isReplying && (
                        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    const content = replyTextareaRef.current?.value || ""
                                    if (!content.trim()) return
                                    handleSubmitReply(e, content, Number(comment.id), comment.userId, comment.author)
                                    if (replyTextareaRef.current) replyTextareaRef.current.value = ""
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
                                        <Button type="button" variant="ghost" size="sm" onClick={handleCancelReply} className="h-8">取消</Button>
                                        <Button type="submit" size="sm" className="h-8">发布</Button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const isExpanded = isFocused || mainHasContent

    return (
        <div className="border-t pt-8 relative md:px-6 lg:px-8">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="text-primary">|</span>
                评论
                <span className="text-base font-normal text-muted-foreground ml-1">{total}</span>
            </h3>

            {/* Comments List - 不设固定高度，随内容增高，整页滚动，避免内部滚动条与多余空白 */}
            <div className="mb-8">
                {comments.length > 0 ? (
                    <>
                        <div ref={commentsListRef} className="rounded-lg">
                            <div className="space-y-0">
                                {topLevelComments.map((comment: Comment) => {
                                    const replyCount = getRepliesUnderRoot(comment.id).length
                                    return (
                                        <div key={comment.id} className="border-b border-border/60 last:border-0">
                                            <CommentCard comment={comment} showReplyForm={true} readOnly={false} noBorder />
                                            {replyCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setDetailRootIdStack([comment.id]); setReplyingTo(null); }}
                                                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors py-2 px-3"
                                                >
                                                    共 {replyCount} 条回复
                                                    <ChevronRight className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
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

            {/* 评论详情 Sheet：栈式钻取 + 查看对话 + 返回 */}
            <Sheet open={detailRootIdStack.length > 0} onOpenChange={(open) => { if (!open) setDetailRootIdStack([]); setReplyingTo(null) }}>
                <SheetContent side="bottom" className="h-[70vh] flex flex-col p-0">
                    <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0 flex flex-row items-center gap-2">
                        {detailRootIdStack.length > 1 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 -ml-2"
                                onClick={() => setDetailRootIdStack(prev => prev.slice(0, -1))}
                            >
                                <ChevronLeft className="h-5 w-5" />
                                <span className="sr-only">返回</span>
                            </Button>
                        )}
                        <SheetTitle className="flex-1">评论详情</SheetTitle>
                    </SheetHeader>
                    {detailRootIdStack.length > 0 && (() => {
                        const currentRootId = detailRootIdStack[detailRootIdStack.length - 1]
                        const rootComment = comments.find((c: Comment) => Number(c.id) === Number(currentRootId))
                        const detailReplies = getRepliesUnderRoot(currentRootId)
                        if (!rootComment) return null
                        return (
                            <>
                                <div className="flex-1 overflow-auto px-4">
                                    <CommentCard comment={rootComment} showReplyForm={false} readOnly={true} />
                                    <p className="text-sm text-muted-foreground py-2">相关回复共 {detailReplies.length} 条</p>
                                    {detailReplies.map((c: Comment) => {
                                        const childCount = getRepliesUnderRoot(c.id).length
                                        return (
                                            <div key={c.id} className="border-b border-border/60 last:border-0">
                                                <CommentCard comment={c} showReplyForm={true} readOnly={false} noBorder />
                                                {childCount > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDetailRootIdStack(prev => [...prev, c.id])}
                                                        className="text-sm text-primary hover:underline py-2 px-0"
                                                    >
                                                        查看对话
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="shrink-0 border-t p-4 bg-background">
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault()
                                            const content = sheetReplyRef.current?.value?.trim()
                                            if (!content) return
                                            handleSubmitReply(e, content, Number(currentRootId), rootComment.userId, rootComment.author)
                                            if (sheetReplyRef.current) sheetReplyRef.current.value = ""
                                        }}
                                        className="flex gap-2 items-end"
                                    >
                                        <textarea
                                            ref={sheetReplyRef}
                                            placeholder={`回复 @${rootComment.author}...`}
                                            className="min-h-[60px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                                        />
                                        <Button type="submit" size="sm" className="shrink-0 h-9">发布</Button>
                                    </form>
                                </div>
                            </>
                        )
                    })()}
                </SheetContent>
            </Sheet>

            {/* 底部固定悬浮栏：单行 [头像] [胶囊输入框] [心][收藏][硬币]，顶部细线+柔和上投影 */}
            <div className="fixed bottom-16 left-0 right-0 md:sticky md:bottom-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-3 border-t border-[#F0F0F0] dark:border-border md:border-t-0 px-4 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] md:shadow-none">
                <div className="flex items-center gap-3 max-w-4xl mx-auto w-full">
                    <AvatarWithFrame
                        src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                        fallback={profile?.display_name?.[0]?.toUpperCase() || "Me"}
                        avatarFrameId={profile?.equipped_avatar_frame_id}
                        className="h-9 w-9 border shrink-0"
                        avatarClassName="h-9 w-9"
                    />
                    <form onSubmit={handleSubmitComment} className="flex-1 min-w-0 flex items-center mr-4">
                        <div className={cn(
                            "flex items-center w-full min-w-0 bg-[#F0F2F5] dark:bg-muted/90 overflow-hidden transition-all duration-200 ease-out",
                            "focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-0",
                            "min-w-[160px]",
                            isExpanded ? "rounded-xl" : "rounded-3xl"
                        )}>
                            <textarea
                                ref={mainTextareaRef}
                                placeholder="说点什么..."
                                rows={1}
                                onChange={(e) => setMainHasContent(e.target.value.trim().length > 0)}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => { if (!mainTextareaRef.current?.value) setIsFocused(false) }}
                                className={cn(
                                    "py-3 px-4 w-full bg-transparent text-base placeholder:text-muted-foreground focus-visible:outline-none resize-none leading-normal",
                                    isExpanded ? "min-h-[88px] max-h-[200px]" : "min-h-[44px] max-h-[120px]"
                                )}
                            />
                            {isExpanded && (
                                <Button
                                    type="submit"
                                    disabled={!mainHasContent}
                                    size="sm"
                                    className="shrink-0 h-9 px-4 mr-2 rounded-lg text-sm font-medium"
                                >
                                    发布
                                </Button>
                            )}
                        </div>
                    </form>
                    {/* 聚焦时隐藏右侧操作区，让回复区域更宽 */}
                    {!isFocused && <div className="min-w-2 shrink-0" aria-hidden />}
                    {actionsSlot != null && !isFocused && (
                        <div className="shrink-0 flex items-center">
                            {actionsSlot}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
