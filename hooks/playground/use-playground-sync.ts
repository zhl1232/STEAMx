"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from '@/lib/context/auth-context';
import { createClient } from "@/lib/supabase/client";
import {
  PLAYGROUND_CHANGE_EVENT,
  clearPlaygroundMemoryStore,
  collectAllStats,
  mergeCloudWithLocal,
} from "@/lib/playground/storage";

const DEBOUNCE_MS = 3000;

/**
 * Cloud-sync hook for Playground game stats.
 *
 * - 登录后：拉取云端 → 合并遗留 localStorage/会话内存 → 写入内存与云端 → 清除 localStorage
 * - 战绩变更：debounce 后 upsert 云端，并立即刷新徽章缓存
 * - 未登录：仅会话内存，不落盘
 */
export function usePlaygroundSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const supabaseRef = useRef(createClient());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedRef = useRef(false);

  const syncBadgesFromCloud = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await fetch("/api/playground/badges/sync", { method: "POST" });
      if (!response.ok) {
        console.error("[PlaygroundSync] badge sync failed", response.status);
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ["gamification", "badges", user.id],
      });
    } catch (error) {
      console.error("[PlaygroundSync] badge sync error", error);
    }
  }, [queryClient, user?.id]);

  const uploadToCloud = useCallback(
    async (userId: string) => {
      const blob = collectAllStats();
      const { error } = await supabaseRef.current
        .from("playground_stats")
        .upsert(
          {
            user_id: userId,
            stats: blob,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      if (error) {
        console.error("[PlaygroundSync] upload failed", error.message);
        return false;
      }
      await syncBadgesFromCloud();
      return true;
    },
    [syncBadgesFromCloud],
  );

  // Initial sync on login
  useEffect(() => {
    if (!user?.id) {
      syncedRef.current = false;
      clearPlaygroundMemoryStore();
      window.dispatchEvent(
        new CustomEvent(PLAYGROUND_CHANGE_EVENT, {
          detail: { source: "logout", skipUpload: true },
        }),
      );
      return;
    }
    if (syncedRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabaseRef.current
          .from("playground_stats")
          .select("stats")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.error("[PlaygroundSync] fetch failed", error.message);
          return;
        }

        const cloudBlob =
          (data?.stats as Record<string, unknown> | null) ?? {};
        const merged = mergeCloudWithLocal(cloudBlob);

        const { error: upsertError } = await supabaseRef.current
          .from("playground_stats")
          .upsert(
            {
              user_id: user.id,
              stats: merged,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        if (upsertError) {
          console.error("[PlaygroundSync] write-back failed", upsertError.message);
        } else {
          await syncBadgesFromCloud();
        }

        syncedRef.current = true;
        window.dispatchEvent(
          new CustomEvent(PLAYGROUND_CHANGE_EVENT, {
            detail: { source: "cloud-sync", skipUpload: true },
          }),
        );
      } catch (err) {
        console.error("[PlaygroundSync] initial sync error", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [syncBadgesFromCloud, user?.id]);

  // Listen for changes and debounced upload
  useEffect(() => {
    if (!user?.id) return;

    const userId = user.id;

    const handler = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as { skipUpload?: boolean } | undefined)
          : undefined;
      if (detail?.skipUpload) {
        return;
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void uploadToCloud(userId);
      }, DEBOUNCE_MS);
    };

    window.addEventListener(PLAYGROUND_CHANGE_EVENT, handler);

    return () => {
      window.removeEventListener(PLAYGROUND_CHANGE_EVENT, handler);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        void uploadToCloud(userId);
      }
    };
  }, [user?.id, uploadToCloud]);
}
