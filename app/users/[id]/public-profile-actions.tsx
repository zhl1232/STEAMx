"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { FollowButton } from "@/components/features/social/follow-button";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/context/auth-context";

export function PublicProfileActions({ targetUserId }: { targetUserId: string }) {
  const { user } = useAuth();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 xl:justify-end">
      <FollowButton
        targetUserId={targetUserId}
        showCount={false}
        className="h-11 rounded-md px-6 text-sm font-semibold"
      />
      {user && user.id !== targetUserId ? (
        <Button variant="outline" className="h-11 rounded-md px-6 text-sm font-semibold" asChild>
          <Link href={`/messages/${targetUserId}`}>
            <MessageCircle className="mr-2 h-4 w-4" />
            发私信
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
