// 本棚の棚(一般古典・聖書・リアリズム)。画面と API で共通。サーバー用の部品を import しない。
import { z } from "zod";

export const SHELVES = ["classics", "bible", "realism"] as const;
export const shelfSchema = z.enum(SHELVES);
export type ShelfId = z.infer<typeof shelfSchema>;

export interface ShelfInfo {
  id: ShelfId;
  // 画面の道筋(トップが一般古典)
  path: string;
  // 棚の名前(リンクに使う)
  name: string;
  // ページの見出しと、その下の説明(文ごとに塊にして、文の切れ目で折る)
  title: string;
  lead: readonly string[];
  // 送信ボタン・待ちの表示・「それでも続ける」ボタンの文言
  submit: string;
  loading: string;
  continueAnyway: string;
  // 注意書きで、書物を指す言い方
  books: string;
}

export const SHELF_INFO: Record<ShelfId, ShelfInfo> = {
  classics: {
    id: "classics",
    path: "/",
    name: "一般古典",
    title: "古典に、聞いてみる。",
    lead: ["悩みも、弱音も、懺悔も。", "古今東西の古典から、そっと言葉を探します。"],
    submit: "古典に聞く",
    loading: "古典の言葉を探しています(20秒ほどかかります)…",
    continueAnyway: "それでも、古典の言葉を聞いてみる",
    books: "古典",
  },
  bible: {
    id: "bible",
    path: "/bible",
    name: "聖書",
    title: "聖書に、聞いてみる。",
    lead: ["悩みも、弱音も、懺悔も。", "何千年も読まれてきた言葉が、そっと寄り添います。"],
    submit: "聖書に聞く",
    loading: "聖書の言葉を探しています(20秒ほどかかります)…",
    continueAnyway: "それでも、聖書の言葉を聞いてみる",
    books: "聖書",
  },
  realism: {
    id: "realism",
    path: "/realism",
    name: "リアリズム",
    title: "兵法に、聞いてみる。",
    lead: [
      "励ましではなく、勝ち目の話を。",
      "孫子・韓非子・マキャベリなどの言葉から、打てる手を探します。",
    ],
    submit: "兵法に聞く",
    loading: "兵法の言葉を探しています(20秒ほどかかります)…",
    continueAnyway: "それでも、兵法の言葉を聞いてみる",
    books: "兵法書・政治思想の古典",
  },
};
