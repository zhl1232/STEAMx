import Link from "next/link";

import { SteamLogo } from "@/components/layout/logo";
import { ICP_FILING_NUMBER, ICP_FILING_URL } from "@/lib/seo/site";
import { BRAND_FULL_NAME } from "@/lib/brand";

const siteFooterColumns = [
  {
    title: "关于我们",
    links: [
      { label: "关于我们", href: "/settings/about" },
      { label: "联系我们", href: "/settings/about" },
      { label: "加入我们", href: "/settings/about" },
    ],
  },
  {
    title: "帮助中心",
    links: [
      { label: "使用指南", href: "/explore" },
      { label: "常见问题", href: "/settings/about" },
      { label: "安全与隐私", href: "/legal/privacy" },
    ],
  },
  {
    title: "合作伙伴",
    links: [
      { label: "学校合作", href: "/settings/about" },
      { label: "机构合作", href: "/settings/about" },
      { label: "赞助我们", href: "/settings/about" },
    ],
  },
  {
    title: "反馈与支持",
    links: [
      { label: "提交反馈", href: "/settings/about" },
      { label: "服务条款", href: "/legal/terms" },
      { label: "隐私政策", href: "/legal/privacy" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.7)] py-6">
      <div className="app-shell-wide hidden grid-cols-2 gap-x-10 gap-y-7 px-8 text-[13px] text-muted-foreground md:grid lg:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div>
          <Link href="/" className="mb-3 flex items-center gap-2">
            <SteamLogo className="h-8 w-8" />
            <span className="text-[22px] font-extrabold text-[hsl(var(--brand-blue))]">{BRAND_FULL_NAME}</span>
          </Link>
          <p>连接全球青少年，探索 STEAM 的无限可能</p>
        </div>
        {siteFooterColumns.map((column) => (
          <div key={column.title}>
            <h3 className="mb-3 font-bold text-foreground">{column.title}</h3>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-0 px-4 text-center text-[12px] text-muted-foreground md:mt-4">
        © 2026 {BRAND_FULL_NAME} · 面向青少年的项目式学习社区
        <span aria-hidden="true"> · </span>
        <a
          href={ICP_FILING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:text-foreground hover:underline"
        >
          {ICP_FILING_NUMBER}
        </a>
      </p>
    </footer>
  );
}
