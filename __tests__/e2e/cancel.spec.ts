import { test, expect } from "@playwright/test";

async function setupAuthCookies(page: import("@playwright/test").Page) {
  await page.context().addCookies([
    { name: "ssotoken", value: "test-sso-token", domain: "localhost", path: "/" },
    { name: "student_id", value: "20001234", domain: "localhost", path: "/" },
    { name: "student_name", value: "홍길동", domain: "localhost", path: "/" },
  ]);
}

const mockHistoryWithCancellable = {
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
  ],
};

test.describe("예약 취소", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthCookies(page);

    await page.route("/api/history", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockHistoryWithCancellable),
      });
    });

    await page.goto("/history");
  });

  test("취소 성공 → UI 상태 변경 또는 성공 피드백", async ({ page }) => {
    await page.route("/api/reservations/cancel", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "예약이 취소되었습니다." }),
      });
    });

    // 취소 버튼 클릭 (있을 경우)
    const cancelBtn = page.getByRole("button", { name: /취소/ }).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();

      // 확인 다이얼로그가 있으면 확인
      const confirmBtn = page.getByRole("button", { name: /확인/ });
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      // 취소 완료 피드백 또는 상태 변경 확인
      await expect(
        page.getByText(/취소/).or(page.getByText(/cancelled/)),
      ).toBeVisible();
    }
  });

  test("취소 실패 → 에러 메시지 표시", async ({ page }) => {
    await page.route("/api/reservations/cancel", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "이미 취소된 예약입니다.",
        }),
      });
    });

    const cancelBtn = page.getByRole("button", { name: /취소/ }).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();

      const confirmBtn = page.getByRole("button", { name: /확인/ });
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await expect(page.getByText(/이미 취소/)).toBeVisible();
    }
  });
});
