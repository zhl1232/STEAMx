import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProjectShowcase } from './project-showcase'
import { ProjectCompletion } from '@/lib/mappers/types'

let mockUserId = 'test-user'

vi.mock('@/lib/supabase/client', () => ({
    createClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            order: vi.fn().mockReturnThis(),
        })),
        rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
    })),
}))

vi.mock('@/context/auth-context', () => ({
    useAuth: vi.fn(() => ({ user: { id: mockUserId } })),
}))

vi.mock('@/context/login-prompt-context', () => ({
    useLoginPrompt: vi.fn(() => ({ promptLogin: vi.fn() })),
}))

vi.mock('@/context/gamification-context', () => ({
    useGamification: vi.fn(() => ({ coins: 100, level: 1 })),
}))

vi.mock('@/hooks/use-danmaku', () => ({
    useDanmaku: vi.fn(() => ({
        activeDanmaku: [],
        sendDanmaku: vi.fn(),
        removeDanmaku: vi.fn(),
        isPlaying: true,
        togglePlay: vi.fn(),
        danmakuClass: 'danmaku-item',
    })),
}))

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn(() => ({ data: undefined })),
    useMutation: vi.fn(() => ({ mutate: vi.fn() })),
    useQueryClient: vi.fn(() => ({
        cancelQueries: vi.fn(),
        getQueryData: vi.fn(),
        setQueryData: vi.fn(),
        invalidateQueries: vi.fn(),
    })),
}))

const mockCompletions: ProjectCompletion[] = [
    {
        id: 1,
        author: 'TestUser',
        avatar: 'https://example.com/avatar.png',
        proofImages: ['https://example.com/image.png'],
        completedAt: '2023-01-01',
        likes: 10,
        notes: 'Great project',
        projectId: 101,
        userId: 'u1',
        isPublic: true,
        proofVideoUrl: undefined,
    },
]

describe('ProjectShowcase', () => {
    it('disables the like button for your own completion', () => {
        mockUserId = 'u1'
        render(<ProjectShowcase completions={mockCompletions} />)
        const item = screen.getByText('TestUser').closest('div')!.parentElement!
        fireEvent.click(item)

        const likeButton = screen.getByRole('button', { name: /自己的作品/i })
        expect(likeButton).toBeDisabled()
    })

    it('renders project list', () => {
        mockUserId = 'test-user'
        render(<ProjectShowcase completions={mockCompletions} />)
        expect(screen.getByText('作品墙')).toBeInTheDocument()
        expect(screen.getByText('TestUser')).toBeInTheDocument()
    })

    it('opens dialog on click', () => {
        mockUserId = 'test-user'
        render(<ProjectShowcase completions={mockCompletions} />)
        const item = screen.getByText('TestUser').closest('div')!.parentElement!
        fireEvent.click(item)
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('作品详情')).toBeInTheDocument()
    })
})
