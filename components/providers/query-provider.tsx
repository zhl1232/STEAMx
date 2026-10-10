"use client";

import { QueryClient, QueryClientProvider, isServer } from "@tanstack/react-query";
import { useState } from "react";

/** Browser: keep idle cache for 24h (PWA / offline browsing). */
export const BROWSER_QUERY_GC_TIME_MS = 24 * 60 * 60 * 1000;

/**
 * Build the app QueryClient.
 *
 * On the server this must keep TanStack's server default (gcTime = Infinity),
 * which schedules no GC timer. An explicit finite gcTime makes every query
 * created during SSR start a setTimeout for that long; the timer keeps the
 * query, its QueryClient and the request's async context alive. With 24h,
 * every SSR render stayed in the heap for a day until the process hit its
 * heap limit (steam-app outage 2026-10-10).
 */
export function createAppQueryClient(onServer: boolean = isServer) {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // 更合理的 staleTime：数据视作新鲜的时间（1分钟）
                staleTime: 60 * 1000,
                // 浏览器端 24 小时（PWA/离线浏览）；服务端必须是 Infinity，不能挂 GC 定时器
                gcTime: onServer ? Infinity : BROWSER_QUERY_GC_TIME_MS,
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
    });
}

export default function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => createAppQueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
