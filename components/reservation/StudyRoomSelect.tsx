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

export const STUDY_ROOMS: StudyRoom[] = [
  { id: "11", name: "스터디룸 01", minPeople: 6, maxPeople: 13 },
  { id: "10", name: "스터디룸 02", minPeople: 3, maxPeople: 6 },
  { id: "12", name: "스터디룸 03", minPeople: 3, maxPeople: 6 },
  { id: "13", name: "스터디룸 04", minPeople: 3, maxPeople: 6 },
  { id: "14", name: "스터디룸 05", minPeople: 3, maxPeople: 6 },
  { id: "15", name: "스터디룸 06", minPeople: 3, maxPeople: 6 },
  { id: "1", name: "스터디룸 07", minPeople: 3, maxPeople: 6 },
  { id: "2", name: "스터디룸 08", minPeople: 3, maxPeople: 6 },
  { id: "3", name: "스터디룸 09", minPeople: 3, maxPeople: 6 },
  { id: "9", name: "스터디룸 10", minPeople: 3, maxPeople: 6 },
  { id: "4", name: "스터디룸 11", minPeople: 3, maxPeople: 6 },
  { id: "5", name: "스터디룸 12", minPeople: 3, maxPeople: 6 },
  { id: "16", name: "스터디룸 13", minPeople: 3, maxPeople: 6 },
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
