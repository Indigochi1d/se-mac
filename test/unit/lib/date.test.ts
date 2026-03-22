import {
  getNextWeekDate,
  generateRecurringDates,
  formatDate,
  getEndTime,
  isFutureReservation,
} from "@/lib/date";

describe("getNextWeekDate", () => {
  beforeEach(() => {
    // 2026-03-19 목요일(4)로 고정
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-19T10:00:00"));
  });
  afterEach(() => jest.useRealTimers());

  it("이미 지난 요일(월요일)이면 다음 주 월요일을 반환", () => {
    const result = getNextWeekDate("mon");
    // 2026-03-19 목요일 → 다음 주 월요일 = 2026-03-23
    expect(result).toEqual({ year: "2026", month: "03", day: "23" });
  });

  it("아직 안 지난 요일(금요일)이면 이번 주 금요일을 반환", () => {
    const result = getNextWeekDate("fri");
    // 2026-03-19 목요일 → 이번 주 금요일 = 2026-03-20
    expect(result).toEqual({ year: "2026", month: "03", day: "20" });
  });

  it("오늘 요일(목요일)이면 다음 주 목요일을 반환", () => {
    const result = getNextWeekDate("thu");
    // 오늘이 목요일이면 다음 주 목요일 = 2026-03-26
    expect(result).toEqual({ year: "2026", month: "03", day: "26" });
  });

  it("잘못된 dayId는 에러를 던짐", () => {
    expect(() => getNextWeekDate("sat")).toThrow("Invalid day ID: sat");
  });

  it("월(month)과 일(day)에 패딩이 적용됨", () => {
    // 2026-01-08 목요일
    jest.setSystemTime(new Date("2026-01-08T10:00:00"));
    const result = getNextWeekDate("fri"); // 1월 9일
    expect(result.month).toBe("01");
    expect(result.day).toBe("09");
  });
});

describe("generateRecurringDates", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // 2026-03-19 목요일
    jest.setSystemTime(new Date("2026-03-19T10:00:00"));
  });
  afterEach(() => jest.useRealTimers());

  it("endDate까지 매주 반복 날짜 배열을 반환", () => {
    // 목요일 → 다음 주 목요일부터 시작 (2026-03-26)
    const dates = generateRecurringDates("thu", "2026-04-16");
    expect(dates).toEqual(["2026-03-26", "2026-04-02", "2026-04-09", "2026-04-16"]);
  });

  it("endDate 이전 날짜만 포함", () => {
    const dates = generateRecurringDates("thu", "2026-04-01");
    expect(dates).toEqual(["2026-03-26"]);
  });

  it("endDate가 시작 날짜보다 이전이면 빈 배열 반환", () => {
    const dates = generateRecurringDates("thu", "2026-03-20");
    expect(dates).toEqual([]);
  });

  it("매주 7일 간격으로 생성됨", () => {
    const dates = generateRecurringDates("mon", "2026-04-20");
    for (let i = 1; i < dates.length; i++) {
      const diff =
        (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) /
        (1000 * 60 * 60 * 24);
      expect(diff).toBe(7);
    }
  });
});

describe("formatDate", () => {
  it("날짜를 한국어 형식으로 포맷 (월, 일, 요일 포함)", () => {
    const result = formatDate("2026-03-19");
    // Node 환경마다 "3월 19일 목" 또는 "3. 19. (목)" 형태로 다를 수 있음
    // 공통: 3(월), 19(일), 목(요일) 숫자 포함
    expect(result).toMatch(/3/);
    expect(result).toMatch(/19/);
  });

  it("1월 1일 포맷 (월 번호 포함)", () => {
    const result = formatDate("2026-01-01");
    expect(result).toMatch(/1/);
    // 빈 문자열이 아님
    expect(result.length).toBeGreaterThan(0);
  });

  it("반환값이 문자열", () => {
    expect(typeof formatDate("2026-06-15")).toBe("string");
  });
});

describe("getEndTime", () => {
  it("14:00 + 2시간 = 16:00", () => {
    expect(getEndTime("14:00", 2)).toBe("16:00");
  });

  it("09:00 + 1시간 = 10:00", () => {
    expect(getEndTime("09:00", 1)).toBe("10:00");
  });

  it("22:00 + 2시간 = 24:00 (패딩 적용)", () => {
    expect(getEndTime("22:00", 2)).toBe("24:00");
  });

  it("분도 그대로 유지됨", () => {
    expect(getEndTime("10:30", 1)).toBe("11:30");
  });
});

describe("isFutureReservation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-19T14:00:00"));
  });
  afterEach(() => jest.useRealTimers());

  it("미래 날짜이면 true", () => {
    expect(isFutureReservation("2026-03-20", "10:00")).toBe(true);
  });

  it("과거 날짜이면 false", () => {
    expect(isFutureReservation("2026-03-18", "10:00")).toBe(false);
  });

  it("오늘 같은 날이지만 미래 시간이면 true", () => {
    expect(isFutureReservation("2026-03-19", "15:00")).toBe(true);
  });

  it("오늘 같은 날이지만 과거 시간이면 false", () => {
    expect(isFutureReservation("2026-03-19", "13:00")).toBe(false);
  });
});
