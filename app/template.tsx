"use client";

import { motion } from "framer-motion";
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
        <motion.div
            initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: "easeOut", duration: 0.5 }}
        >
            {children}
        </motion.div>
    );
}
