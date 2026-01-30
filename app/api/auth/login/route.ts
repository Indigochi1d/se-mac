import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";

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

    // 세종대 포탈에 로그인 요청
    const formData = new URLSearchParams({
      mainLogin: "Y",
      rtUrl: process.env.SEJONG_REDIRECT_URL,
      id: studentId,
      password: password,
      chkNos: "on",
    });

    const response = await fetch(process.env.SEJONG_PORTAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: process.env.SEJONG_HEADERS_REFERER,
      },
      body: formData.toString(),
      redirect: "manual",
    });

    // Set-Cookie 헤더에서 ssotoken 확인
    const setCookieHeader = response.headers.get("set-cookie");
    const ssotoken = extractSsoToken(setCookieHeader);

    if (ssotoken) {
      // 로그인 성공 - httpOnly 쿠키에 저장
      const cookieStore = await cookies();
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 60 * 60 * 24,
        path: "/",
      };

      cookieStore.set("ssotoken", ssotoken, cookieOptions);
      cookieStore.set("student_id", studentId, cookieOptions);
      cookieStore.set("enc_password", encrypt(password), cookieOptions);

      return NextResponse.json({
        success: true,
        message: "로그인 성공",
      });
    } else {
      return NextResponse.json(
        { success: false, message: "학번 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }
  } catch (error) {
    console.error("로그인 에러:", error);
    return NextResponse.json(
      { success: false, message: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

function extractSsoToken(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;

  // Set-Cookie 헤더에서 ssotoken 값 추출
  const match = setCookieHeader.match(/ssotoken=([^;]+)/);
  return match ? match[1] : null;
}
