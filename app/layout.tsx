import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import './globals.css'
import { ErrorBoundary } from '@/components/error-boundary'
import { ConditionalAppShell } from '@/components/conditional-app-shell'
import QueryProvider from '@/components/providers/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/context/auth-context'
import { isPlaywrightSmoke } from '@/lib/testing/playwright-smoke'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    template: '%s | STEAM 探索',
    default: 'STEAM 探索 - 青少年基于项目学习（PBL）的探索平台',
  },
  description: '基于项目学习（PBL）的 STEAM 探索平台。青少年在做中学，发现、分享并完成科学、技术、工程、艺术与数学项目。',
  keywords: ['STEAM', 'PBL', '项目式学习', '教育', '项目分享', '青少年', '科学', '技术', '工程', '艺术', '数学', 'DIY', '创客'],
  authors: [{ name: 'STEAM 探索团队' }],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://steam-explore.com',
    title: 'STEAM 探索 - 青少年基于项目学习（PBL）的探索平台',
    description: '基于项目学习（PBL）的 STEAM 探索平台。青少年在做中学，发现、分享并完成科学、技术、工程、艺术与数学项目。',
    siteName: 'STEAM 探索',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'STEAM 探索',
    description: '基于项目学习（PBL）的 STEAM 探索平台',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const smokeMode = isPlaywrightSmoke()

  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        {!smokeMode && (
          <>
            <link rel="preconnect" href="https://lulfybqiiamdvbtdpqha.supabase.co" crossOrigin="anonymous" />
            <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
          </>
        )}
      </head>
      <body className={inter.className}>
        <script
          dangerouslySetInnerHTML={{
            __html: 'window.__name = (n) => n;',
          }}
        />
        <QueryProvider>
          <AuthProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <ErrorBoundary>
                <ConditionalAppShell>{children}</ConditionalAppShell>
              </ErrorBoundary>
              <Toaster />
            </ThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
