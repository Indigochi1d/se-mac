import { useEffect, useReducer, useState } from "react";
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

interface DetailViewState {
  target: DetailModalTarget | null;
  detail: ReservationDetail | null;
  isLoadingDetail: boolean;
  isEditSaving: boolean;
  editProgressStep: EditProgressStep;
}

type DetailViewAction =
  | { type: "OPEN"; target: DetailModalTarget }
  | { type: "FINISH_LOADING"; detail: ReservationDetail | null }
  | { type: "CLOSE" }
  | { type: "BEGIN_SAVE"; initialStep: EditProgressStep }
  | { type: "ADVANCE_SAVE_STEP"; step: EditProgressStep }
  | { type: "ABORT_SAVE" };

const initialDetailViewState: DetailViewState = {
  target: null,
  detail: null,
  isLoadingDetail: false,
  isEditSaving: false,
  editProgressStep: "idle",
};

function detailViewReducer(
  state: DetailViewState,
  action: DetailViewAction,
): DetailViewState {
  switch (action.type) {
    case "OPEN":
      return {
        ...initialDetailViewState,
        target: action.target,
        isLoadingDetail: true,
      };
    case "FINISH_LOADING":
      return { ...state, detail: action.detail, isLoadingDetail: false };
    case "CLOSE":
      return initialDetailViewState;
    case "BEGIN_SAVE":
      return {
        ...state,
        isEditSaving: true,
        editProgressStep: action.initialStep,
      };
    case "ADVANCE_SAVE_STEP":
      return { ...state, editProgressStep: action.step };
    case "ABORT_SAVE":
      return { ...state, isEditSaving: false, editProgressStep: "idle" };
  }
}

export const useHistory = () => {
  const [groups, setGroups] = useState<ReservationGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);

  const [detailView, dispatchDetailView] = useReducer(
    detailViewReducer,
    initialDetailViewState,
  );
  const {
    target: detailModalTarget,
    detail: reservationDetail,
    isLoadingDetail,
    isEditSaving,
    editProgressStep,
  } = detailView;

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
    dispatchDetailView({ type: "OPEN", target: { reservation, group } });

    try {
      const response = await fetch(`/api/reservations/${reservation.id}`);
      const data = await response.json();
      dispatchDetailView({
        type: "FINISH_LOADING",
        detail: data.success ? data.data : null,
      });
    } catch (error) {
      console.error("예약 상세 조회 실패:", error);
      dispatchDetailView({ type: "FINISH_LOADING", detail: null });
    }
  };

  const closeDetailModal = () => {
    if (isEditSaving) return;
    dispatchDetailView({ type: "CLOSE" });
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

    dispatchDetailView({
      type: "BEGIN_SAVE",
      initialStep: isLibraryBookedAndFuture ? "cancelling" : "idle",
    });

    let stepTransitionTimer: ReturnType<typeof setTimeout> | null = null;

    if (isLibraryBookedAndFuture) {
      stepTransitionTimer = setTimeout(
        () =>
          dispatchDetailView({ type: "ADVANCE_SAVE_STEP", step: "reserving" }),
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
        dispatchDetailView({ type: "ADVANCE_SAVE_STEP", step: "done" });
        await fetchHistory();
        setTimeout(() => {
          dispatchDetailView({ type: "CLOSE" });
        }, 1500);
      } else {
        alert(data.message);
        dispatchDetailView({ type: "ABORT_SAVE" });
      }
    } catch {
      if (stepTransitionTimer) clearTimeout(stepTransitionTimer);
      alert("예약 수정 중 오류가 발생했습니다.");
      dispatchDetailView({ type: "ABORT_SAVE" });
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
