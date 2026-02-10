'use client'

import { useAuth } from '@/context/auth-context'
import { Button } from '@/components/ui/button'
import {
  LogOut,
  User as UserIcon,
  Loader2,
  LayoutDashboard,
  MessageCircle
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function UserButton() {
  const { user, profile, loading, signOut, canReview } = useAuth()

  if (loading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    )
  }

  if (!user) {
    return (
      <Link href="/login">
        <Button variant="default" size="sm">
          登录
        </Button>
      </Link>
    )
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const displayName = profile?.display_name || user.email || '用户'
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarUrl || ''} alt={displayName} />
            <AvatarFallback className="bg-primary/10">
              <UserIcon className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
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
          <Link href="/messages?tab=dm" className="cursor-pointer">
            <MessageCircle className="mr-2 h-4 w-4" />
            <span>私信</span>
          </Link>
        </DropdownMenuItem>

        {canReview ? (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="cursor-pointer">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>管理后台</span>
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link href="/moderator/apply" className="cursor-pointer">
              <UserIcon className="mr-2 h-4 w-4" />
              <span>申请成为审核员</span>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
