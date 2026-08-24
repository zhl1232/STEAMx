import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";
import { ICP_FILING_NUMBER, ICP_FILING_URL } from "@/lib/seo/site";

describe("SiteFooter", () => {
  it("renders the ICP filing number as a link to MIIT", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: ICP_FILING_NUMBER })).toHaveAttribute("href", ICP_FILING_URL);
  });

  it("links help content to the canonical public about page", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "关于我们" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "联系我们" })).toHaveAttribute("href", "/about#contact");
    expect(screen.getByRole("link", { name: "常见问题" })).toHaveAttribute("href", "/about#faq");
    expect(screen.queryByRole("link", { name: "赞助我们" })).not.toBeInTheDocument();
  });
});
