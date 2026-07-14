/**
 * Shared storage layer for Playground games.
 *
 * 登录用户：内存镜像 + 云端 `playground_stats` 为唯一持久化（不再写 localStorage）。
 * 未登录：仅会话内存，刷新即清空。
 * 首次登录仍会读取遗留 localStorage 并入云端，随后清除。
 */

// ── Key registry ─────────────────────────────────────────────────────

export const PLAYGROUND_KEYS = [
  { key: "minesweeper_best_times", label: "扫雷" },
  { key: "minesweeper_stats", label: "扫雷战绩" },
  { key: "gomoku_records", label: "五子棋" },
  { key: "game_of_life_stats", label: "生命游戏" },
  { key: "game_2048_stats", label: "2048" },
  { key: "game_24_stats", label: "24 点" },
  { key: "hanoi_stats", label: "汉诺塔" },

  { key: "sudoku_stats", label: "数独" },
  { key: "nqueens_stats", label: "N 皇后" },
  { key: "fifteen_puzzle_stats", label: "数字华容道" },
  { key: "memory_match_stats", label: "记忆翻牌" },
  { key: "quick_math_stats", label: "速算闪电战" },
  { key: "maze_runner_stats", label: "迷宫探险" },
  { key: "tangram_stats", label: "七巧板" },
  { key: "nonogram_stats", label: "数织" },
  { key: "ball_sort_stats", label: "球排序" },
  { key: "balance_stats", label: "天平称重" },
  { key: "symmetry_stats", label: "像素对称" },
] as const;

export type PlaygroundKey = (typeof PLAYGROUND_KEYS)[number]["key"];

export const PLAYGROUND_CHANGE_EVENT = "playground-stats-change";

const memoryStore = new Map<string, unknown>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readLocalStorageRaw(key: string): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

/** 读取遗留 localStorage 快照（仅用于登录后一次性迁入云端）。 */
export function peekLegacyLocalPlaygroundStats(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const { key } of PLAYGROUND_KEYS) {
    const data = readLocalStorageRaw(key);
    if (data !== null) {
      result[key] = data;
    }
  }
  return result;
}

export function clearPlaygroundLocalStorage(): void {
  if (typeof window === "undefined") return;
  for (const { key } of PLAYGROUND_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export function clearPlaygroundMemoryStore(): void {
  memoryStore.clear();
}

// ── Read / Write helpers ─────────────────────────────────────────────

export function getPlaygroundItem<T = unknown>(key: string): T | null {
  if (typeof window === "undefined") return null;

  if (memoryStore.has(key)) {
    const value = memoryStore.get(key);
    return isPlainObject(value) ? (value as T) : null;
  }

  return null;
}

export function setPlaygroundItem(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  if (!isPlainObject(value)) return;

  memoryStore.set(key, value);
  window.dispatchEvent(
    new CustomEvent(PLAYGROUND_CHANGE_EVENT, { detail: { key } }),
  );
}

export function removePlaygroundItem(key: string): void {
  if (typeof window === "undefined") return;
  memoryStore.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(PLAYGROUND_CHANGE_EVENT, { detail: { key } }),
  );
}

// ── Collect all playground stats into a single object ────────────────

export function collectAllStats(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const { key } of PLAYGROUND_KEYS) {
    const data = getPlaygroundItem(key);
    if (data !== null) {
      result[key] = data;
    }
  }
  return result;
}

// ── Merge strategy ───────────────────────────────────────────────────
// Merges two stats objects for a single game key.
// - Numeric counts (totalGames, wins, …) → max
// - "best time" / "best moves" fields (lower is better) → min (ignoring 0/null)
// - Record<string, number> → merge keys with same strategy
// - Arrays → union
// - Booleans → OR

const LOWER_IS_BETTER_PATTERNS = /time|moves/i;

function mergeNumber(a: number, b: number, lowerIsBetter: boolean): number {
  if (lowerIsBetter) {
    if (a <= 0) return b;
    if (b <= 0) return a;
    return Math.min(a, b);
  }
  return Math.max(a, b);
}

function mergeRecord(
  local: Record<string, unknown>,
  cloud: Record<string, unknown>,
  parentKey: string,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...cloud };
  const lowerIsBetter = LOWER_IS_BETTER_PATTERNS.test(parentKey);

  for (const k of Object.keys(local)) {
    const lv = local[k];
    const cv = merged[k];

    if (cv === undefined || cv === null) {
      merged[k] = lv;
    } else if (typeof lv === "number" && typeof cv === "number") {
      merged[k] = mergeNumber(lv, cv, lowerIsBetter);
    }
  }
  return merged;
}

export function mergeGameStats(
  local: unknown,
  cloud: unknown,
): unknown {
  const hasLocal = isPlainObject(local);
  const hasCloud = isPlainObject(cloud);

  if (!hasLocal) return hasCloud ? cloud : null;
  if (!hasCloud) return local;

  const l = local;
  const c = cloud;
  const merged: Record<string, unknown> = { ...c };

  for (const key of Object.keys(l)) {
    const lv = l[key];
    const cv = merged[key];

    if (cv === undefined || cv === null) {
      merged[key] = lv;
      continue;
    }

    if (typeof lv === "number" && typeof cv === "number") {
      merged[key] = mergeNumber(lv, cv, LOWER_IS_BETTER_PATTERNS.test(key));
      continue;
    }

    if (typeof lv === "boolean" && typeof cv === "boolean") {
      merged[key] = lv || cv;
      continue;
    }

    if (Array.isArray(lv) && Array.isArray(cv)) {
      merged[key] = [...new Set([...cv, ...lv])];
      continue;
    }

    if (
      typeof lv === "object" &&
      lv !== null &&
      !Array.isArray(lv) &&
      typeof cv === "object" &&
      cv !== null &&
      !Array.isArray(cv)
    ) {
      merged[key] = mergeRecord(
        lv as Record<string, unknown>,
        cv as Record<string, unknown>,
        key,
      );
      continue;
    }

    // Fallback: keep local value
    merged[key] = lv;
  }

  return merged;
}

/**
 * 将云端 blob 与遗留 localStorage / 当前内存合并，写入内存并清除 localStorage。
 */
export function mergeCloudWithLocal(
  cloudBlob: Record<string, unknown>,
): Record<string, unknown> {
  const legacyLocal = peekLegacyLocalPlaygroundStats();
  const merged: Record<string, unknown> = {};

  for (const { key } of PLAYGROUND_KEYS) {
    const memory = memoryStore.has(key) ? memoryStore.get(key) : null;
    const legacy = (legacyLocal[key] ?? null) as unknown;
    const cloud = (cloudBlob[key] ?? null) as unknown;

    const withLegacy = mergeGameStats(legacy, cloud);
    const result = mergeGameStats(memory, withLegacy);
    if (result != null && isPlainObject(result)) {
      merged[key] = result;
      memoryStore.set(key, result);
    } else {
      memoryStore.delete(key);
    }
  }

  clearPlaygroundLocalStorage();
  return merged;
}
