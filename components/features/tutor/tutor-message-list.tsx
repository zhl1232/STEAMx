'use client'

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { Loader2, Sparkles, Trash2, Volume2, VolumeX } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

import { OptimizedImage } from '@/components/ui/optimized-image'
import { TutorMessageContent } from '@/components/features/tutor/tutor-message-content'
import type { TutorChatMessage } from '@/components/features/tutor/use-tutor-chat-stream'
import type {
  TutorHistoryDetail,
  TutorHistoryItem,
  TutorPanelView,
} from '@/components/features/tutor/use-tutor-history'
import { buildStartStagePrompt } from '@/lib/ai/tutor/greeting'
import type { AiCreditStatus, TutorGreeting } from '@/lib/ai/tutor/types'
import { MEMBER_AI_MONTHLY_CREDITS } from '@/lib/membership'
import { cn } from '@/lib/utils'

export type TutorMessageListProps = {
  view: TutorPanelView
  isAuthenticated: boolean
  messages: TutorChatMessage[]
  greeting: TutorGreeting | null
  busy: boolean
  quota: AiCreditStatus | null
  sessionFetching: boolean
  sessionError: boolean
  allowAudioMessages: boolean
  contextType: string
  stageIndex?: number
  stageTitle?: string
  quickPrompts: string[]
  speechLoadingKey: string | null
  playingSpeechKey: string | null
  onPlaySpeech: (content: string, speechKey: string) => void | Promise<void>
  onSendPrompt: (text: string) => void
  historyItems: TutorHistoryItem[] | null
  historyLoading: boolean
  historyDetail: TutorHistoryDetail | null
  historyDetailLoading: boolean
  deletingHistoryId: string | null
  onOpenHistoryDetail: (item: TutorHistoryItem) => void
  onDeleteHistoryConversation: (
    conversation: Pick<TutorHistoryItem, 'id' | 'title'>,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void
}

/** 小迪面板滚动消息区：聊天 / 历史列表 / 历史详情三个视图 */
export function TutorMessageList({
  view,
  isAuthenticated,
  messages,
  greeting,
  busy,
  quota,
  sessionFetching,
  sessionError,
  allowAudioMessages,
  contextType,
  stageIndex,
  stageTitle,
  quickPrompts,
  speechLoadingKey,
  playingSpeechKey,
  onPlaySpeech,
  onSendPrompt,
  historyItems,
  historyLoading,
  historyDetail,
  historyDetailLoading,
  deletingHistoryId,
  onOpenHistoryDetail,
  onDeleteHistoryConversation,
}: TutorMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollRef.current || view !== 'chat') return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, busy, view])

  // 历史视图从顶部开始阅读
  useEffect(() => {
    if (!scrollRef.current || view === 'chat') return
    scrollRef.current.scrollTop = 0
  }, [view, historyDetail])

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
      {view === 'history' && (
        <>
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-14 animate-pulse rounded-sm bg-muted" />
              ))}
            </div>
          ) : !historyItems || historyItems.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              这个场景还没有历史对话。点「开启新对话」后，旧对话会出现在这里。
            </p>
          ) : (
            historyItems.map((item) => {
              const deleting = deletingHistoryId === item.id
              return (
                <div
                  key={item.id}
                  className="group flex items-stretch overflow-hidden rounded-sm border border-[hsl(var(--brand-blue)/0.15)] bg-[hsl(var(--surface-raised))] transition-colors hover:bg-[hsl(var(--status-info-surface)/0.4)]"
                >
                  <button
                    type="button"
                    onClick={() => onOpenHistoryDetail(item)}
                    disabled={deleting}
                    className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:cursor-wait disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-medium text-foreground">{item.title}</p>
                      {item.archivedAt ? (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(item.archivedAt), { addSuffix: true, locale: zhCN })}
                        </span>
                      ) : null}
                    </div>
                    {item.preview ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.preview}</p>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => onDeleteHistoryConversation(item, event)}
                    disabled={deleting || deletingHistoryId !== null}
                    aria-label={`删除历史对话：${item.title}`}
                    title="删除这条历史对话"
                    className="my-1.5 mr-1.5 inline-flex w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[hsl(var(--status-danger-surface)/0.78)] hover:text-[hsl(var(--status-danger))] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--status-danger)/0.25)] disabled:cursor-wait disabled:opacity-55"
                  >
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )
            })
          )}
        </>
      )}

      {view === 'historyDetail' && (
        <>
          {historyDetailLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : historyDetail && historyDetail.messages.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">这条对话没有消息。</p>
          ) : (
            historyDetail?.messages.map((message, i) => {
              const speechKey = `history-${i}`
              return message.role === 'assistant' ? (
                <TutorBubble
                  key={i}
                  action={
                    message.content ? (
                      <TutorSpeechButton
                        content={message.content}
                        speechKey={speechKey}
                        loading={speechLoadingKey === speechKey}
                        playing={playingSpeechKey === speechKey}
                        onPlay={onPlaySpeech}
                      />
                    ) : null
                  }
                >
                  <TutorMessageContent content={message.content} allowAudio={allowAudioMessages} />
                </TutorBubble>
              ) : (
                <UserBubble key={i} message={message} />
              )
            })
          )}
        </>
      )}

      {view === 'chat' && !isAuthenticated && (
        <TutorBubble>
          你好呀！我是小迪 👋 STEAM 探索的 AI 学习导师。登录后我就能记住你的进度，陪你做项目、聊挑战、认自然～
        </TutorBubble>
      )}
      {view === 'chat' && isAuthenticated && messages.length === 0 && !greeting && sessionFetching && (
        <TutorBubble>
          <span className="text-muted-foreground">小迪正在准备这个场景…</span>
        </TutorBubble>
      )}
      {view === 'chat' && isAuthenticated && messages.length === 0 && !greeting && sessionError && (
        <TutorBubble error>小迪场景加载失败，可以直接提问，我会在发送时重新连接。</TutorBubble>
      )}
      {view === 'chat' && messages.length === 0 && greeting && (
        <>
          <TutorBubble>{greeting.message}</TutorBubble>
          {isAuthenticated && contextType === 'challenge' && stageIndex != null && (
            <div>
              <button
                type="button"
                onClick={() => onSendPrompt(buildStartStagePrompt(stageTitle || '当前阶段'))}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--brand-blue))] px-3.5 py-1.5 text-xs font-semibold text-[hsl(var(--brand-blue-foreground))] shadow-xs transition-transform hover:scale-[1.03] disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                带我开始这一步
              </button>
            </div>
          )}
          {isAuthenticated && (quickPrompts.length > 0 || greeting.quickPrompts.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {(quickPrompts.length > 0 ? quickPrompts : greeting.quickPrompts).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSendPrompt(prompt)}
                  disabled={busy}
                  className="rounded-full border border-[hsl(var(--brand-blue)/0.3)] bg-[hsl(var(--surface-raised))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--brand-blue))] transition-colors hover:bg-[hsl(var(--status-info-surface)/0.6)] disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'chat' &&
        messages.map((message, i) => {
          const speechKey = `chat-${i}`
          return message.role === 'assistant' ? (
            <TutorBubble
              key={i}
              error={message.error}
              action={
                message.content && !message.error && !message.streaming ? (
                  <TutorSpeechButton
                    content={message.content}
                    speechKey={speechKey}
                    loading={speechLoadingKey === speechKey}
                    playing={playingSpeechKey === speechKey}
                    onPlay={onPlaySpeech}
                  />
                ) : null
              }
            >
              {message.content ? (
                message.error ? (
                  message.content
                ) : (
                  <TutorMessageContent content={message.content} allowAudio={allowAudioMessages} />
                )
              ) : null}
              {message.streaming && !message.content ? <ThinkingIndicator /> : null}
            </TutorBubble>
          ) : (
            <UserBubble key={i} message={message} />
          )
        })}

      {view === 'chat' && busy && messages[messages.length - 1]?.role !== 'assistant' && (
        <TutorBubble>
          <ThinkingIndicator />
        </TutorBubble>
      )}

      {view === 'chat' && quota && !quota.canChat && (
        <div className="rounded-sm border border-[hsl(var(--brand-blue)/0.25)] bg-[hsl(var(--status-info-surface)/0.35)] p-3 text-xs leading-5 text-foreground/85">
          今日免费次数或本月代币已用完。开通会员每月可获 {MEMBER_AI_MONTHLY_CREDITS} 代币，绝大多数时间够用～
        </div>
      )}
    </div>
  )
}

function UserBubble({ message }: { message: TutorChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] space-y-1.5">
        {message.content ? (
          <div className="whitespace-pre-wrap rounded-sm rounded-tr-sm bg-[hsl(var(--brand-blue))] px-3 py-2 text-[13px] leading-6 text-[hsl(var(--brand-blue-foreground))]">
            {message.content}
          </div>
        ) : null}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {message.images.map((image, idx) => (
              <span key={idx} className="relative h-12 w-12 overflow-hidden rounded-xs bg-muted">
                <OptimizedImage src={image} alt="产出图" fill variant="thumbnail" className="object-cover" />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ThinkingIndicator() {
  return <span className="text-muted-foreground">小迪正在思考…</span>
}

function TutorSpeechButton({
  content,
  speechKey,
  loading,
  playing,
  onPlay,
}: {
  content: string
  speechKey: string
  loading: boolean
  playing: boolean
  onPlay: (content: string, speechKey: string) => void | Promise<void>
}) {
  return (
    <button
      type="button"
      onClick={() => void onPlay(content, speechKey)}
      disabled={loading}
      aria-label={playing ? '停止朗读' : '朗读这条回复'}
      title={playing ? '停止朗读' : '朗读这条回复'}
      className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--surface-raised))] text-[hsl(var(--brand-blue))] transition-colors hover:bg-[hsl(var(--status-info-surface)/0.55)] disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : playing ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function TutorBubble({ children, error, action }: { children: ReactNode; error?: boolean; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-1.5">
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-wrap rounded-sm rounded-tl-sm px-3 py-2 text-[13px] leading-6',
          error
            ? 'bg-[hsl(var(--status-danger-surface)/0.7)] text-[hsl(var(--status-danger))]'
            : 'bg-[hsl(var(--surface-raised))] text-foreground/88',
        )}
      >
        {children}
      </div>
      {action}
    </div>
  )
}
