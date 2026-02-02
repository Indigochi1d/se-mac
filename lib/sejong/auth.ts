/**
 * 세종대 포탈 및 도서관 인증 함수
 * 기존 app/api/auth/login/route.ts, app/api/students/verify/route.ts 로직을 재사용 가능하게 추출
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
 * 도서관 시스템에 SSO 로그인하여 JSESSIONID를 획득
 */
export async function loginToLibrary(ssotoken: string): Promise<string> {
  const response = await fetch(process.env.SEJONG_LIBRARY_LOGIN_URL, {
    method: "GET",
    headers: {
      Cookie: `ssotoken=${ssotoken}`,
    },
  });

  const setCookieHeader = response.headers.get("set-cookie");
  const match = setCookieHeader?.match(/JSESSIONID=([^;]+)/);
  return match ? match[1] : "";
}
