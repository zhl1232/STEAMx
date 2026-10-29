'use client'

import { useStoreEntryVisible } from '@/lib/context/store-availability-context'
import { useAuth } from '@/lib/context/auth-context'
import { Button } from '@/components/ui/button'
import {
  LogOut,
  User as UserIcon,
  Loader2,
  LayoutDashboard,
  WalletCards,
  Compass,
  ShoppingBag,
} from 'lucide-react'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { UserAvatar } from "@/components/ui/user-avatar"
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { getMembershipSummary } from '@/lib/membership'
import { getDisplayName, getPublicEmail } from "@/lib/utils/user"

interface UserButtonProps {
  /** 移动端只展示高频入口，低频账户功能从个人中心进入。 */
  compact?: boolean
}

function formatMembershipExpiry(value: string | null) {
  if (!value) return '长期有效'
  return new Date(value).toLocaleDateString('zh-CN', { timeZone: "Asia/Shanghai",
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
}

export function UserButton({ compact = false }: UserButtonProps) {
  const { user, profile, loading, signOut, canReview } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const storeEntryVisible = useStoreEntryVisible()

  if (loading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    )
  }

  if (!user) {
    return (
      <>
        <Button
          variant="default"
          size="sm"
          onClick={() => promptLogin(undefined, { title: '登录或注册' })}
          className={
            compact
              ? 'h-8 min-h-8 px-2.5 text-[13px] font-semibold leading-none'
              : 'h-8 px-3 text-[13px] font-semibold leading-none'
          }
        >
          登录
        </Button>
      </>
    )
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const publicEmail = getPublicEmail(user.email)
  const level = Math.floor(Math.sqrt((profile?.xp ?? 0) / 100)) + 1
  const displayName = getDisplayName({
    profileName: profile?.display_name,
    metadataFullName: user.user_metadata?.full_name,
    metadataName: user.user_metadata?.name,
    email: user.email,
    fallback: '用户',
  })
  const avatarUrl = profile?.avatar_url
  const membership = getMembershipSummary(profile)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" shape="square" size="icon" className="relative h-9 w-9">
          <UserAvatar
            userId={user.id}
            name={displayName}
            src={avatarUrl}
            alt={displayName}
            href={null}
            fallback={<UserIcon className="h-4 w-4" />}
            avatarFrameId={profile?.equipped_avatar_frame_id}
            className="h-9 w-9"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            {!compact && publicEmail ? (
              <p className="text-xs leading-none text-muted-foreground">
                {publicEmail}
              </p>
            ) : null}
            {membership.isActive ? (
              <p className="text-xs leading-none text-[hsl(var(--brand-blue))]">
                {membership.label} · {formatMembershipExpiry(membership.expiresAt)}
              </p>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <UserIcon className="mr-2 h-4 w-4" />
            <span>个人中心</span>
          </Link>
        </DropdownMenuItem>
        {compact ? (
          <DropdownMenuItem asChild>
            <Link href="/start" className="cursor-pointer">
              <Compass className="mr-2 h-4 w-4" />
              <span>探索指南</span>
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link href="/coins" className="cursor-pointer">
              <WalletCards className="mr-2 h-4 w-4" />
              <span>我的硬币</span>
            </Link>
          </DropdownMenuItem>
        )}

        {storeEntryVisible ? <DropdownMenuItem asChild>
          <Link href="/store" className="cursor-pointer"><ShoppingBag className="mr-2 h-4 w-4" /><span>材料商城</span></Link>
        </DropdownMenuItem> : null}

        {canReview ? (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="cursor-pointer">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>管理后台</span>
            </Link>
          </DropdownMenuItem>
        ) : level >= 5 ? (
          <DropdownMenuItem asChild>
            <Link href="/moderator/apply" className="cursor-pointer">
              <UserIcon className="mr-2 h-4 w-4" />
              <span>申请成为审核员</span>
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
