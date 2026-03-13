import { cookies } from "next/headers";
import {
  ReservationButton,
  ReservationHistoryButton,
  LogoutButton,
} from "@/components/home/ReservationButtons";

export default async function Home() {
  const cookieStore = await cookies();
  const studentId = cookieStore.get("student_id")?.value ?? "";
  const studentName = cookieStore.get("student_name")?.value ?? "";

  return (
    <div className="relative flex justify-center items-center min-h-screen gap-4">
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {studentId} {studentName}
        </span>
        <LogoutButton />
      </div>

      <div className="flex gap-4">
        <ReservationButton />
        <ReservationHistoryButton />
      </div>
    </div>
  );
}
