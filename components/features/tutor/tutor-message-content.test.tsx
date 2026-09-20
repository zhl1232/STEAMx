import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TutorMessageContent } from './tutor-message-content'
import { validateTutorResourceTags } from '@/lib/ai/tutor/resource-links'

describe('TutorMessageContent', () => {
  it('renders Scratch rich text markers as colored lesson chips', () => {
    render(
      <TutorMessageContent content="先拖 [[cat:events]] 的 [[block:events|当绿旗被点击]]，再接 [[block:looks|说 出发啦！]]。" />,
    )

    expect(screen.getByLabelText('Scratch 积木：当绿旗被点击')).toBeInTheDocument()
    expect(screen.getByLabelText('Scratch 积木：说 出发啦！')).toBeInTheDocument()
    expect(screen.getByText('说 出发啦！')).toBeInTheDocument()
    expect(screen.queryByText(/\[\[block:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\[\[cat:/)).not.toBeInTheDocument()
  })

  it('renders plain Scratch category names as toolbox legend chips', () => {
    render(<TutorMessageContent content="先从事件分类拖帽子积木，再到外观分类找说话积木。" />)

    expect(screen.getByLabelText('Scratch 分类：事件')).toBeInTheDocument()
    expect(screen.getByLabelText('Scratch 分类：外观')).toBeInTheDocument()
    expect(screen.queryByText('事件分类')).not.toBeInTheDocument()
    expect(screen.queryByText('外观分类')).not.toBeInTheDocument()
  })

  it('renders Scratch extension category markers as toolbox legend chips', () => {
    render(<TutorMessageContent content="打开 [[cat:music]]，拖 [[block:music|演奏音符 60 0.5 拍]]。" />)

    expect(screen.getByLabelText('Scratch 分类：音乐')).toBeInTheDocument()
    expect(screen.getByLabelText('Scratch 积木：演奏音符 60 0.5 拍')).toBeInTheDocument()
  })

  it('only renders audio tags when the scene allows audio', () => {
    const content = '这是黑头鸦的叫声。\n\n[audio:/birds/audio/crow.ogg|黑头鸦]'
    const { rerender } = render(<TutorMessageContent content={content} />)

    expect(screen.queryByText('黑头鸦 · 鸟鸣')).not.toBeInTheDocument()
    expect(screen.queryByText(/\[audio:/)).not.toBeInTheDocument()

    rerender(<TutorMessageContent content={content} allowAudio />)

    expect(screen.getByText('黑头鸦 · 鸟鸣')).toBeInTheDocument()
  })

  it('renders course tags as clickable chips to the course page', () => {
    render(<TutorMessageContent content="可以去学 [course:88|五子棋博弈论入门]。" />)

    const link = screen.getByRole('link', { name: /五子棋博弈论入门/ })
    expect(link).toHaveAttribute('href', '/courses/88')
    expect(screen.queryByText(/\[course:/)).not.toBeInTheDocument()
  })

  it('renders project tags as clickable chips to the project page', () => {
    render(<TutorMessageContent content="试试 [project:12|纸桥挑战]。" />)

    const link = screen.getByRole('link', { name: /纸桥挑战/ })
    expect(link).toHaveAttribute('href', '/project/12')
  })

  it('renders new resource tags as safe internal links', () => {
    render(<TutorMessageContent content="看 [lesson:12:3|纸桥课时]、[species:黑头鸦|黑头鸦] 和 [game:maze|迷宫]。" />)

    expect(screen.getByRole('link', { name: /纸桥课时/ })).toHaveAttribute('href', '/courses/12/lessons/3')
    expect(screen.getByRole('link', { name: /黑头鸦/ })).toHaveAttribute('href', '/nature/species/%E9%BB%91%E5%A4%B4%E9%B8%A6')
    expect(screen.getByRole('link', { name: /迷宫/ })).toHaveAttribute('href', '/playground/maze')
  })

  it('does not turn external markdown links into anchors', () => {
    render(<TutorMessageContent content="[危险](https://example.com)" />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('危险')).toBeInTheDocument()
  })

  it.each([
    '[假入口](/resources/999)',
    '[假入口][r]\n\n[r]: /resources/999',
    '[假入口][]\n\n[假入口]: /resources/999',
    '[假入口]\n\n[假入口]: /resources/999',
  ])('keeps unverified Markdown destinations inert: %s', (markdown) => {
    const content = validateTutorResourceTags(`[resource:2|资料] [resource:999|编造的资料]\n\n${markdown}`, ['[resource:2|材料对比]'])
    render(<TutorMessageContent content={content} />)

    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: '材料对比' })).toHaveAttribute('href', '/resources/2')
    expect(screen.getByText('假入口')).toBeInTheDocument()
  })
})
