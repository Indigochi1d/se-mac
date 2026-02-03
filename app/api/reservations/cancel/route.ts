import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface CancelRequest {
  bookingId: string;
  roomId: string;
  cancelMsg?: string;
}

interface Reservation {
  bookingId: string;
  ipid: string;
  roomId: string;
}

export async function DELETE(request: NextRequest) {
  try {
    // 1. 인증 확인
    const cookieStore = await cookies();
    const ssotoken = cookieStore.get("ssotoken")?.value;
    const studentId = cookieStore.get("student_id")?.value;

    if (!ssotoken || !studentId) {
      return NextResponse.json(
        { success: false, message: "인증이 필요합니다. 다시 로그인해주세요." },
        { status: 401 },
      );
    }

    // 2. 요청 바디 파싱
    const body: CancelRequest = await request.json();
    const { bookingId, roomId, cancelMsg = "잘못 예약" } = body;

    if (!bookingId || !roomId) {
      return NextResponse.json(
        { success: false, message: "bookingId와 roomId는 필수입니다." },
        { status: 400 },
      );
    }

    // 3. 도서관 로그인 (ssotoken 쿠키 전달)
    const loginResponse = await fetch(process.env.SEJONG_LIBRARY_LOGIN_URL!, {
      headers: {
        Cookie: `ssotoken=${ssotoken}`,
      },
      redirect: "manual",
    });

    // 도서관 세션 쿠키 추출
    const libraryCookies = loginResponse.headers.getSetCookie();
    const cookieHeader = libraryCookies
      .map((c) => c.split(";")[0])
      .join("; ");

    // 4. 스터디룸 메인 페이지 접근하여 예약 내역 파싱
    const studyroomResponse = await fetch(
      process.env.SEJONG_LIBRARY_STUDYROOM_URL!,
      {
        headers: {
          Cookie: cookieHeader,
        },
      },
    );

    const html = await studyroomResponse.text();
    const $ = cheerio.load(html);

    // 예약 내역 테이블 파싱
    const reservations: Reservation[] = [];
    const table = $("table.tb01.width-full").last();
    const rows = table.find("tr").slice(1); // 헤더 제외

    rows.each((_, row) => {
      const anchor = $(row).find("a");
      const href = anchor.attr("href");

      if (href) {
        const parts = href.split("'");
        if (parts.length >= 6) {
          reservations.push({
            bookingId: parts[1],
            ipid: parts[3],
            roomId: parts[5],
          });
        }
      }
    });

    if (reservations.length === 0) {
      return NextResponse.json(
        { success: false, message: "현재 스터디룸 예약 내역이 없습니다." },
        { status: 400 },
      );
    }

    // 5. 해당 bookingId가 존재하는지 확인
    const targetReservation = reservations.find(
      (r) => r.bookingId === bookingId,
    );

    if (!targetReservation) {
      return NextResponse.json(
        { success: false, message: "예약을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // 6. 예약 취소 요청
    const cancelFormData = new URLSearchParams({
      cancelMsg: cancelMsg,
      bookingId: bookingId,
      expired: "C",
      roomId: roomId,
      mode: "update",
      classId: "0",
    });

    await fetch(process.env.SEJONG_LIBRARY_BOOKING_PROCESS_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader,
      },
      body: cancelFormData.toString(),
    });

    return NextResponse.json({
      success: true,
      message: "예약이 취소되었습니다.",
    });
  } catch (error) {
    console.error("예약 취소 에러:", error);
    return NextResponse.json(
      { success: false, message: "예약 취소 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
