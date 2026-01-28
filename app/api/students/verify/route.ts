import { cookies } from "next/headers";
import { NextResponse } from "next/server";

interface VerifyRequestBody {
  studentId: string;
  name: string;
  year: string;
  month: string;
  day: string;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const ssotoken = cookieStore.get("ssotoken")?.value;

    if (!ssotoken) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const body: VerifyRequestBody = await request.json();
    const { studentId, name, year, month, day } = body;

    if (!studentId || !name || !year || !month || !day) {
      return NextResponse.json(
        { error: "필수 정보가 누락되었습니다." },
        { status: 400 },
      );
    }

    // 1. 라이브러리 로그인 (세션 초기화)
    const loginResponse = await fetch(process.env.SEJONG_LIBRARY_LOGIN_URL, {
      method: "GET",
      headers: {
        Cookie: `ssotoken=${ssotoken}`,
      },
    });

    // 로그인 응답에서 JSESSIONID 쿠키 추출
    const setCookieHeader = loginResponse.headers.get("set-cookie");
    const jsessionMatch = setCookieHeader?.match(/JSESSIONID=([^;]+)/);
    const jsessionId = jsessionMatch ? jsessionMatch[1] : "";

    // 2. 학생 정보 조회 (JSESSIONID 포함)
    const response = await fetch(process.env.SEJONG_LIBRARY_USER_FIND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: `ssotoken=${ssotoken}; JSESSIONID=${jsessionId}`,
      },
      body: new URLSearchParams({
        altPid: studentId,
        name: name,
        userBlockUser: "Y",
        year: year,
        month: month,
        day: day,
      }).toString(),
    });

    // 3. X-JSON 헤더에서 결과 파싱
    const xJsonHeader = response.headers.get("X-JSON");

    if (!xJsonHeader) {
      return NextResponse.json(
        { error: "서비스에 문제가 있어 등록이 불가능 합니다." },
        { status: 500 },
      );
    }

    const data = JSON.parse(xJsonHeader.replace(/'/g, '"'));

    if (data.result === "true") {
      return NextResponse.json({
        success: true,
        ipid: data.ipid,
        studentId,
        name,
      });
    } else {
      return NextResponse.json(
        { error: "학생 정보를 찾을 수 없거나 예약이 불가능합니다." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "학생 조회에 실패했습니다." },
      { status: 500 },
    );
  }
}
