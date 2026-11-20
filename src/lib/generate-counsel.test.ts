import { beforeEach, describe, expect, it, vi } from "vitest";

// 本物の OpenRouter は呼ばない(chatText を差し替える)
const chat = vi.hoisted(() => ({ chatText: vi.fn() }));
vi.mock("./openrouter", () => ({ chatText: chat.chatText }));

import { MAX_INPUT_CHARS } from "./counsel-schema";
import {
  generateCounsel,
  GenerationError,
  parseCounsel,
  removePhoneNumbers,
} from "./generate-counsel";

const goodPassage = (reference: string, overrides: Record<string, unknown> = {}) => ({
  reference,
  verses: [
    { label: "1", text: "主よ、いつまでなのですか。", core: false },
    { label: "2", text: "わたしの魂は悩みます。", core: true },
  ],
  commentary: "つらい気持ちを、昔の人も言葉にしていました。",
  ...overrides,
});

const goodJson = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    crisis: false,
    preface: null,
    passages: [
      goodPassage("詩篇 13:1-2"),
      goodPassage("マタイによる福音書 11:28-30"),
      goodPassage("伝道の書 4:6"),
    ],
    conclusion: "今日は、早く休みましょう。",
    ...overrides,
  });

describe("parseCounsel", () => {
  it("箇所・本文・核心の節・解説・結論を、読む順に返す", () => {
    const result = parseCounsel(goodJson());
    expect(result.passages.map((p) => p.reference)).toEqual([
      "詩篇 13:1-2",
      "マタイによる福音書 11:28-30",
      "伝道の書 4:6",
    ]);
    expect(result.passages[0].verses).toEqual([
      { label: "1", text: "主よ、いつまでなのですか。", core: false },
      { label: "2", text: "わたしの魂は悩みます。", core: true },
    ]);
    expect(result.conclusion).toBe("今日は、早く休みましょう。");
    expect(result.crisis).toBe(false);
  });

  it("前後に説明やコードブロックの記号があっても、JSON を読む", () => {
    expect(parseCounsel("```json\n" + goodJson() + "\n```\n以上です").passages).toHaveLength(3);
  });

  it("節の番号が数字で返ってきても、文字列にそろえる。core がなければ、核心なし", () => {
    const text = goodJson({
      passages: [goodPassage("詩篇 13:1", { verses: [{ label: 1, text: "主よ。" }] })],
    });
    expect(parseCounsel(text).passages[0].verses).toEqual([
      { label: "1", text: "主よ。", core: false },
    ]);
  });

  it("使えない箇所(解説・本文・書名が空、節が多すぎる、形が違う)は、捨てて、使える箇所だけ返す", () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => ({
      label: String(i + 1),
      text: "節です。",
    }));
    const text = goodJson({
      passages: [
        goodPassage("詩篇 13:1-2", { commentary: "  " }),
        goodPassage("詩篇 13:3", { verses: [] }),
        goodPassage("", {}),
        goodPassage("詩篇 14:1-11", { verses: tooMany }),
        goodPassage("詩篇 14:1", { verses: [{ label: "1", text: "" }] }),
        "文字列",
        null,
        goodPassage("ヨハネの第一の手紙 4:7"),
      ],
    });
    expect(parseCounsel(text).passages.map((p) => p.reference)).toEqual(["ヨハネの第一の手紙 4:7"]);
  });

  it("4つ以上返ってきても、先頭の3つだけ", () => {
    const text = goodJson({
      passages: ["一", "二", "三", "四"].map((n) => goodPassage(`詩篇 ${n}`)),
    });
    expect(parseCounsel(text).passages).toHaveLength(3);
  });

  it("使える箇所が1つもない・結論が空・JSON でない・形が違う返答は、止まる", () => {
    expect(() => parseCounsel(goodJson({ passages: [] }))).toThrow(GenerationError);
    expect(() => parseCounsel(goodJson({ conclusion: "  " }))).toThrow(GenerationError);
    expect(() => parseCounsel("すみません、できません")).toThrow(GenerationError);
    expect(() => parseCounsel("{壊れた}")).toThrow(GenerationError);
    expect(() => parseCounsel(JSON.stringify({ passages: "なし" }))).toThrow(GenerationError);
  });

  it("preface と crisis を読む", () => {
    const result = parseCounsel(
      goodJson({ preface: "それは聖書には載っていませんが、…", crisis: true }),
    );
    expect(result.preface).toBe("それは聖書には載っていませんが、…");
    expect(result.crisis).toBe(true);
    expect(parseCounsel(goodJson({ preface: "  " })).preface).toBeNull();
  });

  it("エラーのメッセージに、返答の中身を入れない", () => {
    const secret = "とても個人的な悩みの内容";
    for (const text of [`${secret} {壊れた`, JSON.stringify({ passages: secret })]) {
      try {
        parseCounsel(text);
        throw new Error("止まるはず");
      } catch (error) {
        expect(error).toBeInstanceOf(GenerationError);
        expect((error as Error).message).not.toContain(secret);
      }
    }
  });
});

describe("電話番号を、AI が書かない(書いても、取り除く)", () => {
  it("removePhoneNumbers: 括弧の中の番号は、括弧ごと。番号だけの場合は、番号を取り除く", () => {
    expect(
      removePhoneNumbers("よりそいホットライン(0120-279-338、24時間・無料)に連絡してください"),
    ).toBe("よりそいホットラインに連絡してください");
    expect(removePhoneNumbers("0120-279-338 に電話")).toBe(" に電話");
    expect(removePhoneNumbers("050-1234-5678")).toBe("");
    expect(removePhoneNumbers("03(1234)5678")).toBe("03(1234)5678"); // 区切りが違う形は、対象外
  });

  it("区切りのない番号・全角の番号・短縮の番号も、取り除く(第4回のレビュー)", () => {
    expect(removePhoneNumbers("0120279338 に電話")).toBe(" に電話");
    // 番号が括弧の外にあるときは、番号だけを取り除く(括弧ごとは、括弧の中に番号があるときだけ)
    expect(removePhoneNumbers("０１２０−２７９−３３８(24時間)に電話")).toBe("(24時間)に電話");
    expect(removePhoneNumbers("電話相談 #9110 や #7119")).toBe("電話相談  や ");
    expect(removePhoneNumbers("よりそいホットライン(０１２０－２７９－３３８)")).toBe(
      "よりそいホットライン",
    );
  });

  it("聖書の節の番号・日付・年は、取り除かない", () => {
    for (const text of [
      "ヨブ記 7:11-21 の箇所",
      "1954年の訳",
      "11-21節",
      "119番や110番",
      "2026-11-18",
    ]) {
      expect(removePhoneNumbers(text)).toBe(text);
    }
  });

  it("parseCounsel は、解説・結論・前置きから、電話番号を取り除く", () => {
    const text = goodJson({
      preface: "前置き(0120-279-338)です。",
      passages: [goodPassage("詩篇 13:1-2", { commentary: "解説 0120-279-338 です" })],
      conclusion: "窓口(03-1234-5678、24時間)に話してください。",
    });
    const result = parseCounsel(text);
    expect(result.preface).toBe("前置きです。");
    expect(result.passages[0].commentary).toBe("解説  です");
    expect(result.conclusion).toBe("窓口に話してください。");
  });
});

describe("generateCounsel", () => {
  beforeEach(() => {
    chat.chatText.mockReset();
  });

  it("箇所・本文・解説・結論を返す。推論は low、書く仕事用のモデル、費用の見積もりも返す", async () => {
    chat.chatText.mockResolvedValueOnce({
      text: goodJson(),
      usage: { promptTokens: 1500, completionTokens: 800 },
    });
    const result = await generateCounsel("仕事で疲れ果てた");
    expect(result.passages).toHaveLength(3);
    expect(result.usage).toEqual({ promptTokens: 1500, completionTokens: 800 });

    const request = chat.chatText.mock.calls[0][0];
    expect(request.reasoningEffort).toBe("low");
    expect(request.purpose).toBe("writing");
    expect(request.user).toContain("仕事で疲れ果てた");
  });

  it("プロンプトに、箇所の選び方・本文の書き方・解説の規則が入っている", async () => {
    chat.chatText.mockResolvedValueOnce({ text: goodJson(), usage: {} });
    await generateCounsel("悩み");
    const system = chat.chatText.mock.calls[0][0].system as string;
    // 箇所の選び方
    expect(system).toContain("気持ちの奥");
    expect(system).toContain("自信のない箇所は、選ばない");
    expect(system).toContain("逆に働く");
    expect(system).toContain("「空である」「苦しい」で終わる箇所は、最後にしない");
    // 本文: 口語訳を、一字一句、正確に。上限と、触れてよい節
    expect(system).toContain("一字一句、正確に");
    expect(system).toContain("上限は、8節・450字");
    expect(system).toContain("責めるように、罰するように、見下すように読める節");
    expect(system).toContain("verses に書いた節にだけ触れる");
    // 解説の書き方
    expect(system).toContain("信仰を前提にしない");
    expect(system).toContain("耐えるよう勧めない");
    expect(system).toContain("病気は、神の怒りや罰ではない");
    expect(system).toContain("相談者が書いていないことを、決めつけない");
    expect(system).toContain("お話からは分かりませんが");
    expect(system).toContain("事実として肯定しない");
    expect(system).toContain("必要なときだけ");
    expect(system).toContain("医療機関に");
    // 電話番号・窓口の名前・受付時間は、書かせない
    expect(system).toContain("電話番号・相談窓口の名前・受付時間は、書かない");
  });

  it("全体の締め切り(signal)を、OpenRouter の呼び出しに渡す。なければ、渡さない。1回の待ち時間は、50秒", async () => {
    chat.chatText.mockResolvedValue({ text: goodJson(), usage: {} });
    const controller = new AbortController();
    await generateCounsel("悩み", { signal: controller.signal });
    expect(chat.chatText.mock.calls[0][1]).toEqual({
      timeoutMs: 50_000,
      signal: controller.signal,
    });
    await generateCounsel("悩み");
    expect(chat.chatText.mock.calls[1][1]).toEqual({ timeoutMs: 50_000 });
  });

  it("空の悩み・長すぎる悩みは、モデルを呼ばずに断る", async () => {
    await expect(generateCounsel("  ")).rejects.toThrow(RangeError);
    await expect(generateCounsel("あ".repeat(MAX_INPUT_CHARS + 1))).rejects.toThrow(RangeError);
    expect(chat.chatText).not.toHaveBeenCalled();
  });

  it("返答が崩れていたら、GenerationError(やり直しは、呼び出し側が決める)", async () => {
    chat.chatText.mockResolvedValueOnce({ text: "すみません、できません", usage: {} });
    await expect(generateCounsel("悩み")).rejects.toThrow(GenerationError);
  });
});

describe("人物や書物の指名", () => {
  beforeEach(() => {
    chat.chatText.mockReset();
    chat.chatText.mockResolvedValue({ text: goodJson(), usage: {} });
  });

  it("3つの棚とも、指名を優先する規則と、安全の規則が優先される旨が入る", async () => {
    for (const shelf of ["classics", "bible", "realism"] as const) {
      await generateCounsel("孔子ならなんと言う?", { shelf });
      const system = chat.chatText.mock.calls.at(-1)?.[0].system as string;
      expect(system).toContain("指名を、箇所の選び方より優先する");
      expect(system).toContain("その人になりきって話さない");
      expect(system).toContain("安全の規則");
    }
  });

  it("棚の範囲の外の指名は、別の棚を案内する(棚ごとに文が違う)", async () => {
    await generateCounsel("悩み", { shelf: "classics" });
    expect(chat.chatText.mock.calls.at(-1)?.[0].system).toContain("「聖書の棚」");
    await generateCounsel("悩み", { shelf: "bible" });
    expect(chat.chatText.mock.calls.at(-1)?.[0].system).toContain("聖書の中の人物");
    await generateCounsel("悩み", { shelf: "realism" });
    expect(chat.chatText.mock.calls.at(-1)?.[0].system).toContain("論語・老子・聖書など");
  });
});

describe("命の危険の文脈(crisisContext)", () => {
  beforeEach(() => {
    chat.chatText.mockReset();
  });

  it("指定したときだけ、専用の指示(受け止める・肯定も否定もしない・窓口を書かない・命が失われる節を選ばない・1人に伝える)を足す", async () => {
    chat.chatText.mockResolvedValue({ text: goodJson(), usage: {} });
    await generateCounsel("悩み");
    expect(chat.chatText.mock.calls.at(-1)?.[0].system).not.toContain(
      "死にたい気持ちを書いている可能性",
    );

    await generateCounsel("悩み", { crisisContext: true });
    const system = chat.chatText.mock.calls.at(-1)?.[0].system as string;
    expect(system).toContain("死にたい気持ちを書いている可能性");
    expect(system).toContain("肯定も否定もせず");
    expect(system).toContain("命が失われることを語る節を、含めない");
    expect(system).toContain("誰か1人に");
  });
});

describe("他人を傷つけたい気持ち(harmContext)", () => {
  beforeEach(() => {
    chat.chatText.mockReset();
  });

  it("指定したときだけ、専用の指示(責める箇所を選ばない・神が代わりに罰する、と読ませない・その場を離れる・緊急の窓口)を足す", async () => {
    chat.chatText.mockResolvedValue({ text: goodJson(), usage: {} });
    await generateCounsel("悩み");
    expect(chat.chatText.mock.calls.at(-1)?.[0].system).not.toContain(
      "傷つけたい気持ちを書いています",
    );

    await generateCounsel("悩み", { harmContext: true });
    const system = chat.chatText.mock.calls.at(-1)?.[0].system as string;
    expect(system).toContain("傷つけたい気持ちを書いています");
    expect(system).toContain("「人殺し」「地獄の火」");
    expect(system).toContain("神が代わりに、相手を罰してくれる、という読みにしない");
    expect(system).toContain("緊急の窓口に連絡する");
    // 自傷の指示とは、別(混ざらない)
    expect(system).not.toContain("死にたい気持ちを書いている可能性");
  });
});
