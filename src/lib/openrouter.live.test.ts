import { describe, expect, it } from "vitest";
import { chatText } from "./openrouter";

// 実際に OpenRouter を呼ぶテスト(お金がかかる)。RUN_LIVE_AI=1 のときだけ動かす。
// 実行: RUN_LIVE_AI=1 npx vitest run src/lib/openrouter.live.test.ts
// キーは .env.local から読む(ここで値を表示しない)
if (process.env.RUN_LIVE_AI === "1") {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // .env.local が無ければ、シェルの環境変数のキーを使う
  }
}

describe.runIf(process.env.RUN_LIVE_AI === "1")("chatText(実際の OpenRouter)", () => {
  it("モデル名と推論の指定が通り、空でない本文と、トークン数が返る", async () => {
    const result = await chatText({
      user: "「はい」とだけ答えてください。",
      maxTokens: 200,
      reasoningEffort: "minimal",
    });
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.usage.promptTokens).toBeGreaterThan(0);
  }, 60_000);
});
