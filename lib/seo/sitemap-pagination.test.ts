import { describe, expect, it, vi } from "vitest";

import { fetchAllSitemapRows } from "@/lib/seo/sitemap-pagination";

describe("fetchAllSitemapRows", () => {
  it("reads every page with deterministic ordering", async () => {
    const source = Array.from({ length: 5 }, (_, index) => ({ id: index + 1 }));
    const order = vi.fn();
    const range = vi.fn(async (from: number, to: number) => ({
      data: source.slice(from, to + 1),
      error: null,
    }));
    const createQuery = vi.fn(() => ({
      order: (column: string, options: { ascending: boolean }) => {
        order(column, options);
        return { range };
      },
    }));

    await expect(fetchAllSitemapRows(createQuery, { pageSize: 2 })).resolves.toEqual(source);
    expect(createQuery).toHaveBeenCalledTimes(3);
    expect(order).toHaveBeenCalledTimes(3);
    expect(order).toHaveBeenCalledWith("id", { ascending: true });
    expect(range.mock.calls).toEqual([[0, 1], [2, 3], [4, 5]]);
  });

  it("stops on an empty table and forwards query errors", async () => {
    const emptyQuery = () => ({
      order: () => ({ range: async () => ({ data: [], error: null }) }),
    });
    const expectedError = new Error("query failed");
    const failingQuery = () => ({
      order: () => ({ range: async () => ({ data: null, error: expectedError }) }),
    });

    await expect(fetchAllSitemapRows(emptyQuery)).resolves.toEqual([]);
    await expect(fetchAllSitemapRows(failingQuery)).rejects.toBe(expectedError);
  });
});
