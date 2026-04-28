import { useEffect, useState } from "react";
import { isFutureReservation, isMoreThanOneDayPast } from "@/lib/date";

export interface Reservation {
  id: number;
  date: string;
  status: "pending" | "success" | "failed" | "cancelled";
  bookingId: string | null;
}

export interface ReservationGroup {
  groupId: string;
  roomId: string;
  startTime: string;
  hours: number;
  reservations: Reservation[];
}

export interface CancelTarget {
  reservation: Reservation;
  startTime: string;
  type: "library" | "pending";
}

export interface ReservationParticipant {
  studentId: string;
  name: string;
}

export interface ReservationDetail {
  participants: ReservationParticipant[];
}

export interface DetailModalTarget {
  reservation: Reservation;
  group: ReservationGroup;
}

export type EditProgressStep = "idle" | "cancelling" | "reserving" | "done";

export const useHistory = () => {
  const [groups, setGroups] = useState<ReservationGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);

  const [detailModalTarget, setDetailModalTarget] =
    useState<DetailModalTarget | null>(null);
  const [reservationDetail, setReservationDetail] =
    useState<ReservationDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editProgressStep, setEditProgressStep] =
    useState<EditProgressStep>("idle");

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/history");
      const data = await response.json();
      if (data.success) {
        setGroups(data.data);
      }
    } catch (error) {
      console.error("예약 내역 조회 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const activeGroups = groups.filter(
    (group) =>
      !group.reservations.every(
        (reservation) =>
          reservation.status === "cancelled" || isMoreThanOneDayPast(reservation.date),
      ),
  );

  const openCancelModal = (reservation: Reservation, startTime: string) => {
    const isReservationInFuture = isFutureReservation(reservation.date, startTime);
    const cancelType: CancelTarget["type"] =
      reservation.status === "success" && isReservationInFuture
        ? "library"
        : "pending";

    setCancelTarget({ reservation, startTime, type: cancelType });
  };

  const confirmCancel = async () => {
    if (!cancelTarget || cancellingId) return;

    const reservationId = cancelTarget.reservation.id;
    setCancellingId(reservationId);

    try {
      const response = await fetch("/api/reservations/cancel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchHistory();
        setCancelTarget(null);
      } else {
        alert(data.message);
      }
    } catch {
      alert("예약 취소 중 오류가 발생했습니다.");
    } finally {
      setCancellingId(null);
    }
  };

  const openDetailModal = async (
    reservation: Reservation,
    group: ReservationGroup,
  ) => {
    setDetailModalTarget({ reservation, group });
    setIsLoadingDetail(true);
    setReservationDetail(null);

    try {
      const response = await fetch(`/api/reservations/${reservation.id}`);
      const data = await response.json();
      if (data.success) {
        setReservationDetail(data.data);
      }
    } catch (error) {
      console.error("예약 상세 조회 실패:", error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeDetailModal = () => {
    if (isEditSaving) return;
    setDetailModalTarget(null);
    setReservationDetail(null);
    setIsLoadingDetail(false);
    setEditProgressStep("idle");
  };

  const saveEditedCompanions = async (
    newCompanions: ReservationParticipant[],
  ) => {
    if (!detailModalTarget) return;

    const { reservation, group } = detailModalTarget;
    const isLibraryBookedAndFuture =
      reservation.status === "success" &&
      reservation.bookingId !== null &&
      isFutureReservation(reservation.date, group.startTime);

    setIsEditSaving(true);

    let stepTransitionTimer: ReturnType<typeof setTimeout> | null = null;

    if (isLibraryBookedAndFuture) {
      setEditProgressStep("cancelling");
      stepTransitionTimer = setTimeout(
        () => setEditProgressStep("reserving"),
        2500,
      );
    }

    try {
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companions: newCompanions }),
      });

      if (stepTransitionTimer) clearTimeout(stepTransitionTimer);

      const data = await response.json();

      if (data.success) {
        setEditProgressStep("done");
        await fetchHistory();
        setTimeout(() => {
          setDetailModalTarget(null);
          setReservationDetail(null);
          setIsEditSaving(false);
          setEditProgressStep("idle");
        }, 1500);
      } else {
        alert(data.message);
        setIsEditSaving(false);
        setEditProgressStep("idle");
      }
    } catch {
      if (stepTransitionTimer) clearTimeout(stepTransitionTimer);
      alert("예약 수정 중 오류가 발생했습니다.");
      setIsEditSaving(false);
      setEditProgressStep("idle");
    }
  };

  return {
    activeGroups,
    isLoading,
    cancellingId,
    cancelTarget,
    setCancelTarget,
    openCancelModal,
    confirmCancel,
    detailModalTarget,
    reservationDetail,
    isLoadingDetail,
    isEditSaving,
    editProgressStep,
    openDetailModal,
    closeDetailModal,
    saveEditedCompanions,
  };
};
