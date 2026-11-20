import Link from "next/link";
import { SHELF_INFO, SHELVES, type ShelfId } from "@/lib/shelves";
import { CounselForm } from "./counsel-form";
import { Notices } from "./notices";
import { Star } from "./star";
import { ThemeToggle } from "./theme-toggle";

// 棚ごとの相談の画面(一般古典・聖書・リアリズムで共通)。見た目は Claude Design の見本(アーチ・金・明朝)。文言とロジックは、このコードが正
export function ShelfPage({ shelf }: { shelf: ShelfId }) {
  const info = SHELF_INFO[shelf];
  return (
    <main className="relative mx-auto flex w-full max-w-180 flex-col gap-[clamp(32px,7vw,48px)] px-6 pt-[clamp(24px,6vw,56px)] pb-[clamp(56px,10vw,96px)]">
      <header className="relative mx-auto flex w-full max-w-140 flex-col items-center gap-4.5 px-7 pt-[clamp(84px,17vw,112px)] pb-11 text-center">
        <div
          aria-hidden="true"
          className="fade-bottom absolute inset-0 rounded-t-[280px] border border-b-0 border-gold bg-[radial-gradient(ellipse_72%_58%_at_50%_20%,var(--glow),transparent_76%)]"
        />
        <div
          aria-hidden="true"
          className="fade-bottom absolute inset-x-3 top-3 bottom-0 rounded-t-[268px] border border-b-0 border-line"
        />
        <div className="relative flex flex-col items-center gap-4.5">
          <Star size={22} className="fill-gold" />
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
      <nav aria-label="本棚" className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[15px]">
        {SHELVES.map((id) => (
          <Link
            key={id}
            href={SHELF_INFO[id].path}
            aria-current={id === shelf ? "page" : undefined}
            className={`min-h-11 content-center underline-offset-4 ${id === shelf ? "font-bold" : "underline"}`}
          >
            {SHELF_INFO[id].name}
          </Link>
        ))}
      </nav>
      <CounselForm shelf={shelf} />
      <Notices shelf={shelf} />
      <ThemeToggle />
    </main>
  );
}
