import { Redis } from "@upstash/redis";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore, createRedisStore, getCounterStore } from "./counter-store";

describe("メモリの保管先(開発用)", () => {
  it("増やして、戻せる。0 より下には、ならない", async () => {
    const store = createMemoryStore();
    expect(await store.incr("a", 60)).toBe(1);
    expect(await store.incr("a", 60)).toBe(2);
    expect(await store.decr("a")).toBe(1);
    expect(await store.decr("a")).toBe(0);
    expect(await store.decr("a")).toBe(0);
    // キーは、別々に数える
    expect(await store.incr("b", 60)).toBe(1);
  });
});

describe("getCounterStore(どの保管先を使うか)", () => {
  it("本番で、接続情報がなければ、止まる(黙って数えないと、回数制限が効かない)", () => {
    expect(() => getCounterStore({ NODE_ENV: "production" })).toThrow("Redis の接続情報");
    expect(() =>
      getCounterStore({ NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "https://x.upstash.io" }),
    ).toThrow("Redis の接続情報");
  });

  it("開発で、接続情報がなければ、メモリで動く(同じものを使い回す)", () => {
    expect(getCounterStore({ NODE_ENV: "development" })).toBe(
      getCounterStore({ NODE_ENV: "development" }),
    );
  });

  it("Upstash の名前でも、Vercel の Marketplace の名前(KV_REST_API_*)でも、本番で動く", () => {
    const upstash = getCounterStore({
      NODE_ENV: "production",
      UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "t",
    });
    const vercel = getCounterStore({
      NODE_ENV: "production",
      KV_REST_API_URL: "https://x.upstash.io",
      KV_REST_API_TOKEN: "t",
    });
    expect(typeof upstash.incr).toBe("function");
    expect(typeof vercel.decr).toBe("function");
  });
});

// Upstash の HTTP の呼び出し(fetch)を、差し替える。本物の Redis に、つなげずに、
// SDK が実際に送る命令の並びと、返事の読み取りを、確かめる
type Command = readonly unknown[];

function installFakeUpstash(initial: Record<string, number> = {}) {
  const data = new Map<string, number>(Object.entries(initial));
  const sent: Command[] = [];

  function run(command: Command): number | string {
    const [name, key, arg] = command.map(String);
    sent.push(command);
    switch (name.toLowerCase()) {
      case "incr":
        data.set(key, (data.get(key) ?? 0) + 1);
        return data.get(key) ?? 0;
      case "decr":
        data.set(key, (data.get(key) ?? 0) - 1);
        return data.get(key) ?? 0;
      case "expire":
        return 1;
      case "set":
        data.set(key, Number(arg));
        return "OK";
      default:
        throw new Error(`想定していない命令: ${name}`);
    }
  }

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const body: unknown = JSON.parse(String(init?.body));
      if (url.endsWith("/pipeline") && Array.isArray(body)) {
        return Response.json(body.map((command: Command) => ({ result: run(command) })));
      }
      if (Array.isArray(body)) return Response.json({ result: run(body) });
      throw new Error("想定していない呼び出し");
    }),
  );
  return { data, sent };
}

describe("Redis の保管先(Upstash の HTTP を、差し替えて確かめる)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const store = () =>
    createRedisStore(new Redis({ url: "https://fake.upstash.io", token: "t", retry: false }));

  it("数えるときは、INCR と EXPIRE を、1回の送信で行う(古い記録が、残り続けない)", async () => {
    const fake = installFakeUpstash();
    expect(await store().incr("rl:global:2026-11-20", 172_800)).toBe(1);
    expect(await store().incr("rl:global:2026-11-20", 172_800)).toBe(2);
    expect(fake.sent.slice(0, 2)).toEqual([
      ["incr", "rl:global:2026-11-20"],
      ["expire", "rl:global:2026-11-20", 172_800],
    ]);
    expect(fake.data.get("rl:global:2026-11-20")).toBe(2);
  });

  it("枠を戻すときは、DECR する", async () => {
    const fake = installFakeUpstash({ k: 3 });
    expect(await store().decr("k")).toBe(2);
    expect(fake.data.get("k")).toBe(2);
  });

  it("期限でキーが消えたあとに戻して、マイナスになったら、0 に直す", async () => {
    const fake = installFakeUpstash();
    expect(await store().decr("gone")).toBe(0);
    expect(fake.data.get("gone")).toBe(0);
    expect(fake.sent).toEqual([
      ["decr", "gone"],
      ["set", "gone", 0],
    ]);
  });

  it("Redis に入れるのは、キーと回数だけ(IP・相談の内容は、入らない)", async () => {
    const fake = installFakeUpstash();
    await store().incr("rl:ip:2026-11-20:" + "a".repeat(64), 172_800);
    const all = JSON.stringify(fake.sent);
    expect(all).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });
});
