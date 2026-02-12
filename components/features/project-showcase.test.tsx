import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectShowcase } from './project-showcase'
import '@testing-library/jest-dom'
import { ProjectCompletion } from '@/lib/mappers/types'

// Mock dependencies
jest.mock('@/lib/supabase/client', () => ({
    createClient: jest.fn(() => ({
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            order: jest.fn().mockReturnThis(),
        })),
        rpc: jest.fn().mockResolvedValue({ data: 0, error: null })
    }))
}))

jest.mock('@/context/auth-context', () => ({
    useAuth: jest.fn(() => ({ user: { id: 'test-user' } }))
}))

jest.mock('@/context/login-prompt-context', () => ({
    useLoginPrompt: jest.fn(() => ({ promptLogin: jest.fn() }))
}))

jest.mock('@/context/gamification-context', () => ({
    useGamification: jest.fn(() => ({ coins: 100, level: 1 }))
}))

jest.mock('@/hooks/use-danmaku', () => ({
    useDanmaku: jest.fn(() => ({
        activeDanmaku: [],
        sendDanmaku: jest.fn(),
        removeDanmaku: jest.fn(),
        isPlaying: true,
        togglePlay: jest.fn(),
        danmakuClass: 'danmaku-item'
    }))
}))

jest.mock('@tanstack/react-query', () => ({
    useQuery: jest.fn(() => ({ data: undefined })),
    useMutation: jest.fn(() => ({ mutate: jest.fn() })),
    useQueryClient: jest.fn(() => ({
        cancelQueries: jest.fn(),
        getQueryData: jest.fn(),
        setQueryData: jest.fn(),
        invalidateQueries: jest.fn(),
    }))
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
        proofVideoUrl: undefined
    }
]

describe('ProjectShowcase', () => {
    it('renders project list', () => {
        render(<ProjectShowcase completions={mockCompletions} />)
        expect(screen.getByText('作品墙')).toBeInTheDocument()
        expect(screen.getByText('TestUser')).toBeInTheDocument()
    })

    it('opens dialog on click', () => {
        render(<ProjectShowcase completions={mockCompletions} />)
        const item = screen.getByText('TestUser').closest('div')!.parentElement!
        fireEvent.click(item)
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('作品详情')).toBeInTheDocument()
    })
})
