# Shu の本棚

悩み・愚痴・弱音・懺悔などを書くと、古典の言葉を最大 3 つ引いて、それぞれの直下に解説、最後に結論を返す Web アプリです。画面と文章は日本語です。本棚は 3 つあります。

| 棚 | パス | 内容 |
|---|---|---|
| 一般古典 | `/` | 論語・老子・徒然草・自省録・モンテーニュなど、古今東西の古典。著作権が切れた近代の人(漱石・ニーチェなど)も(聖書と、リアリズムの棚の書物は選びません) |
| 聖書 | `/bible` | 聖書(AI が記憶から、現代の日本語で書く) |
| リアリズム | `/realism` | 孫子・韓非子・君主論など、戦略・政治・処世を幻想なしに語る古典と、ナポレオンなど著作権が切れた軍人・政治家の言行。励ますのでなく、勝ち目を上げる考え方を示す(責めない・欺かない・自己責任論にしない) |

> **位置づけ**: [Bible_RAG_Counselor](https://github.com/shu915/bible-rag-counselor)(RAG を学ぶための学習用)から、**RAG を外して、LLM だけにした版**です。こちらをデプロイします(まだ準備中です)。経緯は [CLAUDE.md](CLAUDE.md) にあります。

- **LLM が、箇所を選び、本文・解説・結論を書きます。** 検索も DB も、使いません。処理は、3つの棚で同じで、違うのは、プロンプトと、見た目(`shelves.ts` の文言、`shelf-frame.tsx`・`shelf-mark.tsx`、`globals.css` の `[data-shelf]` の色)だけです
- **本文は、LLM が記憶から書きます。** 原典や訳と言い回しが違ったり、まれに、存在しない節が混ざったりします(画面の注意書きにも、書いてあります)
- **ユーザーの入力と AI の返答は、保存しません。** ログインも会話履歴もありません。回数制限のために、IP のハッシュ・日付・回数だけを、Redis に 2 日間、持ちます
- **命の危険を示す入力は、AI を呼ぶ前に、キーワードで検出して、固定の案内にします**

## 全体像

```
ブラウザ ──▶ Next.js(App Router。棚ごとのページ)──▶ OpenRouter(箇所の選択・本文・解説・結論)
                        └──▶ Upstash Redis(回数制限。IP のハッシュ・日付・回数だけ)
```

## 技術スタック

| 分類 | 技術 |
|---|---|
| フレームワーク | Next.js 16(App Router)、React 19 |
| 言語 | TypeScript(strict)、zod(外から来るデータの検証) |
| スタイル | Tailwind CSS 4 |
| AI | OpenRouter(既定は `anthropic/claude-sonnet-5.5`。環境変数で切り替え) |
| 回数制限の保管先 | Upstash Redis(HTTP)。開発は、メモリの中で数える |
| テスト | Vitest |
| フォント | Shippori Mincho(SIL OFL。使う字だけに削った woff2) |
| ホスティング | Vercel(予定。サブドメイン `shelf.` を割り当てる) |

## 手元で動かす

必要なもの: Node.js 22、OpenRouter の API キー。

```bash
npm ci
cp .env.example .env.local        # OPENROUTER_API_KEY を書く
npm run dev                       # http://localhost:3000
```

- ターミナルから相談する: `npm run counsel [classics|bible|realism]`(棚を指定する。省略は bible。OpenRouter を呼ぶ。1 回 約 $0.05)
- 確認: `npm run check`(lint・書式・型)、`npm test`
- 開発では、Redis がなくても動きます(回数は、メモリの中で数えます)

## 環境変数

`.env.example` が見本です。`.env.local` に書き、**コミットしません**。

| 変数 | 説明 |
|---|---|
| `OPENROUTER_API_KEY` | AI の呼び出しに使う |
| `OPENROUTER_WRITING_MODEL` | 箇所の選択・本文・解説・結論を書くモデル(省略すると、下のモデル) |
| `OPENROUTER_CHAT_MODEL` | 予備のモデル(省略すると `google/gemini-4-hydrogen`) |
| `RATE_LIMIT_SALT` | IP をハッシュにするための秘密の値。本番で必須 |
| `RATE_LIMIT_PER_IP_PER_DAY`、`RATE_LIMIT_GLOBAL_PER_DAY` | 1 日の上限(本番の既定は、IP あたり 5 回・全体 100 回) |
| `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN` | 回数を数える Redis。本番で必須(Vercel の Marketplace から追加すると入る。`KV_REST_API_*` でも読む) |

## 注意

- 悩みを受ける場所ですが、専門の相談先ではありません(画面では、つらいときは窓口へ、と案内するだけにしています)
- 相談窓口の案内は、命の危険を示す入力のときの固定の画面にだけ出ます。公開の直前に、公式のページで、受付中かを見直します
- 検索エンジンに載せない設定(noindex)を、入れてあります
