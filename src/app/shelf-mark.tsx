import type { ShelfId } from "@/lib/shelves";
import { Star } from "./star";

// 棚ごとの印(飾り。読み上げの対象にしない)。聖書: 金の星 / 一般古典: 臙脂の栞 / リアリズム: 朱の輪をまとった碁石。
// 色は、棚ごとの --gold(差し色)から取る(globals.css の [data-shelf])。
// noRing: 碁石の朱の輪を付けない(待ちの表示用。ほかの棚では、効かない)
export function ShelfMark({
  shelf,
  size,
  noRing = false,
}: {
  shelf: ShelfId;
  size: number;
  noRing?: boolean;
}) {
  if (shelf === "classics") {
    return (
      <span
        aria-hidden="true"
        className="block flex-none bg-gold [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)]"
        style={{ width: Math.round(size * 0.58), height: Math.round(size * 1.05) }}
      />
    );
  }
  if (shelf === "realism") {
    const d = Math.round(size * 0.86);
    return (
      <span
        aria-hidden="true"
        className={`stone-mark block flex-none rounded-full ${noRing ? "" : "stone-ring"}`}
        style={{ width: d, height: d }}
      />
    );
  }
  return <Star size={size} className="flex-none fill-gold" />;
}
