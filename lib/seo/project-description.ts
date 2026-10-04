/**
 * Select factual copy for project metadata and the visible project intro.
 * Import placeholders and generic step instructions are intentionally omitted.
 */
import {
  formatProjectDescriptionForDisplay,
  formatProjectReflectionForDisplay,
  formatProjectStepDescriptionForDisplay,
} from "@/lib/project/presentation";

export const PROJECT_SEO_DESCRIPTION_MAX = 150;

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

function normalize(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function stripTitleParens(title: string): string {
  return title.replace(/[（(][^）)]*[）)]/gu, "").trim();
}

/** True for empty, importer placeholder, and title-only descriptions. */
export function isPlaceholderProjectDescription(
  description: string | null | undefined,
  title?: string | null,
): boolean {
  const text = normalize(formatProjectDescriptionForDisplay(description, { hasVideoPlayer: true }));
  if (!text) return true;
  if (PLACEHOLDER_DESCRIPTION_RES.some((re) => re.test(text))) return true;
  const plainTitle = normalize(title);
  if (plainTitle && (text === plainTitle || text === stripTitleParens(plainTitle))) return true;
  return false;
}

export function isPlaceholderProjectStep(step: { title?: string | null; description?: string | null }): boolean {
  const description = normalize(step.description);
  if (
    description
    && !PLACEHOLDER_STEP_RES.some((re) => re.test(description))
    && !PLACEHOLDER_DESCRIPTION_RES.some((re) => re.test(description))
  ) return false;
  const title = normalize(step.title);
  return !title || PLACEHOLDER_STEP_TITLE_RES.some((re) => re.test(title)) || Boolean(description);
}

export interface ProjectSeoInput {
  title: string;
  description?: string | null;
  reflection?: string | null;
  steps?: Array<{ title?: string | null; description?: string | null }> | null;
  hasVideo?: boolean;
}

function realStepDescription(steps: ProjectSeoInput["steps"]): string {
  for (const step of steps ?? []) {
    const description = normalize(formatProjectStepDescriptionForDisplay(step.description, { hasVideoPlayer: true }));
    if (!description || isPlaceholderProjectStep({ ...step, description })) continue;
    return description;
  }
  return "";
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

/** Pick only stored project copy; short factual descriptions are kept as-is. */
export function buildProjectSeoDescription(input: ProjectSeoInput): string {
  const title = normalize(input.title);
  const description = normalize(formatProjectDescriptionForDisplay(input.description, { hasVideoPlayer: true }));
  const reflection = normalize(formatProjectReflectionForDisplay(input.reflection));
  const usableReflection = !isPlaceholderProjectDescription(reflection) ? reflection : "";
  const text = !isPlaceholderProjectDescription(description, title)
    ? description
    : usableReflection
      ? usableReflection
      : realStepDescription(input.steps);

  if (text) return clampChineseDescription(text);
  if (input.hasVideo) return clampChineseDescription(`${title}，页面提供演示视频。`);
  return clampChineseDescription(title);
}
