import { createRoot } from 'react-dom/client'
import '@/app/globals.css'
import catalogFixture from './catalog-fixture.json'
import { StoreCatalogClient, type StoreProduct } from '@/components/store/store-catalog-client'
import { StoreProductDetail } from '@/components/store/store-product-detail'
import { StoreCheckout } from '@/components/store/store-checkout'
import { SupportChat } from '@/components/support/support-chat'
import type { SupportMessage } from '@/lib/support/types'

type FixtureRequest = {
  items?: Array<{ variantId: string; quantity: number }>; couponId?: string | null; useCoins?: boolean
  clientId?: string; content?: string; attachmentIds?: string[]; productId?: string
  expectedQuote?: unknown; address?: unknown; province?: string
}
type FixtureMessage = Omit<SupportMessage, 'attachments'> & { attachments: Array<{ id: string }> }
type OrderPost = { body: FixtureRequest; key: string | null }
const params = new URLSearchParams(location.search)
const tier = params.get('tier') === 'founder' ? 'founder' : 'pro'
const scenario = params.get('scenario') || ''
const products = catalogFixture as StoreProduct[]

const orderPosts:OrderPost[] = [], sendPosts:FixtureRequest[] = [], messages:FixtureMessage[] = [{id:'hello',seq:1,sender_role:'admin',client_id:'hello',content:'你好，请描述遇到的问题。',context:{},created_at:'2026-10-26T03:00:00Z',attachments:[]}]
let reprice=false
const conversation = () => ({id:'fixture-conversation',user_id:'fixture-user',status:'open',user_read_seq:0,staff_read_seq:1,last_message_seq:messages.length,updated_at:'2026-10-26T03:00:00Z'})
const response=(data:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}}))
const originalFetch=window.fetch.bind(window)
window.fetch = async (input, init={}) => {
 const url=new URL(String(input),location.href)
 if(url.origin!==location.origin) throw new Error('External network blocked in local fixture preview')
 if(!url.pathname.startsWith('/api/')) return originalFetch(input,init)
 const body: FixtureRequest=typeof init.body==='string'?JSON.parse(init.body):{}
 if(url.pathname==='/api/store/products') return scenario==='catalog-error'?response({error:'测试：商品暂时无法加载'},503):response({products:scenario==='empty'?[]:products})
 if(url.pathname==='/api/store/coupons') return response({coupons:tier==='founder'?[{id:'fixture-coupon',title:'测试满50减5',threshold_cents:5000,discount_cents:500,expires_at:'2027-01-01',eligible:true,eligible_product_ids:products.map(p=>p.id)}]:[]})
 if(url.pathname==='/api/store/quote') {
  const item=body.items?.[0]; const variant=products.flatMap(p=>p.variants).find(v=>v.id===item?.variantId) || products[0].variants[0]
  const original=(variant.price_cents ?? products[0].price_cents)*(item?.quantity||1);const member=Math.round(original*(tier==='founder'?.8:.88));const coupon=body.couponId?500:0
  const shipping=(['新疆维吾尔自治区','西藏自治区'].includes(body.province||'')?3200:0)+(reprice?100:0)
  return response({quote:{originalSubtotalCents:original,memberSubtotalCents:member,memberDiscountCents:original-member,membershipTier:tier,shippingCents:shipping,couponDiscountCents:coupon,coinDiscountCents:0,coinsUsed:0,totalCents:member-coupon+shipping,couponId:body.couponId||null}})
 }
 if(url.pathname==='/api/store/orders'&&init.method==='POST'){orderPosts.push({body,key:new Headers(init.headers).get('idempotency-key')});if(scenario==='reprice'&&!reprice){reprice=true;return response({code:'QUOTE_CHANGED'},409)}if(scenario==='order-timeout'&&orderPosts.length===1)throw new TypeError('测试：连接中断');return response({order:{id:'fixture-order'}})}
 if(url.pathname==='/api/store/orders')return response({order:orderPosts.length?{id:'fixture-order'}:null})
 if(url.pathname.endsWith('/read'))return response({ok:true})
 if(url.pathname.endsWith('/attachments'))return response({attachment:{id:`fixture-image-${Date.now()}`}})
 if(url.pathname.startsWith('/api/support/attachments/'))return originalFetch('/store/science-kits/general-starter-245.jpg')
 if(url.pathname.endsWith('/messages')){if(init.method==='POST'){sendPosts.push(body);if(scenario==='send-error'&&sendPosts.length===1)return response({error:'测试：发送暂时失败，请重试'},503);if(!messages.some(m=>m.client_id===body.clientId))messages.push({id:body.clientId || 'fixture-message',client_id:body.clientId || 'fixture-message',seq:messages.length+1,sender_role:'user',content:body.content || '',context:{productName:body.productId?products[0].name:undefined},created_at:new Date().toISOString(),attachments:(body.attachmentIds || []).map((id:string)=>({id}))});return response({ok:true})}return response({conversation:conversation(),messages:messages.filter(m=>!url.searchParams.has('after')||m.seq>Number(url.searchParams.get('after'))),nextCursor:null,nextAfterCursor:null})}
 throw new Error(`Unmocked API blocked: ${url.pathname}`)
}
Object.assign(window,{fixture:{products,orderPosts,sendPosts}})
const mode=params.get('mode') || (location.pathname.includes('checkout')?'checkout':location.pathname.includes('/products/')?'detail':location.pathname==='/support'?'support':'catalog')
const p=products[0]
createRoot(document.getElementById('root')!).render(<><aside style={{padding:'12px 24px',background:'#fff4ce',fontSize:14}}>本地固定数据预览 · 无数据库、真实订单或支付 · 仅验证界面与交互 <nav style={{display:'flex',flexWrap:'wrap',gap:16,marginTop:8}}>{['catalog','detail','checkout','support'].map(m=><a key={m} href={`/?mode=${m}&tier=${tier}`}>{m}</a>)}<a href={`/?mode=${mode}&tier=${tier==='pro'?'founder':'pro'}`}>当前模拟会员：{tier}（切换）</a></nav></aside>{mode==='catalog'?<StoreCatalogClient/>:mode==='detail'?<StoreProductDetail product={p} checkoutEnabled requestedVariantId={params.get('variant') || undefined}/>:mode==='checkout'?<StoreCheckout userId="fixture-user" productId={p.id} variantId={p.variants[0].id} quantity={Number(params.get('quantity')||1)} intentId={params.get('intent')||'fixture-intent'}/>:<main className="app-shell-narrow py-8"><h1 className="text-page-title mb-6">官方客服</h1><SupportChat conversationId="fixture-conversation" productId={p.id}/></main>}</>)
