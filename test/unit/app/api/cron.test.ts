// Supabase mock
const mockSupabaseSelect = jest.fn();
const mockSupabaseUpdate = jest.fn();
const mockSupabaseDelete = jest.fn();
// update 페이로드 검증용 (스키마에 없는 컬럼 전송 여부 등)
const mockReservationUpdate = jest.fn(() => ({ eq: mockSupabaseUpdate }));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    from: jest.fn((table: string) => {
      if (table === "reservations") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: mockSupabaseSelect,
            })),
          })),
          update: mockReservationUpdate,
        };
      }
      if (table === "reserved_slots") {
        return {
          delete: jest.fn(() => ({
            eq: mockSupabaseDelete,
          })),
        };
      }
    }),
  },
}));

// Sentry mock
const mockCaptureException = jest.fn();
const mockCaptureEvent = jest.fn();
jest.mock("@sentry/nextjs", () => ({
  captureCheckIn: jest.fn(() => "check-in-id"),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureEvent: (...args: unknown[]) => mockCaptureEvent(...args),
}));

// lib/crypto mock
jest.mock("@/lib/crypto", () => ({
  decrypt: jest.fn((s: string) => "decrypted-" + s),
  encrypt: jest.fn((s: string) => "encrypted-" + s),
}));

// lib/sejong/auth mock
const mockLoginToPortal = jest.fn();
const mockLoginToLibseat = jest.fn();
jest.mock("@/lib/sejong/auth", () => ({
  loginToPortal: (...args: unknown[]) => mockLoginToPortal(...args),
  loginToLibseat: (...args: unknown[]) => mockLoginToLibseat(...args),
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

// lib/email mock
const mockSendReservationEmail = jest.fn();
jest.mock("@/lib/email", () => ({
  sendReservationEmail: (...args: unknown[]) => mockSendReservationEmail(...args),
}));

// lib/discord mock
const mockSendReservationDiscordNotification = jest.fn();
jest.mock("@/lib/discord", () => ({
  sendReservationDiscordNotification: (...args: unknown[]) =>
    mockSendReservationDiscordNotification(...args),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/reserve/route";

function makeRequest(authHeader?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/reserve", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function makeReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    student_id: "20001234",
    room_id: "4",
    reservation_date: "2026-03-26",
    start_time: "14:00",
    hours: 2,
    reason: "스터디",
    notification_email: null,
    notification_discord_webhook: null,
    reservation_credentials: [{ password: "encrypted-pw" }],
    companions: [],
    ...overrides,
  };
}

function mockLoginSuccess() {
  mockLoginToPortal.mockResolvedValue("sso-tok");
  mockLoginToLibseat.mockResolvedValue({
    phpSessId: "php-sess",
    token: "tok",
    studentName: "홍길동",
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabaseUpdate.mockResolvedValue({ error: null });
  mockSupabaseDelete.mockResolvedValue({ error: null });
  mockFetchReserveNo.mockResolvedValue("RES-001");
  mockSendReservationEmail.mockResolvedValue(undefined);
  mockSendReservationDiscordNotification.mockResolvedValue(undefined);
});

describe("GET /api/cron/reserve - 인증", () => {
  it("Authorization 헤더 없으면 401", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("잘못된 CRON_SECRET이면 401", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("올바른 CRON_SECRET이면 401이 아님", async () => {
    mockSupabaseSelect.mockResolvedValue({ data: [], error: null });
    const res = await GET(makeRequest("Bearer test-cron-secret"));
    expect(res.status).not.toBe(401);
  });
});

describe("GET /api/cron/reserve - DB 처리", () => {
  it("처리할 예약이 없으면 processed: 0 반환", async () => {
    mockSupabaseSelect.mockResolvedValue({ data: [], error: null });

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.processed).toBe(0);
  });

  it("DB 조회 에러 → 500 반환", async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(500);
  });

  it("예약 1건 성공 처리 → summary.success = 1", async () => {
    const mockReservation = {
      id: 1,
      student_id: "20001234",
      room_id: "4",
      reservation_date: "2026-03-26",
      start_time: "14:00",
      hours: 2,
      reason: "스터디",
      notification_email: null,
      reservation_credentials: [{ password: "encrypted-pw" }],
      companions: [],
    };
    mockSupabaseSelect.mockResolvedValue({
      data: [mockReservation],
      error: null,
    });
    mockLoginToPortal.mockResolvedValue("sso-tok");
    mockLoginToLibseat.mockResolvedValue({
      phpSessId: "php-sess",
      token: "tok",
      studentName: "홍길동",
    });
    mockSubmitReservation.mockResolvedValue({
      success: true,
      message: "예약 완료",
    });

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.summary.success).toBe(1);
    expect(body.summary.failed).toBe(0);
  });

  it("loginToPortal 실패 → 예약 failed 처리", async () => {
    const mockReservation = {
      id: 2,
      student_id: "20001234",
      room_id: "4",
      reservation_date: "2026-03-26",
      start_time: "14:00",
      hours: 2,
      reason: "스터디",
      notification_email: null,
      reservation_credentials: [{ password: "encrypted-pw" }],
      companions: [],
    };
    mockSupabaseSelect.mockResolvedValue({
      data: [mockReservation],
      error: null,
    });
    mockLoginToPortal.mockResolvedValue(null); // 로그인 실패

    const res = await GET(makeRequest("Bearer test-cron-secret"));
    const body = await res.json();
    expect(body.summary.failed).toBe(1);
    expect(body.summary.success).toBe(0);
  });

  it("이메일 알림 주소 있으면 sendReservationEmail 호출", async () => {
    const mockReservation = {
      id: 3,
      student_id: "20001234",
      room_id: "4",
      reservation_date: "2026-03-26",
      start_time: "14:00",
      hours: 2,
      reason: "스터디",
      notification_email: "student@test.com",
      notification_discord_webhook: null,
      reservation_credentials: [{ password: "encrypted-pw" }],
      companions: [],
    };
    mockSupabaseSelect.mockResolvedValue({
      data: [mockReservation],
      error: null,
    });
    mockLoginToPortal.mockResolvedValue("sso-tok");
    mockLoginToLibseat.mockResolvedValue({
      phpSessId: "php-sess",
      token: "tok",
      studentName: "홍길동",
    });
    mockSubmitReservation.mockResolvedValue({
      success: true,
      message: "완료",
    });

    await GET(makeRequest("Bearer test-cron-secret"));
    expect(mockSendReservationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "student@test.com" }),
    );
  });

  it("Discord 웹훅 있으면 sendReservationDiscordNotification 호출", async () => {
    const webhookUrl = "https://discord.com/api/webhooks/1234567890/test-token";
    const mockReservation = {
      id: 4,
      student_id: "20001234",
      room_id: "4",
      reservation_date: "2026-03-26",
      start_time: "14:00",
      hours: 2,
      reason: "스터디",
      notification_email: null,
      notification_discord_webhook: webhookUrl,
      reservation_credentials: [{ password: "encrypted-pw" }],
      companions: [],
    };
    mockSupabaseSelect.mockResolvedValue({
      data: [mockReservation],
      error: null,
    });
    mockLoginToPortal.mockResolvedValue("sso-tok");
    mockLoginToLibseat.mockResolvedValue({
      phpSessId: "php-sess",
      token: "tok",
      studentName: "홍길동",
    });
    mockSubmitReservation.mockResolvedValue({ success: true, message: "완료" });

    await GET(makeRequest("Bearer test-cron-secret"));
    expect(mockSendReservationDiscordNotification).toHaveBeenCalledWith(
      expect.objectContaining({ webhookUrl }),
    );
  });

  it("Discord 웹훅 없으면 sendReservationDiscordNotification 호출 안 됨", async () => {
    const mockReservation = {
      id: 5,
      student_id: "20001234",
      room_id: "4",
      reservation_date: "2026-03-26",
      start_time: "14:00",
      hours: 2,
      reason: "스터디",
      notification_email: null,
      notification_discord_webhook: null,
      reservation_credentials: [{ password: "encrypted-pw" }],
      companions: [],
    };
    mockSupabaseSelect.mockResolvedValue({
      data: [mockReservation],
      error: null,
    });
    mockLoginToPortal.mockResolvedValue("sso-tok");
    mockLoginToLibseat.mockResolvedValue({
      phpSessId: "php-sess",
      token: "tok",
      studentName: "홍길동",
    });
    mockSubmitReservation.mockResolvedValue({ success: true, message: "완료" });

    await GET(makeRequest("Bearer test-cron-secret"));
    expect(mockSendReservationDiscordNotification).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/reserve - 상태 업데이트", () => {
  it("성공 시 update 페이로드는 status와 booking_id만 포함", async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: [makeReservation()],
      error: null,
    });
    mockLoginSuccess();
    mockSubmitReservation.mockResolvedValue({
      success: true,
      message: "예약 완료",
    });

    await GET(makeRequest("Bearer test-cron-secret"));
    expect(mockReservationUpdate).toHaveBeenCalledTimes(1);
    expect(mockReservationUpdate).toHaveBeenCalledWith({
      status: "success",
      booking_id: "RES-001",
    });
  });

  it("booking_id 조회 실패 시 status만 update", async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: [makeReservation()],
      error: null,
    });
    mockLoginSuccess();
    mockSubmitReservation.mockResolvedValue({
      success: true,
      message: "예약 완료",
    });
    mockFetchReserveNo.mockResolvedValue(undefined);

    await GET(makeRequest("Bearer test-cron-secret"));
    expect(mockReservationUpdate).toHaveBeenCalledWith({ status: "success" });
  });

  it("예약 실패 시 페이로드는 status만 포함하고 실패 사유는 Sentry로 보고", async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: [makeReservation()],
      error: null,
    });
    mockLoginSuccess();
    mockSubmitReservation.mockResolvedValue({
      success: false,
      message: "이미 예약된 시간대",
    });

    await GET(makeRequest("Bearer test-cron-secret"));
    // 스키마에 없는 error_message 컬럼을 보내지 않는다
    expect(mockReservationUpdate).toHaveBeenCalledWith({ status: "failed" });
    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: expect.objectContaining({
          reservationId: 10,
          errorMessage: "이미 예약된 시간대",
        }),
      }),
    );
    // 실패한 예약의 슬롯 점유 해제
    expect(mockSupabaseDelete).toHaveBeenCalled();
  });

  it("update 실패 시 1회 재시도하고, 재시도 성공이면 Sentry 보고 없음", async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: [makeReservation()],
      error: null,
    });
    mockLoginSuccess();
    mockSubmitReservation.mockResolvedValue({
      success: true,
      message: "예약 완료",
    });
    mockSupabaseUpdate
      .mockResolvedValueOnce({ error: { message: "transient error" } })
      .mockResolvedValueOnce({ error: null });

    await GET(makeRequest("Bearer test-cron-secret"));
    expect(mockSupabaseUpdate).toHaveBeenCalledTimes(2);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("재시도까지 실패하면 Sentry.captureException 보고", async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: [makeReservation()],
      error: null,
    });
    mockLoginSuccess();
    mockSubmitReservation.mockResolvedValue({
      success: true,
      message: "예약 완료",
    });
    mockSupabaseUpdate.mockResolvedValue({ error: { message: "db down" } });

    await GET(makeRequest("Bearer test-cron-secret"));
    expect(mockSupabaseUpdate).toHaveBeenCalledTimes(2);
    expect(mockCaptureException).toHaveBeenCalledWith(
      { message: "db down" },
      expect.objectContaining({
        extra: expect.objectContaining({ reservationId: 10 }),
      }),
    );
  });
});
