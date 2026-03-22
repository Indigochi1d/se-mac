import { readFileSync } from "fs";
import { join } from "path";
import {
  getLibseatUnavailableTimes,
  parseUnavailableTimesForRoom,
} from "@/lib/sejong/availability";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const fixture12 = readFileSync(
  join(__dirname, "../../../fixtures/availability-12.html"),
  "utf-8",
);
const fixture6 = readFileSync(
  join(__dirname, "../../../fixtures/availability-6.html"),
  "utf-8",
);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("parseUnavailableTimesForRoom (HTML 파서 직접 테스트)", () => {
  describe("12인실 (단독 룸, at-title 없음)", () => {
    it("예약불가 시간을 올바르게 파싱", () => {
      // 스터디룸 01 = 11 (roomId) → name은 "스터디룸 11" 이지만 12인실은 단독
      const result = parseUnavailableTimesForRoom(fixture12, "스터디룸 11");
      expect(result.has("10:00")).toBe(true);
      expect(result.has("14:00")).toBe(true);
      expect(result.has("09:00")).toBe(false);
      expect(result.has("11:00")).toBe(false);
    });
  });

  describe("6인실 멀티컬럼", () => {
    it("02스터디룸 (index 0): 10:00 불가", () => {
      const result = parseUnavailableTimesForRoom(fixture6, "스터디룸 02");
      expect(result.has("10:00")).toBe(true);
      expect(result.has("09:00")).toBe(false);
      expect(result.has("11:00")).toBe(false);
    });

    it("03스터디룸 (index 1): 09:00 불가", () => {
      const result = parseUnavailableTimesForRoom(fixture6, "스터디룸 03");
      expect(result.has("09:00")).toBe(true);
      expect(result.has("10:00")).toBe(false);
    });

    it("04스터디룸 (index 2): 11:00 불가", () => {
      const result = parseUnavailableTimesForRoom(fixture6, "스터디룸 04");
      expect(result.has("11:00")).toBe(true);
      expect(result.has("09:00")).toBe(false);
    });

    it("존재하지 않는 룸 이름이면 빈 Set", () => {
      const result = parseUnavailableTimesForRoom(fixture6, "스터디룸 99");
      expect(result.size).toBe(0);
    });
  });
});

describe("getLibseatUnavailableTimes", () => {
  it("fetch 성공 시 불가 시간 Set 반환", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => fixture12,
    });

    // roomId "11" = 12인실 (스터디룸 11)
    const result = await getLibseatUnavailableTimes("11", "20260319");
    expect(result.has("10:00")).toBe(true);
    expect(result.has("09:00")).toBe(false);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(process.env.SEJONG_LIBSEAT_ROOM_MAP_URL!),
    );
  });

  it("알 수 없는 roomId → 빈 Set", async () => {
    const result = await getLibseatUnavailableTimes("999", "20260319");
    expect(result.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetch 실패 (HTTP error) → 빈 Set", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await getLibseatUnavailableTimes("11", "20260319");
    expect(result.size).toBe(0);
  });

  it("fetch throw → 빈 Set", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    const result = await getLibseatUnavailableTimes("11", "20260319");
    expect(result.size).toBe(0);
  });

  it("URL에 올바른 쿼리 파라미터 포함", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => fixture12,
    });

    await getLibseatUnavailableTimes("11", "20260319");
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("reserveDate=20260319");
    expect(calledUrl).toContain("seatCnt=12");
    expect(calledUrl).toContain("seq=0");
  });
});
