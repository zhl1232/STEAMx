import React from 'react'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// happy-dom 20.14 exposes WAAPI, but canceling Motion animations rejects its
// finished promises during cleanup. Keep DOM unit tests on Motion's JS fallback;
// WAAPI behavior needs a real browser test instead of this simulated DOM.
if (typeof Element !== 'undefined') {
    Reflect.deleteProperty(Element.prototype, 'animate')
}

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
