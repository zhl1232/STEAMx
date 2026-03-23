import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, handleApiError } from "@/lib/api/auth";
import { callRpc } from "@/lib/supabase/rpc";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await params;
  const discussionId = Number.parseInt(id, 10);
  if (Number.isNaN(discussionId)) {
    return NextResponse.json({ error: "Invalid discussion id" }, { status: 400 });
  }

  try {
    const user = await requireAuth(supabase);

    const { data: discussionRow, error: discussionError } = await supabase
      .from("discussions")
      .select("author_id")
      .eq("id", discussionId)
      .maybeSingle();
    if (discussionError) throw discussionError;
    if (!discussionRow) {
      return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
    }
    if ((discussionRow as { author_id: string }).author_id === user.id) {
      return NextResponse.json({ error: "不能给自己的讨论点赞" }, { status: 403 });
    }

    const { data: existingLike, error: existingLikeError } = await supabase
      .from("discussion_likes")
      .select("discussion_id")
      .eq("user_id", user.id)
      .eq("discussion_id", discussionId)
      .maybeSingle();

    if (existingLikeError) throw existingLikeError;

    if (existingLike) {
      const { data: deletedRows, error: deleteError } = await supabase
        .from("discussion_likes")
        .delete()
        .eq("user_id", user.id)
        .eq("discussion_id", discussionId)
        .select("discussion_id");

      if (deleteError) throw deleteError;

      if (deletedRows && deletedRows.length > 0) {
        const { error: rpcError } = await callRpc(supabase, "decrement_discussion_likes", { discussion_id: discussionId });
        if (rpcError) throw rpcError;
      }

      return NextResponse.json({ liked: false, action: "unliked" });
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from("discussion_likes")
      .insert({ user_id: user.id, discussion_id: discussionId } as never)
      .select("discussion_id");

    if (insertError) {
      if ((insertError as { code?: string }).code === "23505") {
        return NextResponse.json({ liked: true, action: "liked" });
      }
      throw insertError;
    }

    if (insertedRows && insertedRows.length > 0) {
      const { error: rpcError } = await callRpc(supabase, "increment_discussion_likes", { discussion_id: discussionId });
      if (rpcError) throw rpcError;
    }

    return NextResponse.json({ liked: true, action: "liked" });
  } catch (error) {
    return handleApiError(error);
  }
}
