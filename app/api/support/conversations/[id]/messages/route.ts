import { messagesHandler } from '@/lib/support/handlers'
export const GET = messagesHandler(false, 'GET')
export const POST = messagesHandler(false, 'POST')
