import { useEffect, useState } from "react";
import { isFutureReservation } from "@/lib/date";

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

export const useHistory = () => {
  const [groups, setGroups] = useState<ReservationGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (data.success) {
        setGroups(data.data);
      }
    } catch {
      // TODO: 에러 처리
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const activeGroups = groups.filter(
    (group) => !group.reservations.every((r) => r.status === "cancelled"),
  );

  const openCancelModal = (reservation: Reservation, startTime: string) => {
    const isFuture = isFutureReservation(reservation.date, startTime);
    const type: CancelTarget["type"] =
      reservation.status === "success" && isFuture ? "library" : "pending";

    setCancelTarget({ reservation, startTime, type });
  };

  const confirmCancel = async () => {
    if (!cancelTarget || cancellingId) return;

    const reservationId = cancelTarget.reservation.id;
    setCancellingId(reservationId);

    try {
      const res = await fetch("/api/reservations/cancel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      });

      const data = await res.json();
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

  return {
    activeGroups,
    isLoading,
    cancellingId,
    cancelTarget,
    setCancelTarget,
    openCancelModal,
    confirmCancel,
  };
};
