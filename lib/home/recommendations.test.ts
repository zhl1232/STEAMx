/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

import {
  birthDateToExactAge,
  collectHomepageRecommendations,
  selectCategoryBalancedProjects,
} from "@/lib/home/recommendations";
import { type Project } from "@/lib/mappers/types";

function createProject(id: number, title = `项目 ${id}`, category = "科学"): Project {
  return {
    id,
    title,
    author: `作者 ${id}`,
    author_id: `user-${id}`,
    image: `/project-${id}.webp`,
    category,
    likes: id * 10,
  };
}

describe("selectCategoryBalancedProjects", () => {
  it("keeps one selected project per category order and fills missing slots from fallback hot projects", () => {
    const result = selectCategoryBalancedProjects({
      categoryProjects: [
        createProject(1, "科学热门", "科学"),
        createProject(2, "工程热门", "工程"),
        createProject(3, "艺术热门", "艺术"),
      ],
      fallbackProjects: [
        createProject(2, "重复工程", "工程"),
        createProject(4, "全站热门 4", "科学"),
        createProject(5, "全站热门 5", "技术"),
      ],
      limit: 5,
    });

    expect(result.map((project) => project.id)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("collectHomepageRecommendations", () => {
  it("continues scanning personalized results until it fills a unique batch", async () => {
    const fetchPersonalized = vi
      .fn()
      .mockResolvedValueOnce({
        projects: [1, 2, 3, 4].map((id) => createProject(id)),
        nextOffset: 4,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        projects: [5, 6, 7, 8].map((id) => createProject(id)),
        nextOffset: 8,
        hasMore: true,
      });

    const fetchPopular = vi.fn();

    const result = await collectHomepageRecommendations({
      limit: 4,
      offset: 0,
      excludeIds: [1, 2, 3, 4],
      mode: "personalized",
      fetchPersonalized,
      fetchPopular,
    });

    expect(result.mode).toBe("personalized");
    expect(result.nextOffset).toBe(8);
    expect(result.hasMore).toBe(true);
    expect(result.projects.map((project) => project.id)).toEqual([5, 6, 7, 8]);
    expect(fetchPersonalized).toHaveBeenCalledTimes(2);
    expect(fetchPopular).not.toHaveBeenCalled();
  });

  it("falls back to popular results when personalized recommendations run out", async () => {
    const fetchPersonalized = vi.fn().mockResolvedValue({
      projects: [createProject(10)],
      nextOffset: 1,
      hasMore: false,
    });

    const fetchPopular = vi.fn().mockResolvedValue({
      projects: [1, 2, 3, 4].map((id) => createProject(id)),
      nextOffset: 4,
      hasMore: true,
    });

    const result = await collectHomepageRecommendations({
      limit: 4,
      offset: 0,
      excludeIds: [1],
      mode: "personalized",
      fetchPersonalized,
      fetchPopular,
    });

    expect(result.mode).toBe("popular-fallback");
    expect(result.nextOffset).toBe(4);
    expect(result.hasMore).toBe(true);
    expect(result.projects.map((project) => project.id)).toEqual([10, 2, 3, 4]);
    expect(fetchPersonalized).toHaveBeenCalledTimes(1);
    expect(fetchPopular).toHaveBeenCalledWith({ limit: 4, offset: 0 });
  });

  it("relaxes homepage exclusions to fill the sidebar batch when unique popular results run out", async () => {
    const fetchPersonalized = vi.fn();
    const fetchPopular = vi
      .fn()
      .mockResolvedValueOnce({
        projects: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => createProject(id)),
        nextOffset: 8,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        projects: [9].map((id) => createProject(id)),
        nextOffset: 9,
        hasMore: false,
      })
      .mockResolvedValueOnce({
        projects: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => createProject(id)),
        nextOffset: 8,
        hasMore: true,
      });

    const result = await collectHomepageRecommendations({
      limit: 8,
      offset: 0,
      excludeIds: [1, 2, 3, 4, 5],
      mode: "popular-fallback",
      fetchPersonalized,
      fetchPopular,
    });

    expect(result.projects.map((project) => project.id)).toEqual([6, 7, 8, 9, 1, 2, 3, 4]);
    expect(fetchPopular).toHaveBeenCalledTimes(3);
    expect(fetchPopular).toHaveBeenNthCalledWith(3, { limit: 8, offset: 0 });
  });
});

describe("birthDateToExactAge", () => {
  const today = new Date(2026, 7, 25);

  it("returns the exact age at the birthday boundary", () => {
    expect(birthDateToExactAge("2020-08-25", today)).toBe(6);
    expect(birthDateToExactAge("2020-08-26", today)).toBe(5);
    expect(birthDateToExactAge("2023-08-25", today)).toBe(3);
    expect(birthDateToExactAge("2010-08-25", today)).toBe(16);
  });

  it("does not guess ages outside the supported range", () => {
    expect(birthDateToExactAge(null, today)).toBeNull();
    expect(birthDateToExactAge("2024-08-25", today)).toBeNull();
    expect(birthDateToExactAge("2009-08-25", today)).toBeNull();
    expect(birthDateToExactAge("not-a-date", today)).toBeNull();
    expect(birthDateToExactAge("2026-02-30", today)).toBeNull();
  });
});
