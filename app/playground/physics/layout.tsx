import { buildPageMetadata } from '@/lib/seo/metadata'
export const metadata = buildPageMetadata({ title: '物理实验室 · 直流电路', description: '连接电池、开关、灯泡与电阻，探索串联、并联和欧姆定律。', path: '/playground/physics' })
export default function PhysicsLayout({ children }: { children: React.ReactNode }) { return children }
