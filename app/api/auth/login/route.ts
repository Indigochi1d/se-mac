import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { loginToPortal, loginToLibseat } from "@/lib/sejong/auth";
import { encrypt } from "@/lib/crypto";
import supabase from "@/lib/db";

interface LoginRequest {
  studentId: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<LoginResponse>> {
  try {
    const body: LoginRequest = await request.json();
    const { studentId, password } = body;

    if (!studentId || !password) {
      return NextResponse.json(
        { success: false, message: "학번과 비밀번호를 입력해주세요." },
        { status: 400 },
      );
    }

    // 1. 포탈 로그인 → ssotoken
    const ssotoken = await loginToPortal(studentId, password);

    if (!ssotoken) {
      return NextResponse.json(
        { success: false, message: "학번 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    // 2. libseat 로그인 → PHPSESSID, token, studentName
    const session = await loginToLibseat(ssotoken);

    if (!session) {
      return NextResponse.json(
        { success: false, message: "도서관 인증에 실패했습니다." },
        { status: 500 },
      );
    }

    // 3. 암호화된 비밀번호를 DB에 저장 (쿠키에 두지 않음)
    const { error: credError } = await supabase
      .from("user_credentials")
      .upsert({ student_id: studentId, password: encrypt(password) });

    if (credError) throw credError;

    // 4. 쿠키 저장
    const cookieStore = await cookies();
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24,
      path: "/",
    };

    cookieStore.set("ssotoken", ssotoken, cookieOptions);
    cookieStore.set("PHPSESSID", session.phpSessId, cookieOptions);
    cookieStore.set("student_id", studentId, cookieOptions);
    cookieStore.set("student_name", session.studentName, cookieOptions);

    return NextResponse.json({ success: true, message: "로그인 성공" });
  } catch (error) {
    console.error("로그인 에러:", error);
    return NextResponse.json(
      { success: false, message: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
