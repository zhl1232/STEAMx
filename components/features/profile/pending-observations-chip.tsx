"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** 本人「待审核 N 条」观察：审核通过前不点亮图鉴，在个人页提示一下。 */
export function PendingObservationsChip({ className }: { className?: string }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        fetch("/api/observations/mine?pageSize=1", { signal: controller.signal, cache: "no-store" })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
                if (payload && typeof payload.pendingCount === "number") setCount(payload.pendingCount);
            })
            .catch(() => {});
        return () => controller.abort();
    }, []);
    if (count <= 0) return null;
    return (
        <Link
            href="/profile/library"
            data-testid="profile-pending-observations"
            className={`inline-flex min-h-8 items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-semibold text-amber-700 dark:text-amber-300 ${className ?? ""}`}
        >
            观察待审核 {count} 条
        </Link>
    );
}
