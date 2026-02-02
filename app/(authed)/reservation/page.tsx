"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  StudyRoomSelect,
  STUDY_ROOMS,
} from "@/components/reservation/StudyRoomSelect";
import { ScheduleSelect } from "@/components/reservation/ScheduleSelect";
import { TIME_SLOTS } from "@/constants/schedule";
import {
  CompanionInput,
  type Companion,
} from "@/components/reservation/CompanionInput";
import { ReasonInput } from "@/components/reservation/ReasonInput";
import { getNextWeekDate } from "@/lib/date";

const ReservationPage = () => {
  const router = useRouter();
  const [studyRoomId, setStudyRoomId] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [startTime, setStartTime] = useState("");
  const [hours, setHours] = useState(1);
  const [endDate, setEndDate] = useState("");
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleResetForm = () => {
    setStudyRoomId("");
    setSelectedDay("");
    setStartTime("");
    setHours(1);
    setEndDate("");
    setCompanions([]);
    setReason("");
    setSubmitResult(null);
  };

  const selectedRoom = STUDY_ROOMS.find((room) => room.id === studyRoomId);

  // 시작 시간 변경 시 2시간 선택 불가하면 1시간으로 초기화
  const lastSlot = TIME_SLOTS[TIME_SLOTS.length - 1];
  const handleStartTimeChange = (time: string) => {
    setStartTime(time);
    if (time === lastSlot) setHours(1);
  };

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
  const isValid = () => {
    if (!studyRoomId) return false;
    if (!selectedDay) return false;
    if (!startTime) return false;
    if (!endDate) return false;
    if (!reason.trim()) return false;

    // 인원 검사 (본인 포함)
    if (selectedRoom) {
      const totalPeople = companions.length + 1;
      if (totalPeople < selectedRoom.minPeople) return false;
      if (totalPeople > selectedRoom.maxPeople) return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!isValid() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const response = await fetch("/api/reservations", {
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
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitResult({ success: true, message: data.message });
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

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>스터디룸 반복 예약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <StudyRoomSelect value={studyRoomId} onChange={setStudyRoomId} />

          <Separator />

          <ScheduleSelect
            selectedDay={selectedDay}
            onDayChange={setSelectedDay}
            startTime={startTime}
            onStartTimeChange={handleStartTimeChange}
            hours={hours}
            onHoursChange={setHours}
            endDate={endDate}
            onEndDateChange={setEndDate}
          />

          <Separator />

          <CompanionInput
            companions={companions}
            onChange={setCompanions}
            onVerify={handleVerifyCompanion}
            minPeople={selectedRoom?.minPeople ?? 2}
            maxPeople={selectedRoom?.maxPeople ?? 6}
          />

          <Separator />

          <ReasonInput value={reason} onChange={setReason} />

          <Button
            className="w-full"
            size="xl"
            onClick={handleSubmit}
            disabled={!isValid() || isSubmitting}
          >
            {isSubmitting ? "예약 등록 중..." : "반복 예약 등록하기"}
          </Button>

        </CardContent>
      </Card>

      <Dialog
        open={submitResult !== null}
        onOpenChange={(open) => {
          if (!open) setSubmitResult(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {submitResult?.success ? (
                <CircleCheck className="size-5 text-green-600" />
              ) : (
                <CircleX className="size-5 text-destructive" />
              )}
              {submitResult?.success ? "예약 등록 완료" : "예약 등록 실패"}
            </DialogTitle>
            <DialogDescription>{submitResult?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleResetForm}>
              다시 예약하기
            </Button>
            <Button onClick={() => router.push("/history")}>
              예약 확인하러 가기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReservationPage;
