import { sendReservationDiscordNotification } from "@/lib/discord";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const baseParams = {
  webhookUrl:
    "https://discord.com/api/webhooks/1498914916445458462/C1bR598ZGd1kYVraVbi7UtuicV8japs3BsC6IpgXQhR2aOOWRddzodsiYfqzpVNYxsrz",
  roomId: "4",
  startTime: "14:00",
  hours: 2,
  results: [
    { date: "2026-03-19", status: "success" as const, message: "예약 완료" },
    {
      date: "2026-03-26",
      status: "failed" as const,
      message: "이미 예약된 시간",
    },
  ],
  userName: "홍길동",
  reason: "스터디 발표 준비",
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

  it("embed title이 '스터디룸이 예약되었어요.'", async () => {
    await sendReservationDiscordNotification(baseParams);
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.embeds[0].title).toBe("스터디룸이 예약되었어요.");
  });

  it("embed fields에 예약자 이름 포함", async () => {
    await sendReservationDiscordNotification(baseParams);
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    const fieldValues = payload.embeds[0].fields.map(
      (f: { value: string }) => f.value,
    );
    expect(fieldValues.some((v: string) => v.includes("홍길동"))).toBe(true);
  });

  it("예약 사유가 8자 초과면 스포일러 태그로 감쌈", async () => {
    const longReasonParams = { ...baseParams, reason: "스터디 발표 준비 자료" };
    await sendReservationDiscordNotification(longReasonParams);
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    const reasonField = payload.embeds[0].fields.find(
      (f: { name: string }) => f.name === "예약 사유",
    );
    expect(reasonField.value).toBe("스터디 발표 준||비 자료||");
  });

  it("예약 사유가 8자 이하면 그대로 표시", async () => {
    const shortReasonParams = { ...baseParams, reason: "팀프로젝트" };
    await sendReservationDiscordNotification(shortReasonParams);
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    const reasonField = payload.embeds[0].fields.find(
      (f: { name: string }) => f.name === "예약 사유",
    );
    expect(reasonField.value).toBe("팀프로젝트");
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
    expect(fieldValues.some((value: string) => value.includes("성공"))).toBe(
      true,
    );
    expect(fieldValues.some((value: string) => value.includes("실패"))).toBe(
      true,
    );
  });

  it("embed fields에 시작 시간과 종료 시간 포함", async () => {
    await sendReservationDiscordNotification(baseParams);
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    const allFieldText = JSON.stringify(payload.embeds[0].fields);
    expect(allFieldText).toContain("14:00");
    expect(allFieldText).toContain("16:00");
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
