import { loginToPortal, loginToLibseat } from "@/lib/sejong/auth";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

// Headers mock helper
function makeHeaders(setCookie: string | null): Headers {
  const headers = new Headers();
  if (setCookie) headers.set("set-cookie", setCookie);
  return headers;
}

function makeSetCookieHeaders(cookies: string[]): Headers {
  const map = new Map<string, string[]>();
  map.set("set-cookie", cookies);
  const headers = {
    get: (key: string) => (key === "set-cookie" ? cookies[0] ?? null : null),
    getSetCookie: () => cookies,
  } as unknown as Headers;
  return headers;
}

describe("loginToPortal", () => {
  it("ssotoken이 set-cookie에 있으면 토큰 반환", async () => {
    mockFetch.mockResolvedValueOnce({
      headers: makeHeaders("ssotoken=abc123; Path=/"),
    });

    const result = await loginToPortal("20001234", "password123");
    expect(result).toBe("abc123");
    expect(mockFetch).toHaveBeenCalledWith(
      process.env.SEJONG_PORTAL_URL,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("set-cookie에 ssotoken이 없으면 null 반환", async () => {
    mockFetch.mockResolvedValueOnce({
      headers: makeHeaders("other-cookie=value; Path=/"),
    });

    const result = await loginToPortal("20001234", "wrongpassword");
    expect(result).toBeNull();
  });

  it("set-cookie 헤더 자체가 없으면 null 반환", async () => {
    mockFetch.mockResolvedValueOnce({
      headers: makeHeaders(null),
    });

    const result = await loginToPortal("20001234", "wrongpassword");
    expect(result).toBeNull();
  });

  it("올바른 form data로 요청", async () => {
    mockFetch.mockResolvedValueOnce({
      headers: makeHeaders("ssotoken=tok; Path=/"),
    });

    await loginToPortal("20001234", "mypassword");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.body).toContain("id=20001234");
    expect(options.body).toContain("password=mypassword");
    expect(options.body).toContain("mainLogin=Y");
  });
});

describe("loginToLibseat", () => {
  const ssotoken = "test-sso-token";

  it("정상 흐름: 3단계 fetch 모두 성공 시 세션 정보 반환", async () => {
    // 1. getPO1JSessionId → PO1_JSESSIONID 쿠키
    mockFetch.mockResolvedValueOnce({
      headers: makeSetCookieHeaders(["PO1_JSESSIONID=sess123; Path=/"]),
    });

    // 2. library studyroom 페이지 → HTML with studentName + libseat URL
    const libraryHtml = `
      <span class="userId">홍길동</span>
      <a href="https://libseat.sejong.ac.kr/mobile/MA/sroomMap.php?token=mytoken123">예약</a>
    `;
    mockFetch.mockResolvedValueOnce({
      text: async () => libraryHtml,
    });

    // 3. libseat URL 접근 → PHPSESSID 쿠키
    mockFetch.mockResolvedValueOnce({
      headers: makeSetCookieHeaders(["PHPSESSID=php999; Path=/"]),
    });

    const result = await loginToLibseat(ssotoken);

    expect(result).toEqual({
      phpSessId: "php999",
      token: "mytoken123",
      studentName: "홍길동",
    });
  });

  it("PO1_JSESSIONID 없으면 null", async () => {
    mockFetch.mockResolvedValueOnce({
      headers: makeSetCookieHeaders([]),
    });

    const result = await loginToLibseat(ssotoken);
    expect(result).toBeNull();
  });

  it("library HTML에 libseat URL 없으면 null", async () => {
    mockFetch.mockResolvedValueOnce({
      headers: makeSetCookieHeaders(["PO1_JSESSIONID=sess123"]),
    });
    mockFetch.mockResolvedValueOnce({
      text: async () => "<html>no libseat link here</html>",
    });

    const result = await loginToLibseat(ssotoken);
    expect(result).toBeNull();
  });

  it("libseat 응답에 PHPSESSID 없으면 null", async () => {
    mockFetch.mockResolvedValueOnce({
      headers: makeSetCookieHeaders(["PO1_JSESSIONID=sess123"]),
    });
    mockFetch.mockResolvedValueOnce({
      text: async () =>
        '<a href="https://libseat.sejong.ac.kr/test?token=tok">링크</a>\n<span class="userId">김씨</span>',
    });
    mockFetch.mockResolvedValueOnce({
      headers: makeSetCookieHeaders([]),
    });

    const result = await loginToLibseat(ssotoken);
    expect(result).toBeNull();
  });
});
