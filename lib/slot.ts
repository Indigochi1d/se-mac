/**
 * startTime과 hours로부터 점유되는 1시간 단위 슬롯 목록을 생성
 * @example generateSlotTimes("14:00", 2) → ["14:00", "15:00"]
 * @example generateSlotTimes("10:00", 1) → ["10:00"]
 */
export const generateSlotTimes = (startTime: string, hours: number): string[] => {
  const [h, m] = startTime.split(":").map(Number);
  return Array.from({ length: hours }, (_, i) =>
    `${String(h + i).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
  );
};
