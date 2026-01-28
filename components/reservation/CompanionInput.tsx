"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface Companion {
  studentId: string;
  name: string;
  ipid: string;
}

interface VerifyResult {
  success: boolean;
  ipid?: string;
  error?: string;
}

interface CompanionInputProps {
  companions: Companion[];
  onChange: (companions: Companion[]) => void;
  onVerify: (studentId: string, name: string) => Promise<VerifyResult>;
  minPeople: number;
  maxPeople: number;
}

export const CompanionInput = ({
  companions,
  onChange,
  onVerify,
  minPeople,
  maxPeople,
}: CompanionInputProps) => {
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!studentId.trim() || !name.trim()) return;

    // 중복 체크
    if (companions.some((c) => c.studentId === studentId)) {
      setError("이미 추가된 학우입니다.");
      return;
    }

    // 최대 인원 체크 (본인 포함이므로 maxPeople - 1)
    if (companions.length >= maxPeople - 1) {
      setError(`동반이용자는 최대 ${maxPeople - 1}명까지 추가할 수 있습니다.`);
      return;
    }

    setIsLoading(true);
    setError("");

    const result = await onVerify(studentId.trim(), name.trim());

    setIsLoading(false);

    if (result.success && result.ipid) {
      onChange([
        ...companions,
        { studentId: studentId.trim(), name: name.trim(), ipid: result.ipid },
      ]);
      setStudentId("");
      setName("");
    } else {
      setError(result.error || "학생 정보를 확인할 수 없습니다.");
    }
  };

  const handleRemove = (studentIdToRemove: string) => {
    onChange(companions.filter((c) => c.studentId !== studentIdToRemove));
  };

  // 본인 포함 필요 인원
  const requiredCompanions = minPeople - 1;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>동반이용자 추가</Label>
        <p className="text-sm text-muted-foreground">
          본인 제외 최소 {requiredCompanions}명, 최대 {maxPeople - 1}명 추가
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="학번"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          className="flex-1"
          disabled={isLoading}
        />
        <Input
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
          disabled={isLoading}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAdd}
          disabled={isLoading}
        >
          {isLoading ? "확인 중..." : "추가"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {companions.length > 0 && (
        <ul className="space-y-2">
          {companions.map((companion) => (
            <li
              key={companion.studentId}
              className="flex items-center justify-between p-2 bg-muted rounded-md"
            >
              <span>
                {companion.studentId} {companion.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(companion.studentId)}
              >
                삭제
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
