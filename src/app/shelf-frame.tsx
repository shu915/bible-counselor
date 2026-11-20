import type { ShelfId } from "@/lib/shelves";

// 見出しの枠(3つの棚で、大きさと位置は同じ。形と、中の模様だけが変わる)。
// 聖書: アーチと光 / 一般古典: 本のページの四角に、古典の原文が縦書きで流れる / リアリズム: 角のない四角に、碁盤と石
// 模様は飾りなので、読み上げない。中央(見出しの文字の周り)は、マスクで抜いて、読みやすさを保つ
const CLASSICS_LINES = [
  "ゆく河の流れは絶えずして、しかももとの水にあらず。",
  "学びて時に之を習う、亦た説ばしからずや。",
  "上善は水の如し。",
  "つれづれなるままに、日くらし硯にむかひて、",
  "知る者は言わず、言う者は知らず。",
  "春はあけぼの。やうやう白くなりゆく山ぎは、",
  "足るを知る者は富む。",
  "祇園精舎の鐘の声、諸行無常の響きあり。",
] as const;

// [x, y, 色](19路の交点。0〜18)
const STONES: readonly [number, number, "b" | "w"][] = [
  [3, 3, "b"],
  [15, 4, "w"],
  [4, 14, "w"],
  [14, 15, "b"],
  [9, 2, "b"],
  [2, 9, "w"],
  [16, 10, "b"],
  [10, 16, "w"],
];

const OUTER_RADIUS: Record<ShelfId, string> = {
  bible: "rounded-t-[280px]",
  classics: "rounded-t-[6px]",
  realism: "rounded-none",
};
const INNER_RADIUS: Record<ShelfId, string> = {
  bible: "rounded-t-[268px]",
  classics: "rounded-t-[3px]",
  realism: "rounded-none",
};

export function ShelfFrame({ shelf }: { shelf: ShelfId }) {
  return (
    <>
      <div
        aria-hidden="true"
        className={`fade-bottom absolute inset-0 border border-b-0 border-gold bg-[radial-gradient(ellipse_72%_58%_at_50%_20%,var(--glow),transparent_76%)] ${OUTER_RADIUS[shelf]}`}
      />
      <div
        aria-hidden="true"
        className={`fade-bottom absolute inset-x-3 top-3 bottom-0 border border-b-0 border-line ${INNER_RADIUS[shelf]}`}
      />
      {shelf === "classics" && (
        <div aria-hidden="true" className="shelf-motif motif-classics">
          {Array.from({ length: 6 }, (_, i) => {
            const seq = [0, 1].map((k) => CLASSICS_LINES[(i + k * 3) % CLASSICS_LINES.length]);
            return (
              <div
                key={i}
                className="motif-col"
                style={{ animationDuration: `${60 + i * 9}s`, animationDelay: `-${i * 11}s` }}
              >
                {/* 同じ並びを2回置いて、半分流れたら最初に戻す(つなぎ目を出さない) */}
                {[...seq, ...seq].map((line, j) => (
                  <p key={j}>{line}</p>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {shelf === "realism" && (
        <div aria-hidden="true" className="shelf-motif">
          <div className="motif-grid" />
          {STONES.map(([x, y, color], i) => (
            <span
              key={i}
              className={`motif-stone ${color === "b" ? "motif-stone-black" : "motif-stone-white"}`}
              style={{
                left: `${(x / 18) * 100}%`,
                top: `${(y / 18) * 100}%`,
                animationDelay: `${i * 0.9}s`,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
