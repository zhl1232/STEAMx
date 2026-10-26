import { chromium, expect } from '@playwright/test'
import fs from 'node:fs/promises'
const dir='/tmp/store-v1-review'
await fs.mkdir(dir,{recursive:true})
const browser=await chromium.launch({headless:true})
const errors=[], blocked=[]
let assertions=0
const check=async(fn)=>{await fn();assertions++}
try {
 for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000}})
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():(blocked.push(route.request().url()),route.abort()))
  const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);});page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())})
  const go=async(query)=>page.goto('http://127.0.0.1:3101/'+query,{waitUntil:'domcontentloaded'})
  const snap=async(name)=>{await page.screenshot({path:`${dir}/${name}-${width}.png`,fullPage:true});await check(async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy())}
  await go('?mode=catalog');await expect(page.getByRole('heading',{name:'科教版科学实验材料套装',exact:true})).toBeVisible();await snap('catalog')
  await page.getByRole('link').filter({has:page.getByRole('heading',{name:'科教版科学实验材料套装',exact:true})}).click();await expect(page.getByRole('heading',{name:'科教版科学实验材料套装',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'查看商品图片 2'}).click();await check(()=>expect(page.getByRole('button',{name:'查看商品图片 2'})).toHaveAttribute('aria-pressed','true'))
  await page.getByRole('button',{name:'测试规格 B（暂缺货）'}).click();await check(()=>expect(page.getByRole('button',{name:'该规格或数量暂不可购'})).toBeDisabled())
  await page.getByRole('button',{name:'测试规格 A',exact:true}).click();await page.getByRole('spinbutton',{name:'数量'}).fill('0');await check(()=>expect(page.getByRole('button',{name:'该规格或数量暂不可购'})).toBeDisabled())
  await page.getByRole('spinbutton',{name:'数量'}).fill('1');await snap('detail');
  // Start the purchase navigation check from a fresh view after full-page capture.
  await go('?mode=detail');await page.getByRole('button',{name:'立即购买'}).click();await page.waitForURL(/checkout/, {waitUntil:'domcontentloaded'});await check(async()=>expect(new URL(page.url()).searchParams.get('intent')).toMatch(/^[a-f0-9-]{36}$/))
  await expect(page.getByText('¥94.01',{exact:true})).toBeVisible();await page.getByRole('radio',{name:'使用硬币抵扣',exact:true}).check();await check(()=>expect(page.getByText('¥85.21',{exact:true})).toBeVisible())
  await snap('checkout-pro-coins')
  await go('?mode=checkout&tier=founder&scenario=reprice&intent=reprice');await page.getByRole('radio',{name:/测试满50减5/}).check();await check(()=>expect(page.getByText('¥81.01',{exact:true})).toBeVisible())
  await check(()=>expect(page.getByRole('radio',{name:'使用硬币抵扣',exact:true})).not.toBeChecked())
  for(const [label,value]of [['收货人','测试收件人'],['手机号','13800000000'],['城市','北京市'],['区县','海淀区'],['详细地址','测试地址一号']]) await page.getByLabel(label,{exact:true}).fill(value)
  await page.getByRole('button',{name:'确认金额并创建订单'}).click();await check(()=>expect(page.getByRole('alert')).toContainText('报价已变化'));await check(()=>expect(page.getByText('¥82.01',{exact:true})).toBeVisible());await snap('checkout-reconfirm')
  await page.getByRole('button',{name:'确认金额并创建订单'}).click();await check(()=>expect(page.getByRole('link',{name:'查看订单并支付'})).toBeVisible())
  const orderData=await page.evaluate(()=>window.fixture.orderPosts);await check(async()=>expect(orderData.length).toBe(2));await check(async()=>expect(orderData[0].key).toBe(orderData[1].key));await check(async()=>expect(orderData[1].body.expectedQuote.totalCents).toBe(8201))
  await page.reload();await check(()=>expect(page.getByRole('link',{name:'查看订单并支付'})).toBeVisible());await check(async()=>expect(await page.evaluate(()=>window.fixture.orderPosts.length)).toBe(0))
  await go('?mode=checkout&scenario=order-timeout&intent=timeout');for(const [label,value]of [['收货人','测试收件人'],['手机号','13800000000'],['城市','北京市'],['区县','海淀区'],['详细地址','测试地址一号']]) await page.getByLabel(label,{exact:true}).fill(value)
  await page.getByRole('button',{name:'确认金额并创建订单'}).click();await check(()=>expect(page.getByRole('button',{name:'重试核查同一笔订单'})).toBeEnabled());await check(()=>expect(page.getByLabel('收货人',{exact:true})).toBeDisabled());await page.getByRole('button',{name:'重试核查同一笔订单'}).click();await expect(page.getByRole('link',{name:'查看订单并支付'})).toBeVisible();await check(async()=>expect(await page.evaluate(()=>window.fixture.orderPosts[0])).toEqual(await page.evaluate(()=>window.fixture.orderPosts[1])))
  await go('?mode=support&scenario=send-error');await expect(page.getByText('你好，请描述遇到的问题。')).toBeVisible();await page.getByLabel('描述问题',{exact:true}).fill('材料缺件，如何处理？');await page.getByRole('button',{name:'发送留言'}).click();await check(()=>expect(page.getByRole('alert')).toContainText('发送暂时失败'));await check(()=>expect(page.getByLabel('描述问题',{exact:true})).toBeDisabled());await page.getByRole('button',{name:'重试发送'}).click();await check(()=>expect(page.getByRole('log')).toContainText('材料缺件，如何处理？'));await check(async()=>expect(await page.evaluate(()=>window.fixture.sendPosts[0])).toEqual(await page.evaluate(()=>window.fixture.sendPosts[1])))
  await page.getByLabel('添加客服图片').setInputFiles('public/store/source-drafts/warehouse-shared/main-5.jpg');await expect(page.getByRole('button',{name:'图片 1 · 移除'})).toBeVisible();await page.getByRole('button',{name:'发送留言'}).click();await check(()=>expect(page.getByRole('log').getByRole('img')).toBeVisible());await check(async()=>expect(await page.getByRole('log').getByRole('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBeTruthy());await snap('support-image')
  const posts=await page.evaluate(()=>window.fixture.sendPosts);await check(async()=>expect(posts.at(-1).attachmentIds).toHaveLength(1));await check(async()=>expect(posts[0].productId).toBeTruthy())
  await go('?mode=catalog&scenario=empty');await check(()=>expect(page.getByRole('heading',{name:'商品正在准备中'})).toBeVisible())
  await go('?mode=catalog&scenario=catalog-error');await check(()=>expect(page.getByRole('alert')).toContainText('商品暂时无法加载'))
  await context.close()
 }
 console.info(JSON.stringify({assertions,errors,blocked,screenshots:dir},null,2))
 if(errors.length||blocked.length)process.exitCode=1
} finally {await browser.close()}
