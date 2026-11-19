import { describe, expect, it } from "vitest";
import { OpenRouterError } from "./openrouter";
import {
  clientIp,
  failedBeforeReachingAi,
  hashIp,
  normalizeIp,
  readRateLimitConfig,
  reserve,
  todayInJapan,
  type CounterStore,
  type RateLimitConfig,
} from "./rate-limit";
import { createMemoryStore } from "./counter-store";

const config: RateLimitConfig = { perIpPerDay: 2, globalPerDay: 3 };
const NOW = new Date("2026-11-19T03:00:00Z"); // 日本時間 12:00

// 呼び出しを記録する保管先(中身は、メモリで数える)
function spyStore(): { store: CounterStore; keys: string[] } {
  const inner = createMemoryStore();
  const keys: string[] = [];
  return {
    keys,
    store: {
      async incr(key, ttl) {
        keys.push(key);
        return inner.incr(key, ttl);
      },
      async decr(key) {
        keys.push(key);
        return inner.decr(key);
      },
    },
  };
}

describe("todayInJapan", () => {
  it("日本時間の日付を返す(UTC で前日でも、日本ではもう翌日)", () => {
    expect(todayInJapan(new Date("2026-11-18T15:30:00Z"))).toBe("2026-11-19");
    expect(todayInJapan(new Date("2026-11-18T14:59:00Z"))).toBe("2026-11-18");
  });
});

describe("reserve", () => {
  it("IP ごとの上限まで取れて、超えたら、scope が ip で断る", async () => {
    const store = createMemoryStore();
    expect((await reserve(store, "a", config, NOW)).ok).toBe(true);
    expect((await reserve(store, "a", config, NOW)).ok).toBe(true);
    expect(await reserve(store, "a", config, NOW)).toEqual({ ok: false, scope: "ip" });
  });

  it("断られた分は、数えない(断られ続けても、別の人の枠を減らさない)", async () => {
    const store = createMemoryStore();
    await reserve(store, "a", { perIpPerDay: 1, globalPerDay: 10 }, NOW);
    for (let i = 0; i < 5; i++)
      await reserve(store, "a", { perIpPerDay: 1, globalPerDay: 10 }, NOW);
    // 全体は、取れた1回ぶんだけ減っている → あと9回、別の IP が取れる
    for (let i = 0; i < 9; i++) {
      expect((await reserve(store, `b${i}`, { perIpPerDay: 1, globalPerDay: 10 }, NOW)).ok).toBe(
        true,
      );
    }
    expect(await reserve(store, "c", { perIpPerDay: 1, globalPerDay: 10 }, NOW)).toEqual({
      ok: false,
      scope: "global",
    });
  });

  it("全体の上限に達したら、scope が global で断る(IP の枠が残っていても)。その IP の分も戻す", async () => {
    const store = createMemoryStore();
    await reserve(store, "a", config, NOW);
    await reserve(store, "b", config, NOW);
    await reserve(store, "c", config, NOW);
    expect(await reserve(store, "d", config, NOW)).toEqual({ ok: false, scope: "global" });
    // d の IP の枠は、戻っている(上限の 2 回、取れる状態のまま。全体が空けば取れる)
    const widened = { perIpPerDay: 2, globalPerDay: 10 };
    expect((await reserve(store, "d", widened, NOW)).ok).toBe(true);
    expect((await reserve(store, "d", widened, NOW)).ok).toBe(true);
  });

  it("release で、枠を戻せる(AI に届かなかったとき)。0 より下には、ならない", async () => {
    const store = createMemoryStore();
    const one = { perIpPerDay: 1, globalPerDay: 10 };
    const first = await reserve(store, "a", one, NOW);
    if (!first.ok) throw new Error("取れるはず");
    expect((await reserve(store, "a", one, NOW)).ok).toBe(false);
    await first.release();
    expect((await reserve(store, "a", one, NOW)).ok).toBe(true);
    // 余分に戻しても、0 より下にならない(次に、上限ぶん取れる)
    await first.release();
    await first.release();
    expect((await reserve(store, "z", one, NOW)).ok).toBe(true);
  });

  it("上限が 0 なら、だれも取れない(受け付けを止める設定)", async () => {
    const store = createMemoryStore();
    expect(await reserve(store, "a", { perIpPerDay: 0, globalPerDay: 100 }, NOW)).toEqual({
      ok: false,
      scope: "ip",
    });
    expect(await reserve(store, "a", { perIpPerDay: 5, globalPerDay: 0 }, NOW)).toEqual({
      ok: false,
      scope: "global",
    });
  });

  it("日付が変われば、別の枠(日本時間の 0 時で、リセットされる)", async () => {
    const store = createMemoryStore();
    const one = { perIpPerDay: 1, globalPerDay: 10 };
    await reserve(store, "a", one, new Date("2026-11-19T14:59:00Z"));
    expect((await reserve(store, "a", one, new Date("2026-11-19T14:59:30Z"))).ok).toBe(false);
    expect((await reserve(store, "a", one, new Date("2026-11-19T15:00:00Z"))).ok).toBe(true);
  });

  it("記録するのは、IP のハッシュ・日付・回数だけ。キーに、悩みの内容も生の IP も現れない", async () => {
    const { store, keys } = spyStore();
    await reserve(store, "hash-of-ip", config, NOW);
    expect(keys).toEqual(["rl:ip:2026-11-19:hash-of-ip", "rl:global:2026-11-19"]);
  });
});

describe("hashIp", () => {
  it("同じ IP・同じ salt なら同じ値。IP か salt が違えば、違う値。元の IP は、含まれない", () => {
    const env = { RATE_LIMIT_SALT: "s1" };
    const a = hashIp("203.0.113.7", env);
    expect(a).toBe(hashIp("203.0.113.7", env));
    expect(a).not.toBe(hashIp("203.0.113.8", env));
    expect(a).not.toBe(hashIp("203.0.113.7", { RATE_LIMIT_SALT: "s2" }));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("203.0.113.7");
  });

  it("本番で salt がなければ、止まる。開発では、開発用の値で動く", () => {
    expect(() => hashIp("1.2.3.4", { NODE_ENV: "production" })).toThrow("RATE_LIMIT_SALT");
    expect(hashIp("1.2.3.4", { NODE_ENV: "development" })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("clientIp", () => {
  const vercel = { VERCEL: "1" };

  it("Vercel のときだけ、x-forwarded-for の先頭(クライアントの IP)を使う。なければ x-real-ip、それもなければ unknown", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), vercel)).toBe(
      "203.0.113.7",
    );
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }), vercel)).toBe("198.51.100.2");
    expect(clientIp(new Headers(), vercel)).toBe("unknown");
  });

  it("Vercel 以外では、x-forwarded-for は、偽装できるので、信頼しない(全員が unknown)", () => {
    const spoofed = new Headers({ "x-forwarded-for": "203.0.113.7" });
    expect(clientIp(spoofed, {})).toBe("unknown");
    expect(clientIp(spoofed, { NODE_ENV: "production" })).toBe("unknown");
  });
});

describe("normalizeIp(IPv6 は /64 に丸める)", () => {
  it("同じ /64 の中の IP は、同じキーになる。別の /64 は、別のキー", () => {
    const a = normalizeIp("2001:db8:abcd:12:1:2:3:4");
    expect(a).toBe("2001:0db8:abcd:0012::/64");
    expect(normalizeIp("2001:db8:abcd:12:ffff:eeee:dddd:cccc")).toBe(a);
    expect(normalizeIp("2001:db8:abcd:12::1")).toBe(a);
    expect(normalizeIp("2001:db8:abcd:13::1")).not.toBe(a);
  });

  it("省略記法(::)も、展開してから丸める", () => {
    expect(normalizeIp("2001:db8::1")).toBe("2001:0db8:0000:0000::/64");
    expect(normalizeIp("::1")).toBe("0000:0000:0000:0000::/64");
  });

  it("IPv4 は、そのまま。IPv4 射影・ポート・角括弧・ゾーン ID は、取り除く", () => {
    expect(normalizeIp("203.0.113.7")).toBe("203.0.113.7");
    expect(normalizeIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(normalizeIp("203.0.113.7:51234")).toBe("203.0.113.7");
    expect(normalizeIp("[2001:db8::1]:443")).toBe("2001:0db8:0000:0000::/64");
    expect(normalizeIp("fe80::1%en0")).toBe("fe80:0000:0000:0000::/64");
  });

  it("形が正しくなければ unknown", () => {
    for (const bad of ["", "abc", "999.1.1.1", "1:2:3", "1::2::3", "gggg::1", "1.2.3"]) {
      expect(normalizeIp(bad)).toBe("unknown");
    }
  });
});

describe("readRateLimitConfig", () => {
  it("本番の既定は、IP 5回・全体 100回。開発の既定は、事実上、制限なし", () => {
    expect(readRateLimitConfig({ NODE_ENV: "production" })).toEqual({
      perIpPerDay: 5,
      globalPerDay: 100,
    });
    expect(readRateLimitConfig({ NODE_ENV: "development" }).perIpPerDay).toBeGreaterThan(100);
  });

  it("環境変数で変えられる。0 も指定できる(受け付けを止める)", () => {
    expect(
      readRateLimitConfig({
        NODE_ENV: "production",
        RATE_LIMIT_PER_IP_PER_DAY: "8",
        RATE_LIMIT_GLOBAL_PER_DAY: "0",
      }),
    ).toEqual({ perIpPerDay: 8, globalPerDay: 0 });
  });

  it("数でない・負の値は、黙って無制限にせず、止まる", () => {
    expect(() => readRateLimitConfig({ RATE_LIMIT_PER_IP_PER_DAY: "たくさん" })).toThrow();
    expect(() => readRateLimitConfig({ RATE_LIMIT_GLOBAL_PER_DAY: "-1" })).toThrow();
    expect(() => readRateLimitConfig({ RATE_LIMIT_PER_IP_PER_DAY: "1.5" })).toThrow();
  });
});

describe("failedBeforeReachingAi(数えるか・数えないか)", () => {
  const error = (kind: ConstructorParameters<typeof OpenRouterError>[2], status?: number) =>
    new OpenRouterError("x", status, kind);

  it("設定の誤り・接続できない・HTTP エラー(402・403・429・5xx)は、AI に届いていない → 数えない", () => {
    expect(failedBeforeReachingAi(error("config"), 0)).toBe(true);
    expect(failedBeforeReachingAi(error("network"), 0)).toBe(true);
    for (const status of [402, 403, 429, 500, 503]) {
      expect(failedBeforeReachingAi(error("http", status), 0)).toBe(true);
    }
  });

  it("1回の待ち時間の超過(timeout)と、全体の締め切りの超過(deadline)は、分からない → 数える", () => {
    expect(failedBeforeReachingAi(error("timeout"), 0)).toBe(false);
    expect(failedBeforeReachingAi(error("deadline"), 0)).toBe(false);
  });

  it("AI が答えたが使えなかった(本文が空・形が違う)・そのほかの失敗は、数える", () => {
    expect(failedBeforeReachingAi(error("response"), 0)).toBe(false);
    expect(failedBeforeReachingAi(new Error("解説の検証に失敗"), 0)).toBe(false);
    expect(failedBeforeReachingAi("文字列", 0)).toBe(false);
  });

  it("この相談の中で、AI が1回でも答えていれば、HTTP エラーでも、戻さない(数える)", () => {
    // 書き換えと選択が成功(費用がかかった)あと、最後の生成が 503 で失敗した、など
    expect(failedBeforeReachingAi(error("http", 503), 2)).toBe(false);
    expect(failedBeforeReachingAi(error("network"), 1)).toBe(false);
    expect(failedBeforeReachingAi(error("config"), 1)).toBe(false);
  });
});
