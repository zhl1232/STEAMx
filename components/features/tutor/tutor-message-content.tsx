'use client'

import { memo, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

/** 小迪回复中的站内项目引用标记：[project:12|项目名] */
const PROJECT_TAG_REGEX = /\[project:(\d+)\|([^\]\n]+)\]/g
/** 仅站内项目详情链接才渲染为可点击 chip */
const PROJECT_HREF_REGEX = /^\/project\/\d+$/

/** 只放行轻量行内/列表元素，标题、表格、代码块、图片等一律剥掉外壳保留文字 */
const ALLOWED_ELEMENTS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'a']

function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  if (typeof href === 'string' && PROJECT_HREF_REGEX.test(href)) {
    return (
      <Link
        href={href}
        className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-[hsl(var(--brand-blue)/0.35)] bg-[hsl(var(--status-info-surface)/0.45)] px-1.5 text-[12px] font-medium text-[hsl(var(--brand-blue))] transition-colors hover:bg-[hsl(var(--status-info-surface)/0.8)]"
      >
        <span className="truncate">{children}</span>
        <ArrowUpRight className="h-3 w-3 shrink-0" />
      </Link>
    )
  }
  // 其他链接（外链或模型编造的路径）不可点击，仅展示文字
  return <span>{children}</span>
}

/**
 * 小迪回复气泡内容：轻量 Markdown（列表/加粗）+ 站内项目引用 chip。
 * 先把 [project:ID|标题] 归一化为标准 Markdown 链接，避免打断列表/段落解析。
 */
export const TutorMessageContent = memo(function TutorMessageContent({ content }: { content: string }) {
  const normalized = useMemo(
    () => content.replace(PROJECT_TAG_REGEX, (_match, id: string, title: string) => `[${title}](/project/${id})`),
    [content],
  )

  return (
    <div className="space-y-1.5 whitespace-normal">
      <ReactMarkdown
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        components={{
          p: ({ children }) => <p className="my-0">{children}</p>,
          ul: ({ children }) => <ul className="my-0 list-disc space-y-0.5 pl-4">{children}</ul>,
          ol: ({ children }) => <ol className="my-0 list-decimal space-y-0.5 pl-4">{children}</ol>,
          li: ({ children }) => <li className="my-0">{children}</li>,
          a: ({ href, children }) => <MarkdownLink href={href}>{children}</MarkdownLink>,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  )
})
