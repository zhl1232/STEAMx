import path from 'node:path'

const exclude = [
    '**/node_modules/**',
    '**/e2e/**',
    '**/.next/**',
    '**/.open-next/**',
    '**/out/**',
    '**/dist/**',
    '**/build/**',
]

// Tests without JSX that still need a browser environment (DOM globals,
// storage, renderHook). Everything else ending in .ts runs in plain node,
// which skips the happy-dom boot and the React testing setup per file.
// Add a file here if it starts failing with "document is not defined".
const domOnlyTsTests = [
    '__tests__/api.admin-challenges-id-route.test.ts',
    '__tests__/api.admin-challenges-route.test.ts',
    'app/playground/functionwars/renderer.test.ts',
    'hooks/playground/use-24-game.test.ts',
    'hooks/playground/use-function-wars-online.test.ts',
    'hooks/playground/use-function-wars.test.ts',
    'hooks/playground/use-game-room.test.ts',
    'hooks/playground/use-gomoku-online.test.ts',
    'lib/auth/pending-otp.test.ts',
    'lib/explore-scroll-restore.test.ts',
    'lib/explore/project-navigation-context.test.ts',
    'lib/navigation/return-href.test.ts',
    'lib/nature-species-scroll-restore.test.ts',
    'lib/playground/gomoku-rapfi.test.ts',
    'lib/playground/minesweeper-stats.test.ts',
    'lib/playground/storage.test.ts',
]

// Pin Supabase env to the CI values so local worktrees/hooks with real or
// placeholder (non-URL) values behave like CI instead of failing at import
// with "Invalid supabaseUrl" or reaching a live project.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'ci-placeholder-anon-key'
delete process.env.SUPABASE_SERVICE_ROLE_KEY

export default async () => {
    // Vitest Explorer may load this config via CommonJS `require`.
    // Dynamic import keeps ESM-only Vite plugins compatible in that mode.
    const { default: react } = await import('@vitejs/plugin-react')

    const resolve = {
        alias: {
            '@': path.resolve(process.cwd(), './'),
        },
    }

    return {
        // Vitest 5 shares the Vite server when projects only customize test options.
        plugins: [react()],
        test: {
            projects: [
                {
                    extends: true,
                    test: {
                        name: 'dom',
                        environment: 'happy-dom',
                        setupFiles: ['./vitest.setup.ts'],
                        include: ['**/*.{test,spec}.tsx', ...domOnlyTsTests],
                        exclude,
                    },
                },
                {
                    extends: true,
                    test: {
                        name: 'node',
                        environment: 'node',
                        include: ['**/*.{test,spec}.ts'],
                        exclude: [...exclude, ...domOnlyTsTests],
                    },
                },
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
        resolve,
    } satisfies import('vitest/config').ViteUserConfig
}
