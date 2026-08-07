export type MessageContextItem = {
  id: number
  senderId: string
  receiverId: string
  content: string
  createdAt: string
}

type MessageContextProps = {
  metadata?: Record<string, unknown> | null
  contentId: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseMessageContext(metadata: Record<string, unknown> | null | undefined) {
  const rawContext = metadata?.messageContext
  if (!isRecord(rawContext) || !Array.isArray(rawContext.messages)) return []

  return rawContext.messages
    .map((value) => {
      if (!isRecord(value)) return null

      const id = Number(value.id)
      const senderId = typeof value.senderId === "string" ? value.senderId : ""
      const receiverId = typeof value.receiverId === "string" ? value.receiverId : ""
      const content = typeof value.content === "string" ? value.content : ""
      const createdAt = typeof value.createdAt === "string" ? value.createdAt : ""

      if (!Number.isInteger(id) || !senderId || !receiverId || !content || !createdAt) return null
      return { id, senderId, receiverId, content, createdAt } satisfies MessageContextItem
    })
    .filter((value): value is MessageContextItem => value !== null)
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN")
}

export function MessageContext({ metadata, contentId }: MessageContextProps) {
  const messages = parseMessageContext(metadata)
  if (messages.length === 0) return null

  return (
    <div className="mt-3 space-y-2 rounded-md border border-border/70 bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">私信上下文</p>
        <span className="text-[11px] text-muted-foreground">举报消息前后记录</span>
      </div>
      <div className="max-h-64 space-y-1.5 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.id === contentId
                ? "rounded-sm border border-destructive/30 bg-destructive/5 px-2.5 py-2"
                : "rounded-sm bg-muted/50 px-2.5 py-2"
            }
          >
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{message.id === contentId ? "被举报消息" : "上下文消息"}</span>
              <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
            </div>
            <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm text-foreground">{message.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
