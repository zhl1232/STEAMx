import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { OptimizedImage } from '@/components/ui/optimized-image'
import { LEARNING_QUICK_START } from '@/lib/product/learning-quick-start'
import { LEARNING_TOPICS, type LearningTopicDefinition } from '@/lib/seo/learning-topics'
import { GuideDisclosure } from './guide-disclosure'

export type LearningResource = {
  id: string | number
  title: string
  description: string | null | undefined
  href: string
  detail: string
  image?: string | null
}

function Preparation({ topic }: { topic: LearningTopicDefinition }) {
  const quick = LEARNING_QUICK_START[topic.slug]
  return (
    <div id={topic.slug === 'nature' ? 'observation-preparation' : undefined} className="scroll-mt-24 space-y-2 text-sm leading-6">
      <p><strong className="font-semibold text-foreground">准备：</strong>{quick.materials}</p>
      <p id={topic.slug === 'nature' ? 'observation-boundaries' : undefined} className="scroll-mt-24 text-muted-foreground"><strong className="font-semibold">{topic.slug === 'scratch' ? '提示：' : '先留意：'}</strong>{quick.safety}</p>
    </div>
  )
}

function FirstTry({ topic }: { topic: LearningTopicDefinition }) {
  const quick = LEARNING_QUICK_START[topic.slug]
  return (
    <section id="first-try" aria-labelledby="first-try-heading" className="scroll-mt-24 rounded-sm border border-[hsl(var(--topic-accent)/0.3)] bg-[hsl(var(--topic-accent)/0.05)] p-4 md:p-6">
      <h2 id="first-try-heading" className="text-lg font-bold text-foreground">{topic.firstQuestion}</h2>
      <div className="mt-3"><Preparation topic={topic} /></div>
      <ol className="mt-4 grid gap-3 md:grid-cols-3 md:gap-5">
        {quick.steps.map((step, index) => (
          <li key={step} className="flex gap-2 text-sm leading-6 text-foreground/85">
            <span aria-hidden="true" className="font-bold tabular-nums text-[hsl(var(--topic-accent))]">{index + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ResourceCards({ resources }: { resources: LearningResource[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {resources.map((resource) => (
        <li key={resource.id} className="min-w-0">
          <Link href={resource.href} prefetch={false} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-sm border border-border bg-card transition hover:border-[hsl(var(--topic-accent)/0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {resource.image ? (
              <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                <OptimizedImage src={resource.image} alt="" fill variant="grid" sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw" className="object-cover" />
              </div>
            ) : null}
            <div className="flex flex-1 items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <h3 className="text-base font-bold leading-6 text-foreground">{resource.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{resource.detail}</p>
                {resource.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{resource.description}</p> : null}
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[hsl(var(--topic-accent))]" aria-hidden="true" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function LearningGuide({ topic, resources }: { topic: LearningTopicDefinition; resources: LearningResource[] }) {
  const quick = LEARNING_QUICK_START[topic.slug]
  const observation = topic.observationGuide
  // 科学入门只能由实际项目承接；指南中的例子不作为独立推荐。
  const catalogOnly = topic.slug === 'science'
  return (
    <>
      <header className="mb-5">
        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">{topic.label}</h1>
        <p className="mt-3 text-sm leading-7 text-foreground/85 md:text-base">{catalogOnly && !resources.length ? '从一个想验证的问题开始，先确认材料和操作要求。' : quick.summary}</p>
        {!catalogOnly || resources.length > 0 ? <a href={quick.directActivity ? '#first-try' : '#start-learning'} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {quick.action}<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a> : null}
      </header>

      {quick.directActivity ? <FirstTry topic={topic} /> : null}

      <section id="start-learning" aria-labelledby="learning-resources" className="scroll-mt-24 py-6 md:py-8">
        {/* 旧纸桥入口的锚点改落到项目选择区，不再引导到独立示例。 */}
        {catalogOnly ? <span id="first-try" className="block scroll-mt-24" aria-hidden="true" /> : null}
        {!quick.directActivity ? <div className="mb-5"><Preparation topic={topic} /></div> : null}
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="learning-resources" className="text-xl font-bold text-foreground">{catalogOnly ? '选一个科学项目开始' : topic.resourceHeading}</h2>
          <Link href={topic.browseHref} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[hsl(var(--nav-active))] hover:underline">{topic.browseLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        {/* 自然观察的隐私提醒保留在发布入口之前，不放入折叠内容。 */}
        <p className="mt-1 mb-4 max-w-3xl text-sm leading-6 text-muted-foreground">{topic.resourceIntroduction}</p>
        {resources.length ? <>
          <ResourceCards resources={resources.slice(0, 3)} />
          {resources.length > 3 ? <div className="mt-3"><GuideDisclosure title={`再看 ${resources.length - 3} 个选择`}><ResourceCards resources={resources.slice(3)} /></GuideDisclosure></div> : null}
        </> : <p className="rounded-sm border border-dashed border-border p-4 text-sm leading-7 text-muted-foreground">
          {catalogOnly ? <>暂时没有可展示的科学项目。<Link href="/explore" className="ml-1 inline-flex min-h-11 items-center font-semibold text-[hsl(var(--nav-active))] hover:underline">去探索其他项目</Link></> : '这个主题暂时没有可展示的课程。可以先试试本页的小挑战，或选择其他方向。'}
        </p>}
      </section>

      <section aria-labelledby="guide-more-heading" className="space-y-3 border-t border-border py-6">
        <h2 id="guide-more-heading" className="text-base font-semibold text-foreground">需要时，再看这些</h2>
        {!quick.directActivity && !catalogOnly ? <GuideDisclosure title={`先试个小挑战：${topic.firstQuestion}`}><FirstTry topic={topic} /></GuideDisclosure> : null}
        <GuideDisclosure title={observation ? '出发准备和完整观察守则' : '材料和准备：查看完整说明'}>
          <section aria-labelledby="learning-preparation">
            <h3 id="learning-preparation" className="scroll-mt-24 font-bold text-foreground">开始前准备什么</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5">{topic.preparation.map(item => <li key={item}>{item}</li>)}</ul>
          </section>
          {topic.equipmentSets ? <section aria-labelledby="building-equipment">
            <h3 id="building-equipment" className="scroll-mt-24 font-bold text-foreground">认识课程使用的教育套装</h3>
            <p className="mt-2">9090、9076、9656、45002 各有侧重。套装编号帮助识别零件组合；准备具体作品时，还要核对课时的零件清单、数量和连接方式，不能只凭套装编号判断零件是否齐全。</p>
            <h4 className="mt-4 font-semibold text-foreground">小班、中班、大班怎么选套？</h4>
            <ul className="mt-2 space-y-2">
              <li><strong>小班：主要使用 9090＋9076。</strong>从基础造型、生活场景和管道组合开始，练习拼接、互锁与简单结构。</li>
              <li><strong>中班：工程搭建可参考 45002。</strong>车辆、吊车等装配活动可从这类工程套装入手，再按作品需要搭配基础积木。</li>
              <li><strong>大班：机械探索可参考 9656。</strong>围绕齿轮、杠杆、滑轮和轮轴开展活动，再按作品需要补充结构零件。</li>
            </ul>
            <p className="mt-3">中班、大班为按学习内容给出的选套参考，尚未逐课核对全部作品所需零件；不代表单套即可完成整门课程。购买或准备前，请先查看选中课时的零件清单与搭建图。</p>
            <dl className="mt-4 grid gap-4 md:grid-cols-2">{topic.equipmentSets.map(set => <div key={set.code}><dt className="font-semibold text-foreground">{set.code} {set.name}</dt><dd className="mt-1">{set.use}</dd></div>)}</dl>
          </section> : null}
          {observation ? <>
            <section><h3 className="font-bold text-foreground">按需要再带这些</h3><ul className="mt-2 list-disc space-y-2 pl-5">{observation.optionalEquipment.map(item => <li key={item}>{item}</li>)}</ul></section>
            <section aria-labelledby="observation-rules">
              <h3 id="observation-rules" className="scroll-mt-24 font-bold text-foreground">观察可以做什么，哪些事不要做</h3>
              <div className="mt-3 grid gap-5 md:grid-cols-2">
                <section aria-labelledby="observation-can-do"><h4 id="observation-can-do" className="font-semibold text-foreground">可以做</h4><ul className="mt-2 list-disc space-y-2 pl-5">{observation.canDo.map(item => <li key={item}>{item}</li>)}</ul></section>
                <section aria-labelledby="observation-avoid"><h4 id="observation-avoid" className="font-semibold text-foreground">不要做</h4><ul className="mt-2 list-disc space-y-2 pl-5">{observation.avoid.map(item => <li key={item}>{item}</li>)}</ul></section>
              </div>
            </section>
          </> : null}
        </GuideDisclosure>

        {topic.concepts ? <GuideDisclosure title="搭得牢、站得稳、动得起来：结构小提示"><section aria-labelledby="building-concepts">
          <h3 id="building-concepts" className="scroll-mt-24 font-bold text-foreground">搭得牢、站得稳、动得起来</h3>
          <dl className="mt-3 grid gap-5 md:grid-cols-2">{topic.concepts.map(concept => <div key={concept.title}><dt className="font-semibold text-foreground">{concept.title}</dt><dd className="mt-1">{concept.description}</dd></div>)}</dl>
        </section></GuideDisclosure> : null}

        <GuideDisclosure title="想再试一步？看看方法和提问"><section aria-labelledby="learning-method">
          <h3 id="learning-method" className="scroll-mt-24 font-bold text-foreground">可以这样一步步开始</h3>
          <p className="mt-2">{topic.introduction}</p>
          <h4 className="mt-4 font-semibold text-foreground">{catalogOnly ? '方法示例（非站内项目）：' : null}{topic.firstQuestion}</h4>
          <p className="mt-2">{topic.firstChallenge}</p>
          <ol className="mt-4 list-decimal space-y-3 pl-5">{topic.sequence.map(step => <li key={step.title}><h4 className="font-semibold text-foreground">{step.title}</h4><p>{step.description}</p></li>)}</ol>
        </section></GuideDisclosure>

        <GuideDisclosure title="家长怎么陪伴？做完再聊什么？">
          <section aria-labelledby="learning-companion"><h3 id="learning-companion" className="scroll-mt-24 font-bold text-foreground">家长和同伴可以怎样陪伴</h3><p className="mt-2">{topic.companionNote}</p></section>
          <section aria-labelledby="learning-reflection"><h3 id="learning-reflection" className="scroll-mt-24 font-bold text-foreground">做完以后，把发现说清楚</h3><ul className="mt-2 list-disc space-y-2 pl-5">{topic.reflection.map(question => <li key={question}>{question}</li>)}</ul></section>
        </GuideDisclosure>

        {observation ? <GuideDisclosure id="record-observation" title="自然观察页面怎么用？上传、鉴定与审核"><section aria-labelledby="observation-site-usage">
          <h3 id="observation-site-usage" className="scroll-mt-24 font-bold text-foreground">本站自然观察页面怎么用</h3>
          <p className="mt-2">可以先浏览；发布自己的照片需要登录。AI 候选只是建议，不确定时可以保持待鉴定。</p>
          <ol className="mt-4 list-decimal space-y-4 pl-5">{observation.siteUsage.map(step => <li key={step.title}>
            <h4 className="font-semibold text-foreground">{step.title}</h4><p className="mt-1">{step.description}</p>
            {step.links ? <div className="flex flex-wrap gap-x-5">{step.links.map(link => <Link key={link.href} href={link.href} prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-[hsl(var(--nav-active))] hover:underline">{link.label}</Link>)}</div> : null}
          </li>)}</ol>
        </section></GuideDisclosure> : null}
      </section>
      <nav aria-label="继续探索学习主题" className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border pt-4 text-sm">
        <span className="text-muted-foreground">换个方向</span>
        {LEARNING_TOPICS.filter(item => item.slug !== topic.slug).map(item => <Link key={item.slug} href={`/learn/${item.slug}`} className="inline-flex min-h-11 items-center font-semibold text-[hsl(var(--nav-active))] hover:underline">{item.label}</Link>)}
        <Link href="/explore" className="inline-flex min-h-11 items-center text-[hsl(var(--nav-active))] hover:underline">探索全部项目</Link>
      </nav>
    </>
  )
}
