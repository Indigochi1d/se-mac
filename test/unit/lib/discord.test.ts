const mockFetch = jest.fn();
global.fetch = mockFetch;

import { sendReservationDiscordNotification } from "@/lib/discord";

const baseParams = {
  webhookUrl: "https://discord.com/api/webhooks/1234567890/test-token",
  roomId: "4",
  startTime: "14:00",
  hours: 2,
  results: [
    { date: "2026-03-19", status: "success" as const, message: "예약 완료" },
    { date: "2026-03-26", status: "failed" as const, message: "이미 예약된 시간" },
  ],
};

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 204 });
});

describe("sendReservationDiscordNotification", () => {
  it("올바른 webhookUrl로 POST 요청을 보냄", async () => {
    await sendReservationDiscordNotification(baseParams);
    expect(mockFetch).toHaveBeenCalledWith(
      baseParams.webhookUrl,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("Content-Type이 application/json", async () => {
    await sendReservationDiscordNotification(baseParams);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("embed title에 '스터디룸 예약 결과' 포함", async () => {
    await sendReservationDiscordNotification(baseParams);
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.embeds[0].title).toContain("스터디룸 예약 결과");
  });

  it("성공 결과가 있으면 embed color가 초록(0x16a34a)", async () => {
    await sendReservationDiscordNotification(baseParams);
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.embeds[0].color).toBe(0x16a34a);
  });

  it("전부 실패면 embed color가 빨강(0xdc2626)", async () => {
    const failOnlyParams = {
      ...baseParams,
      results: [
        { date: "2026-03-19", status: "failed" as const, message: "실패" },
      ],
    };
    await sendReservationDiscordNotification(failOnlyParams);
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.embeds[0].color).toBe(0xdc2626);
  });

  it("embed fields에 성공 건수와 실패 건수 포함", async () => {
    await sendReservationDiscordNotification(baseParams);
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    const fieldValues = payload.embeds[0].fields.map(
      (field: { value: string }) => field.value,
    );
    expect(fieldValues.some((value: string) => value.includes("성공"))).toBe(true);
    expect(fieldValues.some((value: string) => value.includes("실패"))).toBe(true);
  });

  it("embed fields에 시작 시간과 종료 시간 포함", async () => {
    await sendReservationDiscordNotification(baseParams);
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    const allFieldText = JSON.stringify(payload.embeds[0].fields);
    expect(allFieldText).toContain("14:00");
    expect(allFieldText).toContain("16:00");
  });

  it("scheduledCount > 0이면 대기 안내 포함", async () => {
    await sendReservationDiscordNotification({ ...baseParams, scheduledCount: 3 });
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    const allText = JSON.stringify(payload.embeds[0]);
    expect(allText).toContain("3");
    expect(allText).toContain("자동 예약 대기");
  });

  it("scheduledCount 없으면 대기 안내 미포함", async () => {
    await sendReservationDiscordNotification(baseParams);
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    const allText = JSON.stringify(payload.embeds[0]);
    expect(allText).not.toContain("자동 예약 대기");
  });

  it("fetch 실패해도 에러를 throw하지 않음", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(
      sendReservationDiscordNotification(baseParams),
    ).resolves.not.toThrow();
  });

  it("embed footer에 시스템 이름 포함", async () => {
    await sendReservationDiscordNotification(baseParams);
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.embeds[0].footer.text).toContain("세종대학교");
  });
});
