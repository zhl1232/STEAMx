import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ProjectProvider } from "@/context/project-context";
import { AuthProvider } from "@/context/auth-context";
import { LoginPromptProvider } from "@/context/login-prompt-context";
import { GamificationProvider } from "@/context/gamification-context";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { UserButton } from "@/components/user-button";
import { MainNav } from "@/components/main-nav";
import { MobileNav } from "@/components/mobile-nav";
import { NotificationProvider } from "@/context/notification-context";
import { NotificationBell } from "@/components/notification-bell";
import { ErrorBoundary } from "@/components/error-boundary";
import { HeaderSearch } from "@/components/header-search";
import { ShareButton } from "@/components/share-button";


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

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="zh" suppressHydrationWarning>
            <body className={inter.className}>
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
                                            <div className="flex min-h-screen flex-col bg-background">
                                                {/* Header */}
                                                <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                                                    <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-8">
                                                        <MobileNav />

                                                        <div className="md:hidden flex items-center mr-2">
                                                            <Link href="/" className="flex items-center space-x-2">
                                                                <Rocket className="h-5 w-5 text-primary" />
                                                                <span className="font-bold hidden sm:inline-block">STEAM</span>
                                                            </Link>
                                                        </div>

                                                        {/* Logo & Desktop Nav */}
                                                        <div className="mr-4 hidden md:flex items-center">
                                                            <Link className="mr-6 flex items-center space-x-2" href="/">
                                                                <Rocket className="h-6 w-6 text-primary" />
                                                                <span className="hidden font-bold sm:inline-block text-lg">STEAM 探索</span>
                                                            </Link>
                                                            {/* 主导航 */}
                                                            <MainNav />
                                                        </div>

                                                        {/* 右侧搜索和操作区 */}
                                                        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                                                            <div className="w-full flex-1 md:w-auto md:flex-none">
                                                                <HeaderSearch />
                                                            </div>
                                                            <nav className="flex items-center gap-2">
                                                                <ShareButton />
                                                                <NotificationBell />
                                                                <UserButton />
                                                            </nav>
                                                        </div>
                                                    </div>
                                                </header>
                                                {/* Main content */}
                                                <main className="flex-1">{children}</main>
                                            </div>
                                        </ErrorBoundary>
                                        <Toaster />
                                    </ThemeProvider>
                                </ProjectProvider>
                            </NotificationProvider>
                        </GamificationProvider>
                    </LoginPromptProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
