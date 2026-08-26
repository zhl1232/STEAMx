export const SAFETY_KEYWORDS = [
  "剪刀",
  "针",
  "刀",
  "切割",
  "裁纸",
  "热熔胶",
  "胶枪",
  "火",
  "热源",
  "烙铁",
  "电源",
  "插座",
  "化学品",
  "玻璃",
  "重物",
  "高处",
  "钻孔",
  "砂纸",
];

const HIGH_RISK_KEYWORDS = new Set([
  "刀",
  "切割",
  "热熔胶",
  "胶枪",
  "火",
  "热源",
  "烙铁",
  "电源",
  "插座",
  "化学品",
  "玻璃",
  "重物",
  "高处",
  "钻孔",
]);

const AGE_LABELS = {
  小班: 3,
  中班: 4,
  大班: 5,
};

const PRESCHOOL_TARGETING_PATTERN = /学前|幼儿园|幼儿启蒙|幼儿/i;
const PRIMARY_TARGETING_PATTERN = /小学|小学生|儿童/i;
const JUNIOR_TARGETING_PATTERN = /初中|初中生/i;
const SENIOR_TARGETING_PATTERN = /高中|高中生/i;
const PROGRAMMING_PATTERN = /scratch|少儿编程|图形化编程|积木编程|编程|程序设计|代码/i;
const ADVANCED_PROGRAMMING_PATTERN = /python|javascript|typescript|c\+\+|算法|数据结构|变量|函数|调试|坐标系|传感器/i;
const STRATEGY_PATTERN = /五子棋|围棋|象棋|棋类|博弈|策略|战术|概率/i;
const COMPLEX_CONCEPT_PATTERN = /算法|数据结构|变量|函数|原型|迭代|优化|策略|博弈|概率|坐标系|工程设计|承重|约束条件/i;
const HANDS_ON_ACTIVITY_PATTERN = /积木|搭建|拼搭|手工|模型|实验|观察|制作|小车|桥|高塔/i;

function countStructuredItems(value, depth = 0) {
  if (depth > 3 || value === null || value === undefined) return 0;
  if (Array.isArray(value)) return value.length;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return 0;
    try {
      return countStructuredItems(JSON.parse(trimmed), depth + 1);
    } catch {
      return 0;
    }
  }

  if (typeof value !== "object") return 0;
  for (const key of ["items", "steps", "lessons", "stages", "activities", "challenges", "tasks"]) {
    const count = countStructuredItems(value[key], depth + 1);
    if (count > 0) return count;
  }
  return 0;
}

function inferHeuristicRecommendedMinAge(source, text) {
  const titleAndTags = [source.title, ...(source.tags || [])].filter(Boolean).join("\n");

  if (SENIOR_TARGETING_PATTERN.test(titleAndTags)) return { age: 15, rule: "heuristic_senior_targeting_age" };
  if (JUNIOR_TARGETING_PATTERN.test(titleAndTags)) return { age: 12, rule: "heuristic_junior_targeting_age" };
  if (PRESCHOOL_TARGETING_PATTERN.test(titleAndTags)) return { age: 4, rule: "heuristic_preschool_targeting_age" };
  if (PRIMARY_TARGETING_PATTERN.test(titleAndTags)) return { age: 6, rule: "heuristic_primary_targeting_age" };

  if (PROGRAMMING_PATTERN.test(text)) {
    const advanced = ADVANCED_PROGRAMMING_PATTERN.test(text) && !/入门|启蒙|基础/i.test(titleAndTags);
    return advanced
      ? { age: 8, rule: "heuristic_programming_concepts_age" }
      : { age: 6, rule: "heuristic_programming_age" };
  }

  if (STRATEGY_PATTERN.test(text)) return { age: 8, rule: "heuristic_strategy_age" };

  const stepCount = Math.max(countStructuredItems(source.steps), countStructuredItems(source.project_steps));
  const lessonCount = countStructuredItems(source.course_lessons);
  const stageCount = countStructuredItems(source.stages);
  const materialCount = Math.max(countStructuredItems(source.materials), countStructuredItems(source.project_materials));
  const hasComplexStructure = stepCount >= 10
    || lessonCount >= 10
    || stageCount >= 4
    || materialCount >= 12
    || (stepCount >= 6 && materialCount >= 6)
    || (stageCount >= 3 && materialCount >= 6);

  if (COMPLEX_CONCEPT_PATTERN.test(text) || hasComplexStructure) {
    return { age: 8, rule: "heuristic_structure_age" };
  }

  const hasModerateStructure = stepCount >= 6 || lessonCount >= 6 || stageCount >= 3 || materialCount >= 8;
  if (hasModerateStructure) return { age: 7, rule: "heuristic_structure_age" };
  if (stepCount > 0 || lessonCount > 0 || stageCount > 0 || materialCount > 0 || HANDS_ON_ACTIVITY_PATTERN.test(text)) {
    return { age: 6, rule: "heuristic_activity_age" };
  }

  return null;
}

export function mapDifficultyStars(stars) {
  if (!Number.isInteger(stars) || stars < 1 || stars > 6) return null;
  if (stars <= 2) return "beginner";
  if (stars <= 4) return "intermediate";
  return "challenge";
}

export function mapLegacyDifficulty(value) {
  switch (typeof value === "string" ? value.trim().toLowerCase() : "") {
    case "easy":
    case "beginner":
      return "beginner";
    case "medium":
    case "intermediate":
      return "intermediate";
    case "hard":
    case "challenge":
      return "challenge";
    default:
      return null;
  }
}

export function findSafetyKeywords(text) {
  const available = [...SAFETY_KEYWORDS]
    .sort((left, right) => right.length - left.length)
    .filter((keyword) => text.includes(keyword));
  const matched = new Set(
    available.filter((keyword) => !available.some((longer) => longer !== keyword && longer.includes(keyword))),
  );
  return SAFETY_KEYWORDS.filter((keyword) => matched.has(keyword));
}

function collectText(row) {
  const pieces = [
    row.title,
    row.description,
    row.scenario,
    row.driving_question,
    row.expected_outcome,
    row.tags,
    row.materials,
    row.constraints,
    row.resources,
    row.stages,
    row.steps,
    row.project_materials,
    row.project_steps,
    row.course_lessons,
  ];

  const flatten = (value, depth = 0) => {
    if (depth > 6 || value === null || value === undefined) return [];
    if (typeof value === "string") return value.trim() ? [value] : [];
    if (typeof value === "number" || typeof value === "boolean") return [String(value)];
    if (Array.isArray(value)) return value.flatMap((item) => flatten(item, depth + 1));
    if (typeof value === "object") {
      return Object.values(value).flatMap((item) => flatten(item, depth + 1));
    }
    return [];
  };

  return pieces.flatMap((piece) => flatten(piece)).join("\n");
}

export function extractRecommendedMinAge(text) {
  const explicitAge = text.match(/(?:^|[^\d])(3|4|5|6|7|8|9|10|11|12|13|14|15|16)\s*\+\s*(?:岁|$|[^\d])/i);
  if (explicitAge) return { age: Number(explicitAge[1]), rule: "explicit_age_plus" };

  const ageStart = text.match(/(?:适合|推荐|建议|从)\s*(3|4|5|6|7|8|9|10|11|12|13|14|15|16)\s*岁/i);
  if (ageStart) return { age: Number(ageStart[1]), rule: "explicit_starting_age" };

  for (const [label, age] of Object.entries(AGE_LABELS)) {
    if (text.includes(label)) return { age, rule: `${label}_age` };
  }

  return { age: null, rule: null };
}

export function buildCandidate(row) {
  const text = collectText(row);
  const matchedRules = [];
  const explicitAgeResult = extractRecommendedMinAge(text);
  const heuristicAgeResult = explicitAgeResult.age === null
    ? inferHeuristicRecommendedMinAge(row, text)
    : null;
  const ageResult = explicitAgeResult.age === null ? (heuristicAgeResult || explicitAgeResult) : explicitAgeResult;
  if (ageResult.rule) matchedRules.push(ageResult.rule);

  const difficultyBand = mapDifficultyStars(row.difficulty_stars) || mapLegacyDifficulty(row.difficulty);
  if (mapDifficultyStars(row.difficulty_stars)) matchedRules.push("difficulty_stars_band");
  else if (difficultyBand) matchedRules.push("legacy_difficulty_band_needs_star_confirmation");

  const safetyKeywords = findSafetyKeywords(text);
  if (safetyKeywords.length) matchedRules.push("safety_keyword_priority");

  const supportLevel = safetyKeywords.some((keyword) => HIGH_RISK_KEYWORDS.has(keyword))
    ? "adult_required"
    : safetyKeywords.length
      ? "guided"
      : null;
  if (supportLevel) matchedRules.push(`safety_support_candidate_${supportLevel}`);

  const validAge = Number.isInteger(ageResult.age) && ageResult.age >= 3 && ageResult.age <= 16;
  const validStars = mapDifficultyStars(row.difficulty_stars) !== null;

  return {
    recommendedMinAge: validAge ? ageResult.age : null,
    recommendedMaxAge: null,
    supportLevel,
    difficultyStars: validStars ? row.difficulty_stars : null,
    difficultyBand,
    source: "rules_v1",
    status: "unreviewed",
    confidence: explicitAgeResult.age !== null && validAge && validStars ? "high" : validAge || validStars ? "medium" : "low",
    matchedRules,
    safetyKeywords,
  };
}

export function rowToCandidateSource(row) {
  return {
    title: row.title,
    description: row.description,
    scenario: row.scenario,
    driving_question: row.driving_question,
    expected_outcome: row.expected_outcome,
    tags: row.tags,
    materials: row.materials,
    constraints: row.constraints,
    resources: row.resources,
    stages: row.stages,
    steps: row.steps,
    project_materials: row.project_materials,
    project_steps: row.project_steps,
    course_lessons: row.course_lessons,
    difficulty_stars: row.difficulty_stars,
    difficulty: row.difficulty,
  };
}
