/**
 * 세종대 도서관 스터디룸 예약 제출 로직
 * Python create_reservation 함수를 TypeScript로 포팅
 */
import * as cheerio from "cheerio";

const STUDYROOM_RESERVE_URL =
  "https://library.sejong.ac.kr/studyroom/Request.ax?roomId=";
const STUDYROOM_BOOKING_PROCESS_URL =
  "https://library.sejong.ac.kr/studyroom/BookingProcess.axa";

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
}

/**
 * 예약 폼 페이지에서 hidden 필드를 파싱
 */
async function fetchFormFields(
  ssotoken: string,
  jsessionId: string,
  roomId: string,
): Promise<Record<string, string>> {
  const response = await fetch(STUDYROOM_RESERVE_URL + roomId, {
    method: "GET",
    headers: {
      Cookie: `ssotoken=${ssotoken}; JSESSIONID=${jsessionId}`,
    },
  });

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
  const response = await fetch(STUDYROOM_BOOKING_PROCESS_URL, {
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
    return { success: true, message: "예약이 완료되었습니다." };
  }

  const body = await response.text();
  return { success: false, message: body.trim() || "예약에 실패했습니다." };
}
