import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SHELF_INFO, SHELVES } from "@/lib/shelves";
import { Notices } from "./notices";

describe("注意書き(Notices)", () => {
  it("いつも見せる行の先頭に、棚ごとの聞き方の例が出る", () => {
    for (const id of SHELVES) {
      const html = renderToStaticMarkup(<Notices shelf={id} />);
      expect(html).toContain("人物や書物を指名して、聞くこともできます");
      // 例の中の「」と、HTML の文字参照(&#x27; など)が混ざらないよう、例の最初の1つだけを確かめる
      const first = SHELF_INFO[id].askExamples.split("」")[0].replace("「", "");
      expect(html).toContain(first);
    }
  });

  it("保存しない・事業者に送られる、の約束は、どの棚でも残る", () => {
    for (const id of SHELVES) {
      const html = renderToStaticMarkup(<Notices shelf={id} />);
      expect(html).toContain("保存しません");
      expect(html).toContain("AI の事業者には送られます");
    }
  });
});
