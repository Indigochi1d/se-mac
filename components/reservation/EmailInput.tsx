"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
}

export const EmailInput = ({ value, onChange }: EmailInputProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="email">알림 이메일 (선택)</Label>
      <Input
        id="email"
        type="email"
        placeholder="예약 결과를 받을 이메일 주소"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-sm text-muted-foreground">
        입력하면 예약 결과를 이메일로 알려드립니다.
      </p>
    </div>
  );
};
