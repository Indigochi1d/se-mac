/**
 * 세종대 포탈 및 도서관 인증 함수
 */

/**
 * 세종대 포탈에 로그인하여 ssotoken을 획득
 */
export async function loginToPortal(
  studentId: string,
  password: string,
): Promise<string | null> {
  const formData = new URLSearchParams({
    mainLogin: "Y",
    rtUrl: process.env.SEJONG_REDIRECT_URL,
    id: studentId,
    password: password,
    chkNos: "on",
  });

  const response = await fetch(process.env.SEJONG_PORTAL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: process.env.SEJONG_HEADERS_REFERER,
    },
    body: formData.toString(),
    redirect: "manual",
  });

  const setCookieHeader = response.headers.get("set-cookie");
  const match = setCookieHeader?.match(/ssotoken=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * 포탈 SSO를 통해 library.sejong.ac.kr에 로그인하여 PO1_JSESSIONID를 획득
 */
async function getPO1JSessionId(ssotoken: string): Promise<string | null> {
  const response = await fetch(process.env.SEJONG_LIBRARY_SSO_URL, {
    method: "GET",
    headers: {
      Cookie: `ssotoken=${ssotoken}`,
    },
    redirect: "manual",
  });

  const cookies = response.headers.getSetCookie();
  for (const cookie of cookies) {
    const match = cookie.match(/PO1_JSESSIONID=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

export interface LibseatSession {
  phpSessId: string;
  token: string;
  studentName: string;
}

/**
 * ssotoken으로 libseat에 로그인하여 PHPSESSID, token, 학생 이름을 획득
 * 내부적으로 library SSO → studyroom 페이지 파싱 → libseat 접근 순서로 진행
 */
export async function loginToLibseat(
  ssotoken: string,
): Promise<LibseatSession | null> {
  // 1. PO1_JSESSIONID 획득
  const po1JsessionId = await getPO1JSessionId(ssotoken);
  if (!po1JsessionId) return null;

  // 2. library studyroom 페이지에서 libseat URL + 학생 이름 파싱
  const libraryRes = await fetch(process.env.SEJONG_LIBRARY_STUDYROOM_URL, {
    method: "GET",
    headers: {
      Cookie: `ssotoken=${ssotoken}; PO1_JSESSIONID=${po1JsessionId}`,
    },
  });

  const html = await libraryRes.text();

  const nameMatch = html.match(/<span class="userId">([^<]+)<\/span>/);
  const studentName = nameMatch ? nameMatch[1].trim() : "";

  const urlMatch = html.match(/libseat\.sejong\.ac\.kr[^\s"'<>]*/);
  if (!urlMatch) return null;

  const libseatUrl = `https://${urlMatch[0]}`;
  const token = new URL(libseatUrl).searchParams.get("token") ?? "";

  // 3. libseat URL 접근하여 PHPSESSID 획득
  const libseatRes = await fetch(libseatUrl, {
    method: "GET",
    redirect: "manual",
  });

  const setCookies = libseatRes.headers.getSetCookie();
  for (const cookie of setCookies) {
    const m = cookie.match(/PHPSESSID=([^;]+)/);
    if (m) return { phpSessId: m[1], token, studentName };
  }
  return null;
}
