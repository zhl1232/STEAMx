"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                // 默认缓存时间，避免频繁请求，但在开发环境下可以设短一点以便调试
                staleTime: 60 * 1000,
                // 窗口聚焦时重新获取数据，保证数据实时性
                refetchOnWindowFocus: false,
                retry: 1,
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
