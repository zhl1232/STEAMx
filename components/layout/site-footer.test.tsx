import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";
import {
  ICP_FILING_NUMBER,
  ICP_FILING_URL,
  POLICE_FILING_ICON_SRC,
  POLICE_FILING_NUMBER,
  POLICE_FILING_URL,
} from "@/lib/seo/filings";

describe("SiteFooter", () => {
  it("renders the ICP filing number as a link to MIIT", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: ICP_FILING_NUMBER })).toHaveAttribute("href", ICP_FILING_URL);
  });

  it("renders the police filing badge and number linking to the MPS query", () => {
    render(<SiteFooter />);

    const policeLink = screen.getByRole("link", { name: POLICE_FILING_NUMBER });
    expect(policeLink).toHaveAttribute("href", POLICE_FILING_URL);

    const badge = policeLink.querySelector("img");
    expect(badge).not.toBeNull();
    expect(badge).toHaveAttribute("src", expect.stringContaining(POLICE_FILING_ICON_SRC.replace(/^\//, "")));
  });

  it("links help content to the canonical public about page", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "关于我们" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "联系我们" })).toHaveAttribute("href", "/about#contact");
    expect(screen.getByRole("link", { name: "常见问题" })).toHaveAttribute("href", "/about#faq");
    expect(screen.queryByRole("link", { name: "赞助我们" })).not.toBeInTheDocument();
  });

  it("shows the canonical steam.bj.cn host in the copyright line", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "steam.bj.cn" })).toHaveAttribute("href", "https://steam.bj.cn");
  });
});
