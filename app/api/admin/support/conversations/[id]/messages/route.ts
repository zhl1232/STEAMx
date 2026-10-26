import { messagesHandler } from '@/lib/support/handlers'
export const GET = messagesHandler(true, 'GET')
export const POST = messagesHandler(true, 'POST')
