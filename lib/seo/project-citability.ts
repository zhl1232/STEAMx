import { formatStartingAge } from "@/lib/content-classification/labels";
import type { PublicClassification } from "@/lib/content-classification/types";

const DESCRIPTION_MAX = 120;

export function projectKindLabel(category?: string | null): string {
  if (category === "科学") return "科学小实验";
  return "实践项目";
}

function compactAgeLabel(classification?: PublicClassification | null): string {
  if (!classification || classification.status !== "reviewed") return "";
  return formatStartingAge(
    classification.recommendedMinAge,
    classification.recommendedMaxAge,
  ).replace(/\s+/g, "");
}

export function buildProjectCiteDescription(input: {
  title: string;
  description?: string | null;
  category?: string | null;
  classification?: PublicClassification | null;
}): string {
  const title = input.title.trim();
  const kind = projectKindLabel(input.category);
  const age = compactAgeLabel(input.classification);
  const lead = age ? `${title}是适合${age}的${kind}。` : `${title}是${kind}。`;
  const body = (input.description ?? "").replace(/\s+/g, " ").trim();
  const combined = body && !body.startsWith(lead) ? `${lead}${body}` : lead;
  if (combined.length <= DESCRIPTION_MAX) return combined;
  return `${combined.slice(0, DESCRIPTION_MAX - 1)}…`;
}

export function buildProjectCiteKeywords(input: {
  title: string;
  category?: string | null;
  subCategory?: string | null;
  tags?: string[] | null;
}): string[] {
  const extras = input.category === "科学" ? ["科学小实验", "科学实验"] : [];
  return Array.from(
    new Set(
      [input.title, input.category, input.subCategory, ...(input.tags ?? []), ...extras, "STEAM项目"]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}
