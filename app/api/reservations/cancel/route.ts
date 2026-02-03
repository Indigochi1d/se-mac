import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { loginToPortal, loginToLibrary } from "@/lib/sejong/auth";

interface CancelRequest {
  reservationId: number;
  cancelMsg?: string;
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
    const { reservationId, cancelMsg = "예약 취소" } = body;

    if (!reservationId) {
      return NextResponse.json(
        { success: false, message: "reservationId는 필수입니다." },
        { status: 400 },
      );
    }

    // 3. DB에서 예약 정보 조회 (credentials 포함)
    const { data: reservation, error: queryError } = await supabase
      .from("reservations")
      .select(
        "id, status, booking_id, room_id, student_id, reservation_credentials ( password )",
      )
      .eq("id", reservationId)
      .single();

    console.log("[Cancel] reservation:", reservation);
    console.log("[Cancel] queryError:", queryError);

    if (queryError || !reservation) {
      return NextResponse.json(
        { success: false, message: "예약을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // 4. 본인 예약인지 확인
    if (reservation.student_id !== studentId) {
      return NextResponse.json(
        { success: false, message: "본인의 예약만 취소할 수 있습니다." },
        { status: 403 },
      );
    }

    // 5. 상태별 분기 처리
    if (reservation.status === "cancelled") {
      return NextResponse.json(
        { success: false, message: "이미 취소된 예약입니다." },
        { status: 400 },
      );
    }

    if (reservation.status === "failed") {
      return NextResponse.json(
        { success: false, message: "실패한 예약은 취소할 수 없습니다." },
        { status: 400 },
      );
    }

    // 6. booking_id가 있으면 도서관 취소 API 호출 (status와 관계없이)
    console.log("[Cancel] reservation.status:", reservation.status);
    console.log("[Cancel] reservation.booking_id:", reservation.booking_id);

    if (reservation.booking_id) {
      console.log("[Cancel] booking_id exists, calling library cancel API...");

      // 비밀번호 복호화
      const cred = reservation.reservation_credentials;
      const credRecord = Array.isArray(cred) ? cred[0] : cred;

      if (!credRecord?.password) {
        return NextResponse.json(
          { success: false, message: "자격 증명 정보가 없습니다." },
          { status: 400 },
        );
      }

      let plainPassword: string;
      try {
        plainPassword = decrypt(credRecord.password);
      } catch {
        return NextResponse.json(
          { success: false, message: "비밀번호 복호화 실패" },
          { status: 500 },
        );
      }

      // 포탈 로그인으로 새 ssotoken 획득
      const newSsotoken = await loginToPortal(studentId, plainPassword);
      if (!newSsotoken) {
        return NextResponse.json(
          { success: false, message: "포탈 로그인 실패" },
          { status: 401 },
        );
      }

      // 도서관 로그인으로 JSESSIONID 획득
      const jsessionId = await loginToLibrary(newSsotoken);
      console.log("[Cancel] jsessionId:", jsessionId);

      // 도서관 취소 요청
      const cancelFormData = new URLSearchParams({
        cancelMsg: cancelMsg,
        bookingId: reservation.booking_id,
        expired: "C",
        roomId: reservation.room_id,
        mode: "update",
        classId: "0",
      });

      console.log("[Cancel] cancelFormData:", cancelFormData.toString());

      const cancelResponse = await fetch(
        process.env.SEJONG_LIBRARY_RESERVE_PROCESS_URL!,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: `ssotoken=${newSsotoken}; JSESSIONID=${jsessionId}`,
          },
          body: cancelFormData.toString(),
        },
      );

      // 취소 결과 확인
      const xJson = cancelResponse.headers.get("X-JSON");
      const responseBody = await cancelResponse.text();

      console.log("[Cancel] cancelResponse.status:", cancelResponse.status);
      console.log("[Cancel] X-JSON:", xJson);
      console.log("[Cancel] responseBody:", responseBody);

      if (!xJson || !xJson.includes("true")) {
        return NextResponse.json(
          {
            success: false,
            message: responseBody.trim() || "도서관 예약 취소에 실패했습니다.",
          },
          { status: 400 },
        );
      }
    }

    // 7. DB 상태 업데이트 (pending, success 모두)
    const { error: updateError } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", reservationId);

    if (updateError) {
      throw updateError;
    }

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
