import { NextRequest, NextResponse } from "next/server";

export default function proxy(request: NextRequest) {
  const ssotoken = request.cookies.get("ssotoken");
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  // 토큰 없으면 → 로그인 페이지로
  if (!ssotoken && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 토큰 있는데 로그인 페이지 접근 → 메인으로
  if (ssotoken && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
