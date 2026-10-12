import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

vi.mock('@/lib/api/explore-data', () => ({ getExploreFilterOptions: vi.fn(), getProjects: vi.fn() }));
vi.mock('@/lib/recommendations/viewer', () => ({ getRecommendationViewerKey: vi.fn() }));
vi.mock('./explore-client', () => ({ ExploreClient: vi.fn(() => null) }));

import ExplorePage, { generateMetadata } from './page';
import { getExploreFilterOptions, getProjects } from '@/lib/api/explore-data';

afterEach(() => vi.unstubAllEnvs());

describe('explore search metadata', () => {
  it('gives each latest page its own canonical without tracking parameters', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ sortBy: 'latest', page: '1' }) });
    expect(metadata.alternates?.canonical).toBe('https://steam.bj.cn/explore?sortBy=latest&page=1');
    expect(metadata.title).toEqual({ absolute: 'STEAM 项目探索 · 第 2 页 | 创探空间', template: '%s | 创探空间' });
    expect(metadata.robots).toBeUndefined();
  });

  it('keeps search results crawlable but excludes them from indexing', async () => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ q: '积木', page: '1' }) });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it('normalizes malformed page and sort values to the main list', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ page: '2junk', sortBy: 'unknown' }) });
    expect(metadata.alternates?.canonical).toBe('https://steam.bj.cn/explore');
  });
});


describe('explore page errors', () => {
  it('does not convert a query failure into a missing page', async () => {
    vi.mocked(getExploreFilterOptions).mockResolvedValue({ categories: [], availableTags: [], popularTags: [], tagScope: { all: [], byCategory: {}, bySubCategory: {} } });
    vi.mocked(getProjects).mockRejectedValueOnce(new Error('database unavailable'));
    await expect(ExplorePage({ searchParams: Promise.resolve({ sortBy: 'latest', page: '1' }) }))
      .rejects.toThrow('database unavailable');
    expect(getProjects).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ strictErrors: true }));
  });

  it('still reports a genuinely empty later page as not found', async () => {
    vi.mocked(getProjects).mockResolvedValueOnce({ projects: [], total: 0, hasMore: false });
    await expect(ExplorePage({ searchParams: Promise.resolve({ sortBy: 'latest', page: '1' }) }))
      .rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});

describe('explore page initial client props', () => {
  it('passes the normalized server filter key to restore matching SSR data', async () => {
    vi.mocked(getExploreFilterOptions).mockResolvedValue({ categories: [], availableTags: [], popularTags: [], tagScope: { all: [], byCategory: {}, bySubCategory: {} } });
    vi.mocked(getProjects).mockResolvedValueOnce({ projects: [], total: 0, hasMore: false });

    const page = await ExplorePage({
      searchParams: Promise.resolve({
        category: '全部',
        difficulty: 'beginner',
        age: '8',
        tags: '标签二,标签一',
        sortBy: 'latest',
      }),
    });

    const children = (page as ReactElement<{ children: ReactElement<Record<string, unknown>>[] }>).props.children;
    const clientProps = children[1].props;
    expect(clientProps).toEqual(expect.objectContaining({
      initialFiltersKey: 'difficulty=beginner&age=8&tags=%E6%A0%87%E7%AD%BE%E4%BA%8C%2C%E6%A0%87%E7%AD%BE%E4%B8%80&sortBy=latest',
    }));
  });
});

describe('legacy explore grade parameters', () => {
  it.each([['初中', []], ['科教版,初中', ['科教版']], ['kejiao16a-src:1,二年级', []]])(
    'loads %s with matching sanitized server and client filters', async (tags, expected) => {
      vi.mocked(getExploreFilterOptions).mockResolvedValue({ categories: [], availableTags: [], popularTags: [], tagScope: { all: [], byCategory: {}, bySubCategory: {} } });
      vi.mocked(getProjects).mockResolvedValueOnce({ projects: [], total: 0, hasMore: false });
      const page = await ExplorePage({ searchParams: Promise.resolve({ tags }) });
      expect(getProjects).toHaveBeenLastCalledWith(expect.objectContaining({ tags: expected }), expect.anything());
      const children = (page as ReactElement<{ children: ReactElement<Record<string, unknown>>[] }>).props.children;
      const key = expected.length ? new URLSearchParams({ tags: expected.join(',') }).toString() : '';
      expect(children[1].props.initialFiltersKey).toBe(key);
      expect((await generateMetadata({ searchParams: Promise.resolve({ tags }) })).robots).toEqual({ index: false, follow: true });
    },
  );
});
