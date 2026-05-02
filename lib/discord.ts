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
  userName: string;
  reason: string;
}

function truncateReason(reason: string): string {
  if (reason.length <= 8) return reason;
  return reason.slice(0, 8) + "||" + reason.slice(8) + "||";
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

function buildDiscordPayload({
  roomName,
  startTime,
  hours,
  results,
  userName,
  reason,
}: {
  roomName: string;
  startTime: string;
  hours: number;
  results: ReservationResult[];
  userName: string;
  reason: string;
}) {
  const endTime = getEndTime(startTime, hours);
  const fields = [
    { name: "스터디룸", value: roomName, inline: true },
    {
      name: "시간",
      value: `${startTime} ~ ${endTime} (${hours}시간)`,
      inline: true,
    },
    { name: "예약자", value: userName, inline: true },
    { name: "예약 사유", value: truncateReason(reason), inline: false },
    buildResultSummaryField(results),
    buildResultDetailField(results),
  ];

  return {
    embeds: [
      {
        title: "스터디룸이 예약되었어요",
        color: resolveEmbedColor(results),
        fields,
        footer: { text: "se-mac: 세종대 스터디룸 반복 예약 시스템" },
      },
    ],
  };
}

export async function sendReservationDiscordNotification(
  params: SendReservationDiscordNotificationParams,
): Promise<void> {
  const { webhookUrl, roomId, startTime, hours, results, userName, reason } =
    params;
  const roomName =
    STUDY_ROOMS.find((room) => room.id === roomId)?.name ??
    `스터디룸 ${roomId}`;

  const payload = buildDiscordPayload({
    roomName,
    startTime,
    hours,
    results,
    userName,
    reason,
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
