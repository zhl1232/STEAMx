import { afterEach, describe, expect, it, vi } from 'vitest';
import { toPublicImageUrl } from './public-image';

afterEach(() => vi.unstubAllEnvs());

describe('public metadata images', () => {
  it('routes migrated local images to the working asset delivery URL', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(toPublicImageUrl('/projects/generated/project-0012-guide.webp'))
      .toBe('https://steam.bj.cn/api/assets/projects/generated/project-0012-guide.webp');
    expect(toPublicImageUrl('/api/assets/courses/castle.webp?v=2'))
      .toBe('https://steam.bj.cn/api/assets/courses/castle.webp?v=2');
  });

  it('proxies configured CDN objects even when direct display is selected', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ASSETS_BASE_URL', 'https://cdn.example.com/assets');
    vi.stubEnv('NEXT_PUBLIC_ASSETS_DISPLAY_MODE', 'direct');
    expect(toPublicImageUrl('https://cdn.example.com/assets/lesson-a/finished.png'))
      .toBe('https://steam.bj.cn/api/assets/lesson-a/finished.png');
    expect(toPublicImageUrl('https://another.example/image.png')).toBe('https://another.example/image.png');
    expect(toPublicImageUrl('https://another.example/projects/image.png')).toBe('https://another.example/projects/image.png');
  });

  it('keeps ordinary local images and rejects non-fetchable schemes', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(toPublicImageUrl('/assets/seo/steamx-social-card.webp'))
      .toBe('https://steam.bj.cn/assets/seo/steamx-social-card.webp');
    expect(toPublicImageUrl(' ')).toBeUndefined();
    expect(toPublicImageUrl('data:image/png;base64,abc')).toBeUndefined();
    expect(toPublicImageUrl('javascript:alert(1)')).toBeUndefined();
  });
});
