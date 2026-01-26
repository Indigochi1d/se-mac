import {
  ReservationButton,
  ReservationHistoryButton,
} from "@/components/home/ReservationButtons";

export default function Home() {
  return (
    <div className="flex justify-center items-center min-h-screen gap-4">
      <ReservationButton />
      <ReservationHistoryButton />
    </div>
  );
}
