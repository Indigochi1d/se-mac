"use client";

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
  const handleSubmitLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const studentId = formData.get("studentId");
    const password = formData.get("password");
    console.log("로그인 시도:", { studentId, password });
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
              <Field className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 bg-linear-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white font-semibold shadow-md transition-all duration-200"
                >
                  로그인
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
