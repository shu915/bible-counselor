import { SHELF_INFO, type ShelfId } from "@/lib/shelves";
import { CounselForm } from "./counsel-form";
import { Notices } from "./notices";
import { ShelfFrame } from "./shelf-frame";
import { ShelfMark } from "./shelf-mark";

// 棚ごとの相談の画面(一般古典・聖書・リアリズムで共通)。見た目は Claude Design の見本(アーチ・金・明朝)。文言とロジックは、このコードが正
export function ShelfPage({ shelf }: { shelf: ShelfId }) {
  const info = SHELF_INFO[shelf];
  return (
    <div data-shelf={shelf}>
      <main className="relative mx-auto flex w-full max-w-180 flex-col gap-[clamp(32px,7vw,48px)] px-6 pt-[clamp(24px,6vw,56px)] pb-[clamp(56px,10vw,96px)]">
        <header className="relative mx-auto flex w-full max-w-140 flex-col items-center gap-4.5 px-7 pt-[clamp(84px,17vw,112px)] pb-11 text-center">
          <ShelfFrame shelf={shelf} />
          <div className="relative flex flex-col items-center gap-4.5">
            <ShelfMark shelf={shelf} size={22} />
            <h1 className="font-serif text-[clamp(26px,7vw,42px)] leading-[1.45] font-semibold tracking-[0.04em] break-keep">
              {info.title}
            </h1>
            {/* 文ごとに塊にして、文の切れ目でだけ折る。狭い幅で1文が長いときは、文節で折る */}
            <p className="font-serif text-[clamp(15px,4vw,17px)] leading-loose font-medium text-balance">
              {info.lead.map((sentence) => (
                <span key={sentence} className="inline-block">
                  {sentence}
                </span>
              ))}
            </p>
          </div>
        </header>
        <CounselForm shelf={shelf} />
        <Notices shelf={shelf} />
      </main>
    </div>
  );
}
