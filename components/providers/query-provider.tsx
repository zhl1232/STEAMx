"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                // 更合理的 staleTime：数据视作新鲜的时间（1分钟）
                staleTime: 60 * 1000,
                // v5 特性 gcTime（原 cacheTime）：闲置缓存垃圾回收前存活多久（24小时更适合 PWA/离线浏览应用）
                gcTime: 24 * 60 * 60 * 1000,
                // PWA/离线模式重要配置：在离线状态下也正常读取缓存甚至报错暂停直到有网再重试
                networkMode: 'offlineFirst',
                refetchOnWindowFocus: false,
                retry: 1,
            },
            mutations: {
                // mutation 也启用离线优先
                networkMode: 'offlineFirst',
            }
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
