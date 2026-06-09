"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useFollow } from "@/hooks/use-follow";
import { Loader2, UserPlus, UserCheck } from "lucide-react";
import { useAuth } from '@/lib/context/auth-context';
import { useLoginPrompt } from '@/lib/context/login-prompt-context';
import { cn } from "@/lib/utils";

interface FollowButtonProps {
    targetUserId: string;
    className?: string;
    showCount?: boolean;
    variant?: "default" | "outline";
    shape?: ButtonProps["shape"];
    showIcon?: boolean;
    /** 在「新增粉丝」等场景下显示为「回关」而非「关注」 */
    followBack?: boolean;
}

export function FollowButton({
    targetUserId,
    className,
    showCount = false,
    variant = "default",
    shape,
    showIcon = true,
    followBack = false,
}: FollowButtonProps) {
    const { user } = useAuth();
    const { promptLogin } = useLoginPrompt();
    const { isFollowing, isLoading, follow, unfollow, isPending, followerCount } = useFollow(targetUserId);

    const isSelf = user?.id === targetUserId;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (isSelf) return;

        if (!user) {
            promptLogin(() => {}, { 
                title: "关注用户", 
                description: "登录后即可关注感兴趣的创作者，获取最新动态" 
            });
            return;
        }

        if (isFollowing) {
            unfollow();
        } else {
            follow();
        }
    };

    if (isSelf) return null;

    return (
        <Button
            variant={isFollowing ? "outline" : variant}
            size="sm"
            shape={shape}
            onClick={handleClick}
            disabled={isLoading || isPending}
            className={cn("group gap-2 transition-all min-w-[80px]", className, isFollowing && "text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-destructive/10")}
        >
            {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : isFollowing ? (
                <>
                    {showIcon ? <UserCheck className="h-4 w-4" /> : null}
                    <span className="group-hover:hidden">已关注</span>
                    <span className="hidden group-hover:inline">取消关注</span>
                </>
            ) : (
                <>
                    {showIcon ? <UserPlus className="h-4 w-4" /> : null}
                    {followBack ? "回关" : "关注"}
                </>
            )}
            {showCount && <span className="text-xs opacity-80 min-w-[2ch]">{followerCount}</span>}
        </Button>
    );
}
