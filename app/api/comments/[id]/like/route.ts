import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, handleApiError } from "@/lib/api/auth";
import { callRpc } from "@/lib/supabase/rpc";

/**
 * POST /api/comments/[id]/like
 * 点赞/取消点赞评论
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;
  const commentId = Number.parseInt(id, 10);
  if (Number.isNaN(commentId)) {
    return NextResponse.json({ error: "Invalid comment id" }, { status: 400 });
  }

  try {
    const user = await requireAuth(supabase);

    const { data: existingLike, error: existingLikeError } = await supabase
      .from("comment_likes")
      .select("comment_id")
      .eq("user_id", user.id)
      .eq("comment_id", commentId)
      .maybeSingle();

    if (existingLikeError) throw existingLikeError;

    if (existingLike) {
      const { data: deletedRows, error: deleteError } = await supabase
        .from("comment_likes")
        .delete()
        .eq("user_id", user.id)
        .eq("comment_id", commentId)
        .select("comment_id");

      if (deleteError) throw deleteError;

      if (deletedRows && deletedRows.length > 0) {
        await callRpc(supabase, "decrement_comment_likes", { comment_id: commentId });
      }

      return NextResponse.json({ liked: false, action: "unliked" });
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from("comment_likes")
      .insert({ user_id: user.id, comment_id: commentId } as never)
      .select("comment_id");

    if (insertError) {
      if ((insertError as { code?: string }).code === "23505") {
        return NextResponse.json({ liked: true, action: "liked" });
      }
      throw insertError;
    }

    if (insertedRows && insertedRows.length > 0) {
      await callRpc(supabase, "increment_comment_likes", { comment_id: commentId });
    }

    return NextResponse.json({ liked: true, action: "liked" });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/comments/[id]/like
 * 检查当前用户是否已点赞
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;
  const commentId = Number.parseInt(id, 10);
  if (Number.isNaN(commentId)) {
    return NextResponse.json({ error: "Invalid comment id" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ liked: false });
  }

  const { data, error } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("user_id", user.id)
    .eq("comment_id", commentId)
    .maybeSingle();

  if (error) {
    return handleApiError(error);
  }

  return NextResponse.json({ liked: !!data });
}
