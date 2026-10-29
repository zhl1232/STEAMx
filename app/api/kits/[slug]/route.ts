import { NextResponse } from 'next/server'
import { getKit } from '@/lib/kits/service'
export const dynamic='force-dynamic'
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){try{const kit=await getKit((await params).slug);return kit?NextResponse.json({kit}):NextResponse.json({error:'套装不存在'},{status:404})}catch{return NextResponse.json({error:'套装暂时无法加载'},{status:503})}}
