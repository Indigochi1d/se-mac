import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import supabase from "@/lib/db";
import { generateRecurringDates } from "@/lib/date";
import { loginToLibrary } from "@/lib/sejong/auth";
import { submitReservation } from "@/lib/sejong/reserve";

interface Companion {
  studentId: string;
  name: string;
  ipid: string;
}

interface ReservationRequest {
  studyRoomId: string;
  selectedDay: string;
  startTime: string;
  hours: number;
  companions: Companion[];
  reason: string;
  endDate: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const cookieStore = await cookies();
    const ssotoken = cookieStore.get("ssotoken")?.value;
    const studentId = cookieStore.get("student_id")?.value;
    const encPassword = cookieStore.get("enc_password")?.value;

    if (!ssotoken || !studentId || !encPassword) {
      return NextResponse.json(
        { success: false, message: "인증이 필요합니다. 다시 로그인해주세요." },
        { status: 401 },
      );
    }

    // 2. 요청 바디 파싱 및 검증
    const body: ReservationRequest = await request.json();
    const { studyRoomId, selectedDay, startTime, hours, companions, reason, endDate } = body;

    if (!studyRoomId || !selectedDay || !startTime || !hours || !reason || !endDate) {
      return NextResponse.json(
        { success: false, message: "필수 정보가 누락되었습니다." },
        { status: 400 },
      );
    }

    if (![1, 2].includes(hours)) {
      return NextResponse.json(
        { success: false, message: "이용 시간은 1시간 또는 2시간만 가능합니다." },
        { status: 400 },
      );
    }

    if (!["mon", "tue", "wed", "thu", "fri"].includes(selectedDay)) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 요일입니다." },
        { status: 400 },
      );
    }

    // 3. 반복 날짜 생성
    const dates = generateRecurringDates(selectedDay, endDate);

    if (dates.length === 0) {
      return NextResponse.json(
        { success: false, message: "예약할 날짜가 없습니다. 종료 날짜를 확인해주세요." },
        { status: 400 },
      );
    }

    // 4. 즉시 예약 대상 분리
    // 크론은 예약일 7일 전에 실행된다.
    // 예약일이 7일 이내이면 크론 실행 시점이 이미 지났으므로 즉시 예약이 필요하다.
    const CRON_LEAD_DAYS = 7;

    const today = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
    );
    today.setHours(0, 0, 0, 0);

    const schedulableFrom = new Date(today);
    schedulableFrom.setDate(schedulableFrom.getDate() + CRON_LEAD_DAYS);

    const immediateDates = new Set(
      dates.filter((date) => new Date(date) < schedulableFrom),
    );

    // 5. group_id 생성
    const groupId = randomUUID();

    // 6. 날짜별 INSERT (모든 날짜를 우선 DB에 저장)
    const reservationMap = new Map<string, number>();

    for (const date of dates) {
      const { data: reservation, error: resError } = await supabase
        .from("reservations")
        .insert({
          student_id: studentId,
          group_id: groupId,
          room_id: studyRoomId,
          reservation_date: date,
          start_time: startTime,
          hours,
          reason,
          status: "pending",
        })
        .select("id")
        .single();

      if (resError || !reservation) {
        throw resError;
      }

      reservationMap.set(date, reservation.id);

      // 동반 이용자
      if (companions.length > 0) {
        const { error: compError } = await supabase.from("companions").insert(
          companions.map((c) => ({
            reservation_id: reservation.id,
            student_id: c.studentId,
            name: c.name,
            ipid: c.ipid,
          })),
        );

        if (compError) throw compError;
      }

      // 인증 정보
      const { error: credError } = await supabase
        .from("reservation_credentials")
        .insert({
          reservation_id: reservation.id,
          student_id: studentId,
          password: encPassword,
        });

      if (credError) throw credError;
    }

    // 7. 즉시 예약 대상이 있으면 바로 예약 시도
    const immediateResults: Array<{
      date: string;
      status: "success" | "failed";
      message: string;
    }> = [];

    if (immediateDates.size > 0) {
      try {
        const jsessionId = await loginToLibrary(ssotoken);

        for (const date of immediateDates) {
          const reservationId = reservationMap.get(date)!;
          const [year, month, day] = date.split("-");

          try {
            const result = await submitReservation({
              ssotoken,
              jsessionId,
              roomId: studyRoomId,
              year,
              month,
              day,
              startHour: startTime.split(":")[0],
              hours,
              purpose: reason,
              companions: companions.map((c) => ({
                student_id: c.studentId,
                name: c.name,
                ipid: c.ipid,
              })),
            });

            if (result.success) {
              await supabase
                .from("reservations")
                .update({
                  status: "success",
                  ...(result.bookingId && { booking_id: result.bookingId }),
                })
                .eq("id", reservationId);
              immediateResults.push({
                date,
                status: "success",
                message: "예약이 완료되었습니다.",
              });
            } else {
              await supabase
                .from("reservations")
                .update({ status: "failed", error_message: result.message })
                .eq("id", reservationId);
              immediateResults.push({
                date,
                status: "failed",
                message: result.message,
              });
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "알 수 없는 에러";
            await supabase
              .from("reservations")
              .update({ status: "failed", error_message: message })
              .eq("id", reservationId);
            immediateResults.push({ date, status: "failed", message });
          }
        }
      } catch {
        // 도서관 로그인 실패 → 모든 즉시 예약 대상을 failed 처리
        for (const date of immediateDates) {
          const reservationId = reservationMap.get(date)!;
          await supabase
            .from("reservations")
            .update({
              status: "failed",
              error_message: "도서관 로그인 실패",
            })
            .eq("id", reservationId);
          immediateResults.push({
            date,
            status: "failed",
            message: "도서관 로그인 실패",
          });
        }
      }
    }

    const scheduledCount = dates.length - immediateDates.size;

    return NextResponse.json({
      success: true,
      message: `${dates.length}건의 예약이 등록되었습니다.`,
      data: {
        groupId,
        count: dates.length,
        dates,
        immediateResults,
        scheduledCount,
      },
    });
  } catch (error) {
    console.error("예약 등록 에러:", error);
    return NextResponse.json(
      { success: false, message: "예약 등록 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
