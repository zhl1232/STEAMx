import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildWebsiteJsonLd } from "@/lib/seo/json-ld";

import { JsonLd } from "./json-ld";

describe("JsonLd", () => {
  it("escapes < so data cannot close the script element", () => {
    const html = renderToStaticMarkup(<JsonLd data={{ name: "</script><script>alert(1)</script>" }} />);

    expect(html).not.toContain("</script><script>");
    expect(html).toContain("\\u003c/script>");
    const json = html.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
    expect(JSON.parse(json)).toEqual({ name: "</script><script>alert(1)</script>" });
  });

  it("renders the homepage brand graph as parseable JSON-LD", () => {
    const html = renderToStaticMarkup(<JsonLd data={buildWebsiteJsonLd()} />);
    const json = html.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");

    expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(JSON.parse(json)["@graph"][0].name).toBe("创探空间");
  });
});
