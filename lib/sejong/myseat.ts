/**
 * libseat mySeat.php에서 예약 정보 조회
 */

/**
 * 예약 직후 mySeat.php를 조회해 해당 예약의 reserveNo 추출
 * @param token libseat token
 * @param phpSessId PHPSESSID
 * @param date YYYY-MM-DD
 * @param roomId STUDY_ROOMS의 id (e.g. "4")
 * @param startTime HH:MM
 * @param hours 1 or 2
 */
export async function fetchReserveNo(params: {
  token: string;
  phpSessId: string;
  date: string;
  roomId: string;
  startTime: string;
  hours: number;
}): Promise<string | undefined> {
  const { token, phpSessId, date, roomId, startTime, hours } = params;

  const url = new URL(process.env.SEJONG_LIBSEAT_MY_SEAT_URL!);
  url.searchParams.set("token", token);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Cookie: `token=${token}; PHPSESSID=${phpSessId}`,
      },
    });
    if (!response.ok) return undefined;
    const html = await response.text();

    // YYYY-MM-DD → YYYY.MM.DD
    const htmlDate = date.replace(/-/g, ".");

    // "4" → "S1층 04스터디룸"
    const htmlRoom = `S1층 ${roomId.padStart(2, "0")}스터디룸`;

    // "16:00", hours=2 → "16:00 ~ 18:00"
    const [hh, mm] = startTime.split(":").map(Number);
    const endMinutes = hh * 60 + mm + hours * 60;
    const endHH = Math.floor(endMinutes / 60).toString().padStart(2, "0");
    const endMM = (endMinutes % 60).toString().padStart(2, "0");
    const htmlTime = `${startTime} ~ ${endHH}:${endMM}`;

    // item 블록 분리 후 date + room + time + cancelSroom 매칭
    const items = html.split("<div class='item'>");
    items.shift();

    for (const item of items) {
      if (
        item.includes(htmlDate) &&
        item.includes(htmlRoom) &&
        item.includes(htmlTime)
      ) {
        const match = item.match(/cancelSroom\("([^"]+)"\)/);
        if (match) return match[1];
      }
    }
  } catch {
    // 조회 실패 시 undefined 반환 — 취소 기능은 booking_id 없이도 DB에서 처리 가능
  }

  return undefined;
}
