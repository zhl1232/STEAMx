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
  it('renders scene dividers without speech actions and leaves history detail separate', () => {
    const initial = props()
    const { rerender } = render(<TutorMessageList {...initial} messages={[{ role: 'divider', content: '现在在：小车' }]} />)
    expect(screen.getByText('现在在：小车')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '朗读这条回复' })).not.toBeInTheDocument()
    rerender(<TutorMessageList {...initial} messages={[{ role: 'divider', content: '现在在：小车' }]} view="historyDetail" historyDetail={{ id: 'old', title: '历史', archivedAt: null, messages: [{ role: 'assistant', content: '历史回复' }] }} />)
    expect(screen.queryByText('现在在：小车')).not.toBeInTheDocument()
    expect(screen.getByText('历史回复')).toBeInTheDocument()
  })

  it('hides per-message billing captions', () => {
    expect(formatTutorBillingCaption({ source: 'wallet', chargedCredits: 1.23, receiptId: 1 })).toBeNull()
    expect(formatTutorBillingCaption({ source: 'free', chargedCredits: 36.5, receiptId: 5 })).toBeNull()
    expect(formatTutorBillingCaption()).toBeNull()
  })

  it('shows an exhaustion message without a call quota, purchase prompt, or per-message charge line', () => {
    render(<TutorMessageList {...props()} busy={false} messages={[{
      role: 'assistant', content: '回答', billing: { source: 'free', chargedCredits: 36.5, receiptId: 5 },
    }]} quota={{ creditUnit: 'credits', isMember: false, walletBalance: 0, monthlyGrant: 0,
      freeDaily: 150, freeUsedToday: 150, freeRemainingToday: 0, dailyChargeCap: 100, dailyPeriod: '2026-10-13',
      grantPeriod: '', dayResetAt: 0, canChat: false }} />)
    expect(screen.queryByText(/本次 .+代币/)).not.toBeInTheDocument()
    expect(screen.getByText('可用代币不足，请明天使用新的赠送代币。')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/免费次数|开通会员|token|100\s*[:∶]/i)
  })

  it('keeps archived history readable without charge captions', () => {
    const initial = props()
    const { rerender } = render(<TutorMessageList {...initial} busy={false} messages={[{
      role: 'assistant', content: '当前回复', billing: { source: 'wallet', chargedCredits: 1.23, receiptId: 1 },
    }]} />)
    expect(screen.getByText('当前回复')).toBeInTheDocument()
    expect(screen.queryByText(/本次 .+代币/)).not.toBeInTheDocument()
    rerender(<TutorMessageList {...initial} busy={false} view="historyDetail" historyDetail={{
      id: 'old', title: '历史', archivedAt: null, messages: [{
        role: 'assistant', content: '历史回复', billing: { source: 'wallet', chargedCredits: 0.123, receiptId: 4 },
      }],
    }} />)
    expect(screen.getByText('历史回复')).toBeInTheDocument()
    expect(screen.queryByText(/本次 .+代币/)).not.toBeInTheDocument()
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
    rerender(<TutorMessageList {...initial} isAuthenticated={false} view="historyDetail" historyDetail={{ id: 'private', title: '历史', archivedAt: null, messages: initial.messages.filter((message) => message.role !== 'divider') }} />)
    expect(screen.queryByText('第一段')).not.toBeInTheDocument()
  })
})
