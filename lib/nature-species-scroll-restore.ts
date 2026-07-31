const STORAGE_KEY = "nature-species-scroll-restore-v2";

export type NatureSpeciesScrollRestoreState = {
  filtersKey: string;
  scrollY: number;
  anchorSlug?: string;
  anchorTop?: number;
};

const FILTER_PARAM_KEYS = ["q", "topic", "status"] as const;

export function buildNatureSpeciesFiltersKey(params: URLSearchParams): string {
  const normalized = new URLSearchParams();

  for (const key of FILTER_PARAM_KEYS) {
    const value = params.get(key);
    if (!value) continue;
    if ((key === "topic" || key === "status") && value === "all") continue;
    normalized.set(key, value);
  }

  return normalized.toString();
}

export function readNatureSpeciesScrollRestore(): NatureSpeciesScrollRestoreState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as NatureSpeciesScrollRestoreState;
    if (
      typeof parsed.filtersKey !== "string" ||
      typeof parsed.scrollY !== "number" ||
      !Number.isFinite(parsed.scrollY) ||
      (parsed.anchorSlug != null && typeof parsed.anchorSlug !== "string") ||
      (parsed.anchorTop != null && (typeof parsed.anchorTop !== "number" || !Number.isFinite(parsed.anchorTop)))
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveNatureSpeciesScrollRestore(state: NatureSpeciesScrollRestoreState): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage may be unavailable in private browsing or quota-limited contexts.
  }
}

export function clearNatureSpeciesScrollRestore(): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
