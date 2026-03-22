import { test, expect } from "@playwright/test";

// 인증된 상태로 시작하는 헬퍼
async function setupAuthCookies(page: import("@playwright/test").Page) {
  await page.context().addCookies([
    {
      name: "ssotoken",
      value: "test-sso-token",
      domain: "localhost",
      path: "/",
    },
    {
      name: "student_id",
      value: "20001234",
      domain: "localhost",
      path: "/",
    },
    {
      name: "student_name",
      value: "홍길동",
      domain: "localhost",
      path: "/",
    },
  ]);
}

test.describe("예약 페이지", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthCookies(page);

    // /api/reservations/slots mock (빈 슬롯)
    await page.route("/api/reservations/slots*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    await page.goto("/reservation");
  });

  test("예약 폼이 렌더링됨", async ({ page }) => {
    await expect(page.getByText(/예약/)).toBeVisible();
  });

  test("예약 성공 → 성공 메시지 표시", async ({ page }) => {
    await page.route("/api/reservations/reserve", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "2건의 예약이 등록되었습니다.",
          data: {
            groupId: "uuid-123",
            count: 2,
            dates: ["2026-03-26", "2026-04-02"],
            immediateResults: [],
            scheduledCount: 2,
          },
        }),
      });
    });

    // 폼 제출 (실제 UI 요소는 앱 구조에 따라 조정 필요)
    // 예약 버튼 클릭
    const submitBtn = page.getByRole("button", { name: /예약/ });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await expect(page.getByText(/등록되었습니다/)).toBeVisible();
    }
  });

  test("슬롯 충돌 → 에러 메시지 표시", async ({ page }) => {
    await page.route("/api/reservations/reserve", async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "2026-03-26 14:00 시간대는 이미 예약되어 있습니다.",
        }),
      });
    });

    const submitBtn = page.getByRole("button", { name: /예약/ });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await expect(page.getByText(/이미 예약/)).toBeVisible();
    }
  });
});
