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
import { BRAND_FULL_NAME } from "@/lib/brand";
import { fontClassNames } from "@/lib/fonts";
import { HOME_DOCUMENT_TITLE, SITE_DESCRIPTION, SITE_NAME, getMetadataBase } from "@/lib/seo/site";
import { DEFAULT_SEO_KEYWORDS, DEFAULT_SOCIAL_IMAGE } from "@/lib/seo/metadata";
import { buildSiteVerificationMetadata } from "@/lib/seo/site-verification";
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
    default: HOME_DOCUMENT_TITLE,
  },
  description: SITE_DESCRIPTION,
  keywords: [...DEFAULT_SEO_KEYWORDS, "项目分享社区"],
  authors: [{ name: `${BRAND_FULL_NAME}团队` }],
  other: {
    // 百度对自适应页面的识别仍会参考该标记；本站不区分独立移动域名。
    "applicable-device": "pc,mobile",
  },
  verification: buildSiteVerificationMetadata(),
  // Homepage canonical/og:url are handwritten in HomepageCanonicalTags (Next Metadata strips `/` slash).
  // Other routes set their own via buildPageMetadata.
  openGraph: {
    type: "website",
    locale: "zh_CN",
    title: HOME_DOCUMENT_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    images: [{
      url: DEFAULT_SOCIAL_IMAGE,
      width: 1200,
      height: 630,
      alt: HOME_DOCUMENT_TITLE,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_DOCUMENT_TITLE,
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
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon-32.png",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
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
