import type { SupportChannel } from './channels'
export type { SupportChannel } from './channels'

export type SupportConversation = {
  id: string; user_id: string; channel: SupportChannel; status: 'open' | 'resolved'; user_read_seq: number; staff_read_seq: number; last_message_seq: number; updated_at: string
}
export type SupportAttachment = { id: string; mime_type: string; size_bytes: number; message_id: string | null }
export type SupportMessage = {
  id: string; seq: number; actor_id?: string; sender_role: 'user' | 'admin'; client_id: string; content: string;
  context: { productId?: string; productName?: string; orderId?: string; orderStatus?: string }; created_at: string;
  attachments?: SupportAttachment[]
}
