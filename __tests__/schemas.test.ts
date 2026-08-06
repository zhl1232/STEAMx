import { describe, expect, it } from 'vitest'
import { CreateProjectSchema, MessageSchema } from '@/lib/schemas'

describe('CreateProjectSchema', () => {
    const validPayload = {
        title: '纸桥承重挑战',
        description: '使用纸张和胶带搭建一座能承受砝码的小桥。',
        category: '工程',
        difficulty: 'easy' as const,
        difficulty_stars: 2,
        status: 'pending' as const,
        image_url: '/projects/paper-bridge.webp',
        materials: ['A4 纸', '胶带'],
        steps: [
            {
                title: '搭建桥面',
                description: '先折叠桥面，再加固桥墩。',
                sort_order: 0,
            },
        ],
    }

    it('accepts the extra 其他 category exposed by the share UI', () => {
        const result = CreateProjectSchema.safeParse({
            ...validPayload,
            category: '其他',
        })

        expect(result.success).toBe(true)
    })

    it('accepts sub_category names from the share form payload', () => {
        const result = CreateProjectSchema.safeParse({
            ...validPayload,
            sub_category: '机械结构',
        })

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.sub_category).toBe('机械结构')
        }
    })
})

describe('MessageSchema', () => {
    it('accepts legacy UUID-shaped seeded user ids', () => {
        const result = MessageSchema.safeParse({
            id: 12,
            sender_id: 'a1111111-0000-0000-0000-000000000000',
            receiver_id: 'b2222222-0000-0000-0000-000000000000',
            content: '你好',
            read_at: null,
            created_at: '2026-08-06T08:15:20.343981+00:00',
        })

        expect(result.success).toBe(true)
    })
})
