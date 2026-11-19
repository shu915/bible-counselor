# Bible Counselor

悩み・愚痴・弱音・懺悔などを書くと、聖書(日本語口語訳)の箇所を最大 3 つ引いて、それぞれの直下に解説、最後に結論を返す Web アプリです。画面と文章は日本語です。

> **位置づけ**: [Bible_RAG_Counselor](https://github.com/shu915/bible-rag-counselor)(RAG を学ぶための学習用)から、**RAG を外して、LLM だけにした版**です。こちらをデプロイします(まだ準備中です)。経緯は [CLAUDE.md](CLAUDE.md) にあります。

- **LLM が、箇所を選び、本文・解説・結論を書きます。** 検索も DB も、使いません
- **本文は、LLM が口語訳の記憶から書きます。** 言い回しが、口語訳と少し違ったり、まれに、存在しない節が混ざったりします(画面の注意書きにも、書いてあります)
- **ユーザーの入力と AI の返答は、保存しません。** ログインも会話履歴もありません。回数制限のために、IP のハッシュ・日付・回数だけを、Redis に 2 日間、持ちます
- **命の危険を示す入力は、AI を呼ぶ前に、キーワードで検出して、固定の案内にします**

## 全体像

```
ブラウザ ──▶ Next.js(App Router)──▶ OpenRouter(箇所の選択・本文・解説・結論)
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
| ホスティング | Vercel(予定) |

## 手元で動かす

必要なもの: Node.js 22、OpenRouter の API キー。

```bash
npm ci
cp .env.example .env.local        # OPENROUTER_API_KEY を書く
npm run dev                       # http://localhost:3000
```

- ターミナルから相談する: `npm run counsel`(OpenRouter を呼ぶ。1 回 約 $0.05)
- 画面の各状態の見本(AI を呼ばない): `/dev/preview`(開発のときだけ。本番は 404)
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

- 悩みを受ける場所ですが、**専門の相談先ではありません。** 画面の「ご利用にあたって」にも、そう書いてあります
- 相談窓口の名前と電話番号は、**仮の表示**です(公開する場合は、人が公式の情報で確認して入れます)
- 検索エンジンに載せない設定(noindex)を、入れてあります
