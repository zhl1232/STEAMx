import { expect, test, type Page } from '@playwright/test'

import { signUpAndLogin } from './helpers/auth-flow'
import {
  deletePlaygroundRaceMatchByCode,
  deleteUserByEmail,
  setPlaygroundRaceMatchDeadline,
} from './helpers/supabase-admin'

const DEFAULT_PASSWORD = process.env.E2E_USER_PASSWORD ?? '123456'

type JsonResponse<T> = {
  status: number
  body: T
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

async function getJson<T>(page: Page, path: string): Promise<JsonResponse<T>> {
  return page.evaluate(async (requestPath) => {
    const response = await fetch(requestPath, { cache: 'no-store' })
    return {
      status: response.status,
      body: (await response.json()) as T,
    }
  }, path)
}

async function createRaceRoom(page: Page) {
  const response = await postJson<{
    id: string
    code: string
    error?: string
  }>(page, '/api/playground/race-rooms', {
    game_key: 'game24',
    settings: { durationSeconds: 60, cardValues: [1, 2, 3, 4] },
  })
  expect(response.status, JSON.stringify(response.body)).toBe(200)
  expect(response.body.id).toBeTruthy()
  expect(response.body.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  return response.body
}

test.describe('游乐场联网竞速房间', () => {
  test('邀请对局、异常超时和并发加入都由服务端正确结算', async ({ browser }) => {
    test.setTimeout(210_000)

    const nonce = Date.now()
    const hostEmail = `e2e_playground_host_${nonce}@example.com`
    const guestEmail = `e2e_playground_guest_${nonce}@example.com`
    const competitorEmail = `e2e_playground_competitor_${nonce}@example.com`
    const hostContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const competitorContext = await browser.newContext()
    const hostPage = await hostContext.newPage()
    const guestPage = await guestContext.newPage()
    const competitorPage = await competitorContext.newPage()
    const roomCodes: string[] = []

    try {
      await signUpAndLogin(hostPage, {
        email: hostEmail,
        password: DEFAULT_PASSWORD,
        fullName: 'E2E 房主',
        username: `e2e_host_${nonce}`,
      })
      await signUpAndLogin(guestPage, {
        email: guestEmail,
        password: DEFAULT_PASSWORD,
        fullName: 'E2E 对手',
        username: `e2e_guest_${nonce}`,
      })
      await signUpAndLogin(competitorPage, {
        email: competitorEmail,
        password: DEFAULT_PASSWORD,
        fullName: 'E2E 竞争加入者',
        username: `e2e_competitor_${nonce}`,
      })

      await hostPage.goto('/playground/24game')
      const createResponsePromise = hostPage.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/playground/race-rooms',
      )
      await hostPage.getByRole('button', { name: '创建房间' }).click()
      const createResponse = await createResponsePromise
      const createBody = (await createResponse.json()) as { id: string; code: string; error?: string }
      expect(createResponse.status(), JSON.stringify(createBody)).toBe(200)
      await expect(hostPage.getByRole('heading', { name: '等待对手加入' })).toBeVisible({
        timeout: 20_000,
      })

      const roomCodeElement = hostPage.getByText(/^[A-HJ-NP-Z2-9]{6}$/).first()
      await expect(roomCodeElement).toBeVisible()
      const roomCode = (await roomCodeElement.textContent())?.trim() ?? ''
      expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
      roomCodes.push(roomCode)

      await guestPage.goto(`/playground/24game?room=${roomCode}`)
      await expect(guestPage.getByRole('heading', { name: '联网竞速进行中' })).toBeVisible({
        timeout: 20_000,
      })
      await expect(hostPage.getByRole('heading', { name: '联网竞速进行中' })).toBeVisible({
        timeout: 20_000,
      })

      await expect
        .poll(() =>
          hostPage.evaluate(() =>
            window.localStorage.getItem('playground_race_active_game24'),
          ),
        )
        .toBe(createBody.id)
      await expect
        .poll(() =>
          guestPage.evaluate(() =>
            window.localStorage.getItem('playground_race_active_game24'),
          ),
        )
        .toBe(createBody.id)
      const hostMatchId = createBody.id
      const guestMatchId = createBody.id

      const hostSubmission = await postJson<{ match: { status: string } }>(
        hostPage,
        `/api/playground/race-rooms/${hostMatchId}/result`,
        {
          result: {
            completed: true,
            timeSeconds: 8,
          },
        },
      )
      expect(hostSubmission.status).toBe(200)
      expect(hostSubmission.body.match.status).toBe('playing')

      const guestSubmission = await postJson<{
        match: { status: string; winner: string }
      }>(guestPage, `/api/playground/race-rooms/${guestMatchId}/result`, {
        result: {
          completed: true,
          timeSeconds: 12,
        },
      })
      expect(guestSubmission.status).toBe(200)
      expect(guestSubmission.body.match).toMatchObject({ status: 'finished', winner: 'host' })

      await expect(hostPage.getByRole('heading', { name: '你获胜了' })).toBeVisible({
        timeout: 20_000,
      })
      await expect(guestPage.getByRole('heading', { name: '对手获胜' })).toBeVisible({
        timeout: 20_000,
      })

      const concurrentRoom = await createRaceRoom(hostPage)
      roomCodes.push(concurrentRoom.code)
      const concurrentResults = await Promise.all([
        postJson<{ id?: string; status?: string; error?: string }>(
          guestPage,
          '/api/playground/race-rooms/join',
          { code: concurrentRoom.code, game_key: 'game24' },
        ),
        postJson<{ id?: string; status?: string; error?: string }>(
          competitorPage,
          '/api/playground/race-rooms/join',
          { code: concurrentRoom.code, game_key: 'game24' },
        ),
      ])
      expect(concurrentResults.map((result) => result.status).sort()).toEqual([200, 409])
      expect(concurrentResults.find((result) => result.status === 200)?.body).toMatchObject({
        id: concurrentRoom.id,
        status: 'playing',
      })
      expect(concurrentResults.find((result) => result.status === 409)?.body.error).toContain(
        '房间已被他人加入',
      )

      const waitingTimeoutRoom = await createRaceRoom(hostPage)
      roomCodes.push(waitingTimeoutRoom.code)
      await setPlaygroundRaceMatchDeadline(
        waitingTimeoutRoom.id,
        new Date(Date.now() - 60_000).toISOString(),
      )
      const waitingTimeout = await getJson<{
        status: string
        finish_reason: string
        winner: string | null
      }>(hostPage, `/api/playground/race-rooms/${waitingTimeoutRoom.id}`)
      expect(waitingTimeout.status).toBe(200)
      expect(waitingTimeout.body).toMatchObject({
        status: 'cancelled',
        finish_reason: 'waiting_timeout',
        winner: null,
      })

      const resultTimeoutRoom = await createRaceRoom(hostPage)
      roomCodes.push(resultTimeoutRoom.code)
      const resultTimeoutJoin = await postJson<{ status: string }>(
        guestPage,
        '/api/playground/race-rooms/join',
        { code: resultTimeoutRoom.code, game_key: 'game24' },
      )
      expect(resultTimeoutJoin.status).toBe(200)
      const earlySubmission = await postJson<{ match: { status: string } }>(
        hostPage,
        `/api/playground/race-rooms/${resultTimeoutRoom.id}/result`,
        { result: { completed: true, timeSeconds: 9 } },
      )
      expect(earlySubmission.status).toBe(200)
      expect(earlySubmission.body.match.status).toBe('playing')
      await setPlaygroundRaceMatchDeadline(
        resultTimeoutRoom.id,
        new Date(Date.now() - 60_000).toISOString(),
      )
      const resultTimeout = await getJson<{
        status: string
        finish_reason: string
        winner: string | null
      }>(guestPage, `/api/playground/race-rooms/${resultTimeoutRoom.id}`)
      expect(resultTimeout.status).toBe(200)
      expect(resultTimeout.body).toMatchObject({
        status: 'finished',
        finish_reason: 'result_timeout',
        winner: 'host',
      })

      const noResultTimeoutRoom = await createRaceRoom(hostPage)
      roomCodes.push(noResultTimeoutRoom.code)
      const noResultJoin = await postJson<{ status: string }>(
        guestPage,
        '/api/playground/race-rooms/join',
        { code: noResultTimeoutRoom.code, game_key: 'game24' },
      )
      expect(noResultJoin.status).toBe(200)
      await setPlaygroundRaceMatchDeadline(
        noResultTimeoutRoom.id,
        new Date(Date.now() - 60_000).toISOString(),
      )
      const noResultTimeout = await postJson<{
        match: {
          status: string
          finish_reason: string
          winner: string | null
          host_result: unknown
        }
      }>(hostPage, `/api/playground/race-rooms/${noResultTimeoutRoom.id}/result`, {
        result: { completed: true, timeSeconds: 7 },
      })
      expect(noResultTimeout.status).toBe(200)
      expect(noResultTimeout.body.match).toMatchObject({
        status: 'cancelled',
        finish_reason: 'no_result_timeout',
        winner: null,
        host_result: null,
      })
    } finally {
      for (const roomCode of roomCodes) {
        await deletePlaygroundRaceMatchByCode(roomCode)
      }
      await deleteUserByEmail(hostEmail)
      await deleteUserByEmail(guestEmail)
      await deleteUserByEmail(competitorEmail)
      await hostContext.close()
      await guestContext.close()
      await competitorContext.close()
    }
  })
})
