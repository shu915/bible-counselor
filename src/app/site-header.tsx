"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SHELF_INFO, SHELVES, type ShelfId } from "@/lib/shelves";
import { ThemeToggle } from "./theme-toggle";

// 全ページ共通のヘッダー。layout.tsx に置き、棚を切り替えても作り直さない(下線だけが動く)。
// 今いる棚は、道筋から決める。帯の色は、昼夜で変えない。スマホでは2段(上: ロゴと切り替え、下: 棚)
function currentShelf(pathname: string): ShelfId | undefined {
  return SHELVES.find((id) => SHELF_INFO[id].path === pathname);
}

export function SiteHeader() {
  const shelf = currentShelf(usePathname());
  const links = SHELVES.map((id) => (
    <Link
      key={id}
      href={SHELF_INFO[id].path}
      aria-current={id === shelf ? "page" : undefined}
      className="header-link"
    >
      {SHELF_INFO[id].name}
    </Link>
  ));

  return (
    <header className="border-b border-white/8 bg-header text-header-ink">
      {/* PC: 1段 */}
      <div className="mx-auto hidden h-16 max-w-280 items-center justify-between gap-6 px-[clamp(16px,4vw,32px)] sm:flex">
        <Logo />
        <div className="flex items-center gap-4">
          <nav aria-label="本棚" className="flex items-center gap-2">
            {links}
          </nav>
          <span aria-hidden="true" className="h-5 w-px bg-white/18" />
          <ThemeToggle />
        </div>
      </div>

      {/* スマホ: 2段 */}
      <div className="sm:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo />
          <ThemeToggle />
        </div>
        <nav aria-label="本棚" className="header-tabs grid grid-cols-3 border-t border-white/10">
          {links}
        </nav>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <Link
      href="/"
      className="text-[20px] tracking-[0.08em] whitespace-nowrap text-header-ink no-underline"
    >
      Shu の本棚
    </Link>
  );
}
