import { NextResponse } from 'next/server'
import { listKits } from '@/lib/kits/service'
export const dynamic='force-dynamic'
export async function GET(){try{return NextResponse.json({kits:await listKits()})}catch{return NextResponse.json({error:'套装目录暂时无法加载'},{status:503})}}
