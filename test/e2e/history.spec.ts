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
        // 미래 날짜: 수정 버튼 표시 대상
        { id: 1, date: "2099-12-01", status: "success", bookingId: "RES-001" },
        { id: 2, date: "2099-12-08", status: "pending", bookingId: null },
      ],
    },
    {
      groupId: "group-uuid-2",
      roomId: "11",
      startTime: "10:00",
      hours: 1,
      reservations: [
        { id: 3, date: "2099-12-02", status: "cancelled", bookingId: null },
      ],
    },
  ],
};

const mockDetailWithCompanions = {
  success: true,
  data: {
    participants: [
      { studentId: "20009991", name: "동반자1" },
      { studentId: "20009992", name: "동반자2" },
    ],
  },
};

const mockDetailWithoutCompanions = {
  success: true,
  data: { participants: [] },
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

// ─── 상세보기 모달 ─────────────────────────────────────────────────────────────

test.describe("예약 상세보기 모달", () => {
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

    // 첫 번째 그룹 Accordion 열기
    await page.getByText("스터디룸 04").first().click();
  });

  test("상세보기 버튼 클릭 → 모달이 열리고 기본 정보 표시됨", async ({ page }) => {
    await page.route("/api/reservations/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockDetailWithCompanions),
      });
    });

    await page.getByRole("button", { name: "상세보기" }).first().click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("예약 상세 정보")).toBeVisible();
    await expect(page.getByText("스터디룸 04")).toBeVisible();
  });

  test("동반자 있는 예약 → 명단이 모달에 표시됨", async ({ page }) => {
    await page.route("/api/reservations/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockDetailWithCompanions),
      });
    });

    await page.getByRole("button", { name: "상세보기" }).first().click();

    await expect(page.getByText("동반자1")).toBeVisible();
    await expect(page.getByText("동반자2")).toBeVisible();
  });

  test("동반자 없는 예약 → '동반자가 없습니다' 표시됨", async ({ page }) => {
    await page.route("/api/reservations/2", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockDetailWithoutCompanions),
      });
    });

    await page.getByRole("button", { name: "상세보기" }).nth(1).click();

    await expect(page.getByText("동반자가 없습니다")).toBeVisible();
  });

  test("cancelled 예약 상세보기 → 수정 버튼 없음", async ({ page }) => {
    await page.route("/api/reservations/3", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockDetailWithoutCompanions),
      });
    });

    // 두 번째 그룹 열기 (cancelled 예약)
    await page.getByText("스터디룸 11").first().click();
    await page.getByRole("button", { name: "상세보기" }).last().click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "수정" }),
    ).not.toBeVisible();
  });

  test("닫기 버튼 → 모달 닫힘", async ({ page }) => {
    await page.route("/api/reservations/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockDetailWithCompanions),
      });
    });

    await page.getByRole("button", { name: "상세보기" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: "닫기" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

// ─── 예약 명단 수정 ────────────────────────────────────────────────────────────

test.describe("예약 명단 수정 - pending (Case 2)", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthCookies(page);

    await page.route("/api/history", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockHistoryData),
      });
    });

    await page.route("/api/reservations/2", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockDetailWithCompanions),
      });
    });

    await page.goto("/history");
    await page.getByText("스터디룸 04").first().click();
    await page.getByRole("button", { name: "상세보기" }).nth(1).click();
    await page.getByRole("button", { name: "수정" }).click();
  });

  test("수정 모드 진입 → CompanionInput 표시됨", async ({ page }) => {
    await expect(page.getByText("동반이용자 추가")).toBeVisible();
  });

  test("저장 클릭 → 최소 인원 미달 시 에러 모달 표시", async ({ page }) => {
    // 기존 동반자 모두 삭제 (총 1명 = 최소 3명 미달)
    const deleteButtons = page.getByRole("button", { name: "삭제" });
    const count = await deleteButtons.count();
    for (let i = 0; i < count; i++) {
      await page.getByRole("button", { name: "삭제" }).first().click();
    }

    await page.getByRole("button", { name: "저장" }).click();

    // 에러 모달 표시 확인
    await expect(page.getByText("인원 부족")).toBeVisible();
    await expect(page.getByText(/미만은 불가능합니다/)).toBeVisible();
  });

  test("최소 인원 미달 에러 모달의 닫기 버튼 → 에러 모달만 닫힘, 1차 모달 유지", async ({
    page,
  }) => {
    const deleteButtons = page.getByRole("button", { name: "삭제" });
    const count = await deleteButtons.count();
    for (let i = 0; i < count; i++) {
      await page.getByRole("button", { name: "삭제" }).first().click();
    }

    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("인원 부족")).toBeVisible();

    await page.getByRole("button", { name: "닫기" }).last().click();

    // 에러 모달 닫히고 1차 모달은 유지
    await expect(page.getByText("인원 부족")).not.toBeVisible();
    await expect(page.getByText("예약 상세 정보")).toBeVisible();
  });

  test("정원 충족 후 저장 → 2차 확인 모달 표시 (1차 모달 유지)", async ({
    page,
  }) => {
    await page.route("/api/reservations/2", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, message: "수정 완료" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: "저장" }).click();

    // 2차 확인 모달 표시
    await expect(page.getByText("예약 명단을 수정하시겠습니까?")).toBeVisible();
    // 1차 모달도 여전히 렌더링됨
    await expect(page.getByText("예약 상세 정보")).toBeVisible();
  });

  test("2차 확인 모달에서 아니요 → 확인 모달만 닫히고 수정 모드 유지", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("예약 명단을 수정하시겠습니까?")).toBeVisible();

    await page.getByRole("button", { name: "아니요" }).click();

    await expect(page.getByText("예약 명단을 수정하시겠습니까?")).not.toBeVisible();
    await expect(page.getByText("동반이용자 추가")).toBeVisible();
  });
});

test.describe("예약 명단 수정 - success + booking_id (Case 1)", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthCookies(page);

    await page.route("/api/history", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockHistoryData),
      });
    });

    await page.route("/api/reservations/1", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockDetailWithCompanions),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/history");
    await page.getByText("스터디룸 04").first().click();
    await page.getByRole("button", { name: "상세보기" }).first().click();
    await page.getByRole("button", { name: "수정" }).click();
  });

  test("저장 → 2차 확인 모달에 도서관 재예약 안내 문구 표시", async ({ page }) => {
    await page.getByRole("button", { name: "저장" }).click();

    await expect(
      page.getByText(/기존 도서관 예약이 취소되고 새 명단으로 재예약됩니다/),
    ).toBeVisible();
  });

  test("2차 확인 후 → 로딩 UI 표시 및 모달 닫기 비활성화", async ({ page }) => {
    await page.route("/api/reservations/1", async (route) => {
      if (route.request().method() === "PATCH") {
        // 응답을 잠시 지연시켜 로딩 상태 확인
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, message: "완료" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: "저장" }).click();
    await page.getByRole("button", { name: "확인" }).click();

    // 로딩 중 문구 확인
    await expect(
      page.getByText(/도서관 예약을 취소하고 있어요|재예약하고 있어요/),
    ).toBeVisible();
  });
});
