import { describe, expect, it } from 'vitest';
import { buildExplorePageHref, parseExplorePage } from './explore-pagination';

describe('explore pagination URLs', () => {
  it('preserves filters and stable sorting without tracking or stale page parameters', () => {
    const params = new URLSearchParams('q=积木&sortBy=latest&age=8&page=9&utm_source=test');
    const url = new URL(buildExplorePageHref(params, 1), 'https://steam.bj.cn');
    expect(url.searchParams.get('q')).toBe('积木');
    expect(url.searchParams.get('sortBy')).toBe('latest');
    expect(url.searchParams.get('age')).toBe('8');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.has('utm_source')).toBe(false);
    expect(params.get('page')).toBe('9');
  });

  it('omits page zero and rejects malformed or unsafe page numbers', () => {
    expect(buildExplorePageHref(new URLSearchParams(), 0)).toBe('/explore');
    for (const value of [undefined, '-1', '2junk', '1.2', 'Infinity', '999999999999999999']) {
      expect(parseExplorePage(value)).toBe(0);
    }
    expect(parseExplorePage('2')).toBe(2);
  });
  it('keeps only supported theme tags in pagination and canonical URLs', () => {
    const params = new URLSearchParams({ tags: '磁力,趣味实验,初中,科教版,趣味实验', sortBy: 'latest' });
    const url = new URL(buildExplorePageHref(params, 2), 'https://steam.bj.cn');
    expect(url.searchParams.get('tags')).toBe('趣味实验,科教版');
    expect(url.searchParams.get('sortBy')).toBe('latest');
    expect(url.searchParams.get('page')).toBe('2');
    expect(params.get('tags')).toBe('磁力,趣味实验,初中,科教版,趣味实验');
    expect(buildExplorePageHref(new URLSearchParams({ tags: '磁力,初中' }), 0)).toBe('/explore');
  });

});
