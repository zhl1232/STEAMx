interface NatureSubmitHrefOptions {
  topic?: string | null;
  speciesId?: number | string | null;
}

/**
 * `/nature/submit` link. Deliberately carries no `from=` tracking param: the back
 * target is remembered in sessionStorage (see lib/navigation/return-href.ts).
 */
export function buildNatureSubmitHref({
  topic,
  speciesId,
}: NatureSubmitHrefOptions): string {
  const params = new URLSearchParams();

  if (topic) {
    params.set("topic", topic);
  }

  if (speciesId != null && speciesId !== "") {
    params.set("species", String(speciesId));
  }

  const serialized = params.toString();
  return serialized ? `/nature/submit?${serialized}` : "/nature/submit";
}
