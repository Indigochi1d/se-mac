"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const studentId = formData.get("studentId") as string;
    const password = formData.get("password") as string;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, password }),
      });

      const data = await response.json();

      if (data.success) {
        router.push("/");
      } else {
        setError(data.message);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            스터디룸 예약
          </CardTitle>
          <CardDescription className="text-gray-600">
            세종대학교 통합 로그인
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmitLogin}>
            <FieldGroup>
              <Field>
                <FieldLabel
                  htmlFor="studentId"
                  className="text-gray-700 font-medium"
                >
                  학번
                </FieldLabel>
                <Input
                  id="studentId"
                  name="studentId"
                  type="text"
                  placeholder="20201234"
                  required
                  className="h-11 border-gray-300 focus:border-red-500 focus:ring-red-500"
                />
              </Field>
              <Field>
                <FieldLabel
                  htmlFor="password"
                  className="text-gray-700 font-medium"
                >
                  비밀번호
                </FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="h-11 border-gray-300 focus:border-red-500 focus:ring-red-500"
                />
              </Field>
              {error && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}
              <Field className="pt-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-linear-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white font-semibold shadow-md transition-all duration-200 disabled:opacity-50"
                >
                  {isLoading ? "로그인 중..." : "로그인"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {/* 하단 안내 문구 */}
      <p className="text-center text-sm text-gray-500">
        세종대학교 포털 계정으로 로그인하세요
      </p>
    </div>
  );
}
