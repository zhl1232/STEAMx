import path from 'node:path'

export default async () => {
    // Vitest Explorer may load this config via CommonJS `require`.
    // Dynamic import keeps ESM-only Vite plugins compatible in that mode.
    const { default: react } = await import('@vitejs/plugin-react')

    return {
        plugins: [react()],
        test: {
            environment: 'happy-dom',
            setupFiles: ['./vitest.setup.ts'],
            include: ['**/*.{test,spec}.{ts,tsx}'],
            exclude: [
                '**/node_modules/**',
                '**/e2e/**',
                '**/.next/**',
                '**/.open-next/**',
                '**/out/**',
                '**/dist/**',
                '**/build/**',
            ],
            coverage: {
                provider: 'v8',
                reporter: ['text', 'json-summary', 'html'],
                include: [
                    'app/**/*.{js,jsx,ts,tsx}',
                    'components/**/*.{js,jsx,ts,tsx}',
                    'lib/**/*.{js,jsx,ts,tsx}',
                    'context/**/*.{js,jsx,ts,tsx}',
                    'hooks/**/*.{js,jsx,ts,tsx}',
                ],
                exclude: [
                    '**/*.d.ts',
                    '**/node_modules/**',
                    '**/.next/**',
                    '**/.open-next/**',
                    '**/out/**',
                    '**/dist/**',
                    '**/build/**',
                ],
            },
        },
        resolve: {
            alias: {
                '@': path.resolve(process.cwd(), './'),
            },
        },
    } satisfies import('vitest/config').ViteUserConfig
}
