"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getNextWeekDate } from "@/lib/date";

const DAYS = [
  { id: "mon", label: "월" },
  { id: "tue", label: "화" },
  { id: "wed", label: "수" },
  { id: "thu", label: "목" },
  { id: "fri", label: "금" },
] as const;

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
  hours: number;
  onHoursChange: (hours: number) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
}

export const ScheduleSelect = ({
  selectedDay,
  onDayChange,
  startTime,
  onStartTimeChange,
  hours,
  onHoursChange,
  endDate,
  onEndDateChange,
}: ScheduleSelectProps) => {
  // 시작 시간이 17:00이면 1시간만 선택 가능
  const canSelectTwoHours = startTime !== "17:00";

  // 종료일 최소값: 다음 주 해당 요일
  const minEndDate = selectedDay
    ? (() => {
        const { year, month, day } = getNextWeekDate(selectedDay);
        return `${year}-${month}-${day}`;
      })()
    : undefined;

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
              {TIME_SLOTS.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>이용 시간</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={hours === 1 ? "default" : "outline"}
              className="flex-1"
              onClick={() => onHoursChange(1)}
            >
              1시간
            </Button>
            <Button
              type="button"
              variant={hours === 2 ? "default" : "outline"}
              className="flex-1"
              disabled={!canSelectTwoHours}
              onClick={() => onHoursChange(2)}
            >
              2시간
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>종료 날짜</Label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          min={minEndDate}
          disabled={!selectedDay}
        />
        <p className="text-sm text-muted-foreground">
          이 날짜까지 매주 반복 예약됩니다.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        하루 최대 2시간까지 이용 가능합니다.
      </p>
    </div>
  );
};
