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
import { BRAND_FULL_NAME, BRAND_NAME, BRAND_NAME_ZH } from "@/lib/brand";
import { fontClassNames } from "@/lib/fonts";
import { SITE_DESCRIPTION, SITE_NAME, getMetadataBase } from "@/lib/seo/site";
import { DEFAULT_SOCIAL_IMAGE } from "@/lib/seo/metadata";
import { PwaInstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

const metadataBase = getMetadataBase();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
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
    BRAND_NAME,
    BRAND_NAME_ZH,
    "STEAM",
    "少儿编程",
    "免费少儿编程",
    "积木",
    "自然观察",
    "积木课",
    "PBL",
    "科学实验",
    "创客教育",
    "项目分享社区",
  ],
  authors: [{ name: `${BRAND_FULL_NAME}团队` }],
  other: {
    // 百度对自适应页面的识别仍会参考该标记；本站不区分独立移动域名。
    "applicable-device": "pc,mobile",
  },
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
    images: [{
      url: DEFAULT_SOCIAL_IMAGE,
      width: 1200,
      height: 630,
      alt: SITE_NAME,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icon-192x192.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={fontClassNames} suppressHydrationWarning>
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
              <ServiceWorkerRegister />
              <PwaInstallPrompt />
            </ThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
