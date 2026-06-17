/**
 * Shared storage layer for Playground games.
 *
 * Wraps localStorage read/write with a CustomEvent dispatch so the
 * cloud-sync hook can pick up changes without polling.
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
] as const;

export type PlaygroundKey = (typeof PLAYGROUND_KEYS)[number]["key"];

export const PLAYGROUND_CHANGE_EVENT = "playground-stats-change";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

// ── Read / Write helpers ─────────────────────────────────────────────

export function getPlaygroundItem<T = unknown>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed as T;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function setPlaygroundItem(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(
      new CustomEvent(PLAYGROUND_CHANGE_EVENT, { detail: { key } }),
    );
  } catch {
    /* quota exceeded – ignore */
  }
}

export function removePlaygroundItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
    window.dispatchEvent(
      new CustomEvent(PLAYGROUND_CHANGE_EVENT, { detail: { key } }),
    );
  } catch {
    /* ignore */
  }
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
 * Merge a complete cloud blob with the current localStorage state.
 * Returns the merged blob and writes each key back to localStorage.
 */
export function mergeCloudWithLocal(
  cloudBlob: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  for (const { key } of PLAYGROUND_KEYS) {
    const local = getPlaygroundItem(key);
    const cloud = (cloudBlob[key] ?? null) as unknown;
    const result = mergeGameStats(local, cloud);
    if (result != null) {
      merged[key] = result;
      // Write merged result back to localStorage (without dispatching sync event)
      try {
        window.localStorage.setItem(key, JSON.stringify(result));
      } catch {
        /* ignore */
      }
    }
  }

  return merged;
}
