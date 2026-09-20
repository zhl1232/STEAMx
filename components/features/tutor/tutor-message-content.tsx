'use client'

import { Children, Fragment, memo, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

import { ScratchRichText } from '@/components/features/courses/lesson-rich-text'
import { AUDIO_TAG_REGEX } from '@/lib/ai/tutor/audio-tags'
import { resolveAssetDisplayUrl } from '@/lib/utils/asset-url'
import { getTutorResourceHrefs, isTutorResourceHref, tutorResourceTagsToMarkdown } from '@/lib/ai/tutor/resource-links'

/** 只放行轻量行内/列表元素，标题、表格、代码块、图片等一律剥掉外壳保留文字 */
const ALLOWED_ELEMENTS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'a']

type ContentPart =
  | { type: 'markdown'; content: string }
  | { type: 'audio'; path: string; label: string }

function stripAudioTags(content: string) {
  return content.replace(AUDIO_TAG_REGEX, '').replace(/\n{3,}/g, '\n\n').trim()
}

function splitTutorContent(content: string, allowAudio: boolean): ContentPart[] {
  if (!allowAudio) return [{ type: 'markdown', content: stripAudioTags(content) }]

  const parts: ContentPart[] = []
  let lastIndex = 0
  const regex = new RegExp(AUDIO_TAG_REGEX.source, 'g')

  for (const match of content.matchAll(regex)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      parts.push({ type: 'markdown', content: content.slice(lastIndex, index) })
    }
    parts.push({ type: 'audio', path: match[1].trim(), label: match[2].trim() })
    lastIndex = index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'markdown', content: content.slice(lastIndex) })
  }

  return parts.length ? parts : [{ type: 'markdown', content }]
}

function MarkdownLink({ href, allowedHrefs, children }: { href?: string; allowedHrefs: Set<string>; children?: ReactNode }) {
  // Route shape alone cannot authorize Markdown reference links or autolinks.
  if (typeof href === 'string' && isTutorResourceHref(href) && allowedHrefs.has(decodeURIComponent(href))) {
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
  return <span>{children}</span>
}

function TutorAudioPlayer({ path, label }: { path: string; label: string }) {
  const src = useMemo(() => resolveAssetDisplayUrl(path) ?? path, [path])

  return (
    <div className="rounded-xl border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--background))] px-3 py-2">
      <p className="mb-1.5 text-[12px] font-medium text-[hsl(var(--foreground)/0.75)]">{label} · 鸟鸣</p>
      <audio className="w-full" controls preload="none" src={src}>
        你的浏览器不支持音频播放。
      </audio>
    </div>
  )
}

function renderScratchInline(children: ReactNode): ReactNode {
  return Children.toArray(children).flatMap((child, index) => {
    if (typeof child === 'string') return [<ScratchRichText key={`scratch-${index}`} text={child} />]
    return [<Fragment key={`node-${index}`}>{child}</Fragment>]
  })
}

function TutorMarkdownBlock({ content }: { content: string }) {
  const normalized = useMemo(() => tutorResourceTagsToMarkdown(content), [content])
  const allowedHrefs = useMemo(() => getTutorResourceHrefs(content), [content])

  if (!normalized.trim()) return null

  return (
    <ReactMarkdown
      allowedElements={ALLOWED_ELEMENTS}
      unwrapDisallowed
      components={{
        p: ({ children }) => <p className="my-0">{renderScratchInline(children)}</p>,
        strong: ({ children }) => <strong>{renderScratchInline(children)}</strong>,
        em: ({ children }) => <em>{renderScratchInline(children)}</em>,
        ul: ({ children }) => <ul className="my-0 list-disc space-y-0.5 pl-4">{children}</ul>,
        ol: ({ children }) => <ol className="my-0 list-decimal space-y-0.5 pl-4">{children}</ol>,
        li: ({ children }) => <li className="my-0">{renderScratchInline(children)}</li>,
        a: ({ href, children }) => <MarkdownLink href={href} allowedHrefs={allowedHrefs}>{renderScratchInline(children)}</MarkdownLink>,
      }}
    >
      {normalized}
    </ReactMarkdown>
  )
}

/**
 * 小迪回复气泡内容：轻量 Markdown（列表/加粗）+ 已校验的站内资源引用 chip + 鸟鸣音频播放器。
 */
export const TutorMessageContent = memo(function TutorMessageContent({
  content,
  allowAudio = false,
}: {
  content: string
  allowAudio?: boolean
}) {
  const parts = useMemo(() => splitTutorContent(content, allowAudio), [allowAudio, content])

  return (
    <div className="space-y-1.5 whitespace-normal">
      {parts.map((part, index) =>
        part.type === 'audio' ? (
          <TutorAudioPlayer key={`${part.path}-${index}`} path={part.path} label={part.label} />
        ) : (
          <TutorMarkdownBlock key={`md-${index}`} content={part.content} />
        ),
      )}
    </div>
  )
})
