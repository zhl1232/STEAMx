import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModeratorApplicationForm } from './application-form'

let mockAuth = {
    user: null as null | { id: string },
    profile: null as null | { role: 'user' | 'moderator' | 'admin' | 'teacher' },
    loading: false,
}

let mockEligibilityState = {
    eligibility: null as null | {
        isEligible: boolean
        score: number
        requirements: {
            level: { met: boolean; current: number; required: number }
            publishedProjects: { met: boolean; current: number; required: number }
            completedProjects: { met: boolean; current: number; required: number }
            commentsCount: { met: boolean; current: number; required: number }
            badges: { met: boolean; current: number; required: number }
            accountAge: { met: boolean; current: number; required: number }
            violations: { met: boolean }
        }
    },
    isLoading: false,
}

vi.mock('@/lib/context/auth-context', () => ({
    useAuth: () => mockAuth,
}))

vi.mock('@/hooks/use-moderator-eligibility', () => ({
    useModeratorEligibility: () => mockEligibilityState,
}))

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        from: vi.fn(() => ({
            insert: vi.fn(),
        })),
    }),
}))

vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({
        toast: vi.fn(),
    }),
}))

describe('ModeratorApplicationForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAuth = {
            user: null,
            profile: null,
            loading: false,
        }
        mockEligibilityState = {
            eligibility: null,
            isLoading: false,
        }
    })

    it('asks unauthenticated visitors to log in instead of saying they are already moderators', () => {
        render(<ModeratorApplicationForm />)

        expect(screen.getByText('请先登录')).toBeInTheDocument()
        expect(screen.getByText('登录后才能查看申请资格并提交审核员申请。')).toBeInTheDocument()
        expect(screen.queryByText('无需重复申请')).not.toBeInTheDocument()
    })

    it('shows the already-moderator message only for non-user roles', () => {
        mockAuth = {
            user: { id: '11111111-1111-1111-1111-111111111111' },
            profile: { role: 'moderator' },
            loading: false,
        }

        render(<ModeratorApplicationForm />)

        expect(screen.getByText('无需重复申请')).toBeInTheDocument()
        expect(
            screen.getByText('你已经是审核员或管理员，可以直接进入后台处理内容。'),
        ).toBeInTheDocument()
    })
})
