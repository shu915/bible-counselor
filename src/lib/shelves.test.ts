import { describe, expect, it } from "vitest";
import { SHELF_INFO, SHELVES } from "./shelves";

describe("棚の定義(SHELF_INFO)", () => {
  it("棚ごとに、道筋・名前・見出し・入力欄・ボタンの文言があり、道筋は重ならない", () => {
    const paths = SHELVES.map((id) => SHELF_INFO[id].path);
    expect(new Set(paths).size).toBe(SHELVES.length);
    for (const id of SHELVES) {
      const info = SHELF_INFO[id];
      expect(info.id).toBe(id);
      for (const text of [info.name, info.title, info.inputLabel, info.submit, info.loading]) {
        expect(text.trim()).not.toBe("");
      }
      expect(info.lead.length).toBeGreaterThan(0);
    }
  });

  it("聞き方の例(askExamples)は、棚ごとに、人物と書物の指名を、1つずつ含む", () => {
    for (const id of SHELVES) {
      const examples = SHELF_INFO[id].askExamples;
      // 「〇〇なら、なんと言う?」(人物)と、「〇〇には、なんて書いてある?」(書物)
      expect(examples).toContain("なら、なんと言う?");
      expect(examples).toContain("には、なんて書いてある?");
    }
  });

  it("聞き方の例は、その棚の範囲の人物・書物にする(棚の外を、例にしない)", () => {
    expect(SHELF_INFO.bible.askExamples).toContain("詩篇");
    expect(SHELF_INFO.realism.askExamples).toContain("孫子");
    expect(SHELF_INFO.realism.askExamples).not.toContain("聖書");
    expect(SHELF_INFO.classics.askExamples).not.toContain("孫子");
    expect(SHELF_INFO.classics.askExamples).not.toContain("詩篇");
  });
});
