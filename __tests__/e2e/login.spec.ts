import { test, expect } from "@playwright/test";

test.describe("로그인 페이지", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("로그인 폼이 렌더링됨", async ({ page }) => {
    await expect(page.getByText("스터디룸 예약")).toBeVisible();
    await expect(page.getByPlaceholder("20201234")).toBeVisible();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  });

  test("로그인 성공 → 대시보드(/)로 이동", async ({ page }) => {
    // /api/auth/login 인터셉트
    await page.route("/api/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "로그인 성공" }),
      });
    });

    await page.fill('[name="studentId"]', "20001234");
    await page.fill('[name="password"]', "correctpassword");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("/");
  });

  test("로그인 실패 → 에러 메시지 표시", async ({ page }) => {
    await page.route("/api/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "학번 또는 비밀번호가 올바르지 않습니다.",
        }),
      });
    });

    await page.fill('[name="studentId"]', "20001234");
    await page.fill('[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(
      page.getByText("학번 또는 비밀번호가 올바르지 않습니다."),
    ).toBeVisible();
    // 페이지 이동 없음
    await expect(page).toHaveURL("/login");
  });

  test("제출 중 로딩 상태 표시", async ({ page }) => {
    // 느린 응답 시뮬레이션
    await page.route("/api/auth/login", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "로그인 성공" }),
      });
    });

    await page.fill('[name="studentId"]', "20001234");
    await page.fill('[name="password"]', "password");
    await page.click('button[type="submit"]');

    // 로딩 중 텍스트 확인
    await expect(page.getByText("로그인 중...")).toBeVisible();
  });

  test("네트워크 에러 → 에러 메시지 표시", async ({ page }) => {
    await page.route("/api/auth/login", async (route) => {
      await route.abort("failed");
    });

    await page.fill('[name="studentId"]', "20001234");
    await page.fill('[name="password"]', "password");
    await page.click('button[type="submit"]');

    await expect(page.getByText("네트워크 오류가 발생했습니다.")).toBeVisible();
  });
});
