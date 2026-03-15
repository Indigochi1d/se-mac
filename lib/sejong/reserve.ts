/**
 * 세종대 도서관 스터디룸 예약 제출 로직
 */
import { STUDY_ROOMS } from "@/constants/studyroom";

interface Companion {
  student_id: string;
  name: string;
}

interface ReservationParams {
  ssotoken: string;
  phpSessId: string;
  token: string;
  roomId: string;
  reserveDate: string; // YYYYMMDD
  startTime: string; // HHMM
  hours: number;
  studentId: string;
  studentName: string;
  companions: Companion[];
}

interface ReservationResult {
  success: boolean;
  message: string;
}

/**
 * 스터디룸 예약을 도서관 시스템에 제출
 */
export async function submitReservation(
  params: ReservationParams,
): Promise<ReservationResult> {
  const {
    ssotoken,
    phpSessId,
    token,
    roomId,
    reserveDate,
    startTime,
    hours,
    studentId,
    studentName,
    companions,
  } = params;

  const room = STUDY_ROOMS.find((r) => r.id === roomId);
  if (!room) {
    return { success: false, message: "알 수 없는 룸 ID입니다." };
  }

  const seatCnt = room.maxPeople;
  const sroomTitle = `그룹스터디룸${seatCnt}인실`;
  const sroomName = `${roomId.padStart(2, "0")}스터디룸`;
  const roomGB = "S1";

  // 1. 예약 폼 페이지 GET (세션 컨텍스트 설정)
  const formUrl = new URL(process.env.SEJONG_LIBSEAT_RESERVE_FORM_URL!);
  formUrl.searchParams.set("token", token);
  formUrl.searchParams.set("roomGB", roomGB);
  formUrl.searchParams.set("seatCnt", String(seatCnt));
  formUrl.searchParams.set("sroomTitle", sroomTitle);
  formUrl.searchParams.set("reserveDate", reserveDate);
  formUrl.searchParams.set("sroomNo", roomId);
  formUrl.searchParams.set("sroomName", sroomName);
  formUrl.searchParams.set("startTime", startTime);

  await fetch(formUrl.toString(), {
    method: "GET",
    headers: {
      Cookie: `PHPSESSID=${phpSessId}; ssotoken=${ssotoken}`,
    },
  });

  // 2. 예약 제출 POST
  const userIDs = [studentId, ...companions.map((c) => c.student_id)].join("|");
  const userNames = [studentName, ...companions.map((c) => c.name)].join("|");

  const formData = new URLSearchParams({
    userID: userIDs,
    userName: userNames,
    roomNo: roomId,
    reserveDate,
    startTime,
    useTime: String(hours * 60),
  });

  const response = await fetch(process.env.SEJONG_LIBSEAT_RESERVE_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: `PHPSESSID=${phpSessId}; ssotoken=${ssotoken}`,
      Referer: formUrl.toString(),
      "X-Requested-With": "XMLHttpRequest",
    },
    body: formData.toString(),
  });

  const body = (await response.text()).trim();

  if (!response.ok) {
    return { success: false, message: body || "예약에 실패했습니다." };
  }

  // XML 응답 파싱: resultCode=0 → 성공
  if (body.length > 0) {
    const codeMatch = body.match(
      /<resultCode><!\[CDATA\[(\d+)\]\]><\/resultCode>/,
    );
    const msgMatch = body.match(
      /<resultMsg><!\[CDATA\[([\s\S]*?)\]\]><\/resultMsg>/,
    );

    const resultCode = codeMatch ? parseInt(codeMatch[1], 10) : -1;
    const resultMsg = msgMatch ? msgMatch[1].trim() : body;

    if (resultCode === 0) {
      return { success: true, message: resultMsg };
    }
    return { success: false, message: resultMsg };
  }

  return { success: true, message: "예약이 완료되었습니다." };
}
