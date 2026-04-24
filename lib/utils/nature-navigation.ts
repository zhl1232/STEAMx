interface NatureSubmitHrefOptions {
  topic?: string | null;
  speciesId?: number | string | null;
  from?: string | null;
}

export function isSafeNatureHref(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("/nature") && !value.startsWith("//");
}

export function normalizeNatureFrom(
  from: string | null | undefined,
  fallbackHref: string,
): string {
  return isSafeNatureHref(from) ? from : fallbackHref;
}

export function appendNatureFrom(href: string, from: string | null | undefined): string {
  if (!isSafeNatureHref(from)) {
    return href;
  }

  const [pathname, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("from", from);

  const serialized = params.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

export function buildNatureSubmitHref({
  topic,
  speciesId,
  from,
}: NatureSubmitHrefOptions): string {
  const params = new URLSearchParams();

  if (topic) {
    params.set("topic", topic);
  }

  if (speciesId != null && speciesId !== "") {
    params.set("species", String(speciesId));
  }

  if (isSafeNatureHref(from)) {
    params.set("from", from);
  }

  const serialized = params.toString();
  return serialized ? `/nature/submit?${serialized}` : "/nature/submit";
}
