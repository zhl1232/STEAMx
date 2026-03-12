import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, handleApiError } from "@/lib/api/auth";
import { callRpc } from "@/lib/supabase/rpc";

/**
 * POST /api/replies/[id]/like
 * 点赞/取消点赞讨论回复
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;
  const replyId = Number.parseInt(id, 10);
  if (Number.isNaN(replyId)) {
    return NextResponse.json({ error: "Invalid reply id" }, { status: 400 });
  }

  try {
    const user = await requireAuth(supabase);

    const { data: existingLike, error: existingLikeError } = await supabase
      .from("discussion_reply_likes")
      .select("reply_id")
      .eq("user_id", user.id)
      .eq("reply_id", replyId)
      .maybeSingle();

    if (existingLikeError) throw existingLikeError;

    if (existingLike) {
      const { data: deletedRows, error: deleteError } = await supabase
        .from("discussion_reply_likes")
        .delete()
        .eq("user_id", user.id)
        .eq("reply_id", replyId)
        .select("reply_id");

      if (deleteError) throw deleteError;

      if (deletedRows && deletedRows.length > 0) {
        await callRpc(supabase, "decrement_discussion_reply_likes", { reply_id: replyId });
      }

      return NextResponse.json({ liked: false, action: "unliked" });
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from("discussion_reply_likes")
      .insert({ user_id: user.id, reply_id: replyId } as never)
      .select("reply_id");

    if (insertError) {
      if ((insertError as { code?: string }).code === "23505") {
        return NextResponse.json({ liked: true, action: "liked" });
      }
      throw insertError;
    }

    if (insertedRows && insertedRows.length > 0) {
      await callRpc(supabase, "increment_discussion_reply_likes", { reply_id: replyId });
    }

    return NextResponse.json({ liked: true, action: "liked" });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/replies/[id]/like
 * 检查当前用户是否已点赞
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;
  const replyId = Number.parseInt(id, 10);
  if (Number.isNaN(replyId)) {
    return NextResponse.json({ error: "Invalid reply id" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ liked: false });
  }

  const { data, error } = await supabase
    .from("discussion_reply_likes")
    .select("reply_id")
    .eq("user_id", user.id)
    .eq("reply_id", replyId)
    .maybeSingle();

  if (error) {
    return handleApiError(error);
  }

  return NextResponse.json({ liked: !!data });
}
