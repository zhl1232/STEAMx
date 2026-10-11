/**
 * Deterministic, data-only copy for project detail pages whose stored summary is
 * an import placeholder (e.g. 「材料与步骤见正文。」). Nothing here invents facts:
 * every clause is assembled from real project fields (title, category,
 * classification, materials, steps, video presence).
 */
import type { PublicClassification } from "@/lib/content-classification/types";
import { getMaterialMeta } from "@/lib/project/material-meta";
import { projectKindLabel } from "@/lib/seo/project-citability";

export const PROJECT_SEO_DESCRIPTION_MAX = 150;
const PROJECT_SEO_DESCRIPTION_MIN = 80;

/** Whole-summary placeholders written by importers instead of real copy. */
const PLACEHOLDER_DESCRIPTION_RES: RegExp[] = [
  /^材料与步骤见正文[。.!！]?$/u,
  /^(?:材料|步骤|内容|详情|说明)?见(?:正文|视频|下文|详情|实验说明)[。.!！]?$/u,
  /^物理探索\s*木质科技制作$/u,
  /^木质科学$/u,
  /^暂无(?:简介|描述|介绍)[。.!！]?$/u,
];

const PLACEHOLDER_STEP_RES: RegExp[] = [
  /^见视频[。.!！]?$/u,
  /^请准备好对应实验材料包，?跟随本页视频完成操作[。.!！]?$/u,
];
const PLACEHOLDER_STEP_TITLE_RES: RegExp[] = [/^见视频$/u, /^观看实验视频$/u, /^步骤\s*\d+$/u];
const PLACEHOLDER_MATERIAL_RES: RegExp[] = [/^[（(]?见实验说明[）)]?$/u];

function normalize(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function stripTitleParens(title: string): string {
  return title.replace(/[（(][^）)]*[）)]/gu, "").trim();
}

/**
 * True when the stored description carries no information beyond the title:
 * empty, a known importer placeholder, or just the title / a short series label.
 */
export function isPlaceholderProjectDescription(
  description: string | null | undefined,
  title?: string | null,
): boolean {
  const text = normalize(description);
  if (!text) return true;
  if (PLACEHOLDER_DESCRIPTION_RES.some((re) => re.test(text))) return true;
  const plainTitle = normalize(title);
  if (plainTitle && (text === plainTitle || text === stripTitleParens(plainTitle))) return true;
  return false;
}

export function isPlaceholderProjectStep(step: { title?: string | null; description?: string | null }): boolean {
  const description = normalize(step.description);
  if (description && !PLACEHOLDER_STEP_RES.some((re) => re.test(description))) return false;
  const title = normalize(step.title);
  return !title || PLACEHOLDER_STEP_TITLE_RES.some((re) => re.test(title)) || Boolean(description);
}

export interface ProjectSeoInput {
  title: string;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  classification?: PublicClassification | null;
  tags?: string[] | null;
  materials?: string[] | null;
  steps?: Array<{ title?: string | null; description?: string | null }> | null;
  hasVideo?: boolean;
}

function joinList(items: string[], max: number): string {
  const shown = items.slice(0, max);
  return items.length > max ? `${shown.join("、")}等` : shown.join("、");
}

function materialNames(materials: string[] | null | undefined): string[] {
  const names: string[] = [];
  for (const material of materials ?? []) {
    const raw = normalize(material);
    if (!raw || PLACEHOLDER_MATERIAL_RES.some((re) => re.test(raw))) continue;
    const name = getMaterialMeta(raw).name.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

function realSteps(steps: ProjectSeoInput["steps"]) {
  return (steps ?? []).filter((step) => !isPlaceholderProjectStep(step));
}

function stepTitles(steps: ProjectSeoInput["steps"]): string[] {
  return realSteps(steps)
    .map((step) => normalize(step.title))
    .filter((title) => title && !PLACEHOLDER_STEP_TITLE_RES.some((re) => re.test(title)));
}

function classificationClause(classification?: PublicClassification | null): string {
  if (!classification || classification.status !== "reviewed") return "";
  return [
    classification.ageLabel ? `适合${classification.ageLabel.replace(/\s+/g, "")}` : "",
    classification.difficultyLabel ? `难度${classification.difficultyLabel}` : "",
    classification.supportLabel || "",
  ].filter(Boolean).join("，");
}

function projectTopicLabel(input: ProjectSeoInput): string {
  return [input.category, input.subCategory].map((v) => normalize(v)).filter(Boolean).join("·");
}

/** Cut at a sentence boundary when possible so descriptions don't end mid-clause. */
export function clampChineseDescription(text: string, max = PROJECT_SEO_DESCRIPTION_MAX): string {
  const value = normalize(text);
  if (value.length <= max) return value;
  const slice = value.slice(0, max);
  const boundary = Math.max(slice.lastIndexOf("。"), slice.lastIndexOf("；"), slice.lastIndexOf("！"));
  if (boundary >= Math.floor(max * 0.6)) return slice.slice(0, boundary + 1);
  return `${value.slice(0, max - 1)}…`;
}

/**
 * Visible intro paragraph (also the meta-description source) for a project page.
 * Always unique per project because it leads with the title and lists the
 * project's own materials / step titles.
 */
export function buildProjectOverviewText(input: ProjectSeoInput): string {
  const title = normalize(input.title);
  const kind = projectKindLabel(input.category);
  const topic = projectTopicLabel(input);
  const traits = classificationClause(input.classification);
  const sentences: string[] = [];

  sentences.push(`《${title}》是创探空间${topic ? `「${topic}」分类下` : ""}的${kind}${traits ? `，${traits}` : ""}。`);

  const titles = stepTitles(input.steps);
  const steps = realSteps(input.steps);
  if (titles.length) {
    sentences.push(`共 ${steps.length} 个步骤：${joinList(titles, 6)}。`);
  } else if (steps.length) {
    const firstStep = normalize(steps[0].description);
    if (firstStep) sentences.push(`第一步：${clampChineseDescription(firstStep, 60)}`.replace(/([^。！？…])$/u, "$1。"));
  }

  const names = materialNames(input.materials);
  if (names.length) sentences.push(`需要准备${names.length > 1 ? ` ${names.length} 种材料：` : ""}${joinList(names, 6)}。`);

  if (input.hasVideo) sentences.push("页面附实验演示视频，可边看边做。");

  return sentences.join("");
}

/**
 * Meta description (~80–150 chars). Real summaries keep the existing
 * `lead + reflection/body` copy and are topped up with materials / steps when
 * short; placeholder summaries are replaced by the overview text.
 */
export function buildProjectSeoDescription(input: ProjectSeoInput & { citeDescription: string }): string {
  if (isPlaceholderProjectDescription(input.description, input.title)) {
    return clampChineseDescription(buildProjectOverviewText(input));
  }
  let text = normalize(input.citeDescription);
  if (text.length < PROJECT_SEO_DESCRIPTION_MIN) {
    const titles = stepTitles(input.steps);
    const names = materialNames(input.materials);
    const extras = [
      titles.length ? `共 ${realSteps(input.steps).length} 步：${joinList(titles, 4)}。` : "",
      names.length ? `材料：${joinList(names, 4)}。` : "",
    ].filter(Boolean).join("");
    if (extras) text = `${text.replace(/…$/u, "")}${/[。！？]$/u.test(text) ? "" : "。"}${extras}`;
  }
  return clampChineseDescription(text);
}
