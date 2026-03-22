import { generateSlotTimes } from "@/lib/slot";

describe("generateSlotTimes", () => {
  it("2시간 → 2개 슬롯", () => {
    expect(generateSlotTimes("14:00", 2)).toEqual(["14:00", "15:00"]);
  });

  it("1시간 → 1개 슬롯", () => {
    expect(generateSlotTimes("10:00", 1)).toEqual(["10:00"]);
  });

  it("시간 패딩 적용 (9시)", () => {
    expect(generateSlotTimes("09:00", 2)).toEqual(["09:00", "10:00"]);
  });

  it("분이 00이 아닌 경우도 그대로 유지", () => {
    expect(generateSlotTimes("10:30", 2)).toEqual(["10:30", "11:30"]);
  });
});
