"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/lib/context/auth-context';

export function ShareButton() {
    const { user, loading } = useAuth();

    if (loading || !user) {
        return null;
    }

    return (
        <Link href="/project">
            {/* 宽桌面显示文案，中等桌面收为图标 */}
            <Button size="sm" className="hidden xl:flex gap-1 h-9">
                <PlusCircle className="w-4 h-4" />
                <span>分享项目</span>
            </Button>
            <Button size="icon" variant="ghost" className="hidden h-9 w-9 lg:inline-flex xl:hidden" aria-label="分享项目">
                <PlusCircle className="w-5 h-5" aria-hidden />
            </Button>
            {/* 移动端图标版本 */}
            <Button size="icon" variant="ghost" className="h-8 w-8 md:hidden" aria-label="分享项目">
                <PlusCircle className="w-5 h-5" aria-hidden />
            </Button>
        </Link>
    );
}
