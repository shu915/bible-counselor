// 【開発用】ターミナルで、悩み事・愚痴・弱音・懺悔などを入力すると、聖書の箇所(最大3つ)と、本文・解説・結論が返る。
// 本番の流れ(危機の検出 → 箇所の選択・本文・解説・結論を LLM で作る)を、画面なしで通して試す。
//
// 使い方: npm run counsel
//   悩みは、対話の入力で受ける(コマンドの引数にしないので、シェルの履歴に残らない)。空の行で終了する。
//
// 入力も、返答も、ファイルにも保存しない。表示するのは、自分の端末の画面だけ。
// OpenRouter を呼ぶ(1回 約 $0.05)。OPENROUTER_API_KEY は、.env.local に書く。
import * as readline from "node:readline/promises";
import { MAX_INPUT_CHARS } from "../src/lib/counsel-schema";
import { detectCrisis, detectHarmToOthers } from "../src/lib/crisis";
import { CRISIS_MESSAGE_LINES } from "../src/lib/crisis-message";
import { generateCounsel } from "../src/lib/generate-counsel";

// 環境変数は、.env.local から読む。すでにある環境変数は上書きしない
const isMissingFile = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
try {
  process.loadEnvFile(".env.local");
} catch (error) {
  if (!isMissingFile(error)) throw error;
}

// 相談1件ぶんの全体の締め切り(開発用。本番は、Vercel の関数の時間に合わせて決める)
const DEADLINE_MS = 90_000;

// 命の危険のときの、固定の表示(画面と共通。src/lib/crisis-message.ts。窓口の名前と番号は、公開前に人が確認して入れる)
const CRISIS_MESSAGE = CRISIS_MESSAGE_LINES.join("\n");

// 端末の太字(ANSI)。核心の節を太字にして、目が行くようにする
const BOLD = "\u001b[1m";
const RESET = "\u001b[0m";

async function consult(consultation: string): Promise<void> {
  // 1. 命の危険を示す語は、AI を呼ぶ前に、キーワードで止める
  if (detectCrisis(consultation)) {
    console.log(`\n${CRISIS_MESSAGE}`);
    return;
  }

  const startedAt = Date.now();
  // 2. 箇所の選択・本文・解説・結論(LLM)
  const counsel = await generateCounsel(consultation, {
    signal: AbortSignal.timeout(DEADLINE_MS),
    harmContext: detectHarmToOthers(consultation),
  });

  // 補助の防御: LLM が、命に関わる内容だと判断したら、解説を出さずに、固定の表示にする
  if (counsel.crisis) {
    console.log(`\n${CRISIS_MESSAGE}`);
    return;
  }

  if (counsel.preface) console.log(`\n${counsel.preface}`);
  for (const passage of counsel.passages) {
    console.log(`\n■ ${passage.reference}`);
    for (const v of passage.verses) {
      console.log(`  ${v.core ? BOLD : ""}(${v.label}) ${v.text}${v.core ? RESET : ""}`);
    }
    console.log(`\n  ${passage.commentary}`);
  }
  console.log(`\n■ 結論\n  ${counsel.conclusion}`);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\n(${seconds}秒 / トークン: 入力 ${counsel.usage.promptTokens ?? 0} 出力 ${counsel.usage.completionTokens ?? 0})`,
  );
  console.log("(本文は、AI が口語訳の記憶から書いたもの。言い回しが、違うことがある)");
}

async function main(): Promise<void> {
  console.log(
    `悩み事・愚痴・弱音・懺悔などを、書いてください(${MAX_INPUT_CHARS}字まで)。入力は、保存されません。`,
  );
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 0,
  });

  try {
    for (;;) {
      let line: string;
      try {
        line = (await rl.question("\n> ")).trim();
      } catch {
        break; // 入力が閉じた(Ctrl-D など)
      }
      if (line === "") break;
      if (line.length > MAX_INPUT_CHARS) {
        console.log(`長すぎます(${MAX_INPUT_CHARS}字まで)。短くして、もう一度。`);
        continue;
      }
      try {
        await consult(line);
      } catch (error) {
        // 例外のメッセージには、入力や返答の中身が入らない(OpenRouterError・GenerationError)
        console.error(
          error instanceof Error
            ? `\n失敗しました: ${error.name}: ${error.message}`
            : "\n失敗しました",
        );
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : "失敗しました");
  process.exitCode = 1;
});
