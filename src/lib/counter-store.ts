// 回数を数える保管先(rate-limit.ts の CounterStore)を作る。
// - 本番: Upstash Redis(HTTP で呼ぶ。サーバーレスでも、接続が増えない)。Vercel の Marketplace から追加すると、環境変数が入る
// - 開発: 接続情報がなければ、メモリの中で数える(再起動で消える。開発で、何度も試すため)
// - 本番で接続情報がなければ、止める(黙って数えないと、回数制限が効かず、費用を守れない)
// 記録は「IP のハッシュ・日付・回数」だけ(悩みの内容は、一切入れない)。
import { Redis } from "@upstash/redis";
import type { CounterStore } from "./rate-limit";

type Env = Record<string, string | undefined>;

// Upstash の標準の名前(UPSTASH_REDIS_REST_*)と、Vercel の Marketplace が入れる名前(KV_REST_API_*)の、どちらでも読む
function readCredentials(env: Env): { url: string; token: string } | undefined {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : undefined;
}

export function createMemoryStore(): CounterStore {
  const counts = new Map<string, number>();
  return {
    async incr(key) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    async decr(key) {
      // 0 より下には、ならない
      const next = Math.max((counts.get(key) ?? 0) - 1, 0);
      counts.set(key, next);
      return next;
    },
  };
}

export function createRedisStore(redis: Redis): CounterStore {
  return {
    async incr(key, ttlSeconds) {
      // 増やすのと、有効期限をつけるのを、1回の送信で行う(古いカウンターが、残り続けないように)
      const [count] = await redis
        .pipeline()
        .incr(key)
        .expire(key, ttlSeconds)
        .exec<[number, number]>();
      return count;
    },
    async decr(key) {
      const next = await redis.decr(key);
      // キーが、期限で消えたあとに戻すと、マイナスになる。0 に直す
      if (next < 0) {
        await redis.set(key, 0);
        return 0;
      }
      return next;
    },
  };
}

let memoryStore: CounterStore | undefined;

export function getCounterStore(env: Env = process.env): CounterStore {
  const credentials = readCredentials(env);
  if (credentials) return createRedisStore(new Redis(credentials));
  if (env.NODE_ENV === "production") {
    throw new Error("Redis の接続情報が未設定です(UPSTASH_REDIS_REST_URL / _TOKEN。本番では必須)");
  }
  memoryStore ??= createMemoryStore();
  return memoryStore;
}
