import { describe, expect, it } from "vitest";

import { buildSpeciesTopicMetadata } from "@/app/nature/_components/species-topic-page";

describe("buildSpeciesTopicMetadata", () => {
  it("gives each nature topic a canonical route and topical image", () => {
    const metadata = buildSpeciesTopicMetadata({
      topic: "birds",
      slug: "birds",
      title: "鸟类图鉴与观察",
      description: "浏览常见鸟类图鉴与观察记录。",
      keywords: ["鸟类图鉴"],
      image: "/assets/nature-topic-birds.webp",
    });

    expect(metadata.alternates).toEqual({ canonical: "/nature/birds" });
    expect(metadata.openGraph).toMatchObject({
      url: "/nature/birds",
      images: [{ url: "/assets/nature-topic-birds.webp", alt: "鸟类图鉴与观察" }],
    });
  });
});
