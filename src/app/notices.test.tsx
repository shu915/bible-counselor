import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SHELF_INFO, SHELVES } from "@/lib/shelves";
import { Notices } from "./notices";

describe("注意書き(Notices)", () => {
  it("いつも見せる行の先頭に、棚ごとの聞き方の例が出る", () => {
    for (const id of SHELVES) {
      const html = renderToStaticMarkup(<Notices shelf={id} />);
      expect(html).toContain(`${SHELF_INFO[id].askKinds}を指名して、聞くこともできます`);
      // 例の中の「」と、HTML の文字参照(&#x27; など)が混ざらないよう、例の最初の1つだけを確かめる
      const first = SHELF_INFO[id].askExamples.split("」")[0].replace("「", "");
      expect(html).toContain(first);
    }
  });

  it("いつも見せる行で、人物・書物・用語の指名と、引用できない人を、さらっと伝える", () => {
    for (const id of SHELVES) {
      const html = renderToStaticMarkup(<Notices shelf={id} />);
      expect(html).toContain(`${SHELF_INFO[id].askKinds}を指名して`);
      expect(html).toContain("言葉は、引用できません");
    }
  });

  it("「用語」を案内するのは、一般古典だけ(用語の規則が入っているのは、一般古典だけ)", () => {
    expect(SHELF_INFO.classics.askKinds).toContain("用語");
    expect(SHELF_INFO.bible.askKinds).not.toContain("用語");
    expect(SHELF_INFO.realism.askKinds).not.toContain("用語");
  });

  it("保存しない・事業者に送られる、の約束は、どの棚でも残る", () => {
    for (const id of SHELVES) {
      const html = renderToStaticMarkup(<Notices shelf={id} />);
      expect(html).toContain("保存しません");
      expect(html).toContain("AI の事業者には送られます");
    }
  });
});
