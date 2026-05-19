import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";
import supabase from "@/lib/db";
import { generateRecurringDates } from "@/lib/date";
import { loginToLibseat } from "@/lib/sejong/auth";
import { submitReservation } from "@/lib/sejong/reserve";
import { fetchReserveNo } from "@/lib/sejong/myseat";
import { generateSlotTimes } from "@/lib/slot";
import { getLibseatUnavailableTimes } from "@/lib/sejong/availability";
import { sendReservationEmail } from "@/lib/email";
import { sendReservationDiscordNotification } from "@/lib/discord";

interface Companion {
  studentId: string;
  name: string;
}

interface ReservationRequest {
  studyRoomId: string;
  selectedDay: string;
  startDate?: string;
  startTime: string;
  hours: number;
  companions: Companion[];
  reason: string;
  endDate: string;
  notificationEmail?: string;
  notificationDiscordWebhook?: string;
}

export async function POST(request: NextRequest) {
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

    // DB에서 암호화된 비밀번호 조회
    const { data: userCred, error: credFetchError } = await supabase
      .from("user_credentials")
      .select("password")
      .eq("student_id", studentId)
      .single();

    if (credFetchError || !userCred) {
      return NextResponse.json(
        { success: false, message: "인증이 필요합니다. 다시 로그인해주세요." },
        { status: 401 },
      );
    }

    const encPassword = userCred.password;

    // 2. 요청 바디 파싱 및 검증
    const body: ReservationRequest = await request.json();
    const {
      studyRoomId,
      selectedDay,
      startDate,
      startTime,
      hours,
      companions,
      reason,
      endDate,
      notificationEmail,
      notificationDiscordWebhook,
    } = body;

    if (
      !studyRoomId ||
      !selectedDay ||
      !startTime ||
      !hours ||
      !reason ||
      !endDate
    ) {
      return NextResponse.json(
        { success: false, message: "필수 정보가 누락되었습니다." },
        { status: 400 },
      );
    }

    if (![1, 2].includes(hours)) {
      return NextResponse.json(
        {
          success: false,
          message: "이용 시간은 1시간 또는 2시간만 가능합니다.",
        },
        { status: 400 },
      );
    }

    if (!["mon", "tue", "wed", "thu", "fri"].includes(selectedDay)) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 요일입니다." },
        { status: 400 },
      );
    }

    if (startDate) {
      const DAY_MAP: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5 };
      const picked = new Date(startDate + "T00:00:00");
      if (picked.getDay() !== DAY_MAP[selectedDay]) {
        return NextResponse.json(
          { success: false, message: "시작 날짜가 선택한 요일과 일치하지 않습니다." },
          { status: 400 },
        );
      }
    }

    // 3. 반복 날짜 생성
    const dates = generateRecurringDates(selectedDay, endDate, startDate);

    if (dates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "예약할 날짜가 없습니다. 종료 날짜를 확인해주세요.",
        },
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
      dates.filter((date) => new Date(date) <= schedulableFrom),
    );

    // 5. group_id 생성
    const groupId = randomUUID();

    // 6. 즉시 예약 대상 libseat 가용성 사전 확인 (INSERT 전에 체크하여 DB 오염 방지)
    const immediateResults: Array<{
      date: string;
      status: "success" | "failed";
      message: string;
    }> = [];
    const conflictDates = new Set<string>();

    const availabilityResults = await Promise.all(
      [...immediateDates].map(async (date) => {
        const reserveDate = date.replace(/-/g, "");
        const unavailableTimes = await getLibseatUnavailableTimes(
          studyRoomId,
          reserveDate,
        );
        return { date, unavailableTimes };
      }),
    );

    for (const { date, unavailableTimes } of availabilityResults) {
      const conflictTime = generateSlotTimes(startTime, hours).find((t) =>
        unavailableTimes.has(t),
      );
      if (conflictTime) {
        conflictDates.add(date);
        immediateResults.push({
          date,
          status: "failed",
          message: `${date} ${conflictTime} 시간대는 이미 예약되어 있습니다.`,
        });
      }
    }

    // 7. 날짜별 INSERT (충돌 날짜 제외)
    const reservationMap = new Map<string, number>();

    for (const date of dates) {
      if (conflictDates.has(date)) {
        continue;
      }
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
          notification_email: notificationEmail || null,
          notification_discord_webhook: notificationDiscordWebhook || null,
        })
        .select("id")
        .single();

      if (resError || !reservation) {
        throw resError;
      }

      reservationMap.set(date, reservation.id);

      // 슬롯 점유 등록
      const slotTimes = generateSlotTimes(startTime, hours);
      const { error: slotError } = await supabase.from("reserved_slots").insert(
        slotTimes.map((time) => ({
          room_id: studyRoomId,
          slot_date: date,
          slot_time: time,
          reservation_id: reservation.id,
        })),
      );

      if (slotError) {
        Sentry.captureException(slotError);
        // UNIQUE 제약조건 위반 = 이미 점유된 슬롯
        // 방금 생성한 reservation을 정리하고 에러 반환
        await supabase.from("reservations").delete().eq("id", reservation.id);
        return NextResponse.json(
          {
            success: false,
            message: `${date} ${startTime} 시간대는 이미 예약되어 있습니다.`,
          },
          { status: 409 },
        );
      }

      // 동반 이용자
      if (companions.length > 0) {
        const { error: compError } = await supabase.from("companions").insert(
          companions.map((c) => ({
            reservation_id: reservation.id,
            student_id: c.studentId,
            name: c.name,
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

    // 8. 충돌 없는 즉시 예약 대상만 실제 예약 시도
    const submittableDates = [...immediateDates].filter(
      (d) => !conflictDates.has(d),
    );
    const failedImmediateDates = new Set<string>();

    let userName = "";

    if (submittableDates.length > 0) {
      Sentry.addBreadcrumb({
        message: "즉시 예약 시도",
        data: { dates: submittableDates, studyRoomId, studentId },
      });
      try {
        const session = await loginToLibseat(ssotoken);
        if (!session) throw new Error("도서관 로그인 실패");
        userName = session.studentName;

        for (const date of submittableDates) {
          const reservationId = reservationMap.get(date)!;
          const reserveDate = date.replace(/-/g, ""); // YYYY-MM-DD → YYYYMMDD
          const reserveStartTime = startTime.replace(":", ""); // HH:MM → HHMM

          try {
            const result = await submitReservation({
              ssotoken,
              phpSessId: session.phpSessId,
              token: session.token,
              roomId: studyRoomId,
              reserveDate,
              startTime: reserveStartTime,
              hours,
              studentId,
              studentName: session.studentName,
              companions: companions.map((c) => ({
                student_id: c.studentId,
                name: c.name,
              })),
            });

            if (result.success) {
              const reserveNo = await fetchReserveNo({
                token: session.token,
                phpSessId: session.phpSessId,
                date,
                roomId: studyRoomId,
                startTime,
                hours,
              });
              await supabase
                .from("reservations")
                .update({
                  status: "success",
                  ...(reserveNo && { booking_id: reserveNo }),
                })
                .eq("id", reservationId);
              Sentry.captureEvent({
                message: "즉시 예약 성공",
                level: "info",
                tags: { action: "reserve_immediate" },
                extra: { groupId, studyRoomId, date, studentId },
              });
              immediateResults.push({
                date,
                status: "success",
                message: "예약이 완료되었습니다.",
              });
            } else {
              await supabase
                .from("reserved_slots")
                .delete()
                .eq("reservation_id", reservationId);
              await supabase
                .from("reservations")
                .delete()
                .eq("id", reservationId);
              failedImmediateDates.add(date);
              Sentry.captureEvent({
                message: "즉시 예약 실패",
                level: "error",
                tags: { action: "reserve_immediate" },
                extra: { groupId, studyRoomId, date, studentId, errorMessage: result.message },
              });
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
              .from("reserved_slots")
              .delete()
              .eq("reservation_id", reservationId);
            await supabase
              .from("reservations")
              .delete()
              .eq("id", reservationId);
            failedImmediateDates.add(date);
            Sentry.captureEvent({
              message: "즉시 예약 실패",
              level: "error",
              tags: { action: "reserve_immediate" },
              extra: { groupId, studyRoomId, date, studentId, errorMessage: message },
            });
            immediateResults.push({ date, status: "failed", message });
          }
        }
      } catch (error) {
        // 도서관 로그인 실패 → 충돌 없는 즉시 예약 대상 레코드 삭제
        Sentry.captureException(error);
        for (const date of submittableDates) {
          const reservationId = reservationMap.get(date)!;
          await supabase
            .from("reserved_slots")
            .delete()
            .eq("reservation_id", reservationId);
          await supabase
            .from("reservations")
            .delete()
            .eq("id", reservationId);
          failedImmediateDates.add(date);
          immediateResults.push({
            date,
            status: "failed",
            message: "도서관 로그인 실패",
          });
        }
      }
    }

    const insertedDates = dates.filter(
      (d) => !conflictDates.has(d) && !failedImmediateDates.has(d),
    );
    const successfulImmediateCount = immediateResults.filter(
      (r) => r.status === "success",
    ).length;
    const scheduledCount = insertedDates.length - successfulImmediateCount;

    if (notificationEmail && immediateResults.length > 0) {
      await sendReservationEmail({
        to: notificationEmail,
        roomId: studyRoomId,
        startTime,
        hours,
        results: immediateResults,
        scheduledCount,
      });
    }

    if (notificationDiscordWebhook && immediateResults.length > 0) {
      await sendReservationDiscordNotification({
        webhookUrl: notificationDiscordWebhook,
        roomId: studyRoomId,
        startTime,
        hours,
        results: immediateResults,
        userName,
        reason,
      });
    }

    return NextResponse.json({
      success: true,
      message: `${insertedDates.length}건의 예약이 등록되었습니다.`,
      data: {
        groupId,
        count: insertedDates.length,
        dates: insertedDates,
        immediateResults,
        scheduledCount,
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { success: false, message: "예약 등록 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
