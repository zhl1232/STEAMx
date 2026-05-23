import type { Comment } from "@/lib/mappers/types";

/**
 * 某条回复下的全部回复（含多级），平铺列表
 */
export function getRepliesUnderRoot(
  replies: Comment[],
  rootId: number | string
): Comment[] {
  const rid = Number(rootId);
  if (Number.isNaN(rid)) return [];
  const byParent = new Map<number, Comment[]>();
  for (const r of replies) {
    if (r.parent_id == null) continue;
    const pid = Number(r.parent_id);
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(r);
  }
  const result: Comment[] = [];
  const queue = [rid];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const children = byParent.get(id) || [];
    // 同一父节点下按时间倒序（新的在前），避免因全局 replies 顺序导致旧回复排前面
    const sorted = [...children].sort((a, b) => {
      const t1 = a.created_at ?? "";
      const t2 = b.created_at ?? "";
      return t2.localeCompare(t1);
    });
    for (const child of sorted) {
      result.push(child);
      queue.push(Number(child.id));
    }
  }
  return result;
}
