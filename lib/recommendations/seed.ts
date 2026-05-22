/**
 * 推荐列表确定性打乱：同一观众 + 同一天 + 同一批次顺序稳定，隔天/换一批会变化。
 */

export function hashRecommendationSeed(seed: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

/** 上海时区日历日 YYYY-MM-DD */
export function getShanghaiDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function buildRecommendationShuffleSeed(
  viewerKey: string,
  batch = 0,
  dateKey = getShanghaiDateKey(),
): string {
  return `${viewerKey}:${dateKey}:${batch}`;
}

export function sortByRecommendationShuffleSeed<T>(
  items: readonly T[],
  seed: string,
  getKey: (item: T) => string | number = (item) => {
    if (typeof item === "object" && item !== null && "id" in item) {
      return (item as { id: string | number }).id;
    }
    return String(item);
  },
): T[] {
  if (items.length <= 1) {
    return [...items];
  }

  return [...items]
    .map((item, index) => ({
      item,
      index,
      order: hashRecommendationSeed(`${seed}:${getKey(item)}`),
    }))
    .sort((left, right) => left.order - right.order || left.index - right.index)
    .map(({ item }) => item);
}
