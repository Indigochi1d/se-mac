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

// lib/date mock - isFutureReservation만 오버라이드
const mockIsFutureReservation = jest.fn();
jest.mock("@/lib/date", () => ({
  ...jest.requireActual("@/lib/date"),
  isFutureReservation: (...args: unknown[]) => mockIsFutureReservation(...args),
}));

// lib/crypto mock
const mockDecrypt = jest.fn();
jest.mock("@/lib/crypto", () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

// lib/sejong/auth mock
const mockLoginToPortal = jest.fn();
const mockLoginToLibseat = jest.fn();
jest.mock("@/lib/sejong/auth", () => ({
  loginToPortal: (...args: unknown[]) => mockLoginToPortal(...args),
  loginToLibseat: (...args: unknown[]) => mockLoginToLibseat(...args),
}));

// lib/sejong/cancel mock
const mockCancelLibseatReservation = jest.fn();
jest.mock("@/lib/sejong/cancel", () => ({
  cancelLibseatReservation: (...args: unknown[]) =>
    mockCancelLibseatReservation(...args),
}));

// lib/sejong/reserve mock
const mockSubmitReservation = jest.fn();
jest.mock("@/lib/sejong/reserve", () => ({
  submitReservation: (...args: unknown[]) => mockSubmitReservation(...args),
}));

// lib/sejong/myseat mock
const mockFetchReserveNo = jest.fn();
jest.mock("@/lib/sejong/myseat", () => ({
  fetchReserveNo: (...args: unknown[]) => mockFetchReserveNo(...args),
}));

import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/reservations/[id]/route";

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function setupAuth(studentId = "20001234") {
  mockCookieGet.mockImplementation((name: string) => {
    if (name === "student_id") return { value: studentId };
    return undefined;
  });
}

function makeGetRequest(
  reservationId = "1",
): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(`http://localhost:3000/api/reservations/${reservationId}`),
    { params: Promise.resolve({ id: reservationId }) },
  ];
}

function makePatchRequest(
  reservationId = "1",
  body: object,
): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(
      `http://localhost:3000/api/reservations/${reservationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ),
    { params: Promise.resolve({ id: reservationId }) },
  ];
}

// ─── DB 체인 빌더 ──────────────────────────────────────────────────────────────

interface MockDbOptions {
  reservationData: object | null;
  companionRows?: object[];
}

function mockReservationDb({ reservationData, companionRows = [] }: MockDbOptions) {
  const reservationSingleFn = jest.fn().mockResolvedValue({
    data: reservationData,
    error: reservationData ? null : { message: "not found" },
  });
  const reservationEqFn = jest.fn(() => ({ single: reservationSingleFn }));
  const reservationSelectFn = jest.fn(() => ({ eq: reservationEqFn }));
  const reservationUpdateEqFn = jest.fn().mockResolvedValue({ error: null });
  const reservationUpdateFn = jest.fn(() => ({ eq: reservationUpdateEqFn }));

  const companionSelectEqFn = jest.fn().mockResolvedValue({
    data: companionRows,
    error: null,
  });
  const companionSelectFn = jest.fn(() => ({ eq: companionSelectEqFn }));
  const companionDeleteEqFn = jest.fn().mockResolvedValue({ error: null });
  const companionDeleteFn = jest.fn(() => ({ eq: companionDeleteEqFn }));
  const companionInsertFn = jest.fn().mockResolvedValue({ error: null });

  mockDbFrom.mockImplementation((table: string) => {
    if (table === "reservations") {
      return { select: reservationSelectFn, update: reservationUpdateFn };
    }
    if (table === "companions") {
      return {
        select: companionSelectFn,
        delete: companionDeleteFn,
        insert: companionInsertFn,
      };
    }
    return {};
  });

  return {
    reservationSingleFn,
    reservationUpdateFn,
    reservationUpdateEqFn,
    companionInsertFn,
    companionDeleteFn,
    companionDeleteEqFn,
  };
}

// ─── 테스트 픽스처 ─────────────────────────────────────────────────────────────

const OWNER_STUDENT_ID = "20001234";

const pendingReservation = {
  id: 1,
  status: "pending",
  booking_id: null,
  student_id: OWNER_STUDENT_ID,
  room_id: "4",
  reservation_date: "2099-12-01",
  start_time: "14:00",
  hours: 2,
  reservation_credentials: [],
};

const successReservationWithBooking = {
  id: 1,
  status: "success",
  booking_id: "RES-001",
  student_id: OWNER_STUDENT_ID,
  room_id: "4",
  reservation_date: "2099-12-01",
  start_time: "14:00",
  hours: 2,
  reservation_credentials: [{ password: "encrypted-password" }],
};

const cancelledReservation = {
  ...pendingReservation,
  status: "cancelled",
};

const failedReservation = {
  ...pendingReservation,
  status: "failed",
};

// room "4": minPeople=3, maxPeople=6 → 동반자 최소 2명, 최대 5명
const validCompanions = [
  { studentId: "20009991", name: "동반자1" },
  { studentId: "20009992", name: "동반자2" },
];

const libseatSession = {
  phpSessId: "php-sess",
  token: "tok",
  studentName: "홍길동",
};

// ─── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockIsFutureReservation.mockReturnValue(true);
  mockDecrypt.mockReturnValue("plain-password");
  mockLoginToPortal.mockResolvedValue("new-sso-token");
  mockLoginToLibseat.mockResolvedValue(libseatSession);
  mockCancelLibseatReservation.mockResolvedValue({ success: true });
  mockSubmitReservation.mockResolvedValue({ success: true, message: "완료" });
  mockFetchReserveNo.mockResolvedValue("NEW-RES-001");
});

// ─── GET /api/reservations/[id] ────────────────────────────────────────────────

describe("GET /api/reservations/[id] - 인증", () => {
  it("student_id 쿠키 없으면 401", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const res = await GET(...makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("유효하지 않은 ID(문자열) → 400", async () => {
    setupAuth();
    const res = await GET(...makeGetRequest("abc"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/reservations/[id] - 소유자 검증", () => {
  it("존재하지 않는 예약 → 404", async () => {
    setupAuth();
    mockReservationDb({ reservationData: null });
    const res = await GET(...makeGetRequest("999"));
    expect(res.status).toBe(404);
  });

  it("타인 예약 조회 시도 → 403", async () => {
    setupAuth("99999999");
    mockReservationDb({
      reservationData: { id: 1, student_id: OWNER_STUDENT_ID },
    });
    const res = await GET(...makeGetRequest());
    expect(res.status).toBe(403);
  });
});

describe("GET /api/reservations/[id] - 정상 조회", () => {
  it("동반자 있는 예약 → participants 배열 반환", async () => {
    setupAuth();
    mockReservationDb({
      reservationData: { id: 1, student_id: OWNER_STUDENT_ID },
      companionRows: [
        { student_id: "20009991", name: "동반자1" },
        { student_id: "20009992", name: "동반자2" },
      ],
    });

    const res = await GET(...makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.participants).toHaveLength(2);
    expect(json.data.participants[0]).toEqual({
      studentId: "20009991",
      name: "동반자1",
    });
  });

  it("동반자 없는 예약 → participants 빈 배열 반환", async () => {
    setupAuth();
    mockReservationDb({
      reservationData: { id: 1, student_id: OWNER_STUDENT_ID },
      companionRows: [],
    });

    const res = await GET(...makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.participants).toEqual([]);
  });
});

// ─── PATCH /api/reservations/[id] ─────────────────────────────────────────────

describe("PATCH /api/reservations/[id] - 인증", () => {
  it("student_id 쿠키 없으면 401", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const res = await PATCH(
      ...makePatchRequest("1", { companions: validCompanions }),
    );
    expect(res.status).toBe(401);
  });

  it("유효하지 않은 ID(문자열) → 400", async () => {
    setupAuth();
    const res = await PATCH(
      ...makePatchRequest("abc", { companions: validCompanions }),
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/reservations/[id] - 소유자 및 상태 검증", () => {
  it("존재하지 않는 예약 → 404", async () => {
    setupAuth();
    mockReservationDb({ reservationData: null });
    const res = await PATCH(
      ...makePatchRequest("999", { companions: validCompanions }),
    );
    expect(res.status).toBe(404);
  });

  it("타인 예약 수정 시도 → 403", async () => {
    setupAuth("99999999");
    mockReservationDb({ reservationData: pendingReservation });
    const res = await PATCH(
      ...makePatchRequest("1", { companions: validCompanions }),
    );
    expect(res.status).toBe(403);
  });

  it("취소된 예약 수정 시도 → 400", async () => {
    setupAuth();
    mockReservationDb({ reservationData: cancelledReservation });
    const res = await PATCH(
      ...makePatchRequest("1", { companions: validCompanions }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("취소");
  });

  it("실패한 예약 수정 시도 → 400", async () => {
    setupAuth();
    mockReservationDb({ reservationData: failedReservation });
    const res = await PATCH(
      ...makePatchRequest("1", { companions: validCompanions }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("실패");
  });
});

describe("PATCH /api/reservations/[id] - 정원 검증 (room 4: min 3, max 6)", () => {
  beforeEach(() => setupAuth());

  it("동반자 1명(총 2명)으로 수정 시도 → 최소 인원 미달 400", async () => {
    mockReservationDb({ reservationData: pendingReservation });
    const res = await PATCH(
      ...makePatchRequest("1", {
        companions: [{ studentId: "20009991", name: "동반자1" }],
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("3");
  });

  it("동반자 5명(총 6명)으로 수정 → 최대 인원 허용", async () => {
    mockReservationDb({ reservationData: pendingReservation });
    const fiveCompanions = Array.from({ length: 5 }, (_, i) => ({
      studentId: `2000999${i}`,
      name: `동반자${i + 1}`,
    }));
    const res = await PATCH(
      ...makePatchRequest("1", { companions: fiveCompanions }),
    );
    expect(res.status).toBe(200);
  });

  it("동반자 6명(총 7명)으로 수정 시도 → 최대 인원 초과 400", async () => {
    mockReservationDb({ reservationData: pendingReservation });
    const sixCompanions = Array.from({ length: 6 }, (_, i) => ({
      studentId: `2000999${i}`,
      name: `동반자${i + 1}`,
    }));
    const res = await PATCH(
      ...makePatchRequest("1", { companions: sixCompanions }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("6");
  });
});

describe("PATCH /api/reservations/[id] - Case 2: pending 예약 (DB만 업데이트)", () => {
  beforeEach(() => setupAuth());

  it("pending 예약 수정 → 200, companions DB 교체됨", async () => {
    const { companionDeleteFn, companionInsertFn } = mockReservationDb({
      reservationData: pendingReservation,
    });

    const res = await PATCH(
      ...makePatchRequest("1", { companions: validCompanions }),
    );

    expect(res.status).toBe(200);
    expect(companionDeleteFn).toHaveBeenCalledTimes(1);
    expect(companionInsertFn).toHaveBeenCalledTimes(1);
  });

  it("pending 예약 수정 → 도서관 취소 API 호출되지 않음", async () => {
    mockReservationDb({ reservationData: pendingReservation });

    await PATCH(...makePatchRequest("1", { companions: validCompanions }));

    expect(mockCancelLibseatReservation).not.toHaveBeenCalled();
    expect(mockSubmitReservation).not.toHaveBeenCalled();
  });

  it("success이지만 booking_id 없으면 → DB만 업데이트", async () => {
    mockReservationDb({
      reservationData: {
        ...successReservationWithBooking,
        booking_id: null,
        reservation_credentials: [],
      },
    });

    const res = await PATCH(
      ...makePatchRequest("1", { companions: validCompanions }),
    );

    expect(res.status).toBe(200);
    expect(mockCancelLibseatReservation).not.toHaveBeenCalled();
  });

  it("success이지만 isFutureReservation false이면 → DB만 업데이트", async () => {
    mockIsFutureReservation.mockReturnValue(false);
    mockReservationDb({ reservationData: successReservationWithBooking });

    const res = await PATCH(
      ...makePatchRequest("1", { companions: validCompanions }),
    );

    expect(res.status).toBe(200);
    expect(mockCancelLibseatReservation).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/reservations/[id] - Case 1: success + booking_id + future (취소 후 재예약)", () => {
  beforeEach(() => {
    setupAuth();
    mockReservationDb({ reservationData: successReservationWithBooking });
  });

  it("정상 수정 → 200, 취소 + 재예약 + DB 업데이트 순서대로 호출", async () => {
    const res = await PATCH(
      ...makePatchRequest("1", { companions: validCompanions }),
    );

    expect(res.status).toBe(200);
    expect(mockLoginToPortal).toHaveBeenCalledWith(
      OWNER_STUDENT_ID,
      "plain-password",
    );
    expect(mockLoginToLibseat).toHaveBeenCalledWith("new-sso-token");
    expect(mockCancelLibseatReservation).toHaveBeenCalledWith(
      expect.objectContaining({ reserveNo: "RES-001" }),
    );
    expect(mockSubmitReservation).toHaveBeenCalledTimes(1);
  });

  it("포탈 로그인 실패 → 401", async () => {
    mockLoginToPortal.mockResolvedValue(null);

    const res = await PATCH(
      ...makePatchRequest("1", { companions: validCompanions }),
    );

    expect(res.status).toBe(401);
    expect(mockCancelLibseatReservation).not.toHaveBeenCalled();
  });

  it("도서관 인증 실패 → 500", async () => {
    mockLoginToLibseat.mockResolvedValue(null);

    const res = await PATCH(
      ...makePatchRequest("1", { companions: validCompanions }),
    );

    expect(res.status).toBe(500);
    expect(mockCancelLibseatReservation).not.toHaveBeenCalled();
  });

  it("도서관 취소 실패 → 400, 재예약 시도 안함", async () => {
    mockCancelLibseatReservation.mockResolvedValue({
      success: false,
      message: "취소 불가",
    });

    const res = await PATCH(
      ...makePatchRequest("1", { companions: validCompanions }),
    );

    expect(res.status).toBe(400);
    expect(mockSubmitReservation).not.toHaveBeenCalled();
  });

  it("취소 성공 후 재예약 실패 → 400, DB status를 failed로 업데이트", async () => {
    mockSubmitReservation.mockResolvedValue({
      success: false,
      message: "좌석 없음",
    });

    const { reservationUpdateFn } = mockReservationDb({
      reservationData: successReservationWithBooking,
    });

    const res = await PATCH(
      ...makePatchRequest("1", { companions: validCompanions }),
    );

    expect(res.status).toBe(400);
    expect(reservationUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", booking_id: null }),
    );
  });

  it("재예약 성공 시 새 booking_id로 DB 업데이트", async () => {
    mockFetchReserveNo.mockResolvedValue("NEW-RES-999");

    const { reservationUpdateFn } = mockReservationDb({
      reservationData: successReservationWithBooking,
    });

    await PATCH(...makePatchRequest("1", { companions: validCompanions }));

    expect(reservationUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({ booking_id: "NEW-RES-999" }),
    );
  });

  it("submitReservation에 새 companions가 올바른 형식으로 전달됨", async () => {
    mockReservationDb({ reservationData: successReservationWithBooking });

    await PATCH(...makePatchRequest("1", { companions: validCompanions }));

    expect(mockSubmitReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        companions: [
          { student_id: "20009991", name: "동반자1" },
          { student_id: "20009992", name: "동반자2" },
        ],
      }),
    );
  });
});
