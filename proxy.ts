import { type NextRequest, NextResponse } from "next/server";

import { REC_VIEWER_COOKIE } from "@/lib/recommendations/viewer";

const REC_VIEWER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest) {
  if (request.cookies.get(REC_VIEWER_COOKIE)?.value) {
    return NextResponse.next();
  }

  const newId = crypto.randomUUID();

  // 同步写入请求 cookie，下游 RSC 的 cookies() 才能在首次访问时读到同一个值；
  // 否则首屏会用临时 id 渲染，刷新后顺序会跳变。
  request.cookies.set(REC_VIEWER_COOKIE, newId);

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  response.cookies.set(REC_VIEWER_COOKIE, newId, {
    path: "/",
    maxAge: REC_VIEWER_MAX_AGE_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
