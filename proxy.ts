import { type NextRequest, NextResponse } from "next/server";

import { STEAM_PATHNAME_HEADER, STEAM_SEARCH_HEADER } from "@/lib/auth/login-redirect";
import { REC_VIEWER_COOKIE } from "@/lib/recommendations/viewer";
import { buildApexToWwwRedirectUrl } from "@/lib/seo/canonical-host";

const REC_VIEWER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const SEO_RESOURCE_PATHS = new Set(["/robots.txt", "/sitemap.xml"]);
const RECOMMENDATION_IDENTITY_PATHS = new Set([
  "/explore",
  "/api/projects",
  "/api/home/recommendations",
  "/api/explore/recommendations",
]);

function withSteamPathHeaders(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(STEAM_PATHNAME_HEADER, request.nextUrl.pathname);
  if (request.nextUrl.search) {
    requestHeaders.set(STEAM_SEARCH_HEADER, request.nextUrl.search);
  }
  return requestHeaders;
}

export function proxy(request: NextRequest) {
  const apexRedirectUrl = buildApexToWwwRedirectUrl({
    host: request.headers.get("host") ?? request.nextUrl.host,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });
  if (apexRedirectUrl) {
    return NextResponse.redirect(apexRedirectUrl, 301);
  }

  // Search-engine discovery files must be deterministic and cookie-free.
  // Recommendation identity has no meaning for robots.txt or sitemap.xml,
  // and Set-Cookie can make crawler/CDN fetches look user-specific.
  if (SEO_RESOURCE_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const needsRecommendationIdentity = request.method === "GET"
    && RECOMMENDATION_IDENTITY_PATHS.has(request.nextUrl.pathname);

  if (!needsRecommendationIdentity || request.cookies.get(REC_VIEWER_COOKIE)?.value) {
    return NextResponse.next({
      request: { headers: withSteamPathHeaders(request) },
    });
  }

  const newId = crypto.randomUUID();

  // 同步写入请求 cookie，下游 RSC 的 cookies() 才能在首次访问时读到同一个值；
  // 否则首屏会用临时 id 渲染，刷新后顺序会跳变。
  request.cookies.set(REC_VIEWER_COOKIE, newId);

  const response = NextResponse.next({
    request: { headers: withSteamPathHeaders(request) },
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
