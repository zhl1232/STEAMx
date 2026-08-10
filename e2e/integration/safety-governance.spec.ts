import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { signUpAndLogin } from './helpers/auth-flow'
import { deleteSafetyGovernanceFixtures } from './helpers/supabase-admin'

const DEFAULT_PASSWORD = process.env.E2E_USER_PASSWORD ?? '123456'
const RUN_ID = `${Date.now()}_${process.pid}`

const USERS = {
  author: {
    email: process.env.E2E_SAFETY_AUTHOR_EMAIL ?? `e2e_safety_author_${RUN_ID}@example.com`,
    fullName: `E2E 安全作者 ${RUN_ID}`,
    username: `e2e_safety_author_${RUN_ID}`,
    role: 'user' as const,
  },
  reporter: {
    email: process.env.E2E_SAFETY_REPORTER_EMAIL ?? `e2e_safety_reporter_${RUN_ID}@example.com`,
    fullName: `E2E 安全举报人 ${RUN_ID}`,
    username: `e2e_safety_reporter_${RUN_ID}`,
    role: 'user' as const,
  },
  admin: {
    email: process.env.E2E_SAFETY_ADMIN_EMAIL ?? `e2e_safety_admin_${RUN_ID}@example.com`,
    fullName: `E2E 安全管理员 ${RUN_ID}`,
    username: `e2e_safety_admin_${RUN_ID}`,
    role: 'admin' as const,
  },
}

type Session = {
  context: BrowserContext
  page: Page
  userId: string
}

type SafetyUser = (typeof USERS)[keyof typeof USERS]

async function createSession(browser: Browser, user: SafetyUser): Promise<Session> {
  const context = await browser.newContext()
  const page = await context.newPage()
  const userId = await signUpAndLogin(page, {
    email: user.email,
    password: DEFAULT_PASSWORD,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
  })

  return { context, page, userId }
}

async function readJson(response: { json(): Promise<unknown> }) {
  return response.json().catch(() => null) as Promise<Record<string, unknown> | null>
}

test.describe('社区安全治理全链路', () => {
  test('覆盖敏感内容、举报隐藏、屏蔽互动、管理员处理和处罚申诉', async ({ browser }) => {
    test.setTimeout(180_000)

    const contexts: BrowserContext[] = []
    let author: Session | null = null
    let reporter: Session | null = null
    let admin: Session | null = null
    let projectId: number | null = null

    try {
      author = await createSession(browser, USERS.author)
      reporter = await createSession(browser, USERS.reporter)
      admin = await createSession(browser, USERS.admin)
      contexts.push(author.context, reporter.context, admin.context)

      const projectTitle = `E2E 安全项目 ${RUN_ID}`
      const projectResponse = await author.page.request.post('/api/projects', {
        data: {
          title: projectTitle,
          description: '用于验证社区安全治理和公开读取策略的测试项目。',
          category: '科学',
          difficulty: 'easy',
          difficulty_stars: 1,
          materials: ['纸张'],
          steps: [{ title: '准备材料', description: '按步骤完成测试。' }],
        },
      })
      expect(projectResponse.status()).toBe(201)
      const projectPayload = await readJson(projectResponse)
      projectId = Number(projectPayload?.id)
      expect(projectId).toBeGreaterThan(0)

      const sensitiveProjectResponse = await author.page.request.post('/api/projects', {
        data: {
          title: `E2E 敏感内容 ${RUN_ID}`,
          description: '这个项目包含赌博等不适宜文本。',
          category: '科学',
          difficulty: 'easy',
          difficulty_stars: 1,
          materials: ['纸张'],
          steps: [{ title: '测试', description: '测试' }],
        },
      })
      expect([400, 422]).toContain(sensitiveProjectResponse.status())
      const sensitivePayload = await readJson(sensitiveProjectResponse)
      expect(JSON.stringify(sensitivePayload)).toMatch(/不当内容|安全检查/)

      const approveProjectResponse = await admin.page.request.post(`/api/admin/projects/${projectId}/review`, {
        data: { action: 'approve' },
      })
      expect(approveProjectResponse.status()).toBe(200)

      const blockResponse = await author.page.request.post('/api/blocks', {
        data: { blockedUserId: reporter.userId },
      })
      expect(blockResponse.status()).toBe(200)

      const blockStateResponse = await reporter.page.request.get(`/api/blocks?userId=${author.userId}`)
      expect(blockStateResponse.status()).toBe(200)
      await expect(readJson(blockStateResponse)).resolves.toEqual(expect.objectContaining({
        blocked: true,
        blockedByMe: false,
      }))

      const followWhileBlocked = await reporter.page.request.post('/api/follows', {
        data: { targetUserId: author.userId, action: 'follow' },
      })
      expect(followWhileBlocked.status()).toBe(403)

      const messageWhileBlocked = await reporter.page.request.post('/api/messages/send', {
        data: { receiverId: author.userId, content: `屏蔽状态私信 ${RUN_ID}` },
      })
      expect(messageWhileBlocked.status()).toBe(403)

      const commentWhileBlocked = await reporter.page.request.post('/api/comments', {
        data: { project_id: projectId, content: `屏蔽状态评论 ${RUN_ID}` },
      })
      expect(commentWhileBlocked.status()).toBe(403)

      const likeWhileBlocked = await reporter.page.request.post(`/api/projects/${projectId}/like`)
      expect(likeWhileBlocked.status()).toBe(403)

      const collectionWhileBlocked = await reporter.page.request.post(`/api/projects/${projectId}/collection`)
      expect(collectionWhileBlocked.status()).toBe(403)

      const unblockResponse = await author.page.request.delete(`/api/blocks/${reporter.userId}`)
      expect(unblockResponse.status()).toBe(200)
      const unblockedStateResponse = await reporter.page.request.get(`/api/blocks?userId=${author.userId}`)
      expect(unblockedStateResponse.status()).toBe(200)
      await expect(readJson(unblockedStateResponse)).resolves.toEqual(expect.objectContaining({
        blocked: false,
        blockedByMe: false,
      }))

      const reportResponse = await reporter.page.request.post('/api/reports', {
        data: {
          content_type: 'project',
          content_id: projectId,
          reason: 'illegal',
          description: `E2E 高风险举报 ${RUN_ID}`,
        },
      })
      expect(reportResponse.status()).toBe(201)
      const reportPayload = await readJson(reportResponse)
      expect(reportPayload?.report).toEqual(expect.objectContaining({ autoAction: 'hidden' }))

      await reporter.page.goto('/settings/safety')
      await expect(reporter.page.getByRole('heading', { name: '社区安全中心' })).toBeVisible({ timeout: 20_000 })
      await expect(reporter.page.getByText(`举报 项目 #${projectId}`, { exact: true })).toBeVisible()

      const publicProjectResponse = await reporter.page.goto(`/project/${projectId}`, { waitUntil: 'domcontentloaded' })
      // Next dev serves the not-found boundary with a 200 document response;
      // the rendered boundary is the stable access-control assertion here.
      expect([200, 404]).toContain(publicProjectResponse?.status())
      await expect(reporter.page.getByText('这个页面没有找到', { exact: true })).toBeVisible()
      await expect(reporter.page.getByText(projectTitle, { exact: true })).toHaveCount(0)

      const authorProjectResponse = await author.page.goto(`/project/${projectId}`, { waitUntil: 'domcontentloaded' })
      expect(authorProjectResponse?.status()).toBe(200)
      await expect(author.page.getByRole('heading', { name: projectTitle, exact: true })).toBeVisible()

      const adminProjectResponse = await admin.page.goto(`/project/${projectId}`, { waitUntil: 'domcontentloaded' })
      expect(adminProjectResponse?.status()).toBe(200)
      await expect(admin.page.getByRole('heading', { name: projectTitle, exact: true })).toBeVisible()

      const nonAdminQueueResponse = await reporter.page.request.get('/api/admin/moderation/cases?status=all')
      expect(nonAdminQueueResponse.status()).toBe(403)

      const allCasesResponse = await admin.page.request.get('/api/admin/moderation/cases?status=all')
      expect(allCasesResponse.status()).toBe(200)
      const allCasesPayload = await readJson(allCasesResponse)
      const cases = Array.isArray(allCasesPayload?.cases) ? allCasesPayload.cases as Array<Record<string, unknown>> : []
      const hiddenProjectCase = cases.find((item) => item.content_type === 'project' && Number(item.content_id) === projectId)
      expect(hiddenProjectCase?.status).toBe('hidden')

      const firstMessageResponse = await author.page.request.post('/api/messages/send', {
        data: { receiverId: reporter.userId, content: `E2E 安全测试问候 ${RUN_ID}` },
      })
      expect(firstMessageResponse.status()).toBe(200)

      const replyMessageResponse = await reporter.page.request.post('/api/messages/send', {
        data: { receiverId: author.userId, content: `E2E 安全测试回复 ${RUN_ID}` },
      })
      expect(replyMessageResponse.status()).toBe(200)

      const pendingMessageResponse = await author.page.request.post('/api/messages/send', {
        data: { receiverId: reporter.userId, content: `联系方式 https://example.com/e2e-safety-${RUN_ID}` },
      })
      expect(pendingMessageResponse.status()).toBe(202)
      const pendingMessagePayload = await readJson(pendingMessageResponse)
      const pendingMessage = pendingMessagePayload?.message as Record<string, unknown> | undefined
      const pendingMessageId = Number(pendingMessage?.id)
      const pendingCaseId = Number((pendingMessagePayload?.moderation as Record<string, unknown> | undefined)?.caseId)
      expect(pendingMessageId).toBeGreaterThan(0)
      expect(pendingCaseId).toBeGreaterThan(0)

      await admin.page.goto('/admin', { waitUntil: 'domcontentloaded' })
      await expect(admin.page.getByText('后台管理').first()).toBeVisible({ timeout: 30_000 })
      await admin.page.getByRole('tab', { name: /安全队列/ }).click()
      await expect(admin.page.getByText('自动审核案件')).toBeVisible({ timeout: 20_000 })
      await expect(admin.page.getByText(`私信 #${pendingMessageId}`, { exact: true })).toBeVisible({ timeout: 20_000 })
      await expect(admin.page.getByText('举报消息前后记录')).toBeVisible()

      const restrictResponse = await admin.page.request.patch('/api/admin/moderation/cases', {
        data: {
          caseId: pendingCaseId,
          action: 'restrict_24h',
          note: `E2E 处罚审核 ${RUN_ID}`,
        },
      })
      expect(restrictResponse.status()).toBe(200)

      await author.page.goto('/settings/safety')
      await expect(author.page.getByText('账号存在安全限制')).toBeVisible({ timeout: 20_000 })
      await expect(author.page.getByText('互动限制', { exact: true })).toBeVisible()

      const appealReason = `E2E 处罚申诉 ${RUN_ID}`
      await author.page.getByRole('button', { name: '提交申诉' }).click()
      await author.page.getByLabel('申诉说明').fill(appealReason)
      await author.page.getByRole('button', { name: '提交申诉' }).click()
      await expect(author.page.getByText('申诉已提交', { exact: true })).toBeVisible({ timeout: 15_000 })
      await expect(author.page.getByText('申诉已提交，等待审核。')).toBeVisible()

      await admin.page.goto('/admin', { waitUntil: 'domcontentloaded' })
      await admin.page.getByRole('tab', { name: /安全队列/ }).click()
      await expect(admin.page.getByText('申诉队列')).toBeVisible({ timeout: 20_000 })
      const appealReasonText = admin.page.getByText(appealReason, { exact: true })
      await expect(appealReasonText).toBeVisible({ timeout: 20_000 })
      const appealCard = appealReasonText.locator('xpath=..')
      await appealCard.getByRole('button', { name: '通过' }).click()
      await expect(admin.page.getByText(appealReason, { exact: true })).toHaveCount(0, { timeout: 20_000 })

      await author.page.reload({ waitUntil: 'domcontentloaded' })
      await expect(author.page.getByText('账号状态正常')).toBeVisible({ timeout: 20_000 })
      await expect(author.page.getByText('可正常互动')).toBeVisible()
    } finally {
      await Promise.allSettled(contexts.map((context) => context.close()))
      await deleteSafetyGovernanceFixtures({
        userIds: [author?.userId ?? '', reporter?.userId ?? '', admin?.userId ?? ''],
        projectIds: projectId ? [projectId] : [],
      })
    }
  })
})
