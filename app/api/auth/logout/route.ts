import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("ssotoken");
  cookieStore.delete("PHPSESSID");
  return NextResponse.json({ success: true, message: "로그아웃 되었습니다." });
}
