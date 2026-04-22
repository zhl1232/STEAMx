import { pinyin } from "pinyin-pro";

const HANZI_REGEX = /[\u3400-\u9fff]/;

export function toSpeciesPinyinLabel(text?: string | null): string | null {
  if (!text) return null;
  const normalized = text.trim();
  if (!normalized || !HANZI_REGEX.test(normalized)) return null;
  return pinyin(normalized).replace(/\s+/g, " ").trim();
}

export function splitTaxonGroup(taxonGroup?: string | null): { family: string | null; genus: string | null } {
  if (!taxonGroup) {
    return { family: null, genus: null };
  }

  const chunks = taxonGroup
    .split(/[\s/、]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  let family = chunks.find((item) => item.endsWith("科")) ?? null;
  let genus = chunks.find((item) => item.endsWith("属")) ?? null;

  if (!family && chunks.length > 0) family = chunks[0];
  if (!genus && chunks.length > 1) genus = chunks[1];

  return { family, genus };
}
