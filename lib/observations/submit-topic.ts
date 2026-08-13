import type { NatureTopicKey } from '@/lib/config/nature-topics'

export const observationSubmitTopicKeys = ['birds', 'plants', 'insects'] as const
export type ObservationSubmitTopic = (typeof observationSubmitTopicKeys)[number]

export function isObservationSubmitTopic(value: string | null | undefined): value is ObservationSubmitTopic {
  return observationSubmitTopicKeys.includes(value as ObservationSubmitTopic)
}

export function normalizeObservationSubmitTopic(value: string | null | undefined): ObservationSubmitTopic {
  if (isObservationSubmitTopic(value)) {
    return value
  }
  return 'birds'
}

export function observationSubmitTopicFromNatureTopic(
  natureTopic: NatureTopicKey | null | undefined,
): ObservationSubmitTopic {
  if (natureTopic === 'plants' || natureTopic === 'insects') {
    return natureTopic
  }
  return 'birds'
}

export interface ObservationSubmitTopicCopy {
  label: string
  subjectUnit: string
  photoStepDescription: string
  photoSubjectHint: string
  noCandidateMessage: string
  notesPlaceholder: string
  protectionTip: string
  analyzingMessage: string
}

const TOPIC_COPY: Record<ObservationSubmitTopic, ObservationSubmitTopicCopy> = {
  birds: {
    label: '鸟类',
    subjectUnit: '一只鸟',
    photoStepDescription: '鸟类专题记录会由 AI 尝试鉴定，照片越清晰越容易识别。',
    photoSubjectHint: '每张照片会单独成为一条观察，可以分别鉴定和标注性别。',
    noCandidateMessage: '当前图片没有匹配到可靠的鸟类候选。你仍可手动提交鉴定，或发布为待鉴定。',
    notesPlaceholder: '清晨在绿堤水域发现一只白鹭，站在浅水中觅食，时而低头捕食小鱼，时而展翅飞起。',
    protectionTip: '保持安全距离，不投喂、不追赶野生鸟类。',
    analyzingMessage: '正在分析图片质量，并尝试匹配鸟类候选。',
  },
  plants: {
    label: '植物',
    subjectUnit: '一株植物',
    photoStepDescription: '植物专题记录会由 AI 尝试鉴定，请拍清叶、茎、花、果或种子特征。',
    photoSubjectHint: '每张照片会单独成为一条观察，可以分别鉴定和标注性别。',
    noCandidateMessage: '当前图片没有匹配到可靠的植物候选。你仍可手动提交鉴定，或发布为待鉴定。',
    notesPlaceholder: '校园西侧林缘看到一棵正在开花的紫荆，枝条贴满淡紫色花朵，地上落瓣点点。',
    protectionTip: '不采摘花果、不剥皮、不踩踏，保护植物群落。',
    analyzingMessage: '正在分析图片质量，并尝试匹配植物候选。',
  },
  insects: {
    label: '昆虫',
    subjectUnit: '一只昆虫',
    photoStepDescription: '昆虫专题记录会由 AI 尝试鉴定，请尽量拍清翅纹、体色和体型特征。',
    photoSubjectHint: '每张照片会单独成为一条观察，可以分别鉴定和标注性别。',
    noCandidateMessage: '当前图片没有匹配到可靠的昆虫候选。你仍可手动提交鉴定，或发布为待鉴定。',
    notesPlaceholder: '傍晚在草坪边缘看到一只豆娘停在禾本叶尖，翅膀缓缓开合，体色偏蓝。',
    protectionTip: '观察后请放归原处，不捕捉、不伤害昆虫。',
    analyzingMessage: '正在分析图片质量，并尝试匹配昆虫候选。',
  },
}

export function getObservationSubmitTopicCopy(topic: ObservationSubmitTopic): ObservationSubmitTopicCopy {
  return TOPIC_COPY[topic]
}
