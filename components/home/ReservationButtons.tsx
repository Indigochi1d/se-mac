import { Button } from "@/components/ui/button";
import Link from "next/link";

export const ReservationButton = () => {
  return (
    <Button asChild size="xl">
      <Link href="/reservation">예약하기</Link>
    </Button>
  );
};

export const ReservationHistoryButton = () => {
  return (
    <Button asChild size="xl" variant="secondary">
      <Link href="/history">내 예약 확인</Link>
    </Button>
  );
};
