import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const roomId = searchParams.get("roomId");
  const dates = searchParams.get("dates"); // 쉼표 구분 "2025-02-10,2025-02-17"

  if (!roomId || !dates) {
    return NextResponse.json(
      { success: false, message: "roomId와 dates는 필수입니다." },
      { status: 400 },
    );
  }

  const dateList = dates.split(",").map((d) => d.trim());

  const { data, error } = await supabase
    .from("reserved_slots")
    .select("slot_date, slot_time")
    .eq("room_id", roomId)
    .in("slot_date", dateList);

  if (error) {
    return NextResponse.json(
      { success: false, message: "슬롯 조회 실패" },
      { status: 500 },
    );
  }

  // { "2025-02-10": ["14:00", "15:00"], "2025-02-17": ["10:00"] }
  const slotsByDate: Record<string, string[]> = {};
  for (const row of data) {
    const date = row.slot_date;
    if (!slotsByDate[date]) slotsByDate[date] = [];
    slotsByDate[date].push(row.slot_time);
  }

  return NextResponse.json({ success: true, data: slotsByDate });
}
