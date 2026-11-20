// 回数制限(docs/rate-limit.md)。ログインなしで誰でも使えるので、費用を守るために、AI を呼ぶ前に数える。
// 1. IP 単位の、1日の回数(既定 5。環境変数で変える)
// 2. 全体の、1日の回数(環境変数で変える)
// (3. OpenRouter 側の、月の上限は、キーの設定。402・403 は、route.ts で「今月の利用は終了」に変える)
// **記録は「IP のハッシュ・日付・回数」だけ**(Redis の、有効期限つきのカウンター)。IP は生で持たない。悩みの内容は、一切入れない。
// 数える・数えない: AI に届かなかった失敗は数えない(release で戻す)。答えたあとの失敗は数える。
// 危機の固定画面(AI を呼ばない)は、数えず、上限でも止めない(呼び出し側で、この関数の前に返す)。
import { createHmac } from "node:crypto";
import { OpenRouterError } from "./openrouter";

export interface RateLimitConfig {
  perIpPerDay: number;
  globalPerDay: number;
}

// 環境変数から、上限を読む。未設定のときの既定:
// - 本番: IP あたり 5回 / 全体 100回(月 $5 の上限に合わせて、運用で調整する)
// - 開発: 事実上、制限なし(開発で、何度も試すため)
export function readRateLimitConfig(
  env: Record<string, string | undefined> = process.env,
): RateLimitConfig {
  const production = env.NODE_ENV === "production";
  const read = (name: string, fallback: number): number => {
    const raw = env[name];
    if (raw === undefined || raw.trim() === "") return fallback;
    const value = Number(raw);
    // 数でない・負の値は、設定の誤り。黙って無制限にならないよう、止める
    if (!Number.isInteger(value) || value < 0)
      throw new Error(`${name} は、0以上の整数にしてください`);
    return value;
  };
  return {
    perIpPerDay: read("RATE_LIMIT_PER_IP_PER_DAY", production ? 5 : 1_000),
    globalPerDay: read("RATE_LIMIT_GLOBAL_PER_DAY", production ? 100 : 10_000),
  };
}

// IP を、元に戻せない形(HMAC-SHA256)にする。秘密の値(salt)は、環境変数 RATE_LIMIT_SALT。
// 本番で salt がなければ、止める(IP は、数が少ないので、salt なしのハッシュは、総当たりで元に戻せてしまう)
export function hashIp(ip: string, env: Record<string, string | undefined> = process.env): string {
  const salt = env.RATE_LIMIT_SALT;
  if (!salt && env.NODE_ENV === "production") {
    throw new Error("RATE_LIMIT_SALT が未設定です(本番では必須)");
  }
  return createHmac("sha256", salt || "development-only-salt")
    .update(ip)
    .digest("hex");
}

// IPv6 を、8つのグループ(各4桁の16進数)に展開する。形が正しくなければ undefined
function expandIpv6(value: string): string[] | undefined {
  const halves = value.split("::");
  if (halves.length > 2) return undefined;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const filler = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (halves.length === 2 ? filler < 1 : head.length !== 8) return undefined;
  const groups = [...head, ...Array<string>(filler).fill("0"), ...tail];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return undefined;
  return groups.map((g) => g.toLowerCase().padStart(4, "0"));
}

// IP を、数える単位(キー)にそろえる。
// - **IPv6 は、/64 に丸める**: 家庭や携帯の回線は、/64 の中で、IP を自由に変えられる。丸めないと、IP ごとの枠が、実質、無制限になる
// - IPv4 射影の IPv6(::ffff:1.2.3.4)は、IPv4 として扱う。ポート番号・ゾーン ID・角括弧は、除く
// - 形が正しくなければ "unknown"(全員が同じ枠を共有する。きびしい側に倒す)
export function normalizeIp(ip: string): string {
  let value = ip
    .trim()
    .replace(/^\[(.*)\](?::\d+)?$/, "$1")
    .replace(/%.*$/, "");
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped?.[1]) value = mapped[1];
  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(value);
  if (withPort?.[1]) value = withPort[1];

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return value.split(".").every((n) => Number(n) <= 255) ? value : "unknown";
  }
  const groups = expandIpv6(value);
  return groups ? `${groups.slice(0, 4).join(":")}::/64` : "unknown";
}

// リクエストから、IP を取る。
// **x-forwarded-for は、Vercel(環境変数 VERCEL がある)のときだけ信頼する**。Vercel は、クライアントが付けた値を上書きする。
// それ以外(ローカル・別の置き場)では、クライアントが自由に付けられる(偽装して、枠を回避できる)ので、信頼せず、
// 全員を "unknown" にする(同じ枠を共有する。きびしい側に倒す)
export function clientIp(
  headers: Headers,
  env: Record<string, string | undefined> = process.env,
): string {
  if (!env.VERCEL) return "unknown";
  const raw =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim();
  return raw ? normalizeIp(raw) : "unknown";
}

// 回数を数える保管先に必要な、最小の形(Upstash Redis を包んで渡す。テストでは、メモリの偽物を渡す)
export interface CounterStore {
  // 増やして、増やしたあとの値を返す。新しいキーなら、ttlSeconds 後に消えるようにする
  incr(key: string, ttlSeconds: number): Promise<number>;
  // 減らして、減らしたあとの値を返す(枠を戻す)
  decr(key: string): Promise<number>;
}

// カウンターを持つ期間。日付をまたいだあとの確認と、時計のずれの余裕(2日)
const TTL_SECONDS = 2 * 24 * 60 * 60;

// 日本時間の「今日」(YYYY-MM-DD)。サーバーが UTC でも、同じ「今日」になる
export function todayInJapan(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type Reservation =
  { ok: true; release: () => Promise<void> } | { ok: false; scope: "ip" | "global" };

// 1回ぶんの枠を取る(AI を呼ぶ前に)。取れたら、release で戻せる(AI に届かなかったとき)。
// 増やしてから確かめる(INCR は、1つずつ、順番に処理されるので、同時に来ても、上限は超えない)。超えたら、増やした分を戻す
export async function reserve(
  store: CounterStore,
  ipHash: string,
  config: RateLimitConfig,
  now: Date = new Date(),
): Promise<Reservation> {
  const day = todayInJapan(now);
  const ipKey = `rl:ip:${day}:${ipHash}`;
  const globalKey = `rl:global:${day}`;

  // 上限が 0 のときは、数えるまでもなく、断る(受け付けを止める設定)
  if (config.perIpPerDay < 1) return { ok: false, scope: "ip" };
  if (config.globalPerDay < 1) return { ok: false, scope: "global" };

  // IP ごとの上限
  if ((await store.incr(ipKey, TTL_SECONDS)) > config.perIpPerDay) {
    await store.decr(ipKey);
    return { ok: false, scope: "ip" };
  }
  // 全体の上限(取れなければ、IP の分も戻す)
  if ((await store.incr(globalKey, TTL_SECONDS)) > config.globalPerDay) {
    await store.decr(globalKey);
    await store.decr(ipKey);
    return { ok: false, scope: "global" };
  }

  return {
    ok: true,
    // 枠を戻す(キーは、取ったときの日付のもの。日付をまたいでも、取った日の枠を戻す)
    release: async () => {
      await store.decr(ipKey);
      await store.decr(globalKey);
    },
  };
}

// 相手が、処理せずに返したと確実に言える HTTP の状態(枠を戻してよい)
const NOT_PROCESSED_STATUSES: ReadonlySet<number> = new Set([402, 429, 503]);

// 失敗が、「AI に届かなかった」ものか(true なら、数えない。枠を戻す)。
// - **この相談の中で、AI が1回でも答えていれば(successfulCalls > 0)、戻さない**。途中まで成功して(費用がかかって)、
//   最後の生成が失敗したときに、全部戻すと、生成が不安定な間、枠を減らさずに、実費をかけて使えてしまう
// - 設定の誤り・接続できない → 届いていない
// - 相手が HTTP エラーを返した: 戻すのは、処理されていないことが確実な 402(キーの上限)・429(混み合い)・503 だけ。
//   502・504 などは、生成が進んだあとで返ることがあり(課金されうる)、403 は、入力の審査で返ることがある
//   (戻すと、審査に引っかかる入力を、無料で何度も試せる)ので、数える
// - 1回の待ち時間の超過・全体の締め切りの超過 → 分からない(数える。安全側。届いて、生成中かもしれない)
// - AI が答えたが、使えなかった(本文が空・形が違う)・解説の検証に失敗 → 答えている(数える)
// - それ以外(保管先の失敗など)→ 数える(AI を呼んだあとに起きる失敗が多い)
export function failedBeforeReachingAi(error: unknown, successfulCalls: number): boolean {
  if (successfulCalls > 0) return false;
  if (error instanceof OpenRouterError) {
    if (error.kind === "config" || error.kind === "network") return true;
    return error.kind === "http" && NOT_PROCESSED_STATUSES.has(error.status ?? 0);
  }
  return false;
}
