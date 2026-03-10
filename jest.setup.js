// 添加自定义 jest matchers 和测试环境设置
import '@testing-library/jest-dom'

jest.mock('next/image', () => {
    const React = require('react')
    return {
        __esModule: true,
        default: (props) => {
            const { src, alt, ...rest } = props
            const resolvedSrc = typeof src === 'string' ? src : (src?.src ?? '')
            return React.createElement('img', { src: resolvedSrc, alt, ...rest })
        },
    }
})
