'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/context/auth-context'
import { Button } from '@/components/ui/button'
import {
  LogOut,
  User as UserIcon,
  Loader2,
  LayoutDashboard,
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

import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { CoinIcon } from "@/components/icons/coin-icon"
import { LoginDialog } from '@/components/layout/login-dialog'
import { getDefaultAvatarPath } from "@/lib/profile/avatar-options"
import { getDisplayName, getPublicEmail } from "@/lib/utils/user"

export function UserButton() {
  const { user, profile, loading, signOut, canReview } = useAuth()
  const [loginOpen, setLoginOpen] = useState(false)

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
          onClick={() => setLoginOpen(true)}
        >
          登录
        </Button>
        <LoginDialog
          open={loginOpen}
          onOpenChange={setLoginOpen}
          title="登录或注册"
          description="登录后即可查看个人中心、消息和互动记录"
        />
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
    phone: user.phone ?? null,
    email: user.email,
    fallback: '用户',
  })
  const avatarUrl = profile?.avatar_url || getDefaultAvatarPath(user.id)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
          <AvatarWithFrame
            src={avatarUrl}
            alt={displayName}
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
            {publicEmail ? (
              <p className="text-xs leading-none text-muted-foreground">
                {publicEmail}
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
        <DropdownMenuItem asChild>
          <Link href="/shop" className="cursor-pointer">
            <CoinIcon className="mr-2 h-4 w-4" />
            <span>商店</span>
          </Link>
        </DropdownMenuItem>

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
