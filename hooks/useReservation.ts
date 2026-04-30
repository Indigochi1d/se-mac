import { useState, useEffect, useReducer, useMemo } from "react";
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

type NotificationMethod = "none" | "email" | "discord";

interface ReservationDraft {
  studyRoomId: string;
  selectedDay: string;
  startDate: string;
  startTime: string;
  hours: number;
  endDate: string;
  companions: Companion[];
  reason: string;
  notificationMethod: NotificationMethod;
  notificationEmail: string;
  notificationDiscordWebhook: string;
}

type ReservationDraftAction =
  | {
      [K in keyof ReservationDraft]: {
        type: "SET_FIELD";
        field: K;
        value: ReservationDraft[K];
      };
    }[keyof ReservationDraft]
  | { type: "CHANGE_DAY"; day: string; startDate: string }
  | { type: "RESET" };

const initialReservationDraft: ReservationDraft = {
  studyRoomId: "",
  selectedDay: "",
  startDate: "",
  startTime: "",
  hours: 1,
  endDate: "",
  companions: [],
  reason: "",
  notificationMethod: "none",
  notificationEmail: "",
  notificationDiscordWebhook: "",
};

function reservationDraftReducer(
  state: ReservationDraft,
  action: ReservationDraftAction,
): ReservationDraft {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "CHANGE_DAY":
      return {
        ...state,
        selectedDay: action.day,
        startDate: action.startDate,
        endDate: "",
      };
    case "RESET":
      return initialReservationDraft;
  }
}

export const useReservation = () => {
  const [draft, dispatch] = useReducer(
    reservationDraftReducer,
    initialReservationDraft,
  );
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const {
    studyRoomId,
    selectedDay,
    startDate,
    startTime,
    hours,
    endDate,
    companions,
    reason,
    notificationMethod,
    notificationEmail,
    notificationDiscordWebhook,
  } = draft;

  const selectedRoom = STUDY_ROOMS.find((room) => room.id === studyRoomId);

  const draftFieldUpdaters = useMemo(
    () => ({
      setStudyRoomId: (value: string) =>
        dispatch({ type: "SET_FIELD", field: "studyRoomId", value }),
      setSelectedDay: (value: string) =>
        dispatch({ type: "SET_FIELD", field: "selectedDay", value }),
      setStartDate: (value: string) =>
        dispatch({ type: "SET_FIELD", field: "startDate", value }),
      setStartTime: (value: string) =>
        dispatch({ type: "SET_FIELD", field: "startTime", value }),
      setHours: (value: number) =>
        dispatch({ type: "SET_FIELD", field: "hours", value }),
      setEndDate: (value: string) =>
        dispatch({ type: "SET_FIELD", field: "endDate", value }),
      setCompanions: (value: Companion[]) =>
        dispatch({ type: "SET_FIELD", field: "companions", value }),
      setReason: (value: string) =>
        dispatch({ type: "SET_FIELD", field: "reason", value }),
      setNotificationMethod: (value: NotificationMethod) =>
        dispatch({ type: "SET_FIELD", field: "notificationMethod", value }),
      setNotificationEmail: (value: string) =>
        dispatch({ type: "SET_FIELD", field: "notificationEmail", value }),
      setNotificationDiscordWebhook: (value: string) =>
        dispatch({
          type: "SET_FIELD",
          field: "notificationDiscordWebhook",
          value,
        }),
    }),
    [],
  );

  const handleDayChange = (day: string) => {
    const { year, month, day: d } = getNextWeekDate(day);
    dispatch({ type: "CHANGE_DAY", day, startDate: `${year}-${month}-${d}` });
  };

  const handleResetForm = () => {
    dispatch({ type: "RESET" });
    setOccupiedSlots([]);
    setSubmitResult(null);
  };

  // 룸 + 요일 + 시작일 + 종료일이 모두 선택되면 점유 슬롯 조회
  useEffect(() => {
    if (!studyRoomId || !selectedDay || !startDate || !endDate) {
      setOccupiedSlots([]);
      setIsLoadingSlots(false);
      return;
    }

    const dates = generateRecurringDates(selectedDay, endDate, startDate);
    if (dates.length === 0) {
      setOccupiedSlots([]);
      setIsLoadingSlots(false);
      return;
    }

    const controller = new AbortController();
    setIsLoadingSlots(true);

    const debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/reservations/slots?roomId=${studyRoomId}&dates=${dates.join(",")}`,
          { signal: controller.signal },
        );
        const json = await res.json();
        if (json.success) {
          setOccupiedSlots([
            ...new Set((Object.values(json.data) as string[][]).flat()),
          ]);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("점유 슬롯 조회 실패:", error);
        setOccupiedSlots([]);
      } finally {
        if (!controller.signal.aborted) setIsLoadingSlots(false);
      }
    }, 250);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
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
          notificationEmail:
            notificationMethod === "email"
              ? notificationEmail.trim() || undefined
              : undefined,
          notificationDiscordWebhook:
            notificationMethod === "discord"
              ? notificationDiscordWebhook.trim() || undefined
              : undefined,
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
    selectedDay,
    startDate,
    startTime,
    hours,
    endDate,
    companions,
    reason,
    notificationMethod,
    notificationEmail,
    notificationDiscordWebhook,
    ...draftFieldUpdaters,
    handleDayChange,
    selectedRoom,
    occupiedSlots,
    isLoadingSlots,
    isSubmitting,
    submitResult,
    setSubmitResult,
    isValid,
    handleResetForm,
    handleSubmit,
  };
};
