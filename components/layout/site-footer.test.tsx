import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";
import { ICP_FILING_NUMBER, ICP_FILING_URL } from "@/lib/seo/site";

describe("SiteFooter", () => {
  it("renders the ICP filing number as a link to MIIT", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: ICP_FILING_NUMBER })).toHaveAttribute("href", ICP_FILING_URL);
  });
});
