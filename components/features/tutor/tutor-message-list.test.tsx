import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { formatTutorBillingCaption, TutorMessageList, type TutorMessageListProps } from './tutor-message-list'

vi.mock('@/components/features/tutor/tutor-message-content', () => ({ TutorMessageContent: ({ content }: { content: string }) => <span>{content}</span> }))

function props(): TutorMessageListProps {
  return {
    view: 'chat', isAuthenticated: true,
    messages: [{ role: 'user', content: '问题' }, { role: 'assistant', content: '第一段', streaming: true }],
    greeting: null, busy: true, quota: null, sessionFetching: false, sessionError: false,
    allowAudioMessages: false, contextType: 'global', quickPrompts: [], speechLoadingKey: null,
    playingSpeechKey: null, onPlaySpeech: vi.fn(), onSendPrompt: vi.fn(), historyItems: null,
    historyLoading: false, historyDetail: null, historyDetailLoading: false, deletingHistoryId: null,
    onOpenHistoryDetail: vi.fn(), onDeleteHistoryConversation: vi.fn(),
  }
}

describe('tutor reading experience', () => {
  it('formats wallet, free, and unknown usage captions without inventing zero tokens', () => {
    expect(formatTutorBillingCaption({ source: 'wallet', chargedCredits: 0.123, outputTokens: 123, usageMissing: false, receiptId: 1 })).toBe('本次 0.123 代币 · 123 token')
    expect(formatTutorBillingCaption({ source: 'free', chargedCredits: 0, outputTokens: 456, usageMissing: false, receiptId: 2 })).toBe('本次免费 · 456 token')
    expect(formatTutorBillingCaption({ source: 'wallet', chargedCredits: 0, outputTokens: null, usageMissing: true, receiptId: 3 })).toBe('本次 0 代币')
  })

  it('keeps the reading position when new text arrives, with a way back to latest', () => {
    const initial = props()
    const { rerender } = render(<TutorMessageList {...initial} />)
    const log = screen.getByRole('log')
    Object.defineProperties(log, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 200 },
    })
    log.scrollTop = 100
    fireEvent.scroll(log)
    rerender(<TutorMessageList {...initial} messages={[initial.messages[0], { role: 'assistant', content: '第一段和第二段', streaming: true }]} />)
    expect(log.scrollTop).toBe(100)
    fireEvent.click(screen.getByRole('button', { name: '回到最新消息' }))
    expect(log.scrollTop).toBe(1000)
  })

  it('never renders retained private messages or history for an unauthenticated viewer', () => {
    const initial = props()
    const { rerender } = render(<TutorMessageList {...initial} isAuthenticated={false} />)
    expect(screen.queryByText('第一段')).not.toBeInTheDocument()
    rerender(<TutorMessageList {...initial} isAuthenticated={false} view="historyDetail" historyDetail={{ id: 'private', title: '历史', archivedAt: null, messages: initial.messages }} />)
    expect(screen.queryByText('第一段')).not.toBeInTheDocument()
  })
})
