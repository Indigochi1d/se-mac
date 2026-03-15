import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { loginToPortal, loginToLibseat } from "@/lib/sejong/auth";
import { cancelLibseatReservation } from "@/lib/sejong/cancel";

interface CancelRequest {
  reservationId: number;
}

export async function DELETE(request: NextRequest) {
  try {
    // 1. 인증 확인
    const cookieStore = await cookies();
    const studentId = cookieStore.get("student_id")?.value;

    if (!studentId) {
      return NextResponse.json(
        { success: false, message: "인증이 필요합니다. 다시 로그인해주세요." },
        { status: 401 },
      );
    }

    // 2. 요청 바디 파싱
    const body: CancelRequest = await request.json();
    const { reservationId } = body;

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
        "id, status, booking_id, student_id, reservation_credentials ( password )",
      )
      .eq("id", reservationId)
      .single();

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

    // 6. booking_id가 있으면 도서관 취소 API 호출
    if (reservation.booking_id) {
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

      // libseat 로그인으로 token + PHPSESSID 획득
      const session = await loginToLibseat(newSsotoken);
      if (!session) {
        return NextResponse.json(
          { success: false, message: "도서관 인증에 실패했습니다." },
          { status: 500 },
        );
      }

      // 도서관 취소 요청
      const cancelResult = await cancelLibseatReservation({
        userID: studentId,
        reserveNo: reservation.booking_id,
        token: session.token,
        phpSessId: session.phpSessId,
      });

      if (!cancelResult.success) {
        return NextResponse.json(
          { success: false, message: cancelResult.message },
          { status: 400 },
        );
      }
    }

    // 7. DB 상태 업데이트
    const { error: updateError } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", reservationId);

    if (updateError) {
      throw updateError;
    }

    // 8. 슬롯 점유 해제
    await supabase
      .from("reserved_slots")
      .delete()
      .eq("reservation_id", reservationId);

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
