import { describe, expect, it } from "vitest";
import nextConfig, { SECURITY_HEADERS } from "../../next.config";

describe("next.config のヘッダー", () => {
  it("全ページに、検索エンジンに載せない指定と、セキュリティヘッダーが付く", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = rules.find((rule) => rule.source === "/:path*");
    expect(all).toBeDefined();
    const value = (key: string) => all?.headers.find((h) => h.key === key)?.value;
    expect(value("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(value("X-Content-Type-Options")).toBe("nosniff");
    expect(value("X-Frame-Options")).toBe("DENY");
    expect(value("Content-Security-Policy")).toBe("frame-ancestors 'none'");
    expect(value("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(value("Permissions-Policy")).toContain("camera=()");
  });

  it("CSP に script-src を付けない(Next.js の埋め込みスクリプトと、昼夜の script を壊さないため)", () => {
    const csp = SECURITY_HEADERS.find((h) => h.key === "Content-Security-Policy")?.value ?? "";
    expect(csp).not.toContain("script-src");
  });
});
