import type { Metadata, Viewport } from "next";
import Script from "next/script";

import "./globals.css";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { ConditionalAppShell } from "@/components/layout/conditional-app-shell";
import { ObservationGamificationSync } from "@/components/features/gamification/observation-gamification-sync";
import QueryProvider from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/lib/context/auth-context";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    template: "%s | STEAM 探索",
    default: "STEAM 探索 - 基于项目学习（PBL）的探索平台",
  },
  description:
    "基于项目学习（PBL）的 STEAM 探索平台。用户可以在做中学，发现、分享并完成科学、技术、工程、艺术与数学项目。",
  keywords: [
    "STEAM",
    "PBL",
    "项目式学习",
    "教育",
    "项目分享",
    "科学",
    "技术",
    "工程",
    "艺术",
    "数学",
    "DIY",
    "创客",
  ],
  authors: [{ name: "STEAM 探索团队" }],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: appUrl,
    title: "STEAM 探索 - 基于项目学习（PBL）的探索平台",
    description:
      "基于项目学习（PBL）的 STEAM 探索平台。用户可以在做中学，发现、分享并完成科学、技术、工程、艺术与数学项目。",
    siteName: "STEAM 探索",
  },
  twitter: {
    card: "summary_large_image",
    title: "STEAM 探索",
    description: "基于项目学习（PBL）的 STEAM 探索平台",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body className="antialiased">
        {/* Cloudflare Workers 兼容：补充缺失的 __name helper，避免运行时 ReferenceError */}
        <Script id="bootstrap-runtime-helpers" strategy="beforeInteractive">
          {`
            window.__name = (n) => n;
            try {
              if (window.localStorage.getItem("theme") === "black-gold") {
                document.documentElement.classList.add("dark", "black-gold");
              }
            } catch {}
          `}
        </Script>
        <QueryProvider>
          <ObservationGamificationSync />
          <AuthProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              themes={["light", "dark", "system", "black-gold"]}
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
  );
}
