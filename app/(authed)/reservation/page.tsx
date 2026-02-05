"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, CircleCheck, CircleX } from "lucide-react";
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
import { StudyRoomSelect } from "@/components/reservation/StudyRoomSelect";
import { ScheduleSelect } from "@/components/reservation/ScheduleSelect";
import { CompanionInput } from "@/components/reservation/CompanionInput";
import { ReasonInput } from "@/components/reservation/ReasonInput";
import { EmailInput } from "@/components/reservation/EmailInput";
import { formatDate } from "@/lib/date";
import { useReservation } from "@/hooks/useReservation";

const ReservationPage = () => {
  const router = useRouter();
  const {
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
  } = useReservation();

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <CardTitle>스터디룸 반복 예약</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <StudyRoomSelect value={studyRoomId} onChange={setStudyRoomId} />

          <Separator />

          <ScheduleSelect
            selectedDay={selectedDay}
            onDayChange={setSelectedDay}
            startTime={startTime}
            onStartTimeChange={setStartTime}
            hours={hours}
            onHoursChange={setHours}
            endDate={endDate}
            onEndDateChange={setEndDate}
            occupiedSlots={occupiedSlots}
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

          <EmailInput
            value={notificationEmail}
            onChange={setNotificationEmail}
          />

          <Button
            className="w-full"
            size="xl"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
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
            <DialogDescription asChild>
              <div className="space-y-3">
                <p>{submitResult?.message}</p>

                {submitResult?.immediateResults &&
                  submitResult.immediateResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-medium text-foreground">
                        즉시 예약 결과
                      </p>
                      {submitResult.immediateResults.map((result) => (
                        <div
                          key={result.date}
                          className="flex items-center gap-2 text-sm"
                        >
                          {result.status === "success" ? (
                            <CircleCheck className="size-4 text-green-600 shrink-0" />
                          ) : (
                            <CircleX className="size-4 text-destructive shrink-0" />
                          )}
                          <span>
                            {formatDate(result.date)} -{" "}
                            {result.status === "success"
                              ? "예약 완료"
                              : result.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                {submitResult?.scheduledCount !== undefined &&
                  submitResult.scheduledCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      나머지 {submitResult.scheduledCount}건은 자동 예약
                      대기중입니다.
                    </p>
                  )}
              </div>
            </DialogDescription>
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
