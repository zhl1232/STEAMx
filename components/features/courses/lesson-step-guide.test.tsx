import { renderToString } from 'react-dom/server'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LessonStepGuide } from './lesson-step-guide'

function parseGuide(html: string) {
    return new DOMParser().parseFromString(html, 'text/html')
}

describe('LessonStepGuide', () => {
    let fullscreenDescriptor: PropertyDescriptor | undefined
    let fullscreenContainer: HTMLElement | undefined

    afterEach(() => {
        fullscreenContainer?.remove()
        fullscreenContainer = undefined
        if (fullscreenDescriptor) {
            Object.defineProperty(document, 'fullscreenElement', fullscreenDescriptor)
            fullscreenDescriptor = undefined
        }
    })

    it('ports the mobile directory into fullscreen and returns it to the body after exit', () => {
        const fullscreenElement = document.createElement('section')
        document.body.appendChild(fullscreenElement)
        fullscreenContainer = fullscreenElement
        fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: fullscreenElement })

        render(<LessonStepGuide steps={[{ title: '观察', description: '' }]} onStepClick={vi.fn()} />)
        fireEvent.click(screen.getByLabelText('课程目录'))

        const dialog = screen.getByRole('dialog')
        expect(fullscreenElement).toContainElement(dialog)
        expect(fullscreenElement.querySelector('[data-state="open"]')).not.toBeNull()

        Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
        fireEvent(document, new Event('fullscreenchange'))
        const bodyDialog = screen.getByRole('dialog')
        expect(document.body).toContainElement(bodyDialog)
        expect(fullscreenElement).not.toContainElement(bodyDialog)
    })

    it('opens a compact mobile directory at the current page and closes after selection', () => {
        const onStepClick = vi.fn()
        render(<LessonStepGuide steps={[{ title: '观察', description: '不在手机目录显示的说明' }, { title: '搭建', description: '', hint: '详细提示' }]} activeStepIndex={1} onStepClick={onStepClick} />)
        fireEvent.click(screen.getByLabelText('课程目录'))
        const dialog = screen.getByRole('dialog')
        expect(dialog).not.toHaveTextContent('不在手机目录显示的说明')
        expect(dialog).not.toHaveTextContent('详细提示')
        expect(screen.getByRole('button', { name: '2. 搭建' })).toHaveFocus()
        fireEvent.click(screen.getByRole('button', { name: '1. 观察' }))
        expect(onStepClick).toHaveBeenCalledWith(0)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('jumps to a selected page, marks the current page, and closes the directory', () => {
        const onStepClick = vi.fn()
        render(<LessonStepGuide
            steps={[{ title: '认识小车', description: '先观察结构。' }, { title: '搭建车轮', description: '连接车轮。' }]}
            activeStepIndex={1}
            onStepClick={onStepClick}
        />)
        const summary = screen.getByLabelText('桌面课程目录')
        const disclosure = summary.closest('details')!
        disclosure.open = true
        expect(screen.getByRole('button', { name: '2. 搭建车轮' })).toHaveAttribute('aria-current', 'step')

        fireEvent.click(screen.getByRole('button', { name: '1. 认识小车' }))

        expect(onStepClick).toHaveBeenCalledWith(0)
        expect(disclosure.open).toBe(false)
        expect(summary).toHaveFocus()
    })

    it('closes an open directory with Escape without changing the page', () => {
        const onStepClick = vi.fn()
        render(<LessonStepGuide steps={[{ title: '观察', description: '观察模型。' }]} onStepClick={onStepClick} />)
        const summary = screen.getByLabelText('桌面课程目录')
        const disclosure = summary.closest('details')!
        disclosure.open = true
        fireEvent.keyDown(screen.getByRole('button', { name: '1. 观察' }), { key: 'Escape' })
        expect(disclosure.open).toBe(false)
        expect(summary).toHaveFocus()
        expect(onStepClick).not.toHaveBeenCalled()
    })

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
