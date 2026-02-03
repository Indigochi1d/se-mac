namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";

    // 세종대 포탈
    SEJONG_PORTAL_URL: string;
    SEJONG_REDIRECT_URL: string;
    SEJONG_HEADERS_REFERER: string;

    // 세종대 도서관
    SEJONG_LIBRARY_LOGIN_URL: string;
    SEJONG_LIBRARY_USER_FIND_URL: string;
    SEJONG_LIBRARY_STUDYROOM_URL: string;
    SEJONG_LIBRARY_RESERVE_PROCESS_URL: string;
    SEJONG_STUDYROOM_RESERVE_URL: string;
    SEJONG_STUDYROOM_RESERVATION_DETAIL: string;

    // DB
    SUPABASE_PROJECT_URL: string;
    SUPABASE_API_KEY: string;

    // 기타
    ENCRYPTION_KEY: string;
    EMAIL_USER: string;
    EMAIL_PASSWORD: string;
    NEXT_PUBLIC_URL: string;
    CRON_SECRET: string;
  }
}
