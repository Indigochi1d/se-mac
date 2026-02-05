import nodemailer from "nodemailer";
import { STUDY_ROOMS } from "@/constants/studyroom";
import { formatDate, getEndTime } from "@/lib/date";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

interface ReservationEmailResult {
  date: string;
  status: "success" | "failed";
  message: string;
}

interface SendReservationEmailParams {
  to: string;
  roomId: string;
  startTime: string;
  hours: number;
  results: ReservationEmailResult[];
  scheduledCount?: number;
}

function buildEmailHtml({
  roomName,
  startTime,
  hours,
  results,
  scheduledCount,
}: {
  roomName: string;
  startTime: string;
  hours: number;
  results: ReservationEmailResult[];
  scheduledCount?: number;
}) {
  const endTime = getEndTime(startTime, hours);
  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  const rows = results
    .map((r) => {
      const statusColor = r.status === "success" ? "#16a34a" : "#dc2626";
      const statusText = r.status === "success" ? "성공" : "실패";
      const detail =
        r.status === "success" ? "예약 완료" : r.message;

      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${formatDate(r.date)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: ${statusColor}; font-weight: 600;">${statusText}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${detail}</td>
        </tr>`;
    })
    .join("");

  const scheduledNote =
    scheduledCount && scheduledCount > 0
      ? `<p style="margin-top: 16px; color: #6b7280; font-size: 14px;">나머지 ${scheduledCount}건은 자동 예약 대기 중이며, 처리 후 별도로 안내드립니다.</p>`
      : "";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 20px; font-size: 18px; color: #111827;">스터디룸 예약 결과</h2>

      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px;">스터디룸</p>
        <p style="margin: 0 0 12px; font-weight: 600; color: #111827;">${roomName}</p>
        <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px;">시간</p>
        <p style="margin: 0; font-weight: 600; color: #111827;">${startTime} ~ ${endTime} (${hours}시간)</p>
      </div>

      <p style="margin: 0 0 8px; font-size: 14px; color: #374151;">
        총 ${results.length}건 중
        <span style="color: #16a34a; font-weight: 600;">성공 ${successCount}건</span>,
        <span style="color: #dc2626; font-weight: 600;">실패 ${failedCount}건</span>
      </p>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #374151;">날짜</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #374151;">상태</th>
            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #374151;">상세</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      ${scheduledNote}

      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">세종대학교 스터디룸 반복 예약 시스템</p>
    </div>
  `;
}

export async function sendReservationEmail(
  params: SendReservationEmailParams,
): Promise<void> {
  const { to, roomId, startTime, hours, results, scheduledCount } = params;
  const roomName =
    STUDY_ROOMS.find((r) => r.id === roomId)?.name ?? `스터디룸 ${roomId}`;

  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  const subject = `[스터디룸] ${roomName} 예약 결과 - 성공 ${successCount}건, 실패 ${failedCount}건`;

  const html = buildEmailHtml({
    roomName,
    startTime,
    hours,
    results,
    scheduledCount,
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("이메일 발송 실패:", error);
  }
}
