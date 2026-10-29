import { NextResponse } from 'next/server'
import { getKit,getKitProjects } from '@/lib/kits/service'
export const dynamic='force-dynamic'
export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){try{const kit=await getKit((await params).slug);if(!kit)return NextResponse.json({error:'套装不存在'},{status:404});const raw=Number(new URL(request.url).searchParams.get('page')??0);const page=Number.isSafeInteger(raw)&&raw>=0?Math.min(raw,10000):0;return NextResponse.json(await getKitProjects(kit,page))}catch{return NextResponse.json({error:'配套项目暂时无法加载'},{status:503})}}
