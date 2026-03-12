/**
 * 评论区图片上传工具
 * 上传评论附图至 Supabase Storage 的 comment-images bucket
 */
import { createClient } from "@/lib/supabase/client";

const BUCKET = "comment-images";
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export class CommentImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentImageError";
  }
}

/**
 * 上传评论附图
 * @returns 返回图片公开 URL
 */
export async function uploadCommentImage(
  file: File,
  userId: string
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new CommentImageError("仅支持 JPG、PNG、WebP、GIF 格式");
  }
  if (file.size > MAX_SIZE) {
    throw new CommentImageError("图片大小不能超过 2MB");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).upload(fileName, file);

  if (error) {
    console.error("Upload comment image error:", error);
    throw new CommentImageError("图片上传失败，请重试");
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}
