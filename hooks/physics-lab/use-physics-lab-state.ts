"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { emptyPhysicsBackup, mergePhysicsBackups, parsePhysicsBackup, physicsBackupFromValues, physicsBackupValues, PHYSICS_STORAGE_KEYS, type PhysicsBackup } from "@/lib/physics-lab/state";

type Cache = { version: 1; revision: number | null; dirty: boolean; data: PhysicsBackup };
type Status = "loading" | "local" | "saved" | "pending" | "saving" | "offline" | "conflict";
type Snapshot = Cache & { ready: boolean; status: Status; storageAvailable: boolean; guestAvailable: boolean; legacyAvailable: boolean; replacing: boolean; replacement: number; error: string | null };
const cacheKey = (owner: string | null) => `steamx:physics-state:${owner ?? "guest"}`;
function readCache(owner: string | null): Cache | null {
  const raw = localStorage.getItem(cacheKey(owner));
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value?.version !== 1 || typeof value.dirty !== "boolean" || !(value.revision === null || (Number.isSafeInteger(value.revision) && value.revision >= 0))) throw new Error("本地记录格式不正确，请保留浏览器数据并重试。");
  return { version: 1, revision: value.revision, dirty: value.dirty, data: parsePhysicsBackup(value.data) };
}
function readLegacy() {
  const values = Object.fromEntries(PHYSICS_STORAGE_KEYS.map(key => [key, localStorage.getItem(key)]));
  return PHYSICS_STORAGE_KEYS.some(key => values[key] !== null) ? physicsBackupFromValues(values) : null;
}
function hasRecords(data: PhysicsBackup) {
  return data.experiments.length > 0 || data.notebook.sessions.length > 0 || data.observations.length > 0;
}
const initial = (): Snapshot => ({ version: 1, revision: null, dirty: false, data: emptyPhysicsBackup(), ready: false, status: "loading", storageAvailable: true, guestAvailable: false, legacyAvailable: false, replacing: false, replacement: 0, error: null });

/** Mount once per owner. Every async operation is scoped to this owner's lifetime. */
export function usePhysicsLabState(ownerId: string | null) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const current = useRef(snapshot);
  const alive = useRef(false);
  const busy = useRef(false);
  const lifetime = useRef(0);
  const generation = useRef(0);
  const cacheWritable = useRef(true);
  const replacementBase = useRef<Cache | null>(null);
  const replacementRevision = useRef<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const publish = useCallback((patch: Partial<Snapshot>, persist = false) => {
    const next = { ...current.current, ...patch };
    if (persist) {
      try {
        if (!cacheWritable.current) throw new Error("本地存储不可用");
        localStorage.setItem(cacheKey(ownerId), JSON.stringify({ version: 1, revision: next.revision, dirty: next.dirty, data: next.data })); next.storageAvailable = true; }
      catch { next.storageAvailable = false; }
    }
    current.current = next;
    if (alive.current) setSnapshot(next);
  }, [ownerId]);
  const cloudRequest = useCallback(async (method: "GET" | "PUT", body?: unknown) => {
    const abort = new AbortController();
    controller.current = abort;
    const response = await fetch("/api/physics-lab/state", { method, credentials: "same-origin", cache: "no-store", signal: abort.signal, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    if (response.status === 409) throw new Error("conflict");
    if (!response.ok) throw new Error("云端连接失败，记录仍保留在当前页面，可重试。");
    const value = await response.json();
    if (value?.ownerId !== ownerId || !Number.isSafeInteger(value.revision) || value.revision < 0) throw new Error("账号已变化或云端记录格式不正确，请重试。");
    return { revision: value.revision as number, data: value.data === null ? emptyPhysicsBackup() : parsePhysicsBackup(value.data) };
  }, [ownerId]);

  const reconcile = useCallback(async (merge = false) => {
    if (!ownerId || busy.current || current.current.replacing) return;
    busy.current = true;
    const epoch = lifetime.current;
    try {
      const cloud = await cloudRequest("GET");
      if (!alive.current || lifetime.current !== epoch) return;
      const local = current.current;
      if (merge) {
        const data = mergePhysicsBackups(local.data, cloud.data);
        replacementBase.current = local;
        replacementRevision.current = cloud.revision;
        generation.current++;
        publish({ data, dirty: true, ready: true, status: "pending", replacement: local.replacement + 1, replacing: true, error: null });
      } else if (!local.dirty) {
        if (local.ready) { replacementBase.current = local; replacementRevision.current = cloud.revision; }
        publish({ data: cloud.data, revision: local.ready ? local.revision : cloud.revision, dirty: false, ready: true, status: "saved", replacement: local.ready ? local.replacement + 1 : local.replacement, replacing: local.ready, error: null }, !local.ready);
      } else if (local.revision === cloud.revision) {
        publish({ ready: true, status: "pending", error: null });
      } else {
        publish({ ready: true, status: "conflict", error: null });
      }
    } catch (error) {
      if (alive.current && lifetime.current === epoch) publish({ ready: true, status: merge ? "conflict" : "offline", error: error instanceof Error ? error.message : "连接失败，请重试。" });
    } finally { if (lifetime.current === epoch) busy.current = false; }
  }, [ownerId, cloudRequest, publish]);

  useEffect(() => {
    alive.current = true;
    lifetime.current++;
    busy.current = false;
    try {
      const cached = readCache(ownerId);
      publish({ ...(cached ?? {}) });
    } catch (error) {
      // Preserve unreadable cache bytes for backup/recovery throughout this mount.
      cacheWritable.current = false;
      publish({ storageAvailable: false, error: error instanceof Error ? error.message : "本地存储不可用。" });
    }
    if (ownerId) {
      try { const guest = readCache(null); publish({ guestAvailable: !!guest && hasRecords(guest.data) }); }
      catch { /* A damaged guest cache must not block the current account. */ }
    }
    try { const legacy = readLegacy(); publish({ legacyAvailable: !!legacy && hasRecords(legacy) }); }
    catch { publish({ legacyAvailable: true, error: "原有本机记录无法读取，原始数据已保留；请先导出并检查备份。" }); }
    if (ownerId) void reconcile();
    else publish({ ready: true, status: "local" });
    // The controller tracks the latest request, not a DOM node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { alive.current = false; lifetime.current++; controller.current?.abort(); };
  }, [ownerId, publish, reconcile]);

  useEffect(() => {
    if (!ownerId || !snapshot.ready || snapshot.replacing || !snapshot.dirty || snapshot.status !== "pending") return;
    const timer = setTimeout(async () => {
      if (busy.current || !alive.current || current.current.replacing) return;
      busy.current = true;
      const epoch = lifetime.current;
      const sent = current.current;
      const sentGeneration = generation.current;
      publish({ status: "saving" }, true);
      try {
        const cloud = await cloudRequest("PUT", { ownerId, revision: sent.revision ?? 0, data: sent.data });
        if (!alive.current || lifetime.current !== epoch) return;
        const changed = generation.current !== sentGeneration;
        publish({ revision: cloud.revision, dirty: changed, status: changed ? "pending" : "saved", error: null }, true);
      } catch (error) {
        if (alive.current && lifetime.current === epoch) publish({ status: error instanceof Error && error.message === "conflict" ? "conflict" : "offline", error: error instanceof Error && error.message !== "conflict" ? error.message : null }, true);
      } finally { if (lifetime.current === epoch) busy.current = false; }
    }, 700);
    return () => clearTimeout(timer);
  }, [snapshot.ready, snapshot.replacing, snapshot.dirty, snapshot.status, snapshot.data, ownerId, cloudRequest, publish]);

  const change = useCallback((values: unknown) => {
    if (!alive.current || !current.current.ready) return;
    try {
      const data = physicsBackupFromValues(values);
      if (current.current.replacing) {
        generation.current++;
        publish({ data, revision: replacementBase.current ? replacementBase.current.revision : current.current.revision, dirty: !!ownerId, replacing: false, status: "conflict", error: "合并期间实验有新修改，当前记录已保留，请重试合并/导入。" }, true);
        return;
      }
      if (JSON.stringify(physicsBackupValues(data)) === JSON.stringify(physicsBackupValues(current.current.data))) return;
      generation.current++;
      const status = current.current.status;
      publish({ data, dirty: !!ownerId, status: !ownerId ? "local" : status === "saving" || status === "offline" || status === "conflict" ? status : "pending" }, true);
    } catch { /* Invalid child payloads never replace valid records. */ }
  }, [ownerId, publish]);
  const completeReplacement = useCallback((values: unknown, rejected = false) => {
    if (!alive.current || !current.current.replacing) return;
    try {
      const data = physicsBackupFromValues(values);
      generation.current++;
      publish({ data, revision: rejected ? (replacementBase.current ? replacementBase.current.revision : current.current.revision) : replacementRevision.current, replacing: false, dirty: rejected ? !!ownerId : current.current.dirty, status: rejected ? "conflict" : !ownerId ? "local" : current.current.status === "conflict" || current.current.status === "offline" ? current.current.status : current.current.dirty ? "pending" : "saved", error: rejected ? "合并期间实验有新修改，当前记录已保留，请重试合并/导入。" : null }, true);
    } catch { /* Invalid acknowledgments cannot release the replacement fence. */ }
  }, [ownerId, publish]);
  const importRecords = useCallback((legacy: boolean) => {
    if ((!legacy && !ownerId) || !current.current.ready || current.current.replacing || busy.current) return;
    try {
      const incoming = legacy ? readLegacy() : readCache(null)?.data;
      if (!incoming) return;
      const local = current.current;
      const data = mergePhysicsBackups(local.data, incoming);
      replacementBase.current = local;
      replacementRevision.current = local.revision;
      generation.current++;
      publish({ data, dirty: !!ownerId, status: local.status === "conflict" || local.status === "offline" ? local.status : ownerId ? "pending" : "local", replacement: local.replacement + 1, replacing: true, error: null });
    } catch (error) { publish({ error: error instanceof Error ? error.message : "无法导入记录，原始数据已保留。" }); }
  }, [ownerId, publish]);
  const resetDocument = useCallback(() => {
    if (current.current.replacing && replacementBase.current) {
      const base = replacementBase.current;
      generation.current++;
      publish({ data: base.data, revision: base.revision, dirty: base.dirty, replacing: false, status: ownerId ? "conflict" : "local", error: "实验页面已重新加载，待确认的合并已取消，请重试合并/导入。" }, true);
    }
    return current.current.data;
  }, [ownerId, publish]);
  return { ...snapshot, change, completeReplacement, resetDocument, retry: () => reconcile(), mergeCloud: () => reconcile(true), importGuest: () => importRecords(false), importLegacy: () => importRecords(true) };
}
