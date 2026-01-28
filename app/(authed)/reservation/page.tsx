"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  StudyRoomSelect,
  STUDY_ROOMS,
} from "@/components/reservation/StudyRoomSelect";
import { ScheduleSelect } from "@/components/reservation/ScheduleSelect";
import {
  CompanionInput,
  type Companion,
} from "@/components/reservation/CompanionInput";
import { ReasonInput } from "@/components/reservation/ReasonInput";
import { getNextWeekDate } from "@/lib/date";

const ReservationPage = () => {
  const [studyRoomId, setStudyRoomId] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [reason, setReason] = useState("");

  const selectedRoom = STUDY_ROOMS.find((room) => room.id === studyRoomId);

  // 시작 시간 변경 시 종료 시간 초기화
  const handleStartTimeChange = (time: string) => {
    setStartTime(time);
    setEndTime("");
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
    if (!startTime || !endTime) return false;
    if (!reason.trim()) return false;

    // 인원 검사 (본인 포함)
    if (selectedRoom) {
      const totalPeople = companions.length + 1;
      if (totalPeople < selectedRoom.minPeople) return false;
      if (totalPeople > selectedRoom.maxPeople) return false;
    }

    return true;
  };

  const handleSubmit = () => {
    if (!isValid()) return;

    const reservationData = {
      studyRoomId,
      selectedDay,
      startTime,
      endTime,
      companions,
      reason,
    };

    console.log("예약 데이터:", reservationData);
  };

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>스터디룸 예약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <StudyRoomSelect value={studyRoomId} onChange={setStudyRoomId} />

          <Separator />

          <ScheduleSelect
            selectedDay={selectedDay}
            onDayChange={setSelectedDay}
            startTime={startTime}
            onStartTimeChange={handleStartTimeChange}
            endTime={endTime}
            onEndTimeChange={setEndTime}
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
            disabled={!isValid()}
          >
            예약 진행하기
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReservationPage;
