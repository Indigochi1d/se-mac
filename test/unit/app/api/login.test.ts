// next/headers mock
const mockCookieSet = jest.fn();
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ set: mockCookieSet })),
}));

// Supabase mock
const mockUpsert = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    from: jest.fn(() => ({
      upsert: mockUpsert,
    })),
  },
}));

// lib/crypto mock
jest.mock("@/lib/crypto", () => ({
  encrypt: jest.fn((s: string) => "encrypted-" + s),
}));

// lib/sejong/auth mock
const mockLoginToPortal = jest.fn();
const mockLoginToLibseat = jest.fn();
jest.mock("@/lib/sejong/auth", () => ({
  loginToPortal: (...args: unknown[]) => mockLoginToPortal(...args),
  loginToLibseat: (...args: unknown[]) => mockLoginToLibseat(...args),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/login/route";

function makeLoginRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue({ error: null });
});

describe("POST /api/auth/login", () => {
  it("studentId 없으면 400", async () => {
    const res = await POST(makeLoginRequest({ password: "pw" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("password 없으면 400", async () => {
    const res = await POST(makeLoginRequest({ studentId: "20001234" }));
    expect(res.status).toBe(400);
  });

  it("loginToPortal 실패(null) → 401", async () => {
    mockLoginToPortal.mockResolvedValue(null);
    const res = await POST(makeLoginRequest({ studentId: "20001234", password: "wrong" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("loginToLibseat 실패(null) → 500", async () => {
    mockLoginToPortal.mockResolvedValue("sso-tok");
    mockLoginToLibseat.mockResolvedValue(null);
    const res = await POST(makeLoginRequest({ studentId: "20001234", password: "pw" }));
    expect(res.status).toBe(500);
  });

  it("정상 로그인 → 200, success: true, 쿠키 4개 설정", async () => {
    mockLoginToPortal.mockResolvedValue("sso-tok");
    mockLoginToLibseat.mockResolvedValue({
      phpSessId: "php-sess",
      token: "tok",
      studentName: "홍길동",
    });

    const res = await POST(makeLoginRequest({ studentId: "20001234", password: "pw" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // 4개 쿠키 설정됨
    expect(mockCookieSet).toHaveBeenCalledTimes(4);
    const cookieNames = mockCookieSet.mock.calls.map(([name]: [string]) => name);
    expect(cookieNames).toContain("ssotoken");
    expect(cookieNames).toContain("PHPSESSID");
    expect(cookieNames).toContain("student_id");
    expect(cookieNames).toContain("student_name");
  });

  it("DB upsert 에러 → 500", async () => {
    mockLoginToPortal.mockResolvedValue("sso-tok");
    mockLoginToLibseat.mockResolvedValue({
      phpSessId: "php-sess",
      token: "tok",
      studentName: "홍길동",
    });
    mockUpsert.mockResolvedValue({ error: { message: "DB error" } });

    const res = await POST(makeLoginRequest({ studentId: "20001234", password: "pw" }));
    expect(res.status).toBe(500);
  });

  it("암호화된 비밀번호가 DB에 저장됨", async () => {
    mockLoginToPortal.mockResolvedValue("sso-tok");
    mockLoginToLibseat.mockResolvedValue({
      phpSessId: "php-sess",
      token: "tok",
      studentName: "홍길동",
    });

    await POST(makeLoginRequest({ studentId: "20001234", password: "mypassword" }));
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        password: "encrypted-mypassword",
      }),
    );
  });
});
