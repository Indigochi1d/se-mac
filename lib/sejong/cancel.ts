/**
 * 세종대 도서관 스터디룸 예약 취소 로직
 */

interface CancelParams {
  userID: string;
  reserveNo: string;
  token: string;
  phpSessId: string;
}

interface CancelResult {
  success: boolean;
  message: string;
}

/**
 * 도서관 시스템에 스터디룸 예약 취소 요청
 */
export async function cancelLibseatReservation(
  params: CancelParams,
): Promise<CancelResult> {
  const { userID, reserveNo, token, phpSessId } = params;

  const formData = new URLSearchParams({
    userID,
    reserveNo,
  });

  const mySeatUrl = `${process.env.SEJONG_LIBSEAT_MY_SEAT_URL}?token=${encodeURIComponent(token)}`;

  const response = await fetch(process.env.SEJONG_LIBSEAT_CANCEL_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/xml, text/xml, */*; q=0.01",
      Cookie: `token=${token}; PHPSESSID=${phpSessId}`,
      Referer: mySeatUrl,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: formData.toString(),
  });

  const body = (await response.text()).trim();

  if (!response.ok) {
    return { success: false, message: body || "도서관 예약 취소에 실패했습니다." };
  }

  return { success: true, message: "도서관 예약이 취소되었습니다." };
}
