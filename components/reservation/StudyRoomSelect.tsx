"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface StudyRoom {
  id: string;
  name: string;
  minPeople: number;
  maxPeople: number;
}

// 임시 데이터 (API 연동 전)
export const STUDY_ROOMS: StudyRoom[] = [
  { id: "01", name: "스터디룸 01", minPeople: 6, maxPeople: 13 },
  { id: "02", name: "스터디룸 02", minPeople: 2, maxPeople: 6 },
  { id: "03", name: "스터디룸 03", minPeople: 2, maxPeople: 6 },
  { id: "04", name: "스터디룸 04", minPeople: 2, maxPeople: 6 },
  { id: "05", name: "스터디룸 05", minPeople: 2, maxPeople: 6 },
  { id: "06", name: "스터디룸 06", minPeople: 2, maxPeople: 6 },
  { id: "07", name: "스터디룸 07", minPeople: 2, maxPeople: 6 },
  { id: "08", name: "스터디룸 08", minPeople: 2, maxPeople: 6 },
  { id: "09", name: "스터디룸 09", minPeople: 2, maxPeople: 6 },
  { id: "10", name: "스터디룸 10", minPeople: 2, maxPeople: 6 },
  { id: "11", name: "스터디룸 11", minPeople: 2, maxPeople: 6 },
  { id: "12", name: "스터디룸 12", minPeople: 2, maxPeople: 6 },
  { id: "13", name: "스터디룸 13", minPeople: 2, maxPeople: 6 },
];

interface StudyRoomSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export const StudyRoomSelect = ({ value, onChange }: StudyRoomSelectProps) => {
  const selectedRoom = STUDY_ROOMS.find((room) => room.id === value);

  return (
    <div className="space-y-2">
      <Label>스터디룸 선택</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="스터디룸을 선택하세요" />
        </SelectTrigger>
        <SelectContent>
          {STUDY_ROOMS.map((room) => (
            <SelectItem key={room.id} value={room.id}>
              {room.name} ({room.minPeople}~{room.maxPeople}명)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedRoom && (
        <p className="text-sm text-muted-foreground">
          인원: 최소 {selectedRoom.minPeople}명, 최대 {selectedRoom.maxPeople}명
        </p>
      )}
    </div>
  );
};
