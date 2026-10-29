'use client'

import { useAuth } from '@/lib/context/auth-context'
import { getMembershipSummary, type MembershipTier } from '@/lib/membership'
import { cn } from '@/lib/utils'
import styles from './store-price.module.css'

export const storeMoney = (cents: number) => `¥${(cents / 100).toFixed(2)}`

export function useStoreMembershipTier(): MembershipTier {
  const { user, profile, loading } = useAuth()
  return !loading && user ? getMembershipSummary(profile).tier : 'free'
}

export function StorePrice({ cents, tier, varies = false, large = false }: { cents: number; tier: MembershipTier; varies?: boolean; large?: boolean }) {
  const member = tier !== 'free'
  const memberCents = Math.round(cents * (tier === 'founder' ? .8 : .88))
  const label = tier === 'founder' ? '创始会员价' : '会员价'
  return <div className={cn(styles.price, 'space-y-1.5')}>
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={cn(styles.amount, 'font-bold tracking-tight tabular-nums', large ? 'text-4xl' : 'text-2xl')}>{storeMoney(member ? memberCents : cents)}</span>
      {varies ? <span className="text-xs text-muted-foreground">起</span> : null}
      {member ? <span className={cn(styles.badge, 'whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium sm:text-xs')}>{label}</span> : null}
    </div>
    {member && memberCents < cents ? <p className="text-xs text-muted-foreground"><span className="sr-only">普通价 </span><del>{storeMoney(cents)}</del>{varies ? ' 起' : ''}</p> : !member ? <p className="text-xs text-muted-foreground">会员价 <span className={cn(styles.amount, 'font-semibold')}>{storeMoney(memberCents)}</span>{varies ? ' 起' : ''}</p> : null}
  </div>
}
