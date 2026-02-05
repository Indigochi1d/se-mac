import { useState, useEffect } from "react";
import { STUDY_ROOMS } from "@/constants/studyroom";
import { getNextWeekDate, generateRecurringDates } from "@/lib/date";
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
  const [startTime, setStartTime] = useState("");
  const [hours, setHours] = useState(1);
  const [endDate, setEndDate] = useState("");
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [reason, setReason] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const selectedRoom = STUDY_ROOMS.find((room) => room.id === studyRoomId);

  const handleResetForm = () => {
    setStudyRoomId("");
    setSelectedDay("");
    setStartTime("");
    setHours(1);
    setEndDate("");
    setCompanions([]);
    setReason("");
    setNotificationEmail("");
    setOccupiedSlots([]);
    setSubmitResult(null);
  };

  // 룸 + 요일 + 종료일이 모두 선택되면 점유 슬롯 조회
  useEffect(() => {
    if (!studyRoomId || !selectedDay || !endDate) {
      setOccupiedSlots([]);
      return;
    }

    const dates = generateRecurringDates(selectedDay, endDate);
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
          const allSlots = new Set<string>();
          for (const slots of Object.values(json.data) as string[][]) {
            for (const slot of slots) {
              allSlots.add(slot);
            }
          }
          setOccupiedSlots(Array.from(allSlots));
        }
      } catch {
        setOccupiedSlots([]);
      }
    };

    fetchSlots();
  }, [studyRoomId, selectedDay, endDate]);

  // 동반이용자 검증
  const handleVerifyCompanion = async (studentId: string, name: string) => {
    if (!selectedDay) {
      return { success: false, error: "먼저 요일을 선택해주세요." };
    }

    const { year, month, day } = getNextWeekDate(selectedDay);

    const response = await fetch("/api/students/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, name, year, month, day }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return { success: true, ipid: data.ipid };
    }

    return {
      success: false,
      error: data.error || "학생 정보를 확인할 수 없습니다.",
    };
  };

  // 유효성 검사
  const isValid = (() => {
    if (!studyRoomId) return false;
    if (!selectedDay) return false;
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
          startTime,
          hours,
          companions,
          reason,
          endDate,
          notificationEmail: notificationEmail.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitResult({
          success: true,
          message: data.message,
          immediateResults: data.data?.immediateResults,
          scheduledCount: data.data?.scheduledCount,
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
    notificationEmail,
    setNotificationEmail,
    selectedRoom,
    occupiedSlots,
    isSubmitting,
    submitResult,
    setSubmitResult,
    isValid,
    handleResetForm,
    handleVerifyCompanion,
    handleSubmit,
  };
};
