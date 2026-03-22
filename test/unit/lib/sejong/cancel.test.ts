import { cancelLibseatReservation } from "@/lib/sejong/cancel";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const baseParams = {
  userID: "20001234",
  reserveNo: "RES-001",
  token: "libseat-tok",
  phpSessId: "php-sess",
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe("cancelLibseatReservation", () => {
  it("HTTP 200 → 성공 반환", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "OK",
    });

    const result = await cancelLibseatReservation(baseParams);
    expect(result.success).toBe(true);
    expect(result.message).toBe("도서관 예약이 취소되었습니다.");
  });

  it("HTTP 에러 → 실패 반환 (body 메시지 포함)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "취소할 수 없는 예약입니다.",
    });

    const result = await cancelLibseatReservation(baseParams);
    expect(result.success).toBe(false);
    expect(result.message).toBe("취소할 수 없는 예약입니다.");
  });

  it("HTTP 에러이고 body가 비어있으면 기본 에러 메시지", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "",
    });

    const result = await cancelLibseatReservation(baseParams);
    expect(result.success).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("올바른 URL과 form data로 POST 요청", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "",
    });

    await cancelLibseatReservation(baseParams);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(process.env.SEJONG_LIBSEAT_CANCEL_URL);
    expect(options.method).toBe("POST");
    expect(options.body).toContain("userID=20001234");
    expect(options.body).toContain("reserveNo=RES-001");
  });

  it("Cookie 헤더에 token과 PHPSESSID 포함", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "",
    });

    await cancelLibseatReservation(baseParams);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Cookie).toContain("token=libseat-tok");
    expect(options.headers.Cookie).toContain("PHPSESSID=php-sess");
  });
});
