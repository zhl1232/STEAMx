import { queryOptions } from "@tanstack/react-query";

import type { Species } from "@/lib/mappers/types";
import type { SpeciesObservationStatusFilter } from "@/lib/observations/progress";
import type { SpeciesTopicCount, SpeciesTopicFilter } from "@/lib/utils/nature-topic-classification";

export const NATURE_SPECIES_LIST_STALE_MS = 10 * 60 * 1000;
export const NATURE_SPECIES_LIST_GC_MS = 24 * 60 * 60 * 1000;

interface NatureSpeciesListFiltersInput {
  query?: string;
  topic?: SpeciesTopicFilter;
  status?: SpeciesObservationStatusFilter;
  pageSize: number;
}

interface NatureSpeciesPageInput extends NatureSpeciesListFiltersInput {
  page: number;
}

export interface NatureSpeciesPageResponse {
  species: Species[];
  total: number;
  hasMore: boolean;
  topicCounts: SpeciesTopicCount[];
  observedCount: number;
  unobservedCount: number;
  progressPercent: number;
  isProgressAvailable: boolean;
}

export interface CachedNatureSpeciesListState {
  items: Species[];
  page: number;
  hasMore: boolean;
  total: number;
}

export function buildNatureSpeciesPageRequestParams(input: NatureSpeciesPageInput) {
  const params = new URLSearchParams();

  if (input.query) params.set("q", input.query);
  if (input.topic && input.topic !== "all") params.set("topic", input.topic);
  if (input.status && input.status !== "all") params.set("status", input.status);
  params.set("page", String(input.page));
  params.set("pageSize", String(input.pageSize));

  return params;
}

export function natureSpeciesListCacheKey(input: NatureSpeciesListFiltersInput) {
  return [
    "nature-species-list",
    input.query ?? "",
    input.topic ?? "all",
    input.status ?? "all",
    input.pageSize,
  ] as const;
}

export function natureSpeciesListStateQueryKey(input: NatureSpeciesListFiltersInput) {
  return [...natureSpeciesListCacheKey(input), "state"] as const;
}

export function natureSpeciesListPageQueryKey(input: NatureSpeciesPageInput) {
  return [...natureSpeciesListCacheKey(input), "page", input.page] as const;
}

export function natureSpeciesPageQueryOptions(input: NatureSpeciesPageInput) {
  const params = buildNatureSpeciesPageRequestParams(input);

  return queryOptions({
    queryKey: natureSpeciesListPageQueryKey(input),
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/species?${params.toString()}`, { signal });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === "string" ? payload.error : "物种列表加载失败");
      }

      return response.json() as Promise<NatureSpeciesPageResponse>;
    },
    staleTime: NATURE_SPECIES_LIST_STALE_MS,
    gcTime: NATURE_SPECIES_LIST_GC_MS,
  });
}
