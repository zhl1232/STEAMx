import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { TutorProvider } from '../tutor/tutor-context'
import { getScienceSample } from '@/lib/project/science-samples'
import { ScienceProjectNotes, ScienceProjectSafety } from './science-project-notes'

vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/lib/context/login-prompt-context', () => ({ useLoginPrompt: () => ({ promptLogin: vi.fn() }) }))

test('viewing guide shows no-do boundary and keeps extension optional', () => {
  vi.stubEnv('NODE_ENV', 'development')
  try {
    const sample = getScienceSample(1249)!
    render(<TutorProvider><ScienceProjectSafety sample={sample} /><ScienceProjectNotes sample={sample} /></TutorProvider>)
    expect(screen.getByRole('heading', { name: '演示限制' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '观看时想一想' })).toBeInTheDocument()
    expect(screen.queryByText('动手前先检查')).not.toBeInTheDocument()
    expect(screen.getByText('拓展探索（选做）').closest('details')).not.toHaveAttribute('open')
  } finally { vi.unstubAllEnvs() }
})
