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

import { NextRequest } from "next/server";
import { POST } from "@/app/api/reservations/reserve/route";

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
