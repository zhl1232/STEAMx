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
    template: '%s | STEAM Explore & Share',
    default: 'STEAM Explore & Share - 青少年STEAM项目分享平台',
  },
  description: '发现、分享和学习STEAM项目。为青少年提供科学、技术、工程、艺术和数学领域的创意项目展示和交流平台。',
  keywords: ['STEAM', '教育', '项目分享', '青少年', '科学', '技术', '工程', '艺术', '数学', 'DIY', '创客'],
  authors: [{ name: 'STEAM Explore & Share Team' }],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://steam-explore.com',
    title: 'STEAM Explore & Share - 青少年STEAM项目分享平台',
    description: '发现、分享和学习STEAM项目。为青少年提供科学、技术、工程、艺术和数学领域的创意项目展示和交流平台。',
    siteName: 'STEAM Explore & Share',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'STEAM Explore & Share',
    description: '发现、分享和学习STEAM项目',
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
