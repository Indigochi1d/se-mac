import { fetchReserveNo } from "@/lib/sejong/myseat";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const baseParams = {
  token: "libseat-tok",
  phpSessId: "php-sess",
  date: "2026-03-19",
  roomId: "4",
  startTime: "16:00",
  hours: 2,
};

// mySeat.php HTML 픽스처 생성 헬퍼
function makeMySeatHtml(reserveNo: string, date: string, room: string, time: string) {
  return `
    <div class='item'>
      <p>${date}</p>
      <p>${room}</p>
      <p>${time}</p>
      <a href="javascript:cancelSroom("${reserveNo}")">취소</a>
    </div>
  `;
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetchReserveNo", () => {
  it("날짜/룸/시간이 일치하는 아이템에서 reserveNo 추출", async () => {
    // "2026-03-19" → "2026.03.19", "4" → "S1층 04스터디룸", "16:00 ~ 18:00"
    const html = makeMySeatHtml("RES-999", "2026.03.19", "S1층 04스터디룸", "16:00 ~ 18:00");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const result = await fetchReserveNo(baseParams);
    expect(result).toBe("RES-999");
  });

  it("일치하는 아이템이 없으면 undefined", async () => {
    const html = makeMySeatHtml("RES-000", "2026.03.20", "S1층 04스터디룸", "16:00 ~ 18:00");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const result = await fetchReserveNo(baseParams);
    expect(result).toBeUndefined();
  });

  it("HTTP 에러 → undefined", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await fetchReserveNo(baseParams);
    expect(result).toBeUndefined();
  });

  it("fetch throw → undefined", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    const result = await fetchReserveNo(baseParams);
    expect(result).toBeUndefined();
  });

  it("1시간 예약 시 종료시간 계산 정확 (16:00 + 1 = 17:00)", async () => {
    const html = makeMySeatHtml("RES-111", "2026.03.19", "S1층 04스터디룸", "16:00 ~ 17:00");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const result = await fetchReserveNo({ ...baseParams, hours: 1 });
    expect(result).toBe("RES-111");
  });

  it("URL에 token 포함되어 요청", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "",
    });

    await fetchReserveNo(baseParams);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("token=libseat-tok");
  });
});
