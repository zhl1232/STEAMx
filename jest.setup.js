// 添加自定义 jest matchers 和测试环境设置
import '@testing-library/jest-dom'

jest.mock('next/image', () => {
    const React = require('react')
    return {
        __esModule: true,
        default: (props) => {
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
            const resolvedSrc = typeof src === 'string' ? src : (src?.src ?? '')
            return React.createElement('img', { src: resolvedSrc, alt, ...rest })
        },
    }
})
