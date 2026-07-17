import { expect, test, type Page } from '@playwright/test'

import { signUpAndLogin } from './helpers/auth-flow'
import {
  deleteFunctionWarsMatchByCode,
  deleteUserByEmail,
  getFunctionWarsOnlineStats,
  setFunctionWarsMatchDeadline,
} from './helpers/supabase-admin'

const DEFAULT_PASSWORD = process.env.E2E_USER_PASSWORD ?? '123456'

type JsonResponse<T> = {
  status: number
  body: T
}

type FunctionWarsMatch = {
  id: string
  code: string
  status: 'waiting' | 'playing' | 'finished' | 'cancelled'
  current_turn: 'host' | 'guest'
  shot_seq: number
  winner: 'host' | 'guest' | 'draw' | null
  last_shot: {
    by: 'host' | 'guest'
    expression: string
  } | null
}

async function postJson<T>(page: Page, path: string, body: unknown): Promise<JsonResponse<T>> {
  return page.evaluate(
    async ({ requestPath, requestBody }) => {
      const response = await fetch(requestPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      return {
        status: response.status,
        body: (await response.json()) as T,
      }
    },
    { requestPath: path, requestBody: body },
  )
}

async function getMatch(page: Page, matchId: string): Promise<JsonResponse<FunctionWarsMatch>> {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/playground/functionwars-rooms/${id}`, {
      cache: 'no-store',
    })
    return {
      status: response.status,
      body: (await response.json()) as FunctionWarsMatch,
    }
  }, matchId)
}

test.describe('函数战争真人对战', () => {
  test('双账号完成建房、开火、重连、超时推进和认输结算', async ({ browser }) => {
    test.setTimeout(180_000)

    const nonce = Date.now()
    const hostEmail = `e2e_function_wars_host_${nonce}@example.com`
    const guestEmail = `e2e_function_wars_guest_${nonce}@example.com`
    const hostContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const hostPage = await hostContext.newPage()
    const guestPage = await guestContext.newPage()
    let hostUserId = ''
    let guestUserId = ''
    let roomCode = ''

    try {
      hostUserId = await signUpAndLogin(hostPage, {
        email: hostEmail,
        password: DEFAULT_PASSWORD,
        fullName: 'E2E 函数战争房主',
        username: `e2e_fw_host_${nonce}`,
      })
      guestUserId = await signUpAndLogin(guestPage, {
        email: guestEmail,
        password: DEFAULT_PASSWORD,
        fullName: 'E2E 函数战争对手',
        username: `e2e_fw_guest_${nonce}`,
      })

      await hostPage.goto('/playground/functionwars')
      await hostPage.getByRole('button', { name: '真人对战' }).click()
      const createResponsePromise = hostPage.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/playground/functionwars-rooms',
      )
      await hostPage.getByRole('button', { name: '创建房间' }).click()
      const createResponse = await createResponsePromise
      const created = (await createResponse.json()) as { id: string; code: string; error?: string }
      expect(createResponse.status(), JSON.stringify(created)).toBe(200)
      expect(created.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
      roomCode = created.code

      await expect(hostPage.getByLabel('等待对手加入')).toBeVisible({ timeout: 20_000 })
      await guestPage.goto(`/playground/functionwars?room=${roomCode}`)
      await expect(guestPage.getByRole('img', { name: '函数战争在线战场' })).toBeVisible({
        timeout: 20_000,
      })
      await expect(hostPage.getByRole('img', { name: '函数战争在线战场' })).toBeVisible({
        timeout: 20_000,
      })
      await expect(hostPage.getByText('你的回合', { exact: true })).toBeVisible()
      await expect(guestPage.getByText('对手计算中', { exact: true })).toBeVisible()

      const duplicateRoom = await postJson<{ error?: string }>(
        hostPage,
        '/api/playground/functionwars-rooms',
        { map_id: 'symmetric-canyon' },
      )
      expect(duplicateRoom.status).toBe(409)
      expect(duplicateRoom.body.error).toContain('已有进行中的函数战争对局')

      const fireResponsePromise = hostPage.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname ===
            `/api/playground/functionwars-rooms/${created.id}/fire`,
      )
      await hostPage.getByLabel('炮弹轨迹函数').fill('0')
      await hostPage.getByRole('button', { name: '发射' }).click()
      const fireResponse = await fireResponsePromise
      const fired = (await fireResponse.json()) as {
        ok: boolean
        shot_seq: number
        current_turn: string
      }
      expect(fireResponse.status(), JSON.stringify(fired)).toBe(200)
      expect(fired).toMatchObject({ ok: true, shot_seq: 1, current_turn: 'guest' })

      const afterShot = await getMatch(guestPage, created.id)
      expect(afterShot.status).toBe(200)
      expect(afterShot.body).toMatchObject({
        status: 'playing',
        current_turn: 'guest',
        shot_seq: 1,
        last_shot: { by: 'host', expression: '0' },
      })

      await guestPage.reload({ waitUntil: 'domcontentloaded' })
      await expect(guestPage.getByRole('img', { name: '函数战争在线战场' })).toBeVisible({
        timeout: 20_000,
      })
      await expect(guestPage.getByText('你的回合', { exact: true })).toBeVisible({
        timeout: 20_000,
      })

      await setFunctionWarsMatchDeadline(
        created.id,
        new Date(Date.now() - 1_000).toISOString(),
      )
      const afterTimeout = await getMatch(hostPage, created.id)
      expect(afterTimeout.status).toBe(200)
      expect(afterTimeout.body).toMatchObject({
        status: 'playing',
        current_turn: 'host',
        shot_seq: 2,
        last_shot: null,
      })
      await expect(hostPage.getByText('你的回合', { exact: true })).toBeVisible({
        timeout: 20_000,
      })

      await guestPage.getByRole('button', { name: '离开对局' }).click()
      await expect(guestPage.getByLabel('函数战争在线大厅')).toBeVisible({ timeout: 20_000 })
      await expect(hostPage.getByText('任务完成', { exact: true })).toBeVisible({
        timeout: 20_000,
      })

      const finished = await getMatch(hostPage, created.id)
      expect(finished.status).toBe(200)
      expect(finished.body).toMatchObject({ status: 'finished', winner: 'host' })
      await expect.poll(() => getFunctionWarsOnlineStats(hostUserId)).toEqual({
        onlineGames: 1,
        onlineWins: 1,
      })
      await expect.poll(() => getFunctionWarsOnlineStats(guestUserId)).toEqual({
        onlineGames: 1,
        onlineWins: 0,
      })
    } finally {
      if (roomCode) await deleteFunctionWarsMatchByCode(roomCode)
      await deleteUserByEmail(hostEmail)
      await deleteUserByEmail(guestEmail)
      await hostContext.close()
      await guestContext.close()
    }
  })
})
