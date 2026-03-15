/**
 * libseat 스터디룸 가용성 조회 (인증 불필요)
 */
import { STUDY_ROOMS } from "@/constants/studyroom";

interface RoomGroupInfo {
  seatCnt: number;
  seq: number;
  sroomTitle: string;
}

// roomId → sroomMap.php 쿼리 파라미터 매핑
// 12인실(스터디룸01): seq=0, seatCnt=12
// 6인실 02~04: seq=0, seatCnt=6
// 6인실 05~07: seq=1, seatCnt=6
// 6인실 08~10: seq=2, seatCnt=6
// 6인실 11~13: seq=3, seatCnt=6
const ROOM_GROUP_MAP: Record<string, RoomGroupInfo> = {
  "11": { seatCnt: 12, seq: 0, sroomTitle: "그룹스터디룸12인" },
  "10": { seatCnt: 6, seq: 0, sroomTitle: "그룹스터디룸6인실" },
  "12": { seatCnt: 6, seq: 0, sroomTitle: "그룹스터디룸6인실" },
  "13": { seatCnt: 6, seq: 0, sroomTitle: "그룹스터디룸6인실" },
  "14": { seatCnt: 6, seq: 1, sroomTitle: "그룹스터디룸6인실" },
  "15": { seatCnt: 6, seq: 1, sroomTitle: "그룹스터디룸6인실" },
  "1": { seatCnt: 6, seq: 1, sroomTitle: "그룹스터디룸6인실" },
  "2": { seatCnt: 6, seq: 2, sroomTitle: "그룹스터디룸6인실" },
  "3": { seatCnt: 6, seq: 2, sroomTitle: "그룹스터디룸6인실" },
  "9": { seatCnt: 6, seq: 2, sroomTitle: "그룹스터디룸6인실" },
  "4": { seatCnt: 6, seq: 3, sroomTitle: "그룹스터디룸6인실" },
  "5": { seatCnt: 6, seq: 3, sroomTitle: "그룹스터디룸6인실" },
  "16": { seatCnt: 6, seq: 3, sroomTitle: "그룹스터디룸6인실" },
};

/**
 * 특정 날짜/룸에서 libseat 기준 예약 불가 시작 시간 Set 반환
 * @param roomId STUDY_ROOMS의 id값 (e.g. "11", "1")
 * @param reserveDate YYYYMMDD 형식
 * @returns "HH:MM" 형식의 예약 불가 시간 Set. 조회 실패 시 빈 Set (예약 진행 허용)
 */
export async function getLibseatUnavailableTimes(
  roomId: string,
  reserveDate: string,
): Promise<Set<string>> {
  const groupInfo = ROOM_GROUP_MAP[roomId];
  if (!groupInfo) return new Set();

  const room = STUDY_ROOMS.find((r) => r.id === roomId);
  if (!room) return new Set();

  const url = new URL(process.env.SEJONG_LIBSEAT_ROOM_MAP_URL!);
  url.searchParams.set("token", "");
  url.searchParams.set("sroomTitle", groupInfo.sroomTitle);
  url.searchParams.set("roomGB", "S1");
  url.searchParams.set("reserveDate", reserveDate);
  url.searchParams.set("seatCnt", String(groupInfo.seatCnt));
  url.searchParams.set("userId", "");
  url.searchParams.set("seq", String(groupInfo.seq));

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return new Set();
    const html = await response.text();

    return parseUnavailableTimesForRoom(html, room.name);
  } catch {
    return new Set();
  }
}

/**
 * HTML에서 특정 룸의 예약 불가 시간 파싱
 *
 * HTML 구조:
 * - avl-slot > at-title > span: 컬럼별 룸 이름 (e.g. "07스터디룸")
 * - avl-data-slot > avl-time: 시간 (e.g. "09:00")
 * - avl-data-slot > avl-button: 예약가능(<a>태그) 또는 예약불가(텍스트)
 *
 * STUDY_ROOMS.name "스터디룸 07" ↔ HTML span "07스터디룸"
 */
function parseUnavailableTimesForRoom(
  html: string,
  roomName: string,
): Set<string> {
  // "스터디룸 07" → "07스터디룸" 학술정보원 div에 따름
  const number = roomName.replace("스터디룸 ", "");
  const htmlRoomName = `${number}스터디룸`;

  // at-title 헤더에서 컬럼 인덱스 파싱
  const atTitleMatches = [
    ...html.matchAll(
      /<div class=['"]at-title['"][^>]*>[\s\S]*?<span>([^<]+)<\/span>/g,
    ),
  ];

  let columnIndex: number;
  if (atTitleMatches.length === 0) {
    // 단독 룸 (12인실): 컬럼 인덱스 0
    columnIndex = 0;
  } else {
    columnIndex = atTitleMatches.findIndex((m) => m[1].trim() === htmlRoomName);
    if (columnIndex === -1) return new Set();
  }

  // avl-data-slot 블록별 시간 + 버튼 파싱
  const unavailableTimes = new Set<string>();
  const blocks = html.split(/\<div class=['"]avl-data-slot['"]/);
  blocks.shift(); // 첫 번째 요소는 슬롯 이전 HTML

  for (const block of blocks) {
    const timeMatch = block.match(/<div class=['"]avl-time['"]>([^<]+)<\/div>/);
    if (!timeMatch) continue;
    const time = timeMatch[1].trim(); // "09:00"

    const buttonMatches = [
      ...block.matchAll(/<div class=['"]avl-button['"]>([\s\S]*?)<\/div>/g),
    ];
    const buttons = buttonMatches.map((m) => m[1]);

    if (columnIndex < buttons.length) {
      if (!buttons[columnIndex].includes("예약가능")) {
        unavailableTimes.add(time);
      }
    }
  }

  return unavailableTimes;
}
