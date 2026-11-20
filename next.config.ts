import type { NextConfig } from "next";

export const ROBOTS_HEADERS = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // 検索エンジンに載せない(広く公開する予定はない。費用の都合)。
  // ヘッダーは HTML 以外(画像・API)にも効き、layout.tsx の meta は、HTML を保存して使い回されても残る(二重にしてある)
  // あわせて、定番のセキュリティヘッダーを付ける(枠で包まれて偽の画面にされない・種類の取り違えをさせない・外へ住所を渡しすぎない・使わない機能を切る)。
  // CSP は、frame-ancestors だけ(Next.js の埋め込みスクリプトと、昼夜の script を壊さないため。script-src は付けない)
  async headers() {
    return [{ source: "/:path*", headers: [...ROBOTS_HEADERS, ...SECURITY_HEADERS] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
