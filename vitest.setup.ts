import React from 'react'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

afterEach(() => {
    cleanup()
})

vi.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => {
        const {
            src,
            alt,
            blurDataURL: _blurDataURL,
            fill: _fill,
            placeholder: _placeholder,
            quality: _quality,
            sizes: _sizes,
            priority: _priority,
            loader: _loader,
            unoptimized: _unoptimized,
            ...rest
        } = props
        const resolvedSrc = typeof src === 'string' ? src : ((src as { src?: string })?.src ?? '')
        return React.createElement('img', { src: resolvedSrc, alt, ...rest })
    },
}))
