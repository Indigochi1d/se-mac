import { encrypt, decrypt } from "@/lib/crypto";

// jest.setup.ts에서 ENCRYPTION_KEY = "a".repeat(64) 설정됨

describe("encrypt", () => {
  it("반환값이 iv:authTag:ciphertext 형식", () => {
    const result = encrypt("hello");
    const parts = result.split(":");
    expect(parts).toHaveLength(3);
    // iv: 16바이트 = 32 hex
    expect(parts[0]).toHaveLength(32);
    // authTag: 16바이트 = 32 hex
    expect(parts[1]).toHaveLength(32);
    // ciphertext는 비어있지 않음
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("같은 값을 두 번 암호화해도 결과가 다름 (랜덤 IV)", () => {
    const enc1 = encrypt("same-password");
    const enc2 = encrypt("same-password");
    expect(enc1).not.toBe(enc2);
  });

  it("빈 문자열도 암호화 가능", () => {
    const result = encrypt("");
    expect(result.split(":")).toHaveLength(3);
  });
});

describe("decrypt", () => {
  it("encrypt → decrypt 왕복이 원본을 복원", () => {
    const original = "test-password-123!@#";
    expect(decrypt(encrypt(original))).toBe(original);
  });

  it("빈 문자열 왕복", () => {
    expect(decrypt(encrypt(""))).toBe("");
  });

  it("한글 문자열 왕복", () => {
    expect(decrypt(encrypt("비밀번호123"))).toBe("비밀번호123");
  });

  it("잘못된 키로 decrypt하면 에러", () => {
    const encrypted = encrypt("secret");
    // 키를 바꿔서 복호화 시도
    const originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "b".repeat(64);
    expect(() => decrypt(encrypted)).toThrow();
    process.env.ENCRYPTION_KEY = originalKey;
  });
});
