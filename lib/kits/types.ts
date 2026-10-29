export type ExperimentKit = {
  localPreview?: boolean;
  id: string; slug: string; name: string; kind: 'material_pack' | 'general_materials';
  revision: number; edit_version?: number; status: 'draft' | 'published'; cover_url: string | null;
  gallery_urls: string[]; materials: string[]; catalog: string[]; preparation_note: string;
}
export type KitProjectRelation = {
  kit_id: string; project_id: number; status: 'candidate' | 'confirmed' | 'excluded';
  preparation_status: 'unknown' | 'ready' | 'extras'; extras: string[];
  project_hash: string | null; kit_revision: number; sort_order: number;
}
export const KIT_MATERIAL_NOTICE = '器材可重复使用，耗材用完后需补充。实验目录列出适用实验，不表示一套材料能将全部实验各完成一次。请按单次用量取用并妥善保存，水、鸡蛋、盐等日常材料按项目清单自备。'
