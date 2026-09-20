import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LessonStepGuide } from './lesson-step-guide'

function parseGuide(html: string) {
    return new DOMParser().parseFromString(html, 'text/html')
}

describe('LessonStepGuide', () => {
    it('includes every description and hint in the initial HTML of a closed disclosure', () => {
        const steps = [
            { title: '观察', description: '观察车轮如何转动。', hint: '比较两侧车轮。' },
            { title: '动手改进', description: '调整轴距并重新试跑。', hint: '一次只改变一个条件。' },
        ]

        const document = parseGuide(renderToString(<LessonStepGuide steps={steps} />))

        const disclosure = document.querySelector('details')
        expect(disclosure).not.toHaveAttribute('open')
        expect(disclosure?.querySelector('summary')).toHaveTextContent('本课步骤与提示')
        expect(disclosure?.querySelectorAll('ol > li')).toHaveLength(steps.length)
        for (const step of steps) {
            expect(disclosure).toHaveTextContent(step.title)
            expect(disclosure).toHaveTextContent(step.description)
            expect(disclosure).toHaveTextContent(step.hint)
        }
        expect(disclosure?.querySelector('[role="region"]')).toHaveAttribute('tabindex', '0')
    })

    it('renders lesson rich text and keeps embedded HTML as escaped text', () => {
        const description = '使用 [[cat:motion]] 中的 [[block:motion|移动 10 步]]。<script>alert(1)</script>'

        const document = parseGuide(renderToString(
            <LessonStepGuide steps={[{ title: '让角色移动', description }]} />,
        ))

        expect(document.querySelector('[aria-label="Scratch 分类：运动"]')).not.toBeNull()
        expect(document.querySelector('[aria-label="Scratch 积木：移动 10 步"]')).not.toBeNull()
        expect(document.querySelector('script')).toBeNull()
        expect(document.body).toHaveTextContent('<script>alert(1)</script>')
    })

    it('provides a crawlable parts link even when no learning steps are available', () => {
        const document = parseGuide(renderToString(
            <LessonStepGuide steps={[]} partsHref="/courses/7/lessons/42/parts" />,
        ))

        expect(document.querySelector('a')).toHaveAttribute('href', '/courses/7/lessons/42/parts')
        expect(document.querySelector('a')).toHaveTextContent('查看本课零件清单')
        expect(document.querySelector('ol')).toBeNull()
    })

    it('does not display an empty guide', () => {
        expect(renderToString(<LessonStepGuide steps={[]} />)).toBe('')
    })
})
