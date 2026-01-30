import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sql from "@/lib/db";
import { generateRecurringDates } from "@/lib/date";

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

    // 4. group_id 생성
    const groupId = randomUUID();

    // 5. 트랜잭션으로 INSERT
    await sql.begin(async (_tx) => {
      const tx = _tx as unknown as typeof sql;

      for (const date of dates) {
        const [reservation] = await tx`
          INSERT INTO reservations (student_id, group_id, room_id, reservation_date, start_time, hours, reason, status)
          VALUES (${studentId}, ${groupId}, ${studyRoomId}, ${date}, ${startTime}, ${hours}, ${reason}, 'pending')
          RETURNING id
        `;

        const reservationId = reservation.id;

        // 동반 이용자
        for (const c of companions) {
          await tx`
            INSERT INTO companions (reservation_id, student_id, name, ipid)
            VALUES (${reservationId}, ${c.studentId}, ${c.name}, ${c.ipid})
          `;
        }

        // 인증 정보
        await tx`
          INSERT INTO reservation_credentials (reservation_id, student_id, password)
          VALUES (${reservationId}, ${studentId}, ${encPassword})
        `;
      }
    });

    return NextResponse.json({
      success: true,
      message: `${dates.length}건의 반복 예약이 등록되었습니다.`,
      data: {
        groupId,
        count: dates.length,
        dates,
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
