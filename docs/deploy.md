# デプロイの手順(Vercel)

公開は、1つのサブドメイン(`shelf.<メインのドメイン>`)に、パスで棚を分ける(`/`・`/bible`・`/realism`)。メインのドメインは、Xserver の WordPress(ヘッドレスのバックエンド)なので、DNS は Xserver で触る。

## 0. 前提

- マージ済みの `main` から出す(未マージの変更は、デプロイされない)
- `npm run check`・`npm test`・`npm run build` が通っている
- noindex(`next.config.ts` の `X-Robots-Tag` と `layout.tsx` の `robots`)は、**広く公開するときまで外さない**

## 1. 外部サービス(人が用意する)

| サービス | やること | 控えるもの |
|---|---|---|
| Upstash(本家 upstash.com) | Redis のデータベースを作る。地域は、Vercel の関数の地域に近い所(日本向けなら東京) | `UPSTASH_REDIS_REST_URL`・`UPSTASH_REDIS_REST_TOKEN`(読み取り専用でない、普通のトークン) |
| OpenRouter | **本番用のキー**を作る。月の上限を付ける(開発用のキーとは、別にする) | `OPENROUTER_API_KEY` |

トークンやキーは、環境変数にだけ入れる。リポジトリ・会話・文書には、書かない。書いてしまったら、管理画面で作り直す。

## 2. Vercel

1. プロジェクトを作り、リポジトリ `shu-bookshelf` をつなぐ(フレームワークは Next.js。Node は 22)
2. 環境変数を、**Production と Preview の両方**に入れる(Preview も `NODE_ENV=production` で動くので、ないと、相談のたびに 500 で止まる)

   | 変数 | 値 |
   |---|---|
   | `OPENROUTER_API_KEY` | 本番用のキー |
   | `RATE_LIMIT_SALT` | 長いランダムな文字列(**変えると、当日の枠がリセットされる**) |
   | `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash の REST の値 |
   | `RATE_LIMIT_PER_IP_PER_DAY` / `RATE_LIMIT_GLOBAL_PER_DAY` | 省略可(既定は、IP あたり 5 回・全体 100 回/日)。月の上限に合わせて決める |
   | `OPENROUTER_WRITING_MODEL` / `OPENROUTER_CHAT_MODEL` | 省略可(既定は、コードの値) |

3. 関数の最大実行時間は 60 秒(`route.ts` の `maxDuration`)。プランの上限を超えないか、確認する
4. Preview を外から見られるかは、Deployment Protection の設定しだい。本番のキーを Preview に入れる場合は、保護を有効にする

## 3. まず、Vercel の仮のアドレスで確認する

`〜.vercel.app` で、次を確認してから、独自のドメインを足す。

- 3つの棚(`/`・`/bible`・`/realism`)が開く
- 相談が1回通る。結果の印・色が、棚ごとに違う
- 危機の画面(「もう死にたい」と入力)が出る。窓口の番号とリンクが、**公式のページで、受付中**か(公開の直前に、人が見直す)
- Upstash の管理画面に、キー(`rl:global:日付`・`rl:ip:日付:ハッシュ`)ができて、値が増える。**キーに、生の IP や相談の内容が入っていない**
- 応答ヘッダー: `curl -sI https://<アドレス>/` で、`X-Frame-Options`・`Content-Security-Policy`・`X-Robots-Tag`・`Strict-Transport-Security` が付いている(HSTS は、Vercel が付けるはず。付いていなければ、`next.config.ts` に足す)
- 別の2つの回線(Wi-Fi とスマホの回線)から、枠が別々に減る(`VERCEL` が実行時にあり、`x-forwarded-for` が回線ごとに違う)
- 6回目で、429(回数の上限)の画面が出る

## 4. 独自のドメイン

1. Vercel のプロジェクトに、`shelf.<メインのドメイン>` を追加する
2. Xserver の DNS に、Vercel が指示する **CNAME を 1 本**足す
3. **DNS は、プロキシなし(CNAME で Vercel に直接)のままにする**。手前に別のプロキシを挟むと、`x-forwarded-for` が、プロキシの出口の IP になり、IP ごとの枠が崩れる
4. 証明書が発行されたら、手順 3 の確認を、独自のドメインでも、もう一度行う

## 5. 公開したあと

- OpenRouter のキーの月の上限と、使用量を、ときどき見る(1 回の相談は、約 $0.02〜0.03。[docs/cost.md](cost.md))
- 上限に達すると、「今月の利用は終了しました」と出る。月の上限を上げるか、全体の 1 日の上限(`RATE_LIMIT_GLOBAL_PER_DAY`)を調整する
- 広く公開するときは、noindex を、`next.config.ts` と `layout.tsx` の**両方**から外す
