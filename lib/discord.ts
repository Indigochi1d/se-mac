import * as Sentry from "@sentry/nextjs";
import { STUDY_ROOMS } from "@/constants/studyroom";
import { formatDate, getEndTime } from "@/lib/date";

interface ReservationResult {
  date: string;
  status: "success" | "failed";
  message: string;
}

interface SendReservationDiscordNotificationParams {
  webhookUrl: string;
  roomId: string;
  startTime: string;
  hours: number;
  results: ReservationResult[];
  scheduledCount?: number;
}

function resolveEmbedColor(results: ReservationResult[]): number {
  const hasSuccess = results.some((result) => result.status === "success");
  return hasSuccess ? 0x16a34a : 0xdc2626;
}

function buildResultSummaryField(results: ReservationResult[]) {
  const successCount = results.filter(
    (result) => result.status === "success",
  ).length;
  const failedCount = results.filter(
    (result) => result.status === "failed",
  ).length;

  return {
    name: "예약 결과",
    value: `성공 ${successCount}건 / 실패 ${failedCount}건`,
    inline: false,
  };
}

function buildResultDetailField(results: ReservationResult[]) {
  const lines = results.map((result) => {
    const statusEmoji = result.status === "success" ? "✅" : "❌";
    const detail = result.status === "success" ? "예약 완료" : result.message;
    return `${statusEmoji} ${formatDate(result.date)} — ${detail}`;
  });

  return {
    name: "날짜별 상세",
    value: lines.join("\n"),
    inline: false,
  };
}

function buildScheduledCountField(scheduledCount: number) {
  return {
    name: "자동 예약 대기",
    value: `나머지 ${scheduledCount}건은 자동 예약 대기 중이며, 처리 후 별도로 안내됩니다.`,
    inline: false,
  };
}

function buildDiscordPayload({
  roomName,
  startTime,
  hours,
  results,
  scheduledCount,
}: {
  roomName: string;
  startTime: string;
  hours: number;
  results: ReservationResult[];
  scheduledCount?: number;
}) {
  const endTime = getEndTime(startTime, hours);
  const fields = [
    { name: "스터디룸", value: roomName, inline: true },
    {
      name: "시간",
      value: `${startTime} ~ ${endTime} (${hours}시간)`,
      inline: true,
    },
    buildResultSummaryField(results),
    buildResultDetailField(results),
  ];

  if (scheduledCount && scheduledCount > 0) {
    fields.push(buildScheduledCountField(scheduledCount));
  }

  return {
    embeds: [
      {
        title: "스터디룸 예약 결과",
        color: resolveEmbedColor(results),
        fields,
        footer: { text: "세종대학교 스터디룸 반복 예약 시스템" },
      },
    ],
  };
}

export async function sendReservationDiscordNotification(
  params: SendReservationDiscordNotificationParams,
): Promise<void> {
  const { webhookUrl, roomId, startTime, hours, results, scheduledCount } =
    params;
  const roomName =
    STUDY_ROOMS.find((room) => room.id === roomId)?.name ??
    `스터디룸 ${roomId}`;

  const payload = buildDiscordPayload({
    roomName,
    startTime,
    hours,
    results,
    scheduledCount,
  });

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Discord 웹훅 발송 실패:", error);
    Sentry.captureException(error, {
      extra: { webhookUrl, roomId, startTime, hours },
    });
  }
}
