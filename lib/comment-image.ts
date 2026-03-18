/**
 * 评论区图片上传工具
 * 通过 /api/upload 服务端 API 上传评论附图
 */

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
  _userId: string
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new CommentImageError("仅支持 JPG、PNG、WebP、GIF 格式");
  }
  if (file.size > MAX_SIZE) {
    throw new CommentImageError("图片大小不能超过 2MB");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", BUCKET);

  const res = await fetch("/api/upload", { method: "POST", body: formData });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new CommentImageError(data?.error || "图片上传失败，请重试");
  }

  const data = await res.json();
  if (!data.publicUrl) {
    throw new CommentImageError("图片上传失败，请重试");
  }

  return data.publicUrl;
}
