// 공통 환경 변수 설정 (테스트용)
process.env.ENCRYPTION_KEY = "a".repeat(64); // 32바이트 hex (테스트용)
process.env.CRON_SECRET = "test-cron-secret";
process.env.EMAIL_USER = "test@example.com";
process.env.EMAIL_PASSWORD = "test-password";
process.env.NEXT_PUBLIC_URL = "http://localhost:3000";

process.env.SEJONG_PORTAL_URL = "https://mock-portal.test/login";
process.env.SEJONG_REDIRECT_URL = "https://mock-portal.test/redirect";
process.env.SEJONG_HEADERS_REFERER = "https://mock-portal.test/referer";
process.env.SEJONG_LIBRARY_SSO_URL = "https://mock-library.test/sso";
process.env.SEJONG_LIBRARY_STUDYROOM_URL = "https://mock-library.test/studyroom";
process.env.SEJONG_LIBSEAT_RESERVE_FORM_URL = "https://mock-libseat.test/reserveForm";
process.env.SEJONG_LIBSEAT_RESERVE_URL = "https://mock-libseat.test/reserve";
process.env.SEJONG_LIBSEAT_LIST_URL = "https://mock-libseat.test/list";
process.env.SEJONG_LIBSEAT_ROOM_MAP_URL = "https://mock-libseat.test/roomMap";
process.env.SEJONG_LIBSEAT_CANCEL_URL = "https://mock-libseat.test/cancel";
process.env.SEJONG_LIBSEAT_MY_SEAT_URL = "https://mock-libseat.test/mySeat";

process.env.SUPABASE_PROJECT_URL = "https://mock-supabase.test";
process.env.SUPABASE_API_KEY = "mock-supabase-key";
