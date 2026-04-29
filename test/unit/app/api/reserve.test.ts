// next/headers mock
const mockCookieGet = jest.fn();
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: mockCookieGet })),
}));

// Supabase mock - 복잡한 체인 처리
const mockDbFrom = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { from: (...args: unknown[]) => mockDbFrom(...args) },
}));

// lib/date mock - generateRecurringDates
jest.mock("@/lib/date", () => ({
  ...jest.requireActual("@/lib/date"),
  generateRecurringDates: jest.fn(() => ["2026-03-26", "2026-04-02"]),
}));

// lib/sejong/availability mock
const mockGetUnavailableTimes = jest.fn();
jest.mock("@/lib/sejong/availability", () => ({
  getLibseatUnavailableTimes: (...args: unknown[]) => mockGetUnavailableTimes(...args),
}));

// lib/sejong/auth mock
const mockLoginToLibseat = jest.fn();
jest.mock("@/lib/sejong/auth", () => ({
  loginToLibseat: (...args: unknown[]) => mockLoginToLibseat(...args),
}));

// lib/sejong/reserve mock
const mockSubmitReservation = jest.fn();
jest.mock("@/lib/sejong/reserve", () => ({
  submitReservation: (...args: unknown[]) => mockSubmitReservation(...args),
}));

// lib/sejong/myseat mock
jest.mock("@/lib/sejong/myseat", () => ({
  fetchReserveNo: jest.fn(async () => undefined),
}));

// lib/email mock
jest.mock("@/lib/email", () => ({
  sendReservationEmail: jest.fn(async () => undefined),
}));

// lib/discord mock
const mockSendReservationDiscordNotification = jest.fn();
jest.mock("@/lib/discord", () => ({
  sendReservationDiscordNotification: (...args: unknown[]) =>
    mockSendReservationDiscordNotification(...args),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/reservations/reserve/route";
import { generateRecurringDates } from "@/lib/date";

const validBody = {
  studyRoomId: "4",
  selectedDay: "mon",
  startTime: "14:00",
  hours: 2,
  companions: [],
  reason: "스터디",
  endDate: "2026-06-30",
};

function makeRequest(body: object, withCookies = true): NextRequest {
  if (withCookies) {
    mockCookieGet.mockImplementation((name: string) => {
      if (name === "ssotoken") return { value: "sso-tok" };
      if (name === "student_id") return { value: "20001234" };
      return undefined;
    });
  } else {
    mockCookieGet.mockReturnValue(undefined);
  }
  return new NextRequest("http://localhost:3000/api/reservations/reserve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// DB 체인 빌더
function makeDbChain(overrides: Record<string, jest.Mock> = {}) {
  const single = jest.fn().mockResolvedValue({ data: { password: "enc-pw" }, error: null });
  const eqSingle = jest.fn(() => ({ single }));
  const selectCredential = jest.fn(() => ({ eq: eqSingle }));

  const insertSingle = overrides.insertSingle ?? jest.fn().mockResolvedValue({
    data: { id: 1 },
    error: null,
  });
  const insertSelect = jest.fn(() => ({ single: insertSingle }));
  const insertFn = jest.fn(() => ({
    select: insertSelect,
    // slots/companions/credentials insert (체인 없이 바로 resolve)
  }));
  const insertDirect = overrides.insertDirect ?? jest.fn().mockResolvedValue({ error: null });

  const deleteFn = jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) }));
  const updateFn = jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) }));

  mockDbFrom.mockImplementation((table: string) => {
    if (table === "user_credentials") return { select: selectCredential };
    if (table === "reservations") return {
      insert: jest.fn(() => ({ select: jest.fn(() => ({ single: insertSingle })) })),
      update: updateFn,
      delete: deleteFn,
    };
    if (table === "reserved_slots") return {
      insert: insertDirect,
      delete: deleteFn,
    };
    if (table === "companions") return { insert: insertDirect };
    if (table === "reservation_credentials") return { insert: insertDirect };
    return {};
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // 2026-03-25로 고정 → "2026-03-26"이 schedulableFrom(+7=2026-04-01)보다 이전 → 즉시예약 대상
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-03-25T10:00:00"));
  mockGetUnavailableTimes.mockResolvedValue(new Set());
  mockLoginToLibseat.mockResolvedValue({
    phpSessId: "php-sess",
    token: "tok",
    studentName: "홍길동",
  });
  mockSubmitReservation.mockResolvedValue({ success: true, message: "완료" });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("POST /api/reservations/reserve - 인증", () => {
  it("쿠키 없으면 401", async () => {
    const res = await POST(makeRequest(validBody, false));
    expect(res.status).toBe(401);
  });

  it("user_credentials 없으면 401", async () => {
    mockCookieGet.mockImplementation((name: string) => {
      if (name === "ssotoken") return { value: "sso-tok" };
      if (name === "student_id") return { value: "20001234" };
      return undefined;
    });
    mockDbFrom.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/reservations/reserve - 입력값 검증", () => {
  beforeEach(() => makeDbChain());

  it("필수 필드 누락 (studyRoomId 없음) → 400", async () => {
    const { studyRoomId: _, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("hours가 1, 2 이외 → 400", async () => {
    const res = await POST(makeRequest({ ...validBody, hours: 3 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("1시간 또는 2시간");
  });

  it("유효하지 않은 요일 → 400", async () => {
    const res = await POST(makeRequest({ ...validBody, selectedDay: "sat" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("요일");
  });

  it("startDate가 selectedDay와 다른 요일이면 400 반환", async () => {
    // selectedDay: "mon"(월=1), startDate: "2026-03-26"(목=4) → 불일치
    const res = await POST(makeRequest({ ...validBody, startDate: "2026-03-26" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toMatch(/요일/);
  });
});

describe("POST /api/reservations/reserve - startDate 전달", () => {
  beforeEach(() => makeDbChain());

  it("startDate가 올바른 요일이면 generateRecurringDates에 startDate 전달", async () => {
    // selectedDay: "mon", startDate: "2026-03-23"(월)
    const req = makeRequest({ ...validBody, startDate: "2026-03-23" });
    await POST(req);
    expect(generateRecurringDates).toHaveBeenCalledWith("mon", "2026-06-30", "2026-03-23");
  });

  it("startDate 없으면 generateRecurringDates에 undefined 전달 (기존 동작)", async () => {
    const req = makeRequest(validBody);
    await POST(req);
    expect(generateRecurringDates).toHaveBeenCalledWith("mon", "2026-06-30", undefined);
  });
});

describe("POST /api/reservations/reserve - 슬롯 충돌", () => {
  it("libseat에서 슬롯 충돌 감지 → 해당 날짜 failed", async () => {
    makeDbChain();

    // 2026-03-26 날짜에서 14:00 불가
    mockGetUnavailableTimes.mockImplementation((_roomId: string, date: string) => {
      if (date === "20260326") return Promise.resolve(new Set(["14:00"]));
      return Promise.resolve(new Set());
    });

    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(200); // 전체 실패가 아니라 부분 실패
    // immediateResults에 failed 항목 포함
    const failed = json.data?.immediateResults?.filter(
      (r: { status: string }) => r.status === "failed",
    );
    expect(failed?.length).toBeGreaterThan(0);
  });

  it("여러 날짜가 즉시예약 대상일 때 모든 날짜의 가용성을 체크함", async () => {
    makeDbChain();
    // 오늘을 2026-03-27로 설정 → schedulableFrom = 2026-04-03
    // 두 날짜(2026-03-26, 2026-04-02) 모두 2026-04-03 이전 → 즉시예약 대상
    jest.setSystemTime(new Date("2026-03-27T10:00:00"));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(mockGetUnavailableTimes).toHaveBeenCalledTimes(2);
    expect(mockGetUnavailableTimes).toHaveBeenCalledWith("4", "20260326");
    expect(mockGetUnavailableTimes).toHaveBeenCalledWith("4", "20260402");
  });

  it("여러 날짜 중 일부만 충돌 → 충돌 날짜만 failed, 나머지는 예약 진행", async () => {
    makeDbChain();
    jest.setSystemTime(new Date("2026-03-27T10:00:00"));

    mockGetUnavailableTimes.mockImplementation((_roomId: string, date: string) => {
      if (date === "20260326") return Promise.resolve(new Set(["14:00", "15:00"]));
      return Promise.resolve(new Set());
    });

    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(200);

    type ImmediateResult = { date: string; status: string };
    const results: ImmediateResult[] = json.data?.immediateResults ?? [];
    const failedDates = results.filter((r) => r.status === "failed").map((r) => r.date);
    const successDates = results.filter((r) => r.status === "success").map((r) => r.date);
    expect(failedDates).toContain("2026-03-26");
    expect(successDates).toContain("2026-04-02");
  });

  it("가용성 체크 중 예외 발생 시 500 반환", async () => {
    makeDbChain();
    mockGetUnavailableTimes.mockRejectedValue(new Error("libseat 응답 오류"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });

  it("DB UNIQUE 위반 → 409", async () => {
    mockCookieGet.mockImplementation((name: string) => {
      if (name === "ssotoken") return { value: "sso-tok" };
      if (name === "student_id") return { value: "20001234" };
      return undefined;
    });

    mockDbFrom.mockImplementation((table: string) => {
      if (table === "user_credentials") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { password: "enc-pw" },
                error: null,
              }),
            })),
          })),
        };
      }
      if (table === "reservations") {
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
            })),
          })),
          delete: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({}) })),
        };
      }
      if (table === "reserved_slots") {
        return {
          insert: jest.fn().mockResolvedValue({ error: { code: "23505" } }),
          delete: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({}) })),
        };
      }
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
  });
});

describe("POST /api/reservations/reserve - Discord 알림", () => {
  beforeEach(() => {
    makeDbChain();
    mockSendReservationDiscordNotification.mockReset();
  });

  it("notificationDiscordWebhook 있고 즉시 예약 결과 있으면 sendReservationDiscordNotification 호출", async () => {
    const res = await POST(
      makeRequest({
        ...validBody,
        notificationDiscordWebhook:
          "https://discord.com/api/webhooks/1234567890/test-token",
      }),
    );
    expect(res.status).toBe(200);
    expect(mockSendReservationDiscordNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookUrl: "https://discord.com/api/webhooks/1234567890/test-token",
      }),
    );
  });

  it("notificationDiscordWebhook 없으면 sendReservationDiscordNotification 호출 안 됨", async () => {
    await POST(makeRequest(validBody));
    expect(mockSendReservationDiscordNotification).not.toHaveBeenCalled();
  });

  it("DB insert 시 notification_discord_webhook 컬럼에 값 저장", async () => {
    const insertSpy = jest.fn().mockResolvedValue({ data: { id: 1 }, error: null });
    mockDbFrom.mockImplementation((table: string) => {
      if (table === "user_credentials") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: { password: "enc-pw" }, error: null }),
            })),
          })),
        };
      }
      if (table === "reservations") {
        return {
          insert: jest.fn(() => ({ select: jest.fn(() => ({ single: insertSpy })) })),
          update: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
          delete: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
        };
      }
      if (table === "reserved_slots") {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
          delete: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
        };
      }
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    });

    const webhookUrl = "https://discord.com/api/webhooks/1234567890/test-token";
    await POST(makeRequest({ ...validBody, notificationDiscordWebhook: webhookUrl }));

    const reservationsInsertCall = mockDbFrom.mock.calls.find(
      ([table]) => table === "reservations",
    );
    expect(reservationsInsertCall).toBeDefined();
  });
});
