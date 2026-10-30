import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProjectDemonstration } from './project-demonstration'
import { MobileProjectSteps } from './mobile-project-steps'

vi.mock('@/components/features/shared/image-lightbox', () => ({
  ImageLightbox: ({ open }: { open: boolean }) => open ? <div role="dialog" aria-label="步骤图片预览" /> : null,
}))

const demonstration = { image: '/project-guides/demos/project-307-garden-v1.png', title: '综合材料拼贴画', notice: '生成演示图，具体操作见步骤说明。' }

describe('complete project demonstration figure', () => {
  it('shows the complete image and provenance and opens the shared viewer', async () => {
    const user = userEvent.setup()
    render(<ProjectDemonstration {...demonstration} />)
    const image = screen.getByAltText(`${demonstration.title}：${demonstration.notice}`)
    expect(image).toHaveClass('object-contain')
    expect(screen.getByText(demonstration.notice)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `放大查看：${demonstration.title}：${demonstration.notice}` }))
    expect(await screen.findByRole('dialog', { name: '步骤图片预览' })).toBeInTheDocument()
  })

  it('shows one shared storyboard beside the mobile instructions and preserves real step diagrams', () => {
    render(<MobileProjectSteps demonstration={demonstration} steps={[
      { title: '确定主题', description: '画草图', image_url: '/verified-step.svg' },
      { title: '剪裁拼贴', description: '剪裁材料' },
    ]} />)
    expect(screen.getAllByAltText(`${demonstration.title}：${demonstration.notice}`)).toHaveLength(1)
    expect(screen.getByRole('button', { name: '放大查看：确定主题' })).toBeInTheDocument()
    expect(screen.getByText('剪裁拼贴')).toBeInTheDocument()
  })
})
