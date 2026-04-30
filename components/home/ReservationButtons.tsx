"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
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

export const LogoutButton = () => {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      loading={isLoggingOut}
      loadingText="로그아웃 중..."
    >
      <LogOut className="size-4" />
      로그아웃
    </Button>
  );
};
