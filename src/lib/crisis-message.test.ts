import { describe, expect, it } from "vitest";
import { CRISIS_MESSAGE, SHOW_SUPPORT_CONTACTS } from "./crisis-message";

// 窓口の番号やリンクを、誤って書き換えないための確認。変えるときは、公式のページで確認してから、ここも直す
describe("危機の画面の固定の文", () => {
  it("窓口を出す設定のとき、電話は tel:、チャットは https のリンクで入っている", () => {
    expect(SHOW_SUPPORT_CONTACTS).toBe(true);
    const hrefs = CRISIS_MESSAGE.flatMap((line) => (line.href ? [line.href] : []));
    expect(hrefs).toEqual(["tel:0120279338", "https://talkme.jp/"]);
  });

  it("電話の表示の番号と、リンクの番号が一致している", () => {
    const line = CRISIS_MESSAGE.find((l) => l.href === "tel:0120279338");
    expect(line?.text).toContain("0120-279-338");
  });

  it("119 は、太字の1行だけで、110 は入っていない", () => {
    const emphasized = CRISIS_MESSAGE.filter((l) => l.emphasis);
    expect(emphasized).toHaveLength(1);
    expect(emphasized[0].text).toContain("119");
    expect(CRISIS_MESSAGE.some((l) => l.text.includes("110"))).toBe(false);
  });
});
