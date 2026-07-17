"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

let lastRenderedPathname: string | null = null;

export default function Template({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const shouldAnimate = lastRenderedPathname !== null && lastRenderedPathname !== pathname;

    useEffect(() => {
        lastRenderedPathname = pathname;
    }, [pathname]);

    return (
        <div className={shouldAnimate ? "route-transition-enter" : undefined}>
            {children}
        </div>
    );
}
