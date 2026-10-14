import { redirect } from 'next/navigation'

/** 兼容 /learn 入口，探索指南仍以 /start 为唯一主地址。 */
export default function LearnPage() {
  redirect('/start')
}
