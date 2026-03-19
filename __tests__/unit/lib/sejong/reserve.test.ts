import { submitReservation } from "@/lib/sejong/reserve";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const baseParams = {
  ssotoken: "sso-tok",
  phpSessId: "php-sess",
  token: "libseat-tok",
  roomId: "4", // STUDY_ROOMS에 존재하는 ID
  reserveDate: "20260319",
  startTime: "1400",
  hours: 2,
  studentId: "20001234",
  studentName: "홍길동",
  companions: [],
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe("submitReservation", () => {
  it("resultCode=0 → 성공 반환", async () => {
    // 1번째: 폼 GET (응답 무시)
    mockFetch.mockResolvedValueOnce({});
    // 2번째: POST → XML 성공 응답
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        `<result><resultCode><![CDATA[0]]></resultCode><resultMsg><![CDATA[예약이 완료되었습니다.]]></resultMsg></result>`,
    });

    const result = await submitReservation(baseParams);
    expect(result.success).toBe(true);
    expect(result.message).toBe("예약이 완료되었습니다.");
  });

  it("resultCode != 0 → 실패 반환 (메시지 포함)", async () => {
    mockFetch.mockResolvedValueOnce({});
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        `<result><resultCode><![CDATA[1]]></resultCode><resultMsg><![CDATA[이미 예약된 시간입니다.]]></resultMsg></result>`,
    });

    const result = await submitReservation(baseParams);
    expect(result.success).toBe(false);
    expect(result.message).toBe("이미 예약된 시간입니다.");
  });

  it("HTTP 에러 → 실패 반환", async () => {
    mockFetch.mockResolvedValueOnce({});
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "서버 오류",
    });

    const result = await submitReservation(baseParams);
    expect(result.success).toBe(false);
  });

  it("알 수 없는 roomId → 실패 반환 (fetch 호출 없음)", async () => {
    const result = await submitReservation({ ...baseParams, roomId: "999" });
    expect(result.success).toBe(false);
    expect(result.message).toContain("알 수 없는 룸 ID");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("동반자 있을 때 userID/userName 파이프 구분자 포함", async () => {
    mockFetch.mockResolvedValueOnce({});
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "",
    });

    await submitReservation({
      ...baseParams,
      companions: [{ student_id: "20005678", name: "김영희" }],
    });

    const postCall = mockFetch.mock.calls[1];
    const [, options] = postCall;
    expect(options.body).toContain("20001234%7C20005678"); // | → %7C
    expect(options.body).toContain(encodeURIComponent("홍길동|김영희"));
  });

  it("빈 XML 응답이면 성공으로 처리", async () => {
    mockFetch.mockResolvedValueOnce({});
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "",
    });

    const result = await submitReservation(baseParams);
    expect(result.success).toBe(true);
  });
});
