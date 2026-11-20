import { SHELF_INFO, type ShelfId } from "@/lib/shelves";

// 「ご利用にあたって」(能書き)。無料であること・回数の制限・保存しないこと・送信先・AI の間違いなど。免責は、最小限にする(書きすぎない)。
// 見た目は Claude Design の見本に合わせる。文言は、このコードが正。
// **文面は、公開前に、必ず確認する**: 送信先(AI の事業者)の保管の扱いは、事業者の最新の規約に合わせる。
// 専門家には見てもらわない方針(管理人の判断)。個人情報の扱いは、事業者の規約に合わせる。
// 回数の上限の数字は、環境変数で変える(docs/rate-limit.md)ので、ここには書かない。

function buildNotices(shelf: ShelfId): readonly { title: string; body: string }[] {
  const books = SHELF_INFO[shelf].books;
  return [
    {
      title: "無料で使えます",
      body: "相談は無料です。管理人が契約している AI サービス(OpenRouter)の利用枠を、少し消費します。利用が集中したときは、回数を制限したり、受け付けをお休みしたりすることがあります。",
    },
    {
      title: "1日に使える回数には、上限があります",
      body: "費用を守るため、1人が1日に使える回数に、上限を設けています。回数を数えるために、IP アドレスを元に戻せない形(ハッシュ)にして、日付と回数だけを記録します。相談の内容は、記録しません。",
    },
    {
      title: "このサイトでは、書いた内容と、AI の返答を、保存しません",
      body: "入力したテキストと、AI が返したテキストを、管理人は、保存しません(データベースにも、ログにも、残しません)。画面を閉じると、消えます。AI の返答は、毎回変わるので、同じ文章を、もう一度作ることはできません。残したいときは、ご自身でコピーして、保管してください。なお、昼夜の表示の設定だけは、ご自身のブラウザに保存します(相談の内容は含みません)。",
    },
    {
      title: "AI の事業者に、文章が送られます",
      body: "書いた文章は、AI の事業者(OpenRouter を経由)に送られて、処理されます。学習やデータの収集に使わない設定で送っていますが、不正な利用を防ぐためなどに、事業者の側で、一時的に保管されることがあります。氏名・住所・電話番号・他人の実名など、個人が特定される情報は、書かないでください。",
    },
    {
      title: "AI は、間違えることがあります",
      body: `AI の解説は、ひとつの読み方です。間違えたり、${books}の内容を読み違えたりすることがあります。選ばれた箇所や解説が、相談の内容と合わない、見当違いな答えが返ってくることもあります。読み方は、人によっても分かれます。引用の本文など、大事なところは、ご自身で確かめてください。`,
    },
    {
      title: "つらい気持ちが続くときは",
      body: "つらい気持ちが続くとき、命の危険を感じるときは、専門の相談窓口や、信頼できる人に、相談してください。相談窓口は、命の危険を感じる言葉を書いたときの画面で、案内しています。",
    },
    shelf === "bible"
      ? {
          title: "聖書の本文は、AI が思い出して書いています",
          body: "引用してある聖書の本文は、AI が、聖書の記憶から、現代の日本語で書いたものです。実際の訳と言い回しが違ったり、存在しない節が混ざったりすることがあります。大事なところは、ご自身で、聖書で確かめてください。",
        }
      : {
          title: "引用の本文は、AI が思い出して書いています",
          body: `引用してある本文は、AI が、${books}の記憶から、自分の言葉で書いたものです。実際の書物と、言い回しが違ったり、存在しない箇所が混ざったりすることがあります。大事なところは、ご自身で、書物で確かめてください。`,
        },
    ...(shelf === "realism"
      ? [
          {
            title: "人を欺いたり、傷つけたりする手は、示しません",
            body: `${books}の言葉を、ひとつの知恵として、紹介します。人を欺いたり、傷つけたりすることは、勧めません。`,
          },
        ]
      : []),
  ];
}

// いつも見せる、最小限の行(詳しい説明は、折りたたむ)。読まれないほど長くしない
function buildSummary(shelf: ShelfId): readonly string[] {
  return [
    `悩みのほかに、人物や書物を指名して、聞くこともできます。たとえば、${SHELF_INFO[shelf].askExamples}`,
    "相談は無料です(管理人の AI の利用枠を、少し使います)。1日に使える回数には、上限があります。",
    "書いた内容と、AI の返答は、このサイトでは保存しません。ただし、AI の事業者には送られます。画面を閉じると消え、同じ文章は、もう作れません。必要なら、ご自身で保管してください。",
    "AI は、間違えることがあります。見当違いな答えが返ってくることもあります。大事なところは、ご自身で確かめてください。",
  ];
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none stroke-gold-ink transition-transform duration-200 group-open:rotate-180"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function Notices({ shelf = "bible" }: { shelf?: ShelfId }) {
  const NOTICES = buildNotices(shelf);
  return (
    <section
      aria-labelledby="notices-heading"
      className="flex flex-col gap-4.5 border-t border-line pt-9"
    >
      <h2
        id="notices-heading"
        className="font-serif text-xl leading-normal font-semibold tracking-[0.04em]"
      >
        ご利用にあたって
      </h2>
      <ul className="flex flex-col gap-2.5">
        {buildSummary(shelf).map((line) => (
          <li key={line} className="flex gap-3 text-sm leading-[1.85]">
            <span aria-hidden="true" className="mt-2.5 size-1.5 flex-none rotate-45 bg-gold" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm leading-[1.6] font-medium [&::-webkit-details-marker]:hidden">
          詳しく読む(送信先・個人情報など)
          <Chevron />
        </summary>
        <ul className="mt-2 flex flex-col">
          {NOTICES.map((notice) => (
            <li key={notice.title} className="flex flex-col gap-1.5 border-t border-line py-4.5">
              <h3 className="text-sm leading-[1.7] font-bold">{notice.title}</h3>
              <p className="text-sm leading-[1.9] text-muted">{notice.body}</p>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
