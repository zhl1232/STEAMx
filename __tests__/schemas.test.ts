import { describe, expect, it } from 'vitest'
import { CreateProjectSchema } from '@/lib/schemas'

describe('CreateProjectSchema', () => {
    const validPayload = {
        title: '纸桥承重挑战',
        description: '使用纸张和胶带搭建一座能承受砝码的小桥。',
        category: '工程',
        difficulty: 'easy' as const,
        difficulty_stars: 2,
        duration: 30,
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
