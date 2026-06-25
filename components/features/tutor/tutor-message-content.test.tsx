import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TutorMessageContent } from './tutor-message-content'

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
})
