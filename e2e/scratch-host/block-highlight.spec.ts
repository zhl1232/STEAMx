import { expect, test, type Page } from '@playwright/test'

type ScratchHint = {
  label: string
  category: 'motion' | 'looks' | 'sound' | 'events' | 'control' | 'sensing' | 'operators' | 'data'
  blockId: string
}

const HINT_CASES: ScratchHint[] = [
  { label: '移到 x:0 y:-130', category: 'motion', blockId: 'motion_gotoxy' },
  { label: '按下 ← 键？', category: 'sensing', blockId: 'sensing_keypressed' },
  { label: '将 得分 增加 1', category: 'data', blockId: 'data_changevariableby' },
  { label: 'y 坐标 < -160', category: 'operators', blockId: 'operator_lt' },
  { label: '停止 全部', category: 'control', blockId: 'control_stop' },
  { label: '将大小增加 10', category: 'looks', blockId: 'looks_changesizeby' },
  { label: '5 + 3', category: 'operators', blockId: 'operator_add' },
  { label: '24 / 3', category: 'operators', blockId: 'operator_divide' },
  { label: 'x 坐标', category: 'motion', blockId: 'motion_xposition' },
  { label: '音量', category: 'sound', blockId: 'sound_volume' },
]

type ScratchVm = {
  editingTarget?: {
    id: string
    isStage?: boolean
    createVariable?: (id: string, name: string, type: string) => void
  }
  runtime?: {
    targets?: Array<{ id: string; isStage?: boolean }>
  }
  setEditingTarget?: (targetId: string) => void
  emitWorkspaceUpdate?: () => void
}

async function openScratchEditor(page: Page) {
  await page.goto('/index.html', { waitUntil: 'networkidle' })
  await expect(page.locator('#scratch-status')).toHaveText('编辑模式', { timeout: 40_000 })
}

async function sendHighlight(page: Page, hint: ScratchHint) {
  await page.evaluate((message) => {
    window.postMessage(
      {
        source: 'steam-scratch-parent',
        type: 'HIGHLIGHT_BLOCK_KEYWORDS',
        keywords: [message.label],
        items: [
          {
            label: message.label,
            findLabel: message.label,
            blockIds: [message.blockId],
            category: message.category,
          },
        ],
        category: message.category,
      },
      window.location.origin,
    )
  }, hint)
}

async function expectVisibleBlockHighlight(page: Page, hint: ScratchHint) {
  await expect(page.locator('#scratch-status')).toHaveText(`已定位积木：${hint.label}`)
  await expect(page.locator('#scratch-block-hint-overlay')).toContainText(hint.label)
  await expect(page.locator('[data-steam-scratch-block-hint-target="1"]')).toBeVisible()
}

test('highlights mapped core course blocks in the live Scratch flyout', async ({ page }) => {
  await openScratchEditor(page)

  await page.evaluate(() => {
    const vm = (window as typeof window & { __scratchVm?: ScratchVm }).__scratchVm
    if (!vm) throw new Error('Scratch VM is not ready')
    vm.editingTarget?.createVariable?.('e2e-score', '得分', '')
    vm.emitWorkspaceUpdate?.()
  })

  for (const hint of HINT_CASES) {
    await test.step(hint.blockId, async () => {
      await sendHighlight(page, hint)
      await expectVisibleBlockHighlight(page, hint)
    })
  }
})

test('selects a sprite before highlighting a motion block from the stage', async ({ page }) => {
  await openScratchEditor(page)

  await page.evaluate(() => {
    const vm = (window as typeof window & { __scratchVm?: ScratchVm }).__scratchVm
    if (!vm) throw new Error('Scratch VM is not ready')
    const stage = vm.runtime?.targets?.find((target) => target.isStage)
    if (!stage || !vm.setEditingTarget) throw new Error('Scratch stage is not ready')
    vm.setEditingTarget(stage.id)
  })
  await expect
    .poll(() =>
      page.evaluate(() => {
        const vm = (window as typeof window & { __scratchVm?: ScratchVm }).__scratchVm
        return Boolean(vm?.editingTarget?.isStage)
      }),
    )
    .toBe(true)

  const motionHint = HINT_CASES[0]!
  await sendHighlight(page, motionHint)

  await expect
    .poll(() =>
      page.evaluate(() => {
        const vm = (window as typeof window & { __scratchVm?: ScratchVm }).__scratchVm
        return Boolean(vm?.editingTarget && !vm.editingTarget.isStage)
      }),
    )
    .toBe(true)
  await expectVisibleBlockHighlight(page, motionHint)
})
