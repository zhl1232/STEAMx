import { notFound } from 'next/navigation'

import { MobileBackButton } from '@/components/ui/mobile-back-button'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { birdObservationResourceMap, birdObservationResources } from '@/lib/bird-observation-content'

interface BirdObservationResourcePageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return birdObservationResources.map((resource) => ({ slug: resource.slug }))
}

export default async function BirdObservationResourcePage({ params }: BirdObservationResourcePageProps) {
  const { slug } = await params
  const resource = birdObservationResourceMap[slug]

  if (!resource) {
    notFound()
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10 md:py-14">
      <MobilePageHeader
        title={resource.title}
        fallbackHref="/bird-observation"
        className="-mx-4 -mt-10 mb-4 md:hidden"
      />
      <MobileBackButton fallbackHref="/bird-observation" className="hidden md:block" />

      <div className="mt-4 rounded-3xl border bg-card px-6 py-8 shadow-sm md:px-10 md:py-10">
        <h1 className="text-3xl font-bold tracking-tight">{resource.title}</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{resource.summary}</p>

        <div className="mt-8 space-y-6">
          {resource.sections.map((section) => (
            <section key={section.title} className="rounded-2xl border bg-muted/20 p-5">
              <h2 className="text-xl font-semibold">{section.title}</h2>
              {section.description && (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.description}</p>
              )}
              {section.bullets && section.bullets.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm leading-6 text-foreground/90">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
