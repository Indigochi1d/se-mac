"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DAYS = [
  { id: "mon", label: "월" },
  { id: "tue", label: "화" },
  { id: "wed", label: "수" },
  { id: "thu", label: "목" },
  { id: "fri", label: "금" },
] as const;

// 임시 데이터 (API 연동 전)
const TIME_SLOTS = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

interface ScheduleSelectProps {
  selectedDay: string;
  onDayChange: (day: string) => void;
  startTime: string;
  onStartTimeChange: (time: string) => void;
  endTime: string;
  onEndTimeChange: (time: string) => void;
}

export const ScheduleSelect = ({
  selectedDay,
  onDayChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
}: ScheduleSelectProps) => {
  // 시작 시간 기준으로 종료 시간 옵션 생성 (최대 2시간)
  const getEndTimeOptions = () => {
    if (!startTime) return [];

    const startIndex = TIME_SLOTS.indexOf(startTime);
    if (startIndex === -1) return [];

    // 시작 시간 이후 1~2시간 범위
    return TIME_SLOTS.slice(startIndex + 1, startIndex + 3);
  };

  const endTimeOptions = getEndTimeOptions();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>요일 선택</Label>
        <div className="flex gap-4 flex-wrap">
          {DAYS.map((day) => (
            <div key={day.id} className="flex items-center gap-2">
              <Checkbox
                id={day.id}
                checked={selectedDay === day.id}
                onCheckedChange={() => onDayChange(day.id)}
              />
              <Label htmlFor={day.id} className="cursor-pointer">
                {day.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>시작 시간</Label>
          <Select value={startTime} onValueChange={onStartTimeChange}>
            <SelectTrigger>
              <SelectValue placeholder="시작 시간" />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.slice(0, -1).map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>종료 시간</Label>
          <Select
            value={endTime}
            onValueChange={onEndTimeChange}
            disabled={!startTime}
          >
            <SelectTrigger>
              <SelectValue placeholder="종료 시간" />
            </SelectTrigger>
            <SelectContent>
              {endTimeOptions.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        하루 최대 2시간까지 이용 가능합니다.
      </p>
    </div>
  );
};
