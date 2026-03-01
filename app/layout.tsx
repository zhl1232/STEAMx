import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ProjectProvider } from "@/context/project-context";
import { AuthProvider } from "@/context/auth-context";
import { LoginPromptProvider } from "@/context/login-prompt-context";
import { GamificationProvider } from "@/context/gamification-context";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { NotificationProvider } from "@/context/notification-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { ConditionalAppShell } from "@/components/conditional-app-shell";


const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
    title: {
        template: '%s | STEAM Explore & Share',
        default: 'STEAM Explore & Share - 青少年STEAM项目分享平台',
    },
    description: '发现、分享和学习STEAM项目。为青少年提供科学、技术、工程、艺术和数学领域的创意项目展示和交流平台。',
    keywords: ['STEAM', '教育', '项目分享', '青少年', '科学', '技术', '工程', '艺术', '数学', 'DIY', '创客'],
    authors: [{ name: 'STEAM Explore & Share Team' }],

    // Open Graph
    openGraph: {
        type: 'website',
        locale: 'zh_CN',
        url: 'https://steam-explore.com',
        title: 'STEAM Explore & Share - 青少年STEAM项目分享平台',
        description: '发现、分享和学习STEAM项目。为青少年提供科学、技术、工程、艺术和数学领域的创意项目展示和交流平台。',
        siteName: 'STEAM Explore & Share',
    },

    // Twitter Card
    twitter: {
        card: 'summary_large_image',
        title: 'STEAM Explore & Share',
        description: '发现、分享和学习STEAM项目',
    },

    robots: {
        index: true,
        follow: true,
    },
};

import QueryProvider from "@/components/providers/query-provider";

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="zh" suppressHydrationWarning>
            <head>
                {/* 提前连接图片源，减少首屏图片加载延迟 */}
                <link rel="preconnect" href="https://lulfybqiiamdvbtdpqha.supabase.co" crossOrigin="anonymous" />
                <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
            </head>
            <body className={inter.className}>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window.__name = (n) => n;`,
                    }}
                />
                <QueryProvider>
                    <AuthProvider>
                        <LoginPromptProvider>
                            <GamificationProvider>
                                <NotificationProvider>
                                    <ProjectProvider>
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
                                    </ProjectProvider>
                                </NotificationProvider>
                            </GamificationProvider>
                        </LoginPromptProvider>
                    </AuthProvider>
                </QueryProvider>
            </body>
        </html>
    );
}
