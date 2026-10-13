import Image from "next/image";
import Link from "next/link";

import { SteamLogo } from "@/components/layout/logo";
import {
  ICP_FILING_NUMBER,
  ICP_FILING_URL,
  POLICE_FILING_ICON_SRC,
  POLICE_FILING_NUMBER,
  POLICE_FILING_URL,
} from "@/lib/seo/filings";
import { BRAND_FULL_NAME, BRAND_POSITIONING } from "@/lib/brand";

const siteFooterColumns = [
  {
    title: "关于我们",
    links: [
      { label: "关于我们", href: "/about" },
      { label: "会员服务说明", href: "/membership" },
      { label: "联系我们", href: "/about#contact" },
    ],
  },
  {
    title: "帮助中心",
    links: [
      { label: "使用指南", href: "/explore" },
      { label: "常见问题", href: "/about#faq" },
      { label: "安全与隐私", href: "/legal/privacy" },
    ],
  },
  {
    title: "反馈与支持",
    links: [
      { label: "提交反馈", href: "/about#feedback" },
      { label: "服务条款", href: "/legal/terms" },
      { label: "隐私政策", href: "/legal/privacy" },
    ],
  },
] as const;

const filingLinkClassName =
  "inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline";

export function SiteFooter() {
  return (
    <footer className="border-t border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.7)] py-6">
      <div className="app-shell-wide hidden grid-cols-2 gap-x-10 gap-y-7 px-8 text-[13px] text-muted-foreground md:grid lg:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="mb-3 flex items-center gap-2">
            <SteamLogo className="h-8 w-8" />
            <span className="text-[22px] font-extrabold text-[hsl(var(--brand-blue))]">{BRAND_FULL_NAME}</span>
          </Link>
          <p>{BRAND_POSITIONING}</p>
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
      <div className="mt-0 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 px-4 text-center text-[13px] text-foreground/75 md:mt-4">
        <span>© 2026 {BRAND_FULL_NAME}</span>
        <span aria-hidden="true">·</span>
        <a
          href={ICP_FILING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={filingLinkClassName}
        >
          {ICP_FILING_NUMBER}
        </a>
        <span aria-hidden="true">·</span>
        <a
          href={POLICE_FILING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={filingLinkClassName}
        >
          <Image
            src={POLICE_FILING_ICON_SRC}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 shrink-0"
            aria-hidden="true"
          />
          <span>{POLICE_FILING_NUMBER}</span>
        </a>
      </div>
    </footer>
  );
}
