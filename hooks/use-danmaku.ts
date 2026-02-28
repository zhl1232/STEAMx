import { useState, useEffect, useRef, useCallback } from "react";
import styles from "@/components/features/danmaku.module.css";

export interface DanmakuItem {
    id: number | string;
    content: string;
    top: string;
    color: string;
    duration: string;
    startTime: number;
    uniqueKey?: string;
}

const DANMAKU_COLORS = [
    "#FEF3C7", // amber-100
    "#D1FAE5", // emerald-100
    "#DBEAFE", // blue-100
    "#FCE7F3", // pink-100
    "#FFFFFF", // white
    "#F3F4F6", // gray-100
    "#FFEDD5", // orange-100
];

interface UseDanmakuOptions {
    initialComments?: { id: number | string; content: string }[];
    autoPlay?: boolean;
    /** 同一资源只跑一轮初始弹幕，不因 initialComments 引用变化而重复播放 */
    runOnce?: boolean;
    /** 资源标识（如 completion.id），切换时重新种子队列 */
    resourceId?: number | string;
}

export function useDanmaku({ initialComments = [], autoPlay = true, runOnce = false, resourceId }: UseDanmakuOptions = {}) {
    const [activeDanmaku, setActiveDanmaku] = useState<DanmakuItem[]>([]);
    const [isPlaying, setIsPlaying] = useState(autoPlay);

    // 使用 ref 存储待播放队列，避免频繁更新 state 导致不必要的渲染
    const pendingQueueRef = useRef<DanmakuItem[]>([]);
    // 仅 runOnce 时：当前资源是否已种子过，避免重复跑
    const seededForRef = useRef<number | string | null>(null);

    // Track management
    const TRACK_COUNT = 8;
    const tracksRef = useRef<number[]>(new Array(TRACK_COUNT).fill(0));

    const getAvailableTrack = useCallback(() => {
        const now = Date.now();
        // Strategy: Find first track that is free (time < now) or soonest to be free

        let bestTrack = -1;
        // 1. Try to find a completely free track
        for (let i = 0; i < TRACK_COUNT; i++) {
            if (now >= tracksRef.current[i]) {
                bestTrack = i;
                break;
            }
        }

        // 2. If all busy, pick the one that becomes free soonest
        if (bestTrack === -1) {
            let minTime = Infinity;
            tracksRef.current.forEach((time, idx) => {
                if (time < minTime) {
                    minTime = time;
                    bestTrack = idx;
                }
            });
        }

        // Mark track as busy for 2s (prevent overlap at start)
        tracksRef.current[bestTrack] = Math.max(tracksRef.current[bestTrack], now) + 2000;

        return bestTrack;
    }, []);

    // 初始化弹幕队列（runOnce 时同一 resourceId 只种子一次，弹幕只跑一轮）
    useEffect(() => {
        if (initialComments.length === 0) return;
        const key = resourceId ?? "default";
        if (runOnce && seededForRef.current === key) return;
        seededForRef.current = key;
        const formatted: DanmakuItem[] = initialComments.map((c) => ({
            id: c.id,
            content: c.content,
            top: '0%',
            color: DANMAKU_COLORS[Math.floor(Math.random() * DANMAKU_COLORS.length)],
            duration: `${Math.random() * 4 + 8}s`,
            startTime: 0
        }));
        pendingQueueRef.current = formatted;
    }, [initialComments, runOnce, resourceId]);

    // 弹幕投放定时器
    useEffect(() => {
        if (!isPlaying) return;

        const interval = setInterval(() => {
            if (pendingQueueRef.current.length === 0) return;

            // Reduce burst to 1 to better manage tracks
            const count = Math.min(pendingQueueRef.current.length, 1);

            const batch = pendingQueueRef.current.splice(0, count);
            const now = Date.now();

            const newActive = batch.map(b => {
                const trackIdx = getAvailableTrack();
                const top = `${trackIdx * 10 + 10}%`; // 10% - 80% range

                return {
                    ...b,
                    top,
                    uniqueKey: `${b.id}-${now}-${Math.random()}`
                };
            });

            setActiveDanmaku(prev => [...prev, ...newActive]);
        }, 1200); // Slower interval for track management

        return () => clearInterval(interval);
    }, [isPlaying, getAvailableTrack]);

    // 发送弹幕（立即显示）
    const sendDanmaku = useCallback((content: string) => {
        const now = Date.now();
        const trackIdx = getAvailableTrack();
        const top = `${trackIdx * 10 + 10}%`;

        const newItem: DanmakuItem = {
            id: `temp-${now}`,
            content,
            top,
            color: '#FFFFFF', // 高亮白色
            duration: '10s',
            startTime: now,
            uniqueKey: `my-${now}`
        };
        setActiveDanmaku(prev => [...prev, newItem]);
    }, [getAvailableTrack]);

    // 移除结束动画的弹幕
    const removeDanmaku = useCallback((uniqueKey: string) => {
        setActiveDanmaku(prev => prev.filter(item => item.uniqueKey !== uniqueKey));
    }, []);

    const togglePlay = useCallback(() => setIsPlaying(prev => !prev), []);

    return {
        activeDanmaku,
        sendDanmaku,
        removeDanmaku,
        isPlaying,
        togglePlay,
        danmakuClass: styles.item
    };
}
