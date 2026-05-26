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
}

const TOPIC_COPY: Record<ObservationSubmitTopic, ObservationSubmitTopicCopy> = {
  birds: {
    label: '鸟类',
    subjectUnit: '一只鸟',
    photoStepDescription: '鸟类专题记录会由 AI 尝试鉴定，照片越清晰越容易识别。',
    photoSubjectHint: '每条记录只对应一只鸟；上传多张照片时，请确保都是同一个观察对象。',
    noCandidateMessage: '当前图片没有匹配到可靠的鸟类候选。你仍可手动提交鉴定，或发布为待鉴定。',
  },
  plants: {
    label: '树木',
    subjectUnit: '一棵树',
    photoStepDescription: '树木专题记录会由 AI 尝试鉴定，请拍清叶、树皮或花果特征。',
    photoSubjectHint: '每条记录只对应一棵树；上传多张照片时，请确保都是同一个观察对象。',
    noCandidateMessage: '当前图片没有匹配到可靠的树木候选。你仍可手动提交鉴定，或发布为待鉴定。',
  },
  insects: {
    label: '昆虫',
    subjectUnit: '一只昆虫',
    photoStepDescription: '昆虫专题记录会由 AI 尝试鉴定，请尽量拍清翅纹、体色和体型特征。',
    photoSubjectHint: '每条记录只对应一只昆虫；上传多张照片时，请确保都是同一个观察对象。',
    noCandidateMessage: '当前图片没有匹配到可靠的昆虫候选。你仍可手动提交鉴定，或发布为待鉴定。',
  },
}

export function getObservationSubmitTopicCopy(topic: ObservationSubmitTopic): ObservationSubmitTopicCopy {
  return TOPIC_COPY[topic]
}
