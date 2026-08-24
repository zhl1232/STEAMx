import { describe, expect, it } from "vitest";

import { generateMetadata } from "./page";

describe("lesson preview metadata", () => {
  it("keeps previews out of the index and canonicals to the lesson", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ courseId: "5", lessonId: "30" }),
    });

    expect(metadata.alternates).toEqual({ canonical: "/courses/5/lessons/30" });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
