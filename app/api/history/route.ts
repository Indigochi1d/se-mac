import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import supabase from "@/lib/db";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const studentId = cookieStore.get("student_id")?.value;

    if (!studentId) {
      return NextResponse.json(
        { success: false, message: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const { data, error } = await supabase
      .from("reservations")
      .select(
        "id, group_id, room_id, reservation_date, start_time, hours, status, booking_id",
      )
      .eq("student_id", studentId)
      .order("reservation_date", { ascending: true });

    if (error) throw error;

    // group_id 기준 그룹핑
    const groupMap = new Map<
      string,
      {
        groupId: string;
        roomId: string;
        startTime: string;
        hours: number;
        reservations: {
          id: number;
          date: string;
          status: string;
          bookingId: string | null;
        }[];
      }
    >();

    for (const row of data) {
      const gid = row.group_id;

      if (!groupMap.has(gid)) {
        groupMap.set(gid, {
          groupId: gid,
          roomId: row.room_id,
          startTime: row.start_time,
          hours: row.hours,
          reservations: [],
        });
      }

      groupMap.get(gid)!.reservations.push({
        id: row.id,
        date: row.reservation_date,
        status: row.status,
        bookingId: row.booking_id,
      });
    }

    // 최신 그룹 먼저 (첫 예약 날짜 기준 내림차순)
    const groups = [...groupMap.values()].sort((a, b) =>
      b.reservations[0].date.localeCompare(a.reservations[0].date),
    );

    return NextResponse.json({ success: true, data: groups });
  } catch (error) {
    console.error("예약 조회 에러:", error);
    return NextResponse.json(
      { success: false, message: "예약 목록을 불러올 수 없습니다." },
      { status: 500 },
    );
  }
}
