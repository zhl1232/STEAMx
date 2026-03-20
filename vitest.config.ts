import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
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
            '@': path.resolve(__dirname, './'),
        },
    },
})
