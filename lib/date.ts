const DAY_MAP: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
};

/**
 * 요일 ID를 다음 주 해당 요일의 날짜로 변환
 * @param dayId - 요일 ID (mon, tue, wed, thu, fri)
 * @returns { year, month, day } - 패딩된 문자열
 */
export function getNextWeekDate(dayId: string): {
  year: string;
  month: string;
  day: string;
} {
  const targetDayOfWeek = DAY_MAP[dayId];
  if (targetDayOfWeek === undefined) {
    throw new Error(`Invalid day ID: ${dayId}`);
  }

  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 = 일요일

  // 다음 주 월요일까지의 일수
  const daysUntilNextMonday = currentDayOfWeek === 0 ? 1 : 8 - currentDayOfWeek;

  // 다음 주 해당 요일까지의 일수
  const daysUntilTarget = daysUntilNextMonday + (targetDayOfWeek - 1);

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysUntilTarget);

  return {
    year: targetDate.getFullYear().toString(),
    month: String(targetDate.getMonth() + 1).padStart(2, "0"),
    day: String(targetDate.getDate()).padStart(2, "0"),
  };
}

/**
 * 특정 요일에 해당하는 모든 날짜를 생성 (다음 주 ~ 종료일)
 * @param dayId - 요일 ID (mon, tue, wed, thu, fri)
 * @param endDate - 종료 날짜 (YYYY-MM-DD 형식)
 * @returns string[] - "YYYY-MM-DD" 형식의 날짜 배열
 */
export function generateRecurringDates(
  dayId: string,
  endDate: string,
): string[] {
  const { year, month, day } = getNextWeekDate(dayId);
  const current = new Date(`${year}-${month}-${day}`);
  const end = new Date(endDate);

  const dates: string[] = [];

  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 7);
  }

  return dates;
}
