import { useState, useEffect } from "react";
import { STUDY_ROOMS } from "@/constants/studyroom";
import { generateRecurringDates, getNextWeekDate } from "@/lib/date";
import type { Companion } from "@/components/reservation/CompanionInput";

interface SubmitResult {
  success: boolean;
  message: string;
  immediateResults?: Array<{
    date: string;
    status: "success" | "failed";
    message: string;
  }>;
  scheduledCount?: number;
}

export const useReservation = () => {
  const [studyRoomId, setStudyRoomId] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [hours, setHours] = useState(1);
  const [endDate, setEndDate] = useState("");
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [reason, setReason] = useState("");
  const [notificationMethod, setNotificationMethod] = useState<"none" | "email" | "discord">("none");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [notificationDiscordWebhook, setNotificationDiscordWebhook] = useState("");
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const selectedRoom = STUDY_ROOMS.find((room) => room.id === studyRoomId);

  const handleDayChange = (day: string) => {
    setSelectedDay(day);
    const { year, month, day: d } = getNextWeekDate(day);
    setStartDate(`${year}-${month}-${d}`);
    setEndDate("");
  };

  const handleResetForm = () => {
    setStudyRoomId("");
    setSelectedDay("");
    setStartDate("");
    setStartTime("");
    setHours(1);
    setEndDate("");
    setCompanions([]);
    setReason("");
    setNotificationMethod("none");
    setNotificationEmail("");
    setNotificationDiscordWebhook("");
    setOccupiedSlots([]);
    setSubmitResult(null);
  };

  // 룸 + 요일 + 시작일 + 종료일이 모두 선택되면 점유 슬롯 조회
  useEffect(() => {
    if (!studyRoomId || !selectedDay || !startDate || !endDate) {
      setOccupiedSlots([]);
      return;
    }

    const dates = generateRecurringDates(selectedDay, endDate, startDate);
    if (dates.length === 0) {
      setOccupiedSlots([]);
      return;
    }

    const fetchSlots = async () => {
      try {
        const res = await fetch(
          `/api/reservations/slots?roomId=${studyRoomId}&dates=${dates.join(",")}`,
        );
        const json = await res.json();
        if (json.success) {
          setOccupiedSlots([
            ...new Set((Object.values(json.data) as string[][]).flat()),
          ]);
        }
      } catch (error) {
        console.error("점유 슬롯 조회 실패:", error);
        setOccupiedSlots([]);
      }
    };

    fetchSlots();
  }, [studyRoomId, selectedDay, startDate, endDate]);

  // 유효성 검사
  const isValid = (() => {
    if (!studyRoomId) return false;
    if (!selectedDay) return false;
    if (!startDate) return false;
    if (!startTime) return false;
    if (!endDate) return false;
    if (!reason.trim()) return false;

    if (selectedRoom) {
      const totalPeople = companions.length + 1;
      if (totalPeople < selectedRoom.minPeople) return false;
      if (totalPeople > selectedRoom.maxPeople) return false;
    }

    return true;
  })();

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const response = await fetch("/api/reservations/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyRoomId,
          selectedDay,
          startDate,
          startTime,
          hours,
          companions,
          reason,
          endDate,
          notificationEmail: notificationMethod === "email" ? notificationEmail.trim() || undefined : undefined,
          notificationDiscordWebhook: notificationMethod === "discord" ? notificationDiscordWebhook.trim() || undefined : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const immediateResults = data.data?.immediateResults ?? [];
        const scheduledCount = data.data?.scheduledCount ?? 0;

        // 즉시 예약이 전부 실패했고 예정 예약도 없으면 실패로 표시
        const allImmediateFailed =
          immediateResults.length > 0 &&
          immediateResults.every(
            (r: { status: string }) => r.status === "failed",
          );

        const isActualSuccess = !(allImmediateFailed && scheduledCount === 0);

        setSubmitResult({
          success: isActualSuccess,
          message: isActualSuccess ? data.message : "예약에 실패했습니다.",
          immediateResults,
          scheduledCount,
        });
      } else {
        setSubmitResult({
          success: false,
          message: data.message || "예약에 실패했습니다.",
        });
      }
    } catch {
      setSubmitResult({
        success: false,
        message: "네트워크 오류가 발생했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    studyRoomId,
    setStudyRoomId,
    selectedDay,
    setSelectedDay,
    handleDayChange,
    startDate,
    setStartDate,
    startTime,
    setStartTime,
    hours,
    setHours,
    endDate,
    setEndDate,
    companions,
    setCompanions,
    reason,
    setReason,
    notificationMethod,
    setNotificationMethod,
    notificationEmail,
    setNotificationEmail,
    notificationDiscordWebhook,
    setNotificationDiscordWebhook,
    selectedRoom,
    occupiedSlots,
    isSubmitting,
    submitResult,
    setSubmitResult,
    isValid,
    handleResetForm,
    handleSubmit,
  };
};
