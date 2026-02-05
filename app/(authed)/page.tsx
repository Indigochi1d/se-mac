import {
  ReservationButton,
  ReservationHistoryButton,
  LogoutButton,
} from "@/components/home/ReservationButtons";

export default function Home() {
  return (
    <div className="relative flex justify-center items-center min-h-screen gap-4">
      <div className="absolute top-4 right-4">
        <LogoutButton />
      </div>
      <ReservationButton />
      <ReservationHistoryButton />
    </div>
  );
}
