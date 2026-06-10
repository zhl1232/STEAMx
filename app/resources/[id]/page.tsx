import type { Metadata } from 'next'
import type { ComponentProps } from 'react'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { getPublishedLearningResource } from '@/lib/api/learning-resources'
import { LEARNING_RESOURCE_CATEGORY_LABELS } from '@/lib/learning-resources'
import { buildPageMetadata } from '@/lib/seo/metadata'

interface ResourcePageProps {
  params: Promise<{ id: string }>
}

function parseResourceId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function generateMetadata({ params }: ResourcePageProps): Promise<Metadata> {
  const { id } = await params
  const resourceId = parseResourceId(id)
  const resource = resourceId ? await getPublishedLearningResource(resourceId) : null

  if (!resource) {
    return buildPageMetadata({
      title: '资料卡',
      description: '学习资料卡',
      path: `/resources/${id}`,
      noIndex: true,
    })
  }

  return buildPageMetadata({
    title: resource.title,
    description: resource.summary || `${resource.title} — 学习资料卡`,
    path: `/resources/${resource.id}`,
    type: 'article',
    keywords: [LEARNING_RESOURCE_CATEGORY_LABELS[resource.category]],
  })
}

const markdownComponents: ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => (
    <h2 className="mt-8 text-xl font-semibold tracking-tight first:mt-0">{children}</h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 text-xl font-semibold tracking-tight first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 text-base font-semibold tracking-tight first:mt-0">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mt-3 text-sm leading-7 text-foreground/85">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-7 text-foreground/85">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-7 text-foreground/85">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="mt-3 border-l-2 border-[hsl(var(--brand-blue))] pl-4 text-sm leading-7 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-[hsl(var(--surface-border)/0.55)]" />,
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium text-primary underline underline-offset-2"
      {...(href?.startsWith('/') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">{children}</code>
  ),
}

export default async function ResourcePage({ params }: ResourcePageProps) {
  const { id } = await params
  const resourceId = parseResourceId(id)

  if (!resourceId) notFound()

  const resource = await getPublishedLearningResource(resourceId)

  if (!resource) notFound()

  const categoryLabel = LEARNING_RESOURCE_CATEGORY_LABELS[resource.category] || '资料'

  return (
    <div className="page-shell pt-0 pb-24 md:pt-6 md:pb-10">
      <MobilePageHeader
        title={resource.title}
        fallbackHref="/create"
        className="md:hidden"
      />

      <div className="mx-auto max-w-3xl pt-5 md:pt-0">
        <article className="surface-panel overflow-hidden">
          <header className="border-b border-border/60 bg-[hsl(var(--surface-muted)/0.56)] px-5 py-5 sm:px-6 sm:py-6">
            <p className="section-kicker">资料卡 · {categoryLabel}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {resource.title}
            </h1>
            {resource.summary ? (
              <p className="mt-3 max-w-[42rem] text-sm leading-7 text-muted-foreground">
                {resource.summary}
              </p>
            ) : null}
          </header>

          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <ReactMarkdown components={markdownComponents}>{resource.contentMd}</ReactMarkdown>
          </div>
        </article>
      </div>
    </div>
  )
}
