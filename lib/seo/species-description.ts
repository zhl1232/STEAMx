/**
 * Deterministic species-page copy assembled only from stored species fields
 * (names, taxonomy, notes, public observation stats). No invented facts.
 */
import { natureTopicLabels, type NatureTopicKey } from "@/lib/config/nature-topics";
import { clampChineseDescription } from "@/lib/seo/project-description";

export interface SpeciesSeoInput {
  commonName: string;
  scientificName?: string | null;
  aliases?: string[] | null;
  taxonGroup?: string | null;
  topicKey?: NatureTopicKey | null;
  identificationNotes?: string | null;
  habitatNotes?: string | null;
  seasonalityNotes?: string | null;
  stats?: { totalObservationCount: number; latestObservedAt: string | null } | null;
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function ensurePeriod(text: string): string {
  return /[。！？…]$/u.test(text) ? text : `${text}。`;
}

function topicLabel(topicKey?: NatureTopicKey | null): string {
  return topicKey ? natureTopicLabels[topicKey] ?? "" : "";
}

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatObservedDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
}

/** `凹背臭斑金龟（Osmoderma barnabita），鞘翅目 金龟科昆虫。` */
function speciesLead(input: SpeciesSeoInput): string {
  const name = clean(input.commonName);
  const latin = clean(input.scientificName);
  const taxon = clean(input.taxonGroup);
  const kind = topicLabel(input.topicKey);
  const head = latin ? `${name}（${latin}）` : name;
  const tail = [taxon, kind].filter(Boolean).join("");
  return tail ? `${head}，${tail}。` : `${head}。`;
}

/** Meta description (~80–150 chars): names + taxonomy lead, then identification / habitat / season notes. */
export function buildSpeciesSeoDescription(input: SpeciesSeoInput): string {
  const notes = [input.identificationNotes, input.habitatNotes, input.seasonalityNotes]
    .map(clean)
    .filter(Boolean)
    .map(ensurePeriod);
  const body = notes.join("");
  const text = body
    ? `${speciesLead(input)}${body}`
    : `${speciesLead(input)}物种档案，包含识别特征、常见环境和近期观察线索。`;
  return clampChineseDescription(text, 150);
}

/** Visible intro paragraph for the species page. */
export function buildSpeciesIntroText(input: SpeciesSeoInput & { archiveLabel: string }): string {
  const name = clean(input.commonName);
  const latin = clean(input.scientificName);
  const taxon = clean(input.taxonGroup);
  const aliases = (input.aliases ?? []).map(clean).filter(Boolean);
  const sentences: string[] = [];

  sentences.push(`${name}${latin ? `（学名 ${latin}）` : ""}是创探空间${input.archiveLabel}收录的物种${taxon ? `，分类上属于${taxon}` : ""}。`);
  if (aliases.length) sentences.push(`别名：${aliases.slice(0, 4).join("、")}。`);

  const season = clean(input.seasonalityNotes);
  if (season) sentences.push(`常见时段：${ensurePeriod(season)}`);

  const total = input.stats?.totalObservationCount ?? 0;
  if (total > 0) {
    const latest = formatObservedDate(input.stats?.latestObservedAt);
    sentences.push(`社区已记录 ${total} 条公开观察${latest ? `，最近一次在 ${latest}` : ""}。`);
  } else {
    sentences.push("社区暂无公开观察记录，欢迎提交第一条观察。");
  }

  return sentences.join("");
}
