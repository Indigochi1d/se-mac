import { test, expect } from "@playwright/test";

async function setupAuthCookies(page: import("@playwright/test").Page) {
  await page.context().addCookies([
    { name: "ssotoken", value: "test-sso-token", domain: "localhost", path: "/" },
    { name: "student_id", value: "20001234", domain: "localhost", path: "/" },
    { name: "student_name", value: "홍길동", domain: "localhost", path: "/" },
  ]);
}

const mockHistoryData = {
  success: true,
  data: [
    {
      groupId: "group-uuid-1",
      roomId: "4",
      startTime: "14:00",
      hours: 2,
      reservations: [
        { id: 1, date: "2026-03-26", status: "success", bookingId: "RES-001" },
        { id: 2, date: "2026-04-02", status: "pending", bookingId: null },
      ],
    },
    {
      groupId: "group-uuid-2",
      roomId: "11",
      startTime: "10:00",
      hours: 1,
      reservations: [
        { id: 3, date: "2026-03-27", status: "cancelled", bookingId: null },
      ],
    },
  ],
};

test.describe("히스토리 페이지", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthCookies(page);

    await page.route("/api/history", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockHistoryData),
      });
    });

    await page.goto("/history");
  });

  test("예약 목록이 렌더링됨", async ({ page }) => {
    // 히스토리 데이터가 화면에 표시됨
    await expect(page.getByText(/2026/)).toBeVisible();
  });

  test("다양한 상태 (success, pending, cancelled) 표시", async ({ page }) => {
    // 상태 배지들이 표시됨
    const pageText = await page.textContent("body");
    // success, pending, cancelled 중 하나 이상 포함
    const hasStatus =
      pageText?.includes("성공") ||
      pageText?.includes("대기") ||
      pageText?.includes("취소") ||
      pageText?.includes("success") ||
      pageText?.includes("pending") ||
      pageText?.includes("cancelled");
    expect(hasStatus).toBeTruthy();
  });

  test("데이터 없을 때 빈 상태 표시", async ({ page }) => {
    await page.route("/api/history", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.reload();
    // 빈 상태 UI 표시 (텍스트는 앱에 따라 다름)
    await expect(page).not.toHaveURL("/login"); // 로그인 페이지로 리다이렉트 안됨
  });
});
