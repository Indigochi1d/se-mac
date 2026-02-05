"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Clock,
  MapPin,
  Calendar,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STUDY_ROOMS } from "@/constants/studyroom";
import { formatDate, getEndTime, isFutureReservation } from "@/lib/date";
import { useHistory } from "@/hooks/useHistory";

const STATUS_CONFIG = {
  pending: { label: "대기", variant: "outline" as const },
  success: { label: "완료", variant: "success" as const },
  failed: { label: "실패", variant: "destructive" as const },
  cancelled: { label: "취소됨", variant: "secondary" as const },
} as const;

const getRoomName = (roomId: string) =>
  STUDY_ROOMS.find((r) => r.id === roomId)?.name ?? `룸 ${roomId}`;

const HistoryPage = () => {
  const router = useRouter();
  const {
    activeGroups,
    isLoading,
    cancellingId,
    cancelTarget,
    setCancelTarget,
    openCancelModal,
    confirmCancel,
  } = useHistory();

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
            <CardTitle>예약 내역</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeGroups.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              예약 내역이 없습니다.
            </p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {activeGroups.map((group) => {
                const successCount = group.reservations.filter(
                  (r) => r.status === "success",
                ).length;
                const totalCount = group.reservations.length;
                const firstDate = group.reservations[0].date;
                const lastDate = group.reservations[totalCount - 1].date;

                return (
                  <AccordionItem key={group.groupId} value={group.groupId}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-col items-start gap-1.5">
                        <div className="flex items-center gap-2">
                          <MapPin className="size-4 text-muted-foreground" />
                          <span className="font-semibold">
                            {getRoomName(group.roomId)}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {successCount}/{totalCount}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {group.startTime}~
                            {getEndTime(group.startTime, group.hours)}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarRange className="size-3" />
                            {formatDate(firstDate)} ~ {formatDate(lastDate)}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {group.reservations
                          .slice()
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map((reservation) => {
                            const config = STATUS_CONFIG[reservation.status];
                            return (
                              <div
                                key={reservation.date}
                                className="flex items-center justify-between rounded-md border px-3 py-2"
                              >
                                <span className="flex items-center gap-2 text-sm">
                                  <Calendar className="size-3.5 text-muted-foreground" />
                                  {formatDate(reservation.date)}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Badge variant={config.variant}>
                                    {config.label}
                                  </Badge>
                                  {(reservation.status === "pending" ||
                                    (reservation.status === "success" &&
                                      isFutureReservation(reservation.date, group.startTime))) && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      disabled={cancellingId === reservation.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openCancelModal(reservation, group.startTime);
                                      }}
                                    >
                                      {cancellingId === reservation.id ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : (
                                        "예약 취소"
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>예약 취소</DialogTitle>
            <DialogDescription>
              {cancelTarget?.type === "library"
                ? "학술정보원에 예약된 건을 취소하시겠어요?"
                : "등록된 예약을 취소하시겠어요?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              disabled={!!cancellingId}
            >
              아니요
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={!!cancellingId}
            >
              {cancellingId ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "취소하기"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HistoryPage;
