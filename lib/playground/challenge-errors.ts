import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/auth'
const messages:Record<string,[number,string]>={
 not_found:[404,'房间不存在'],room_not_found:[404,'房间不存在'],forbidden:[403,'无权访问此对局'],
 daily_limit:[409,'今天这款游戏的随机挑战次数已用完'],insufficient_coins:[409,'硬币不足，需要 2 枚硬币报名'],
 active_challenge:[409,'请先完成当前的随机挑战'],room_full:[409,'房间已开始或已满'],matching:[409,'正在寻找对手'],
 conflict:[409,'对局已更新，请重试'],too_fast:[409,'请等翻牌完成后继续'],not_started:[409,'对局尚未开始'],
 not_your_turn:[409,'还没有轮到你'],invalid_state:[409,'对局状态已变化，请重试'],
}
export function challengeApiError(error:unknown){
 const key=error instanceof Error?error.message:''
 if(messages[key]){const [status,message]=messages[key];return NextResponse.json({error:message,code:key},{status})}
 if(key.startsWith('invalid_')||key==='queue_first')return NextResponse.json({error:'操作无效，请刷新对局后重试',code:key},{status:400})
 return handleApiError(error)
}
