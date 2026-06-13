"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from '@/lib/context/auth-context';
import { createClient } from "@/lib/supabase/client";
import {
  PLAYGROUND_CHANGE_EVENT,
  collectAllStats,
  mergeCloudWithLocal,
} from "@/lib/playground/storage";

const DEBOUNCE_MS = 3000;

/**
 * Cloud-sync hook for Playground game stats.
 *
 * - On mount (authenticated): fetches cloud data, merges with localStorage,
 *   writes the merged result back to both.
 * - On `playground-stats-change` events: debounced upsert to cloud.
 * - Unauthenticated users are unaffected (pure localStorage, same as before).
 */
export function usePlaygroundSync() {
  const { user } = useAuth();
  const supabaseRef = useRef(createClient());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedRef = useRef(false);

  const syncBadgesFromCloud = useCallback(async () => {
    try {
      const response = await fetch("/api/playground/badges/sync", { method: "POST" });
      if (!response.ok) {
        console.error("[PlaygroundSync] badge sync failed", response.status);
      }
    } catch (error) {
      console.error("[PlaygroundSync] badge sync error", error);
    }
  }, []);

  const uploadToCloud = useCallback(
    async (userId: string, options?: { throwOnError?: boolean }) => {
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
        if (options?.throwOnError) {
          throw new Error("云端同步失败，请稍后重试");
        }
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

        // Write merged result back to cloud
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
        // Flush pending upload on unmount
        void uploadToCloud(userId);
      }
    };
  }, [user?.id, uploadToCloud]);

  /** Immediately upload current localStorage snapshot to cloud (bypasses debounce). */
  const flushToCloud = useCallback(async () => {
    if (!user?.id) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    await uploadToCloud(user.id, { throwOnError: true });
  }, [user?.id, uploadToCloud]);

  /** Delete all playground cloud data. */
  const clearCloud = useCallback(async () => {
    if (!user?.id) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const { error } = await supabaseRef.current
      .from("playground_stats")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      console.error("[PlaygroundSync] clear failed", error.message);
      throw new Error("云端清理失败，请稍后重试");
    }
  }, [user?.id]);

  return { clearCloud, flushToCloud };
}
