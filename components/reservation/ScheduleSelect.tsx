"use client";

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
  endDate: string;
  onEndDateChange: (date: string) => void;
  occupiedSlots: string[];
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
  occupiedSlots,
}: ScheduleSelectProps) => {
  const lastSlot = TIME_SLOTS[TIME_SLOTS.length - 1];

  const isSlotDisabled = (time: string) => occupiedSlots.includes(time);

  // 2시간 선택 가능 여부: 마지막 슬롯이 아니고, 다음 슬롯도 비어있어야 함
  const canSelectTwoHours = (() => {
    if (!startTime || startTime === lastSlot) return false;
    const idx = TIME_SLOTS.indexOf(startTime);
    if (idx === -1 || idx + 1 >= TIME_SLOTS.length) return false;
    return !isSlotDisabled(TIME_SLOTS[idx + 1]);
  })();

  // 시간 버튼 클릭 시: 2시간 모드에서 다음 슬롯이 점유되어 있으면 1시간으로 전환
  const handleTimeClick = (time: string) => {
    onStartTimeChange(time);
    if (hours === 2) {
      const idx = TIME_SLOTS.indexOf(time);
      const nextSlot = TIME_SLOTS[idx + 1];
      if (!nextSlot || isSlotDisabled(nextSlot)) {
        onHoursChange(1);
      }
    }
  };

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

      <div className="space-y-2">
        <Label>이용시간</Label>
        <p className="text-sm text-muted-foreground">
          하루 최대 2시간까지 이용할 수 있어요
        </p>
        <div className="flex gap-2 flex-wrap">
          {TIME_SLOTS.map((time) => {
            const disabled = isSlotDisabled(time);
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
    </div>
  );
};
