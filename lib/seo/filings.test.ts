import { describe, expect, it } from "vitest";

import { ICP_FILING_NUMBER, ICP_FILING_URL } from "@/lib/seo/site";
import {
  ICP_FILING_NUMBER as FOOTER_ICP_NUMBER,
  ICP_FILING_URL as FOOTER_ICP_URL,
  POLICE_FILING_ICON_SRC,
  POLICE_FILING_NUMBER,
  POLICE_FILING_URL,
} from "@/lib/seo/filings";

describe("filings", () => {
  it("keeps footer ICP aligned with site SEO constants", () => {
    expect(FOOTER_ICP_NUMBER).toBe(ICP_FILING_NUMBER);
    expect(FOOTER_ICP_NUMBER).toBe("京ICP备2025129751号-3");
    expect(FOOTER_ICP_URL).toBe(ICP_FILING_URL);
    expect(FOOTER_ICP_URL).toBe("https://beian.miit.gov.cn/");
  });

  it("exposes the police filing number, MPS query URL, and local badge path", () => {
    expect(POLICE_FILING_NUMBER).toBe("京公网安备11011402057315号");
    expect(POLICE_FILING_URL).toBe(
      "https://beian.mps.gov.cn/#/query/webSearch?code=11011402057315",
    );
    expect(POLICE_FILING_ICON_SRC).toBe("/gongan-beian.png");
  });
});
