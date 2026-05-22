import { cache } from "react";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export const REC_VIEWER_COOKIE = "rec_viewer";

const REC_VIEWER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * 推荐打乱用的观众标识：登录用户为 user id，匿名用户为 rec_viewer cookie。
 */
export const getRecommendationViewerKey = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    return user.id;
  }

  const cookieStore = await cookies();
  const existing = cookieStore.get(REC_VIEWER_COOKIE)?.value?.trim();
  if (existing) {
    return `anon:${existing}`;
  }

  const anonId = crypto.randomUUID();

  try {
    cookieStore.set({
      name: REC_VIEWER_COOKIE,
      value: anonId,
      path: "/",
      maxAge: REC_VIEWER_MAX_AGE_SECONDS,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  } catch {
    // Server Component 内 set cookie 可能失败；middleware 会补种
  }

  return `anon:${anonId}`;
});
