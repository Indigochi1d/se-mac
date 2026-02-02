"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { STUDY_ROOMS } from "@/constants/studyroom";

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
