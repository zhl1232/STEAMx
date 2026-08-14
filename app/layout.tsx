import type { Metadata, Viewport } from "next";
import Script from "next/script";

import "leaflet/dist/leaflet.css";
import "./globals.css";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { ConditionalAppShell } from "@/components/layout/conditional-app-shell";
import { SiteFooter } from "@/components/layout/site-footer";
import { ObservationGamificationSync } from "@/components/features/gamification/observation-gamification-sync";
import { BadgeUnlockOverlayMount } from "@/components/features/gamification/badge-unlock-overlay-mount";
import QueryProvider from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/lib/context/auth-context";
import { fontClassNames } from "@/lib/fonts";
import { SITE_DESCRIPTION, SITE_NAME, getMetadataBase } from "@/lib/seo/site";

const metadataBase = getMetadataBase();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase,
  applicationName: SITE_NAME,
  title: {
    template: `%s | ${SITE_NAME}`,
    default: SITE_NAME,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "STEAM",
    "STEAM教育",
    "PBL",
    "项目式学习",
    "科学实验",
    "创客教育",
    "自然观察",
    "鸟类观察",
    "项目分享社区",
  ],
  authors: [{ name: "STEAM 探索团队" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "/",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: "STEAM 项目式学习与自然观察社区",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh" className={fontClassNames} suppressHydrationWarning>
      <body className="font-sans antialiased">
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
                <ConditionalAppShell footer={<SiteFooter />}>{children}</ConditionalAppShell>
              </ErrorBoundary>
              <BadgeUnlockOverlayMount />
              <Toaster />
            </ThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
