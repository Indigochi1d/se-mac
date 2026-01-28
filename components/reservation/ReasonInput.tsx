"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReasonInputProps {
  value: string;
  onChange: (value: string) => void;
}

export const ReasonInput = ({ value, onChange }: ReasonInputProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="reason">예약 사유</Label>
      <Textarea
        id="reason"
        placeholder="예약 사유를 입력하세요"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
      />
    </div>
  );
};
