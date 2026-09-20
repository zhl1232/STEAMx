import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/explore-data', () => ({ getExploreFilterOptions: vi.fn(), getProjects: vi.fn() }));
vi.mock('@/lib/recommendations/viewer', () => ({ getRecommendationViewerKey: vi.fn() }));
vi.mock('./explore-client', () => ({ ExploreClient: () => null }));

import ExplorePage, { generateMetadata } from './page';
import { getExploreFilterOptions, getProjects } from '@/lib/api/explore-data';

afterEach(() => vi.unstubAllEnvs());

describe('explore search metadata', () => {
  it('gives each latest page its own canonical without tracking parameters', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ sortBy: 'latest', page: '1' }) });
    expect(metadata.alternates?.canonical).toBe('https://steam.bj.cn/explore?sortBy=latest&page=1');
    expect(metadata.title).toBe('STEAM 项目探索 · 第 2 页');
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
