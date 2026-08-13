import { describe, expect, it, vi } from 'vitest'

import {
  OBSERVATION_ROLLBACK_FAILED_MESSAGE,
  rollbackCreatedObservations,
} from './create-rollback'

function mockDeleteClient(result: { data: Array<{ id: number }> | null; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ select }))
  const inFilter = vi.fn(() => ({ eq }))
  const del = vi.fn(() => ({ in: inFilter }))
  const from = vi.fn(() => ({ delete: del }))
  return { from, select, eq, inFilter, del } as const
}

describe('rollbackCreatedObservations', () => {
  it('deletes every created observation id for the author', async () => {
    const client = mockDeleteClient({ data: [{ id: 11 }, { id: 12 }], error: null })

    await rollbackCreatedObservations({
      supabase: { from: client.from } as never,
      userId: 'user-1',
      observationIds: [11, 12],
    })

    expect(client.from).toHaveBeenCalledWith('observation_events')
    expect(client.inFilter).toHaveBeenCalledWith('id', [11, 12])
    expect(client.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(client.select).toHaveBeenCalledWith('id')
  })

  it('throws when the delete does not remove every created row', async () => {
    const client = mockDeleteClient({ data: [{ id: 11 }], error: null })

    await expect(rollbackCreatedObservations({
      supabase: { from: client.from } as never,
      userId: 'user-1',
      observationIds: [11, 12],
    })).rejects.toThrow(OBSERVATION_ROLLBACK_FAILED_MESSAGE)
  })

  it('throws when the delete query itself fails', async () => {
    const client = mockDeleteClient({ data: null, error: new Error('rls denied') })

    await expect(rollbackCreatedObservations({
      supabase: { from: client.from } as never,
      userId: 'user-1',
      observationIds: [11],
    })).rejects.toThrow('rls denied')
  })
})
