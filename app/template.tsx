"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

let lastRenderedPathname: string | null = null;

export default function Template({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [transition, setTransition] = useState(() => ({
        pathname,
        active: lastRenderedPathname !== null && lastRenderedPathname !== pathname,
    }));

    // Deeper navigations can change the pathname without remounting this template.
    if (transition.pathname !== pathname) {
        setTransition({ pathname, active: true });
    }

    useEffect(() => {
        lastRenderedPathname = pathname;
    }, [pathname]);

    return (
        <div
            className={transition.active ? "route-transition-enter" : undefined}
            onAnimationEnd={(event) => {
                if (event.target === event.currentTarget && event.animationName === "route-enter") {
                    setTransition({ pathname, active: false });
                }
            }}
        >
            {children}
        </div>
    );
}
