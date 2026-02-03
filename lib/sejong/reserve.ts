/**
 * 세종대 도서관 스터디룸 예약 제출 로직
 */
import * as cheerio from "cheerio";

interface Companion {
  student_id: string;
  name: string;
  ipid: string;
}

interface ReservationParams {
  ssotoken: string;
  jsessionId: string;
  roomId: string;
  year: string;
  month: string;
  day: string;
  startHour: string;
  hours: number;
  purpose: string;
  companions: Companion[];
}

interface ReservationResult {
  success: boolean;
  message: string;
  bookingId?: string;
}

/**
 * 스터디룸 메인 페이지에서 예약 목록을 파싱하여 bookingId 조회
 * cheerio 대신 정규식 사용 (HTML 오류로 인한 파싱 문제 우회)
 */
async function fetchBookingId(
  ssotoken: string,
  roomId: string,
  year: string,
  month: string,
  day: string,
  startHour: string,
): Promise<string | undefined> {
  // 도서관 로그인하여 세션 쿠키 획득
  const loginResponse = await fetch(process.env.SEJONG_LIBRARY_LOGIN_URL!, {
    headers: {
      Cookie: `ssotoken=${ssotoken}`,
    },
    redirect: "manual",
  });

  const libraryCookies = loginResponse.headers.getSetCookie();
  const cookieHeader = libraryCookies.map((c) => c.split(";")[0]).join("; ");

  // 메인 페이지 조회 (ssotoken도 함께 전달)
  const response = await fetch(process.env.SEJONG_LIBRARY_STUDYROOM_URL!, {
    headers: {
      Cookie: `ssotoken=${ssotoken}; ${cookieHeader}`,
    },
  });

  const html = await response.text();

  // HTML 날짜 형식: 2026/02/10 (슬래시)
  const targetDate = `${year}/${month.padStart(2, "0")}/${day.padStart(2, "0")}`;
  const targetTime = `${startHour.padStart(2, "0")}:00`;

  // 정규식으로 각 <tr> 블록 추출
  const trPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const trMatches = html.match(trPattern) || [];

  for (const trContent of trMatches) {
    // goStudyRoomBookingDetail('bookingId','ipid','roomId') 패턴 추출
    const detailMatch = trContent.match(
      /goStudyRoomBookingDetail\('(\d+)','(\d+)','(\d+)'\)/,
    );
    if (!detailMatch) continue;

    const [, rowBookingId, , rowRoomId] = detailMatch;

    // roomId 확인
    if (rowRoomId !== roomId) continue;

    // 날짜/시간 확인 (2026/02/10 14:00 형식)
    if (trContent.includes(targetDate) && trContent.includes(targetTime)) {
      return rowBookingId;
    }
  }

  return undefined;
}

/**
 * 예약 폼 페이지에서 hidden 필드를 파싱
 */
async function fetchFormFields(
  ssotoken: string,
  jsessionId: string,
  roomId: string,
): Promise<Record<string, string>> {
  const response = await fetch(
    process.env.SEJONG_STUDYROOM_RESERVE_URL + roomId,
    {
      method: "GET",
      headers: {
        Cookie: `ssotoken=${ssotoken}; JSESSIONID=${jsessionId}`,
      },
    },
  );

  const html = await response.text();
  const $ = cheerio.load(html);

  const fields: Record<string, string> = {};
  $("#frmMain input").each((_, el) => {
    const name = $(el).attr("name");
    if (name) {
      fields[name] = $(el).attr("value") ?? "";
    }
  });

  return fields;
}

/**
 * 스터디룸 예약을 도서관 시스템에 제출
 */
export async function submitReservation(
  params: ReservationParams,
): Promise<ReservationResult> {
  const {
    ssotoken,
    jsessionId,
    roomId,
    year,
    month,
    day,
    startHour,
    hours,
    purpose,
    companions,
  } = params;

  // 1. 예약 폼 페이지에서 hidden 필드 가져오기
  const formFields = await fetchFormFields(ssotoken, jsessionId, roomId);

  // 2. 동반이용자 정보 추가
  companions.forEach((companion, index) => {
    const i = index + 1;
    formFields[`altPid${i}`] = companion.student_id;
    formFields[`name${i}`] = companion.name;
    formFields[`ipid${i}`] = companion.ipid;
  });

  // 3. 예약 정보 설정
  formFields["year"] = year;
  formFields["month"] = month;
  formFields["day"] = day;
  formFields["startHour"] = startHour;
  formFields["closeTime"] = "22";
  formFields["hours"] = String(hours);
  formFields["purpose"] = purpose;
  formFields["mode"] = "INSERT";

  // 4. 예약 제출
  const response = await fetch(process.env.SEJONG_LIBRARY_RESERVE_PROCESS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: `ssotoken=${ssotoken}; JSESSIONID=${jsessionId}`,
    },
    body: new URLSearchParams(formFields).toString(),
  });

  // 5. 결과 확인
  const xJson = response.headers.get("X-JSON");

  if (xJson && xJson.includes("true")) {
    // 6. 예약 성공 시 메인 페이지에서 bookingId 조회

    const bookingId = await fetchBookingId(
      ssotoken,
      roomId,
      year,
      month,
      day,
      startHour,
    );

    return {
      success: true,
      message: "예약이 완료되었습니다.",
      bookingId,
    };
  }

  const body = await response.text();
  return { success: false, message: body.trim() || "예약에 실패했습니다." };
}
