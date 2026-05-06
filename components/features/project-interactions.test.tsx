import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectInteractions } from './project-interactions'

const mockUseQuery = vi.fn()
const mockTipProjectDialog = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: vi.fn(),
    }),
}))

vi.mock('@tanstack/react-query', () => ({
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
}))

vi.mock('@/lib/context/project-context', () => ({
    useProjects: () => ({
        toggleLike: vi.fn(),
        isLiked: vi.fn(() => false),
        getLikesDelta: vi.fn(() => 0),
        clearLikesDelta: vi.fn(),
        toggleCollection: vi.fn(),
        isCollected: vi.fn(() => false),
    }),
}))

vi.mock('@/lib/context/auth-context', () => ({
    useAuth: () => ({
        user: { id: '11111111-1111-1111-1111-111111111111' },
    }),
}))

vi.mock('@/lib/context/login-prompt-context', () => ({
    useLoginPrompt: () => ({
        promptLogin: vi.fn(),
    }),
}))

vi.mock('@/components/features/project/tip-project-dialog', () => ({
    TipProjectDialog: (props: unknown) => {
        mockTipProjectDialog(props)
        return null
    },
}))

vi.mock('@/components/ui/report-dialog', () => ({
    ReportDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('ProjectInteractions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseQuery.mockReturnValue({ data: 0 })
    })

    it('uses a numeric project tip query key even when projectId is passed as a string', () => {
        render(
            <ProjectInteractions
                projectId="42"
                projectTitle="测试项目"
                likes={0}
                projectOwnerId="owner-1"
            />
        )

        expect(mockUseQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: ['tip_my', 'project', 42],
            })
        )
    })

    it('passes project tipping metadata to the tip dialog', () => {
        render(
            <ProjectInteractions
                projectId={42}
                projectTitle="测试项目"
                likes={0}
                projectOwnerId="owner-1"
            />
        )

        expect(mockTipProjectDialog).toHaveBeenCalledWith(
            expect.objectContaining({
                projectId: 42,
                projectOwnerId: 'owner-1',
                projectTitle: '测试项目',
            })
        )
    })
})
