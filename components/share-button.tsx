"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

export function ShareButton() {
    const { user, loading } = useAuth();

    if (loading || !user) {
        return null;
    }

    return (
        <Link href="/share">
            {/* 仅在桌面端显示 "发布作品" 文字 */}
            <Button size="sm" className="hidden md:flex gap-1 h-9">
                <PlusCircle className="w-4 h-4" />
                <span>分享项目</span>
            </Button>
            {/* 移动端图标版本 */}
            <Button size="icon" variant="ghost" className="md:hidden h-8 w-8">
                <PlusCircle className="w-5 h-5" />
            </Button>
        </Link>
    );
}
