const DAY_MAP: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
};

/**
 * 요일 ID를 가장 가까운 해당 요일 날짜로 변환 (오늘 포함)
 * - 이번 주 해당 요일이 아직 안 지났으면 이번 주
 * - 이미 지났으면 다음 주
 * @param dayId - 요일 ID (mon, tue, wed, thu, fri)
 * @returns { year, month, day } - 패딩된 문자열
 */
export const getNextWeekDate = (
  dayId: string,
): {
  year: string;
  month: string;
  day: string;
} => {
  const targetDayOfWeek = DAY_MAP[dayId];
  if (targetDayOfWeek === undefined) {
    throw new Error(`Invalid day ID: ${dayId}`);
  }

  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 = 일요일

  let daysUntilTarget = targetDayOfWeek - currentDayOfWeek;
  if (daysUntilTarget < 0) {
    // 이번 주에 이미 지난 요일이면 다음 주로
    daysUntilTarget += 7;
  }
  if (daysUntilTarget === 0) {
    // 오늘이 해당 요일이면 다음 주로 (오늘은 이미 예약하기 어려우므로)
    daysUntilTarget = 7;
  }

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysUntilTarget);

  return {
    year: targetDate.getFullYear().toString(),
    month: String(targetDate.getMonth() + 1).padStart(2, "0"),
    day: String(targetDate.getDate()).padStart(2, "0"),
  };
};

/**
 * 특정 요일에 해당하는 모든 날짜를 생성 (다음 주 ~ 종료일)
 * @param dayId - 요일 ID (mon, tue, wed, thu, fri)
 * @param endDate - 종료 날짜 (YYYY-MM-DD 형식)
 * @returns string[] - "YYYY-MM-DD" 형식의 날짜 배열
 */
export const generateRecurringDates = (
  dayId: string,
  endDate: string,
): string[] => {
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
};

export const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
};

export const getEndTime = (startTime: string, hours: number) => {
  const [h, m] = startTime.split(":").map(Number);
  return `${String(h + hours).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * 예약일시가 현재 시점보다 미래인지 확인
 * @param date - 예약 날짜 (YYYY-MM-DD 형식)
 * @param startTime - 시작 시간 (HH:mm 형식)
 * @returns boolean - 미래이면 true
 */
export const isFutureReservation = (date: string, startTime: string): boolean => {
  const reservationDateTime = new Date(`${date}T${startTime}:00`);
  return reservationDateTime > new Date();
};
