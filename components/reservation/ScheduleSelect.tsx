"use client";

import { useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { getNextWeekDate } from "@/lib/date";
import { DAYS, TIME_SLOTS } from "@/constants/schedule";

interface ScheduleSelectProps {
  selectedDay: string;
  onDayChange: (day: string) => void;
  startTime: string;
  onStartTimeChange: (time: string) => void;
  hours: number;
  onHoursChange: (hours: number) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  occupiedSlots: string[];
}

const DAY_JS_MAP: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
};

const lastSlot = TIME_SLOTS[TIME_SLOTS.length - 1];

export const ScheduleSelect = ({
  selectedDay,
  onDayChange,
  startTime,
  onStartTimeChange,
  hours,
  onHoursChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  occupiedSlots,
}: ScheduleSelectProps) => {
  const occupiedSet = useMemo(() => new Set(occupiedSlots), [occupiedSlots]);

  // 2시간 선택 가능 여부: 마지막 슬롯이 아니고, 다음 슬롯도 비어있어야 함
  const canSelectTwoHours = useMemo(() => {
    if (!startTime || startTime === lastSlot) return false;
    const idx = TIME_SLOTS.indexOf(startTime);
    if (idx === -1 || idx + 1 >= TIME_SLOTS.length) return false;
    return !occupiedSet.has(TIME_SLOTS[idx + 1]);
  }, [startTime, occupiedSet]);

  // 시간 버튼 클릭 시: 2시간 모드에서 다음 슬롯이 점유되어 있으면 1시간으로 전환
  const handleTimeClick = useCallback(
    (time: string) => {
      onStartTimeChange(time);
      if (hours === 2) {
        const idx = TIME_SLOTS.indexOf(time);
        const nextSlot = TIME_SLOTS[idx + 1];
        if (!nextSlot || occupiedSet.has(nextSlot)) {
          onHoursChange(1);
        }
      }
    },
    [hours, occupiedSet, onStartTimeChange, onHoursChange],
  );

  // 시작일 최소값: 다음 가능 날짜
  const minStartDate = useMemo(() => {
    if (!selectedDay) return undefined;
    const { year, month, day } = getNextWeekDate(selectedDay);
    return `${year}-${month}-${day}`;
  }, [selectedDay]);

  // 종료일 최소값: startDate 기준 (없으면 minStartDate)
  const minEndDate = startDate || minStartDate;

  // 시작일 변경: 선택한 요일과 다른 날짜면 무시
  const handleStartDateChange = useCallback(
    (value: string) => {
      if (!value) return;
      if (new Date(value + "T00:00:00").getDay() !== DAY_JS_MAP[selectedDay])
        return;
      onStartDateChange(value);
      if (endDate && value > endDate) onEndDateChange("");
    },
    [selectedDay, endDate, onStartDateChange, onEndDateChange],
  );

  const beforeSelectStartEndDay = startDate === "" || endDate === "";

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

      <div className="space-y-2">
        <Label>반복 예약 시작 날짜</Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => handleStartDateChange(e.target.value)}
          min={minStartDate}
          disabled={!selectedDay}
        />
        <p className="text-sm text-muted-foreground">
          선택한 요일에 해당하는 날짜만 선택할 수 있어요
        </p>
      </div>

      <div className="space-y-2">
        <Label>반복 예약 종료 날짜</Label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          min={minEndDate}
          disabled={!selectedDay}
        />
        <p className="text-sm text-muted-foreground">
          이 날짜까지 매주 반복 예약돼요
        </p>
      </div>

      <div className="space-y-2">
        <Label>이용시간</Label>
        <p className="text-sm text-muted-foreground">
          반복 예약의 시작일과 종료일을 선택하면 이용 시간을 설정할 수 있어요
        </p>
        <div className="flex gap-2 flex-wrap">
          {TIME_SLOTS.map((time) => {
            const disabled = occupiedSet.has(time) || beforeSelectStartEndDay;
            const selected = startTime === time;
            return (
              <Button
                key={time}
                type="button"
                variant={selected ? "default" : "outline"}
                disabled={disabled}
                onClick={() => handleTimeClick(time)}
              >
                {parseInt(time)}시
              </Button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={hours === 1 ? "default" : "outline"}
            onClick={() => onHoursChange(1)}
          >
            1시간
          </Button>
          <Button
            type="button"
            variant={hours === 2 ? "default" : "outline"}
            disabled={!canSelectTwoHours}
            onClick={() => onHoursChange(2)}
          >
            2시간
          </Button>
        </div>
      </div>
    </div>
  );
};
