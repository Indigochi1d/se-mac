namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";

    // 세종대 포탈
    SEJONG_PORTAL_URL: string;
    SEJONG_REDIRECT_URL: string;
    SEJONG_HEADERS_REFERER: string;

    // DB
    DATABASE_URL: string;

    // AWS
    AWS_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;

    // 기타
    ENCRYPTION_KEY: string;
    EMAIL_USER: string;
    EMAIL_PASSWORD: string;
    NEXT_PUBLIC_URL: string;
  }
}
