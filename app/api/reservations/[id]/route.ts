import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { loginToPortal, loginToLibseat } from "@/lib/sejong/auth";
import { cancelLibseatReservation } from "@/lib/sejong/cancel";
import { submitReservation } from "@/lib/sejong/reserve";
import { fetchReserveNo } from "@/lib/sejong/myseat";
import { STUDY_ROOMS } from "@/constants/studyroom";
import { isFutureReservation } from "@/lib/date";

interface CompanionData {
  studentId: string;
  name: string;
}

interface UpdateReservationCompanionsRequest {
  companions: CompanionData[];
}

async function getAuthenticatedStudentId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("student_id")?.value ?? null;
}

function isLibraryBookedReservation(
  status: string,
  bookingId: string | null,
  reservationDate: string,
  startTime: string,
): boolean {
  return (
    status === "success" &&
    bookingId !== null &&
    isFutureReservation(reservationDate, startTime)
  );
}

async function replaceCompanionsInDatabase(
  reservationId: number,
  newCompanions: CompanionData[],
): Promise<void> {
  await supabase
    .from("companions")
    .delete()
    .eq("reservation_id", reservationId);

  if (newCompanions.length > 0) {
    const { error: insertError } = await supabase.from("companions").insert(
      newCompanions.map((companion) => ({
        reservation_id: reservationId,
        student_id: companion.studentId,
        name: companion.name,
      })),
    );
    if (insertError) throw insertError;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticatedStudentId = await getAuthenticatedStudentId();
    if (!authenticatedStudentId) {
      return NextResponse.json(
        { success: false, message: "인증이 필요합니다. 다시 로그인해주세요." },
        { status: 401 },
      );
    }

    const { id } = await params;
    const reservationId = parseInt(id, 10);
    if (isNaN(reservationId)) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 예약 ID입니다." },
        { status: 400 },
      );
    }

    const { data: reservation, error: reservationQueryError } = await supabase
      .from("reservations")
      .select("id, student_id")
      .eq("id", reservationId)
      .single();

    if (reservationQueryError || !reservation) {
      return NextResponse.json(
        { success: false, message: "예약을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (reservation.student_id !== authenticatedStudentId) {
      return NextResponse.json(
        { success: false, message: "본인의 예약만 조회할 수 있습니다." },
        { status: 403 },
      );
    }

    const { data: companionsFromDatabase, error: companionsQueryError } =
      await supabase
        .from("companions")
        .select("student_id, name")
        .eq("reservation_id", reservationId);

    if (companionsQueryError) {
      throw companionsQueryError;
    }

    const participants = (companionsFromDatabase ?? []).map((companion) => ({
      studentId: companion.student_id,
      name: companion.name,
    }));

    return NextResponse.json({
      success: true,
      data: { participants },
    });
  } catch (error) {
    console.error("예약 상세 조회 에러:", error);
    return NextResponse.json(
      { success: false, message: "예약 상세 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authenticatedStudentId = await getAuthenticatedStudentId();
    if (!authenticatedStudentId) {
      return NextResponse.json(
        { success: false, message: "인증이 필요합니다. 다시 로그인해주세요." },
        { status: 401 },
      );
    }

    const { id } = await params;
    const reservationId = parseInt(id, 10);
    if (isNaN(reservationId)) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 예약 ID입니다." },
        { status: 400 },
      );
    }

    const requestBody: UpdateReservationCompanionsRequest = await request.json();
    const { companions: newCompanions } = requestBody;

    if (!Array.isArray(newCompanions)) {
      return NextResponse.json(
        { success: false, message: "companions 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const { data: reservation, error: reservationQueryError } = await supabase
      .from("reservations")
      .select(
        "id, status, booking_id, student_id, room_id, reservation_date, start_time, hours, reservation_credentials ( password )",
      )
      .eq("id", reservationId)
      .single();

    if (reservationQueryError || !reservation) {
      return NextResponse.json(
        { success: false, message: "예약을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (reservation.student_id !== authenticatedStudentId) {
      return NextResponse.json(
        { success: false, message: "본인의 예약만 수정할 수 있습니다." },
        { status: 403 },
      );
    }

    if (reservation.status === "cancelled") {
      return NextResponse.json(
        { success: false, message: "취소된 예약은 수정할 수 없습니다." },
        { status: 400 },
      );
    }

    if (reservation.status === "failed") {
      return NextResponse.json(
        { success: false, message: "실패한 예약은 수정할 수 없습니다." },
        { status: 400 },
      );
    }

    const studyRoom = STUDY_ROOMS.find((room) => room.id === reservation.room_id);
    if (!studyRoom) {
      return NextResponse.json(
        { success: false, message: "알 수 없는 스터디룸입니다." },
        { status: 400 },
      );
    }

    const totalParticipantCount = newCompanions.length + 1;
    if (totalParticipantCount < studyRoom.minPeople) {
      return NextResponse.json(
        {
          success: false,
          message: `최소 ${studyRoom.minPeople}명이 필요합니다. (동반자 최소 ${studyRoom.minPeople - 1}명)`,
        },
        { status: 400 },
      );
    }
    if (totalParticipantCount > studyRoom.maxPeople) {
      return NextResponse.json(
        {
          success: false,
          message: `최대 ${studyRoom.maxPeople}명까지 가능합니다. (동반자 최대 ${studyRoom.maxPeople - 1}명)`,
        },
        { status: 400 },
      );
    }

    const shouldRebookLibraryReservation = isLibraryBookedReservation(
      reservation.status,
      reservation.booking_id,
      reservation.reservation_date,
      reservation.start_time,
    );

    if (shouldRebookLibraryReservation) {
      const credentialsRecord = Array.isArray(reservation.reservation_credentials)
        ? reservation.reservation_credentials[0]
        : reservation.reservation_credentials;

      if (!credentialsRecord?.password) {
        return NextResponse.json(
          { success: false, message: "자격 증명 정보가 없습니다." },
          { status: 400 },
        );
      }

      let decryptedPassword: string;
      try {
        decryptedPassword = decrypt(credentialsRecord.password);
      } catch {
        return NextResponse.json(
          { success: false, message: "비밀번호 복호화에 실패했습니다." },
          { status: 500 },
        );
      }

      const newSsotoken = await loginToPortal(
        authenticatedStudentId,
        decryptedPassword,
      );
      if (!newSsotoken) {
        return NextResponse.json(
          { success: false, message: "포탈 로그인에 실패했습니다." },
          { status: 401 },
        );
      }

      const libseatSession = await loginToLibseat(newSsotoken);
      if (!libseatSession) {
        return NextResponse.json(
          { success: false, message: "도서관 인증에 실패했습니다." },
          { status: 500 },
        );
      }

      const cancelResult = await cancelLibseatReservation({
        userID: authenticatedStudentId,
        reserveNo: reservation.booking_id!,
        token: libseatSession.token,
        phpSessId: libseatSession.phpSessId,
      });

      if (!cancelResult.success) {
        return NextResponse.json(
          { success: false, message: cancelResult.message },
          { status: 400 },
        );
      }

      const reserveDateFormatted = reservation.reservation_date.replace(/-/g, "");
      const startTimeFormatted = reservation.start_time.replace(":", "");

      const rebookingResult = await submitReservation({
        ssotoken: newSsotoken,
        phpSessId: libseatSession.phpSessId,
        token: libseatSession.token,
        roomId: reservation.room_id,
        reserveDate: reserveDateFormatted,
        startTime: startTimeFormatted,
        hours: reservation.hours,
        studentId: authenticatedStudentId,
        studentName: libseatSession.studentName,
        companions: newCompanions.map((companion) => ({
          student_id: companion.studentId,
          name: companion.name,
        })),
      });

      if (!rebookingResult.success) {
        await supabase
          .from("reservations")
          .update({ status: "failed", booking_id: null })
          .eq("id", reservationId);

        return NextResponse.json(
          {
            success: false,
            message: `재예약에 실패했습니다. 예약이 취소 상태로 변경되었습니다: ${rebookingResult.message}`,
          },
          { status: 400 },
        );
      }

      const newBookingId = await fetchReserveNo({
        token: libseatSession.token,
        phpSessId: libseatSession.phpSessId,
        date: reservation.reservation_date,
        roomId: reservation.room_id,
        startTime: reservation.start_time,
        hours: reservation.hours,
      });

      await replaceCompanionsInDatabase(reservationId, newCompanions);

      if (newBookingId) {
        await supabase
          .from("reservations")
          .update({ booking_id: newBookingId })
          .eq("id", reservationId);
      }

      return NextResponse.json({
        success: true,
        message: "기존 예약이 취소되고 새 명단으로 재예약되었습니다.",
      });
    } else {
      await replaceCompanionsInDatabase(reservationId, newCompanions);

      return NextResponse.json({
        success: true,
        message: "예약 명단이 수정되었습니다.",
      });
    }
  } catch (error) {
    console.error("예약 수정 에러:", error);
    return NextResponse.json(
      { success: false, message: "예약 수정 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
