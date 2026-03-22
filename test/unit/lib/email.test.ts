// nodemailer를 모듈 로드 전에 mock (jest.mock은 자동으로 파일 최상단으로 hoisting됨)
const mockSendMail = jest.fn();
jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

import { sendReservationEmail } from "@/lib/email";

beforeEach(() => {
  mockSendMail.mockReset();
  mockSendMail.mockResolvedValue({ messageId: "test-id" });
});

describe("sendReservationEmail", () => {
  const baseParams = {
    to: "student@sejong.ac.kr",
    roomId: "4",
    startTime: "14:00",
    hours: 2,
    results: [
      { date: "2026-03-19", status: "success" as const, message: "예약 완료" },
      { date: "2026-03-26", status: "failed" as const, message: "이미 예약된 시간" },
    ],
  };

  it("sendMail이 올바른 to 주소로 호출됨", async () => {
    await sendReservationEmail(baseParams);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "student@sejong.ac.kr" }),
    );
  });

  it("subject에 성공/실패 건수 포함", async () => {
    await sendReservationEmail(baseParams);
    const { subject } = mockSendMail.mock.calls[0][0];
    expect(subject).toContain("성공 1건");
    expect(subject).toContain("실패 1건");
  });

  it("subject에 룸 이름 포함", async () => {
    await sendReservationEmail(baseParams);
    const { subject } = mockSendMail.mock.calls[0][0];
    // roomId "4" → STUDY_ROOMS에서 찾은 이름
    expect(subject).toContain("스터디룸");
  });

  it("HTML body에 성공 날짜와 초록색 텍스트 포함", async () => {
    await sendReservationEmail(baseParams);
    const { html } = mockSendMail.mock.calls[0][0];
    expect(html).toContain("#16a34a"); // 성공 초록색
    expect(html).toContain("성공");
  });

  it("HTML body에 실패 날짜와 빨간색 텍스트 포함", async () => {
    await sendReservationEmail(baseParams);
    const { html } = mockSendMail.mock.calls[0][0];
    expect(html).toContain("#dc2626"); // 실패 빨간색
    expect(html).toContain("실패");
    expect(html).toContain("이미 예약된 시간");
  });

  it("scheduledCount > 0 이면 HTML에 대기 건수 안내 포함", async () => {
    await sendReservationEmail({ ...baseParams, scheduledCount: 3 });
    const { html } = mockSendMail.mock.calls[0][0];
    expect(html).toContain("3건");
    expect(html).toContain("자동 예약 대기");
  });

  it("scheduledCount 없으면 대기 안내 미포함", async () => {
    await sendReservationEmail(baseParams);
    const { html } = mockSendMail.mock.calls[0][0];
    expect(html).not.toContain("자동 예약 대기");
  });

  it("sendMail 실패해도 에러를 throw하지 않음 (내부 catch)", async () => {
    mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));
    await expect(sendReservationEmail(baseParams)).resolves.not.toThrow();
  });

  it("HTML에 시작~종료 시간 포함 (14:00 ~ 16:00)", async () => {
    await sendReservationEmail(baseParams);
    const { html } = mockSendMail.mock.calls[0][0];
    expect(html).toContain("14:00");
    expect(html).toContain("16:00");
  });
});
