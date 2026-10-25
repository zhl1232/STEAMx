import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePhysicsLabState } from "./use-physics-lab-state";
import { emptyPhysicsBackup, physicsBackupValues, PHYSICS_STORAGE_KEYS, type PhysicsBackup } from "@/lib/physics-lab/state";

import { defaults } from "@/public/physics-lab/exploration-model.mjs";

const key = (id: string) => `steamx:physics-state:${id}`;
const backup = (id = "record"): PhysicsBackup => ({ ...emptyPhysicsBackup(), observations: [{ id, experiment: "sound", note: id, params: defaults("sound"), time: 0, level: 0, at: "today" }] });
const cache = (id: string, data: PhysicsBackup, revision: number | null, dirty: boolean) => localStorage.setItem(key(id), JSON.stringify({ version: 1, revision, dirty, data }));
const response = (ownerId: string, revision: number, data: PhysicsBackup | null = null) => ({ ok: true, status: 200, json: async () => ({ ownerId, revision, data }) });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("keeps guests local without fetching or automatically importing into an account", async () => {
  const fetcher = vi.fn().mockResolvedValue(response("a", 0)); vi.stubGlobal("fetch", fetcher);
  const guest = renderHook(() => usePhysicsLabState(null));
  expect(guest.result.current.status).toBe("local");
  expect(fetcher).not.toHaveBeenCalled();
  guest.unmount();
  cache("guest", backup(), null, false);
  const account = renderHook(() => usePhysicsLabState("a")); await flush();
  expect(account.result.current.data.observations).toHaveLength(0);
  expect(account.result.current.guestAvailable).toBe(true);
});

it("loads cloud over a clean cache before allowing the child to mount", async () => {
  cache("a", emptyPhysicsBackup(), 1, false);
  const pending = deferred<ReturnType<typeof response>>(); vi.stubGlobal("fetch", vi.fn(() => pending.promise));
  const { result } = renderHook(() => usePhysicsLabState("a"));
  expect(result.current.ready).toBe(false);
  pending.resolve(response("a", 2)); await flush();
  expect(result.current).toMatchObject({ ready: true, revision: 2, dirty: false, status: "saved" });
});

it("preserves a dirty cache and pauses when the cloud revision differs", async () => {
  cache("a", emptyPhysicsBackup(), 1, true);
  const fetcher = vi.fn().mockResolvedValue(response("a", 2)); vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  expect(result.current).toMatchObject({ revision: 1, dirty: true, status: "conflict" });
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("autosaves a dirty cache based on the same cloud revision", async () => {
  cache("a", emptyPhysicsBackup(), 2, true);
  const fetcher = vi.fn().mockResolvedValueOnce(response("a", 2)).mockResolvedValueOnce(response("a", 3)); vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  await act(async () => vi.advanceTimersByTimeAsync(700));
  expect(result.current).toMatchObject({ revision: 3, dirty: false, status: "saved" });
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ ownerId: "a", revision: 2 });
});

it("retains failed saves locally and reconciles a retry without overwriting dirty data", async () => {
  cache("a", emptyPhysicsBackup(), 2, true);
  const fetcher = vi.fn().mockResolvedValueOnce(response("a", 2)).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(response("a", 3)); vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  await act(async () => vi.advanceTimersByTimeAsync(700));
  expect(result.current.status).toBe("offline");
  expect(JSON.parse(localStorage.getItem(key("a"))!).dirty).toBe(true);
  await act(async () => result.current.retry());
  expect(result.current).toMatchObject({ revision: 2, dirty: true, status: "conflict" });
});

it("ignores a late request after the owner workspace unmounts", async () => {
  const old = deferred<ReturnType<typeof response>>();
  vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(response("b", 4)));
  const a = renderHook(() => usePhysicsLabState("a")); a.unmount();
  const b = renderHook(() => usePhysicsLabState("b")); await flush();
  old.resolve(response("a", 9)); await flush();
  expect(b.result.current).toMatchObject({ revision: 4, status: "saved" });
  expect(localStorage.getItem(key("a"))).toBeNull();
});

it("refuses cloud payloads belonging to another account", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("other", 3)));
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  expect(result.current.status).toBe("offline");
  expect(result.current.revision).toBeNull();
});

it("shows storage unavailability without claiming guest records are durable", () => {
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
  const { result } = renderHook(() => usePhysicsLabState(null));
  expect(result.current.storageAvailable).toBe(false);
});


it("imports guest records only on explicit consent and preserves the guest copy", async () => {
  const guest = backup("guest-record"); cache("guest", guest, null, false);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("a", 0)));
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  expect(result.current.data.observations).toHaveLength(0);
  act(() => result.current.importGuest());
  expect(result.current.data.observations).toHaveLength(1);
  expect(result.current.replacement).toBe(1);
  expect(JSON.parse(localStorage.getItem(key("guest"))!).data).toEqual(guest);
});

it("serializes saves and keeps changes made while a save is in flight", async () => {
  cache("a", emptyPhysicsBackup(), 2, true);
  const firstSave = deferred<ReturnType<typeof response>>();
  const fetcher = vi.fn().mockResolvedValueOnce(response("a", 2)).mockReturnValueOnce(firstSave.promise).mockResolvedValueOnce(response("a", 4)); vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  await act(async () => vi.advanceTimersByTimeAsync(700));
  act(() => result.current.change(physicsBackupValues(backup("newer"))));
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(fetcher).toHaveBeenCalledTimes(2);
  firstSave.resolve(response("a", 3)); await flush();
  expect(result.current).toMatchObject({ revision: 3, dirty: true, status: "pending" });
  await act(async () => vi.advanceTimersByTimeAsync(700));
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toMatchObject({ revision: 3, data: { observations: [{ id: "newer" }] } });
  expect(result.current).toMatchObject({ revision: 4, dirty: false, status: "saved" });
});

it("explicitly merges cloud conflicts and saves against the latest revision", async () => {
  cache("a", backup("local"), 1, true);
  const cloud = backup("cloud");
  const fetcher = vi.fn().mockResolvedValueOnce(response("a", 2, cloud)).mockResolvedValueOnce(response("a", 3, cloud)).mockResolvedValueOnce(response("a", 4)); vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  await act(async () => result.current.mergeCloud());
  expect(result.current.data.observations).toHaveLength(2);
  expect(result.current.replacement).toBe(1);
  act(() => result.current.completeReplacement(physicsBackupValues(result.current.data)));
  await act(async () => vi.advanceTimersByTimeAsync(700));
  expect(JSON.parse(fetcher.mock.calls[2][1].body).revision).toBe(3);
});

it("keeps corrupt local cache bytes intact instead of overwriting them during startup", async () => {
  localStorage.setItem(key("a"), "{broken");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("a", 2)));
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  expect(localStorage.getItem(key("a"))).toBe("{broken");
  expect(result.current.storageAvailable).toBe(false);
});

it("preserves local records and pauses autosave after a CAS conflict", async () => {
  cache("a", backup("keep"), 1, true);
  const fetcher = vi.fn().mockResolvedValueOnce(response("a", 1)).mockResolvedValueOnce({ ok: false, status: 409 }); vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  await act(async () => vi.advanceTimersByTimeAsync(700));
  expect(result.current.status).toBe("conflict");
  expect(result.current.data.observations[0].id).toBe("keep");
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("shows cached records after an initial network failure without claiming cloud success", async () => {
  cache("a", backup("offline-record"), 2, false);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  expect(result.current).toMatchObject({ ready: true, status: "offline", revision: 2 });
  expect(result.current.data.observations[0].id).toBe("offline-record");
});

it("preserves both local and guest data when a merge would exceed record limits", async () => {
  const local = emptyPhysicsBackup();
  local.observations = Array.from({ length: 120 }, (_, i) => backup(`local-${i}`).observations[0]);
  cache("a", local, 1, true);
  cache("guest", backup("extra"), null, false);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("a", 2)));
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  act(() => result.current.importGuest());
  expect(result.current.error).toContain("上限");
  expect(result.current.data.observations).toHaveLength(120);
  expect(result.current.replacement).toBe(0);
  expect(JSON.parse(localStorage.getItem(key("guest"))!).data.observations).toHaveLength(1);
});

it("never allows invalid child storage values to replace the current backup", () => {
  const { result } = renderHook(() => usePhysicsLabState(null));
  act(() => result.current.change({ arbitrary: "key" }));
  expect(result.current.data.observations).toHaveLength(0);
  expect(localStorage.getItem(key("guest"))).toBeNull();
});


it("offers legacy records to guests without importing them automatically or changing original keys", () => {
  const values = physicsBackupValues(backup("legacy"));
  Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value!));
  const { result } = renderHook(() => usePhysicsLabState(null));
  expect(result.current.legacyAvailable).toBe(true);
  expect(result.current.data.observations).toHaveLength(0);
  act(() => result.current.importLegacy());
  expect(result.current.replacing).toBe(true);
  expect(result.current.data.observations[0].id).toBe("legacy");
  act(() => result.current.completeReplacement(physicsBackupValues(result.current.data)));
  expect(result.current.replacing).toBe(false);
  expect(result.current.status).toBe("local");
  PHYSICS_STORAGE_KEYS.forEach(key => expect(localStorage.getItem(key)).toBe(values[key]));
});

it("preserves invalid legacy bytes and reports the import error", () => {
  localStorage.setItem(PHYSICS_STORAGE_KEYS[0], "{invalid");
  const { result } = renderHook(() => usePhysicsLabState(null));
  expect(result.current.legacyAvailable).toBe(true);
  act(() => result.current.importLegacy());
  expect(result.current.replacing).toBe(false);
  expect(result.current.error).toBeTruthy();
  expect(localStorage.getItem(PHYSICS_STORAGE_KEYS[0])).toBe("{invalid");
});

it("holds cloud autosave until the child confirms an imported replacement", async () => {
  cache("guest", backup("guest"), null, false);
  const fetcher = vi.fn().mockResolvedValueOnce(response("a", 2)).mockResolvedValueOnce(response("a", 3)); vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  act(() => result.current.importGuest());
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(result.current.replacing).toBe(true);
  act(() => result.current.completeReplacement(physicsBackupValues(result.current.data)));
  await act(async () => vi.advanceTimersByTimeAsync(700));
  expect(result.current).toMatchObject({ replacing: false, dirty: false, revision: 3 });
});

it("cancels a pending merge when a queued newer child edit arrives and never autosaves the canceled merge", async () => {
  cache("guest", backup("guest"), null, false);
  const fetcher = vi.fn().mockResolvedValue(response("a", 2)); vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  act(() => result.current.importGuest());
  act(() => result.current.change(physicsBackupValues(backup("new-child-edit"))));
  expect(result.current).toMatchObject({ replacing: false, status: "conflict" });
  expect(result.current.data.observations[0].id).toBe("new-child-edit");
  expect(result.current.error).toContain("新修改");
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("preserves the child snapshot when the child rejects a replacement after editing", async () => {
  cache("guest", backup("guest"), null, false);
  const fetcher = vi.fn().mockResolvedValue(response("a", 2)); vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  act(() => result.current.importGuest());
  act(() => result.current.completeReplacement(physicsBackupValues(backup("edited-before-replace")), true));
  expect(result.current).toMatchObject({ replacing: false, status: "conflict" });
  expect(result.current.data.observations[0].id).toBe("edited-before-replace");
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(fetcher).toHaveBeenCalledTimes(1);
});


it.each(["reject", "change"])("retains the original CAS base after canceled cloud merge (%s), including retry and remount", async (ordering) => {
  cache("a", backup("local"), 1, true);
  const remote = backup("remote-only");
  const fetcher = vi.fn().mockResolvedValue(response("a", 2, remote)); vi.stubGlobal("fetch", fetcher);
  const first = renderHook(() => usePhysicsLabState("a")); await flush();
  await act(async () => first.result.current.mergeCloud());
  expect(first.result.current.revision).toBe(1);
  expect(first.result.current.replacing).toBe(true);
  act(() => {
    const values = physicsBackupValues(backup("local-newer"));
    if (ordering === "reject") first.result.current.completeReplacement(values, true);
    else first.result.current.change(values);
  });
  expect(first.result.current.revision).toBe(1);
  await act(async () => first.result.current.retry());
  expect(first.result.current.status).toBe("conflict");
  first.unmount();
  const second = renderHook(() => usePhysicsLabState("a")); await flush();
  expect(second.result.current).toMatchObject({ revision: 1, status: "conflict", dirty: true });
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(fetcher.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
  expect(second.result.current.data.observations[0].id).toBe("local-newer");
});

it("commits the target cloud revision only after the child accepts the merged records", async () => {
  cache("a", backup("local"), 1, true);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("a", 2, backup("remote"))));
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  await act(async () => result.current.mergeCloud());
  expect(result.current.revision).toBe(1);
  act(() => result.current.completeReplacement(physicsBackupValues(result.current.data)));
  expect(result.current.revision).toBe(2);
  expect(result.current.data.observations).toHaveLength(2);
});

it("restores the actual premerge backup and old CAS base when the child document reloads", async () => {
  cache("a", backup("local"), 1, true);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("a", 2, backup("remote"))));
  const { result } = renderHook(() => usePhysicsLabState("a")); await flush();
  await act(async () => result.current.mergeCloud());
  act(() => result.current.resetDocument());
  expect(result.current).toMatchObject({ revision: 1, dirty: true, replacing: false, status: "conflict" });
  expect(result.current.data.observations.map(item => item.id)).toEqual(["local"]);
});
