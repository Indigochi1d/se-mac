"use client";

import { useState } from "react";
import {
  Loader2,
  MapPin,
  Calendar,
  Clock,
  Users,
  CheckCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CompanionInput,
  Companion,
} from "@/components/reservation/CompanionInput";
import { STUDY_ROOMS } from "@/constants/studyroom";
import { formatDate, getEndTime, isFutureReservation } from "@/lib/date";
import {
  Reservation,
  ReservationGroup,
  ReservationDetail,
  ReservationParticipant,
  EditProgressStep,
} from "@/hooks/useHistory";

interface ReservationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetReservation: Reservation;
  targetGroup: ReservationGroup;
  reservationDetail: ReservationDetail | null;
  isLoadingDetail: boolean;
  isEditSaving: boolean;
  editProgressStep: EditProgressStep;
  onSaveEditedCompanions: (newCompanions: ReservationParticipant[]) => void;
}

function getRoomNameById(roomId: string): string {
  return STUDY_ROOMS.find((room) => room.id === roomId)?.name ?? `룸 ${roomId}`;
}

function getRoomCapacityById(
  roomId: string,
): { minPeople: number; maxPeople: number } | null {
  const studyRoom = STUDY_ROOMS.find((room) => room.id === roomId);
  return studyRoom
    ? { minPeople: studyRoom.minPeople, maxPeople: studyRoom.maxPeople }
    : null;
}

function canEditReservation(
  reservation: Reservation,
  startTime: string,
): boolean {
  if (reservation.status === "cancelled" || reservation.status === "failed") {
    return false;
  }
  if (
    reservation.status === "success" &&
    !isFutureReservation(reservation.date, startTime)
  ) {
    return false;
  }
  return true;
}

function isLibraryBookedAndFutureReservation(
  reservation: Reservation,
  startTime: string,
): boolean {
  return (
    reservation.status === "success" &&
    reservation.bookingId !== null &&
    isFutureReservation(reservation.date, startTime)
  );
}

const EDIT_PROGRESS_MESSAGES: Record<EditProgressStep, string> = {
  idle: "",
  cancelling: "기존 도서관 예약을 취소하고 있어요...",
  reserving: "새 명단으로 재예약하고 있어요...",
  done: "수정이 완료되었어요!",
};

// ─── 서브 컴포넌트: 기본 예약 정보 섹션 ───────────────────────────────────────

interface ReservationInfoSectionProps {
  targetReservation: Reservation;
  targetGroup: ReservationGroup;
}

function ReservationInfoSection({
  targetReservation,
  targetGroup,
}: ReservationInfoSectionProps) {
  const roomName = getRoomNameById(targetGroup.roomId);
  const endTime = getEndTime(targetGroup.startTime, targetGroup.hours);

  return (
    <div className="space-y-2 rounded-md border p-3 bg-muted/30">
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="size-4 text-muted-foreground shrink-0" />
        <span className="font-medium">{roomName}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="size-4 shrink-0" />
        <span>{formatDate(targetReservation.date)}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="size-4 shrink-0" />
        <span>
          {targetGroup.startTime} ~ {endTime} ({targetGroup.hours}시간)
        </span>
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트: 참여자 목록 뷰 ───────────────────────────────────────────

interface ParticipantsViewSectionProps {
  participants: ReservationParticipant[];
}

function ParticipantsViewSection({
  participants,
}: ParticipantsViewSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">예약 명단</span>
        <span className="text-xs text-muted-foreground">
          ({participants.length}명)
        </span>
      </div>
      {participants.length === 0 ? (
        <p className="text-sm text-muted-foreground pl-6">동반자가 없습니다.</p>
      ) : (
        <ul className="space-y-1 pl-6">
          {participants.map((participant) => (
            <li
              key={participant.studentId}
              className="text-sm flex items-center gap-2"
            >
              <span className="text-muted-foreground">
                {participant.studentId}
              </span>
              <span>{participant.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── 서브 컴포넌트: 저장 진행 중 오버레이 ─────────────────────────────────────

interface EditSavingOverlayProps {
  editProgressStep: EditProgressStep;
}

function EditSavingOverlay({ editProgressStep }: EditSavingOverlayProps) {
  const progressMessage = EDIT_PROGRESS_MESSAGES[editProgressStep];
  const isDone = editProgressStep === "done";

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      {isDone ? (
        <CheckCircle className="size-12 text-green-500" />
      ) : (
        <Loader2 className="size-12 animate-spin text-muted-foreground" />
      )}
      <p className="text-sm text-center text-muted-foreground">
        {progressMessage}
      </p>
    </div>
  );
}

// ─── 서브 컴포넌트: 최소 인원 미달 에러 다이얼로그 ──────────────────────────────

interface BelowMinimumPeopleErrorDialogProps {
  isOpen: boolean;
  minimumPeopleRequired: number;
  onClose: () => void;
}

function BelowMinimumPeopleErrorDialog({
  isOpen,
  minimumPeopleRequired,
  onClose,
}: BelowMinimumPeopleErrorDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>인원 부족</DialogTitle>
          <DialogDescription>
            {minimumPeopleRequired}명 미만은 불가능합니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 서브 컴포넌트: 2차 확인 다이얼로그 ──────────────────────────────────────

interface EditConfirmDialogProps {
  isOpen: boolean;
  isLibraryRebooking: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function EditConfirmDialog({
  isOpen,
  isLibraryRebooking,
  onConfirm,
  onCancel,
}: EditConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>예약 명단 수정</DialogTitle>
          <DialogDescription>
            {isLibraryRebooking
              ? "기존 도서관 예약이 취소되고 새 명단으로 재예약됩니다. 계속하시겠습니까?"
              : "예약 명단을 수정하시겠습니까?"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            아니요
          </Button>
          <Button onClick={onConfirm}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function ReservationDetailModal({
  isOpen,
  onClose,
  targetReservation,
  targetGroup,
  reservationDetail,
  isLoadingDetail,
  isEditSaving,
  editProgressStep,
  onSaveEditedCompanions,
}: ReservationDetailModalProps) {
  const [isInEditMode, setIsInEditMode] = useState(false);
  const [editedCompanions, setEditedCompanions] = useState<Companion[]>([]);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isBelowMinimumDialogOpen, setIsBelowMinimumDialogOpen] =
    useState(false);

  const isEditAllowed = canEditReservation(
    targetReservation,
    targetGroup.startTime,
  );

  const isLibraryRebooking = isLibraryBookedAndFutureReservation(
    targetReservation,
    targetGroup.startTime,
  );

  const roomCapacity = getRoomCapacityById(targetGroup.roomId);

  const handleEnterEditMode = () => {
    const initialCompanions = (reservationDetail?.participants ?? []).map(
      (participant) => ({
        studentId: participant.studentId,
        name: participant.name,
      }),
    );
    setEditedCompanions(initialCompanions);
    setIsInEditMode(true);
  };

  const handleCancelEditMode = () => {
    setIsInEditMode(false);
    setEditedCompanions([]);
  };

  const handleRequestSave = () => {
    if (!roomCapacity) return;

    const totalParticipantCount = editedCompanions.length + 1;
    if (totalParticipantCount < roomCapacity.minPeople) {
      setIsBelowMinimumDialogOpen(true);
      return;
    }

    setIsConfirmDialogOpen(true);
  };

  const handleConfirmSave = () => {
    setIsConfirmDialogOpen(false);
    onSaveEditedCompanions(
      editedCompanions.map((companion) => ({
        studentId: companion.studentId,
        name: companion.name,
      })),
    );
  };

  const handleCancelConfirmDialog = () => {
    setIsConfirmDialogOpen(false);
  };

  const handleCloseBelowMinimumDialog = () => {
    setIsBelowMinimumDialogOpen(false);
  };

  const handleInteractOutside = (event: Event) => {
    if (isEditSaving) {
      event.preventDefault();
    }
  };

  const renderModalContent = () => {
    if (isEditSaving) {
      return <EditSavingOverlay editProgressStep={editProgressStep} />;
    }

    if (isLoadingDetail) {
      return (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <ReservationInfoSection
          targetReservation={targetReservation}
          targetGroup={targetGroup}
        />

        {isInEditMode ? (
          roomCapacity ? (
            <CompanionInput
              companions={editedCompanions}
              onChange={setEditedCompanions}
              minPeople={roomCapacity.minPeople}
              maxPeople={roomCapacity.maxPeople}
            />
          ) : null
        ) : (
          <ParticipantsViewSection
            participants={reservationDetail?.participants ?? []}
          />
        )}
      </div>
    );
  };

  const renderModalFooter = () => {
    if (isEditSaving) return null;
    if (isLoadingDetail) return null;

    if (isInEditMode) {
      return (
        <DialogFooter>
          <Button variant="outline" onClick={handleCancelEditMode}>
            닫기
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={handleRequestSave}
          >
            저장
          </Button>
        </DialogFooter>
      );
    }

    return (
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
        {isEditAllowed && (
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={handleEnterEditMode}
          >
            수정
          </Button>
        )}
      </DialogFooter>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          showCloseButton={!isEditSaving}
          onInteractOutside={handleInteractOutside}
          className="max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>예약 상세 정보</DialogTitle>
          </DialogHeader>

          {renderModalContent()}
          {renderModalFooter()}
        </DialogContent>
      </Dialog>

      <BelowMinimumPeopleErrorDialog
        isOpen={isBelowMinimumDialogOpen}
        minimumPeopleRequired={roomCapacity?.minPeople ?? 0}
        onClose={handleCloseBelowMinimumDialog}
      />

      <EditConfirmDialog
        isOpen={isConfirmDialogOpen}
        isLibraryRebooking={isLibraryRebooking}
        onConfirm={handleConfirmSave}
        onCancel={handleCancelConfirmDialog}
      />
    </>
  );
}
