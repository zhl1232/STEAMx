import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from './route';

vi.mock('@/lib/api/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'test-user-id' }),
  handleApiError: vi.fn((err) => new Response(JSON.stringify({ error: err.message }), { status: 500 })),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  requireRateLimit: vi.fn().mockResolvedValue(undefined),
}));

const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn(() => ({
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return { eq: mockEq };
      },
    })),
  }),
}));

describe('PATCH /api/profile/equipped-honor', () => {
  it('updates equipped_title and featured_badge_ids successfully', async () => {
    mockUpdate.mockClear();
    const req = new NextRequest('http://localhost:3000/api/profile/equipped-honor', {
      method: 'PATCH',
      body: JSON.stringify({
        equipped_title: '真理追寻者',
        featured_badge_ids: ['science_expert_gold', 'tech_expert_silver'],
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.equipped_title).toBe('真理追寻者');
    expect(body.featured_badge_ids).toEqual(['science_expert_gold', 'tech_expert_silver']);
  });

  it('allows up to 5 featured badges', async () => {
    mockUpdate.mockClear();
    const req = new NextRequest('http://localhost:3000/api/profile/equipped-honor', {
      method: 'PATCH',
      body: JSON.stringify({
        featured_badge_ids: ['1', '2', '3', '4', '5'],
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.featured_badge_ids).toEqual(['1', '2', '3', '4', '5']);
  });

  it('keeps null as the default-selection state', async () => {
    mockUpdate.mockClear();
    const req = new NextRequest('http://localhost:3000/api/profile/equipped-honor', {
      method: 'PATCH',
      body: JSON.stringify({ featured_badge_ids: null }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.featured_badge_ids).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith({ featured_badge_ids: null });
  });

  it('keeps an empty array as an explicitly empty selection', async () => {
    mockUpdate.mockClear();
    const req = new NextRequest('http://localhost:3000/api/profile/equipped-honor', {
      method: 'PATCH',
      body: JSON.stringify({ featured_badge_ids: [] }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.featured_badge_ids).toEqual([]);
    expect(mockUpdate).toHaveBeenCalledWith({ featured_badge_ids: [] });
  });

  it('rejects more than 5 featured badges', async () => {
    const req = new NextRequest('http://localhost:3000/api/profile/equipped-honor', {
      method: 'PATCH',
      body: JSON.stringify({
        featured_badge_ids: ['1', '2', '3', '4', '5', '6'],
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('最多展示 5 枚');
  });
});
