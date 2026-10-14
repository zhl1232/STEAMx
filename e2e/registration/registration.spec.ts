import { expect, test, type Page } from '@playwright/test'

async function sendCode(page: Page) {
  await page.getByPlaceholder('请输入手机号', { exact: true }).fill('13800138000')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '获取验证码', exact: true }).click()
  await expect(page.getByPlaceholder('请输入 6 位验证码')).toBeVisible()
}
async function complete(page: Page) {
  await page.getByPlaceholder('请输入 6 位验证码').fill('123456')
  await page.getByRole('button', { name: '验证并继续', exact: true }).click()
}
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => {
    const url=route.request().url()
    if(url.endsWith('/sms/send')) return route.fulfill({json:{success:true}})
    if(url.endsWith('/sms/verify')) return route.fulfill({json:{isNewUser:true,session:{access_token:'test',refresh_token:'test'}}})
    if(url.endsWith('/collection')) return route.fulfill({json:{collected:true,action:'collected'}})
    return route.fulfill({json:{}})
  })
})
test('first prompt, original content, close, refresh, navigation and independent opener tab', async ({page}, testInfo) => {
  await page.goto('/project/7')
  const dialog=page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await page.screenshot({path:testInfo.outputPath('registration-dialog.png')})
  await expect(page.getByText('公开项目内容')).toBeAttached()
  const box=await dialog.boundingBox(); const viewport=page.viewportSize()!
  expect(box!.x).toBeGreaterThanOrEqual(-1); expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width+1)
  await page.getByRole('button',{name:'先去探索',exact:true}).click()
  await page.reload(); await expect(dialog).toHaveCount(0)
  await page.getByRole('button',{name:'站内切页'}).click(); await expect(page).toHaveURL(/\/nature$/)
  await expect(dialog).toHaveCount(0); await page.goBack(); await expect(dialog).toHaveCount(0)
  const popupEvent=page.waitForEvent('popup')
  await page.getByRole('button',{name:'打开新标签'}).click()
  const popup=await popupEvent; await expect(popup.getByRole('dialog')).toBeVisible(); await popup.close()
})
test('existing session never prompts',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('fixture-auth','1'))
  await page.goto('/nature'); await expect(page.getByText('已经登录')).toBeVisible(); await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('storage disabled still allows exploring and navigating without repeat',async({page})=>{
  await page.addInitScript(()=>{ Storage.prototype.getItem=()=>{throw new Error('disabled')};Storage.prototype.setItem=()=>{throw new Error('disabled')} })
  // Auth boundary uses storage too; initialization must remain independent of prompt storage.
  await page.goto('/project/7'); await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button',{name:'先去探索',exact:true}).click()
  await page.getByRole('button',{name:'站内切页'}).click(); await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('new signup resumes collection once, retains draft, failed OTP can retry and cancel resumes code',async({page})=>{
  let posts=0,attempts=0
  await page.route('**/api/projects/7/collection',route=>{posts++;return route.fulfill({json:{collected:true,action:'collected'}})})
  await page.route('**/api/auth/sms/verify',route=>{attempts++;return attempts===1 ? route.fulfill({status:400,json:{error:'验证码错误'}}) : route.fulfill({json:{isNewUser:true,session:{access_token:'test',refresh_token:'test'}}})})
  await page.goto('/project/7'); await page.getByRole('button',{name:'先去探索',exact:true}).click()
  await page.getByLabel('项目草稿').fill('我的观察还没写完')
  await page.getByRole('button',{name:'收藏项目'}).click();await sendCode(page)
  await page.getByRole('button',{name:'关闭登录层'}).click();expect(posts).toBe(0)
  await page.getByRole('button',{name:'收藏项目'}).click()
  await expect(page.getByPlaceholder('请输入 6 位验证码')).toBeVisible()
  await complete(page);await expect(page.getByText('验证码错误',{exact:true})).toBeVisible();expect(posts).toBe(0)
  await complete(page);await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('已经登录')).toBeVisible();expect(posts).toBe(1)
  await expect(page).toHaveURL(/\/project\/7$/);await expect(page.getByLabel('项目草稿')).toHaveValue('我的观察还没写完')
})
test('photo intent returns to an explicit picker button without automatic file chooser',async({page})=>{
  await page.goto('/nature/submit');await page.getByRole('button',{name:'先去探索',exact:true}).click()
  await page.locator('button').filter({hasText:'选择观察照片'}).first().click()
  let choosers=0;page.on('filechooser',()=>choosers++)
  await sendCode(page);await complete(page)
  await expect(page.getByRole('button',{name:'继续选照片'})).toBeVisible();expect(choosers).toBe(0)
  const chosen=page.waitForEvent('filechooser');await page.getByRole('button',{name:'继续选照片'}).click();await chosen
  expect(choosers).toBe(1)
})
test('extension question returns as editable intent without any tutor request',async({page})=>{
  let tutorCalls=0;page.on('request',r=>{if(r.url().includes('/api/tutor'))tutorCalls++})
  await page.goto('/project/7');await page.getByRole('button',{name:'先去探索',exact:true}).click()
  await page.getByRole('button',{name:'为什么会这样？'}).click();await sendCode(page);await complete(page)
  await expect(page.getByLabel('小迪草稿')).toHaveText('为什么会这样？');expect(tutorCalls).toBe(0)
  await expect(page).toHaveURL(/\/project\/7$/)
})

test('late OTP success after closing never authenticates or replays the cancelled action',async({page})=>{
  let release!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve})
  let posts=0
  await page.route('**/api/auth/sms/verify',async route=>{await gate;await route.fulfill({json:{isNewUser:true,session:{access_token:'test',refresh_token:'test'}}})})
  await page.route('**/api/projects/7/collection',route=>{posts++;return route.fulfill({json:{collected:true}})})
  await page.goto('/project/7');await page.getByRole('button',{name:'先去探索',exact:true}).click()
  await page.getByRole('button',{name:'收藏项目'}).click();await sendCode(page)
  const requested=page.waitForRequest('**/api/auth/sms/verify');await complete(page);await requested
  await page.getByRole('button',{name:'关闭登录层'}).click();release()
  await page.getByRole('button',{name:'手动登录'}).click()
  await expect(page.getByPlaceholder('请输入 6 位验证码')).toBeVisible()
  expect(posts).toBe(0);await expect(page.getByText('游客',{exact:true})).toBeVisible()
})
test('navigation during verification invalidates the original action',async({page})=>{
  let release!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve})
  let posts=0
  await page.route('**/api/auth/sms/verify',async route=>{await gate;await route.fulfill({json:{isNewUser:true,session:{access_token:'test',refresh_token:'test'}}})})
  await page.route('**/api/projects/7/collection',route=>{posts++;return route.fulfill({json:{collected:true}})})
  await page.goto('/project/7');await page.getByRole('button',{name:'先去探索',exact:true}).click()
  await page.getByRole('button',{name:'收藏项目'}).click();await sendCode(page)
  const requested=page.waitForRequest('**/api/auth/sms/verify');await complete(page);await requested
  await page.evaluate(()=>{history.pushState({},'', '/nature');dispatchEvent(new PopStateEvent('popstate'))})
  await expect(page.getByRole('dialog')).toHaveCount(0);release()
  await expect(page).toHaveURL(/\/nature$/);expect(posts).toBe(0)
})
test('old user password login resumes start once and preserves scroll',async({page})=>{
  let starts=0
  await page.route('**/api/projects/7/explorations/start',route=>{starts++;return route.fulfill({json:{}})})
  await page.goto('/project/7');await page.getByRole('button',{name:'先去探索',exact:true}).click()
  await page.evaluate(()=>{window.scrollTo(0, 400); const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='开始项目')!; button.focus({preventScroll:true}); button.click()})
  await page.getByRole('button',{name:'密码登录',exact:true}).click()
  await page.getByPlaceholder('请输入手机号', {exact:true}).fill('13800138000')
  await page.getByPlaceholder('请输入至少 6 位密码').fill('fixture-password')
  await page.getByRole('button',{name:'登录',exact:true}).click()
  await expect(page.getByRole('dialog')).toHaveCount(0);expect(starts).toBe(1)
  await expect.poll(()=>page.evaluate(()=>Math.round(window.scrollY))).toBe(400)
  await expect(page).toHaveURL(/\/project\/7$/)
})
