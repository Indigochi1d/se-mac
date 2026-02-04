import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { loginToPortal, loginToLibrary } from "@/lib/sejong/auth";
import { submitReservation } from "@/lib/sejong/reserve";

/** 예약은 7일 전에 수행 (KST 기준 오늘 + 7일) */
const TARGET_DATE_OFFSET = 7;

export async function GET(request: NextRequest) {
  // 1. CRON_SECRET 검증
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  // 2. 타겟 날짜 계산 (KST 기준 오늘 + 7일)
  const now = new Date();
  const kstNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  kstNow.setDate(kstNow.getDate() + TARGET_DATE_OFFSET);

  const targetDate = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, "0")}-${String(kstNow.getDate()).padStart(2, "0")}`;

  // 3. DB에서 pending 예약 조회
  const { data: reservations, error: queryError } = await supabase
    .from("reservations")
    .select(
      `
      id,
      student_id,
      room_id,
      reservation_date,
      start_time,
      hours,
      reason,
      reservation_credentials ( password ),
      companions ( student_id, name, ipid )
    `,
    )
    .eq("reservation_date", targetDate)
    .eq("status", "pending");

  if (queryError) {
    console.error("DB 조회 에러:", queryError);
    return NextResponse.json(
      { success: false, message: "DB 조회 실패", error: queryError.message },
      { status: 500 },
    );
  }

  if (!reservations || reservations.length === 0) {
    return NextResponse.json({
      success: true,
      message: `${targetDate}에 처리할 예약이 없습니다.`,
      processed: 0,
    });
  }

  // 4. 학생별 그룹핑 (같은 학생은 한 번만 로그인)
  const byStudent = new Map<string, typeof reservations>();
  for (const res of reservations) {
    const list = byStudent.get(res.student_id) ?? [];
    list.push(res);
    byStudent.set(res.student_id, list);
  }

  const results: Array<{
    reservationId: number;
    status: "success" | "failed";
    message: string;
  }> = [];

  // 5. 학생별 처리
  for (const [studentId, studentReservations] of byStudent) {
    // 5a. 비밀번호 복호화
    const cred = studentReservations[0].reservation_credentials;
    const credRecord = Array.isArray(cred) ? cred[0] : cred;

    if (!credRecord?.password) {
      for (const res of studentReservations) {
        await markFailed(res.id, "자격 증명 정보 없음");
        results.push({
          reservationId: res.id,
          status: "failed",
          message: "자격 증명 없음",
        });
      }
      continue;
    }

    let plainPassword: string;
    try {
      plainPassword = decrypt(credRecord.password);
    } catch {
      for (const res of studentReservations) {
        await markFailed(res.id, "비밀번호 복호화 실패");
        results.push({
          reservationId: res.id,
          status: "failed",
          message: "복호화 실패",
        });
      }
      continue;
    }

    // 5b. 포탈 로그인
    let ssotoken: string | null;
    try {
      ssotoken = await loginToPortal(studentId, plainPassword);
    } catch {
      for (const res of studentReservations) {
        await markFailed(res.id, "포탈 로그인 요청 실패");
        results.push({
          reservationId: res.id,
          status: "failed",
          message: "포탈 로그인 실패",
        });
      }
      continue;
    }

    if (!ssotoken) {
      for (const res of studentReservations) {
        await markFailed(res.id, "포탈 로그인 실패 - 비밀번호 변경 가능성");
        results.push({
          reservationId: res.id,
          status: "failed",
          message: "ssotoken 획득 실패",
        });
      }
      continue;
    }

    // 5c. 도서관 로그인
    let jsessionId: string;
    try {
      jsessionId = await loginToLibrary(ssotoken);
    } catch {
      for (const res of studentReservations) {
        await markFailed(res.id, "도서관 로그인 실패");
        results.push({
          reservationId: res.id,
          status: "failed",
          message: "도서관 로그인 실패",
        });
      }
      continue;
    }

    // 5d. 각 예약 제출
    for (const res of studentReservations) {
      const [year, month, day] = res.reservation_date.split("-");
      const companions = Array.isArray(res.companions)
        ? res.companions
        : res.companions
          ? [res.companions]
          : [];

      try {
        const result = await submitReservation({
          ssotoken,
          jsessionId,
          roomId: res.room_id,
          year,
          month,
          day,
          startHour: res.start_time.split(":")[0], // "13:00" → "13"
          hours: res.hours,
          purpose: res.reason,
          companions,
        });

        if (result.success) {
          await updateStatus(res.id, "success", undefined, result.bookingId);
          results.push({
            reservationId: res.id,
            status: "success",
            message: result.message,
          });
        } else {
          await markFailed(res.id, result.message);
          results.push({
            reservationId: res.id,
            status: "failed",
            message: result.message,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "알 수 없는 에러";
        await markFailed(res.id, message);
        results.push({ reservationId: res.id, status: "failed", message });
      }
    }
  }

  // 6. 결과 반환
  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    success: true,
    targetDate,
    summary: {
      total: results.length,
      success: successCount,
      failed: failedCount,
    },
    results,
  });
}

async function updateStatus(
  reservationId: number,
  status: string,
  errorMessage?: string,
  bookingId?: string,
) {
  await supabase
    .from("reservations")
    .update({
      status,
      ...(errorMessage && { error_message: errorMessage }),
      ...(bookingId && { booking_id: bookingId }),
    })
    .eq("id", reservationId);
}

async function markFailed(reservationId: number, errorMessage: string) {
  await updateStatus(reservationId, "failed", errorMessage);
  // 실패한 예약의 슬롯 점유 해제
  await supabase
    .from("reserved_slots")
    .delete()
    .eq("reservation_id", reservationId);
}
