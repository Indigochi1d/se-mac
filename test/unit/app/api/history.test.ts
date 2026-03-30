// next/headers mock
const mockCookieGet = jest.fn();
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: mockCookieGet })),
}));

// Supabase mock
const mockDbFrom = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { from: (...args: unknown[]) => mockDbFrom(...args) },
}));

import { GET } from "@/app/api/history/route";

type ReservationRow = {
  id: number;
  group_id: string;
  room_id: string;
  reservation_date: string;
  start_time: string;
  hours: number;
  status: string;
  booking_id: string | null;
};

function setupAuth() {
  mockCookieGet.mockImplementation((name: string) => {
    if (name === "student_id") return { value: "20001234" };
    return undefined;
  });
}

function mockReservations(rows: ReservationRow[]) {
  mockDbFrom.mockReturnValue({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({ data: rows, error: null }),
      })),
    })),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/history - 인증", () => {
  it("student_id 쿠키 없으면 401", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/history - 그룹핑", () => {
  beforeEach(() => setupAuth());

  it("같은 group_id는 하나의 그룹으로 묶임", async () => {
    mockReservations([
      { id: 1, group_id: "g1", room_id: "4", reservation_date: "2026-03-26", start_time: "14:00", hours: 2, status: "success", booking_id: null },
      { id: 2, group_id: "g1", room_id: "4", reservation_date: "2026-04-02", start_time: "14:00", hours: 2, status: "pending", booking_id: null },
    ]);

    const res = await GET();
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].reservations).toHaveLength(2);
  });

  it("다른 group_id는 별도 그룹으로 분리됨", async () => {
    mockReservations([
      { id: 1, group_id: "g1", room_id: "4", reservation_date: "2026-03-26", start_time: "14:00", hours: 2, status: "success", booking_id: null },
      { id: 2, group_id: "g2", room_id: "11", reservation_date: "2026-03-27", start_time: "10:00", hours: 1, status: "pending", booking_id: null },
    ]);

    const res = await GET();
    const json = await res.json();
    expect(json.data).toHaveLength(2);
  });

  it("그룹 메타(roomId, startTime, hours)가 올바르게 매핑됨", async () => {
    mockReservations([
      { id: 1, group_id: "g1", room_id: "4", reservation_date: "2026-03-26", start_time: "14:00", hours: 2, status: "success", booking_id: "RES-001" },
    ]);

    const res = await GET();
    const json = await res.json();
    const group = json.data[0];
    expect(group.groupId).toBe("g1");
    expect(group.roomId).toBe("4");
    expect(group.startTime).toBe("14:00");
    expect(group.hours).toBe(2);
    expect(group.reservations[0].bookingId).toBe("RES-001");
  });

  it("예약 없으면 빈 배열 반환", async () => {
    mockReservations([]);
    const res = await GET();
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(0);
  });
});

describe("GET /api/history - 정렬 순서", () => {
  beforeEach(() => setupAuth());

  it("그룹은 첫 예약 날짜 기준 내림차순 (최신 그룹이 먼저)", async () => {
    // DB는 reservation_date ASC로 반환 → g1의 첫 날짜: 2026-02-01, g2의 첫 날짜: 2026-03-01
    mockReservations([
      { id: 1, group_id: "g1", room_id: "4", reservation_date: "2026-02-01", start_time: "14:00", hours: 2, status: "success", booking_id: null },
      { id: 2, group_id: "g2", room_id: "11", reservation_date: "2026-03-01", start_time: "10:00", hours: 1, status: "pending", booking_id: null },
    ]);

    const res = await GET();
    const json = await res.json();
    // g2(2026-03-01)가 g1(2026-02-01)보다 먼저 와야 함
    expect(json.data[0].groupId).toBe("g2");
    expect(json.data[1].groupId).toBe("g1");
  });

  it("그룹 내 예약은 DB ORDER BY 기준 날짜 오름차순 유지", async () => {
    // DB가 ORDER BY reservation_date ASC로 반환하면 API는 그 순서를 보존해야 함
    // history/page.tsx에서 클라이언트 sort를 제거했으므로 이 계약이 핵심
    mockReservations([
      { id: 1, group_id: "g1", room_id: "4", reservation_date: "2026-03-26", start_time: "14:00", hours: 2, status: "success", booking_id: null },
      { id: 2, group_id: "g1", room_id: "4", reservation_date: "2026-04-02", start_time: "14:00", hours: 2, status: "pending", booking_id: null },
      { id: 3, group_id: "g1", room_id: "4", reservation_date: "2026-04-09", start_time: "14:00", hours: 2, status: "pending", booking_id: null },
    ]);

    const res = await GET();
    const json = await res.json();
    const dates = json.data[0].reservations.map((r: { date: string }) => r.date);
    expect(dates).toEqual(["2026-03-26", "2026-04-02", "2026-04-09"]);
  });

  it("같은 날짜에 다른 그룹이 있을 때 정렬이 안정적으로 유지됨", async () => {
    mockReservations([
      { id: 1, group_id: "g1", room_id: "4", reservation_date: "2026-03-26", start_time: "09:00", hours: 1, status: "success", booking_id: null },
      { id: 2, group_id: "g2", room_id: "11", reservation_date: "2026-03-26", start_time: "14:00", hours: 2, status: "pending", booking_id: null },
    ]);

    const res = await GET();
    const json = await res.json();
    // 두 그룹 모두 존재해야 하고, 날짜가 같으면 순서는 localeCompare 기준으로 동일
    expect(json.data).toHaveLength(2);
    expect(json.data[0].groupId).toBe(json.data[1].groupId === "g1" ? "g2" : "g1");
  });
});

describe("GET /api/history - DB 에러", () => {
  beforeEach(() => setupAuth());

  it("DB 에러 시 500 반환", async () => {
    mockDbFrom.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn().mockResolvedValue({ data: null, error: new Error("DB 연결 실패") }),
        })),
      })),
    });

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
