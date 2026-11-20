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
  // 入力欄の見出しと、例(placeholder)
  inputLabel: string;
  placeholder: string;
  // 「聞き方の例」(人物や書物の指名。注意書きに出す)と、指名できるものの種類(用語は、一般古典だけ)
  askExamples: string;
  askKinds: string;
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
    title: "古典を、めくってみる。",
    lead: ["悩みでも、考えごとでも。", "古今東西の古典から、いまの気持ちに合う言葉を探します。"],
    inputLabel: "いま心にあることを、そのまま書いてください",
    placeholder: "思いつくままに、書いてください",
    askKinds: "人物・書物・用語",
    askExamples:
      "「孔子なら、なんと言う?」「『徒然草』には、なんて書いてある?」「『無常』って、どういうこと?」",
    submit: "古典をめくる",
    loading: "古典の言葉を探しています(20秒ほどかかります)…",
    continueAnyway: "それでも、古典をめくってみる",
    books: "古典",
  },
  bible: {
    id: "bible",
    path: "/bible",
    name: "聖書",
    title: "聖書を、めくってみる。",
    lead: ["悩みも、弱音も、懺悔も。", "何千年も読まれてきた言葉が、そっと寄り添います。"],
    inputLabel: "悩み事・愚痴・弱音・懺悔など、心にあることを、書いてください",
    placeholder: "思いつくままに、書いてください",
    askKinds: "人物・書物",
    askExamples: "「パウロなら、なんと言う?」「詩篇には、なんて書いてある?」",
    submit: "聖書をめくる",
    loading: "聖書の言葉を探しています(20秒ほどかかります)…",
    continueAnyway: "それでも、聖書をめくってみる",
    books: "聖書",
  },
  realism: {
    id: "realism",
    path: "/realism",
    name: "リアリズム",
    title: "現実を、見てみる。",
    lead: [
      "励ましではなく、勝ち目の話を。",
      "孫子・韓非子・ショーペンハウアーなど、幻想のない古典から、打てる手を探します。",
    ],
    inputLabel: "いまの状況と、困っていることを、書いてください",
    placeholder: "状況と、相手との関係から、思いつくままに",
    askKinds: "人物・書物",
    askExamples: "「孫子なら、なんと言う?」「『君主論』には、なんて書いてある?」",
    submit: "打てる手を探す",
    loading: "打てる手を探しています(20秒ほどかかります)…",
    continueAnyway: "それでも、打てる手を探してみる",
    books: "兵法・政治・経済・処世術の古典",
  },
};
