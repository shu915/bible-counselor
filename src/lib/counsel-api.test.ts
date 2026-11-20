import { beforeEach, describe, expect, it, vi } from "vitest";

// 本物の AI は使わない(生成を差し替える)。危機の検出は、本物を使う
const mocks = vi.hoisted(() => ({ generateCounsel: vi.fn() }));
vi.mock("./generate-counsel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./generate-counsel")>()),
  generateCounsel: mocks.generateCounsel,
}));

import { runCounsel } from "./counsel-api";
import { MAX_INPUT_CHARS, counselRequestSchema } from "./counsel-schema";
import { GenerationError } from "./generate-counsel";

const passage = {
  reference: "マタイによる福音書 6:19-21",
  verses: [
    { label: "19", text: "地上に宝をたくわえるな。", core: false },
    { label: "20", text: "天に宝をたくわえよ。", core: false },
    { label: "21", text: "宝のある所に心もある。", core: true },
  ],
  commentary: "宝のある所に心もある、という言葉です。",
};

function counsel(overrides: Record<string, unknown> = {}) {
  return {
    preface: "それは聖書には載っていませんが、富を失うことと受け止めました。",
    passages: [passage],
    conclusion: "今日は早く休みましょう。",
    crisis: false,
    usage: {},
    ...overrides,
  };
}

beforeEach(() => {
  mocks.generateCounsel.mockReset();
  mocks.generateCounsel.mockResolvedValue(counsel());
});

describe("counselRequestSchema", () => {
  it("前後の空白を除く。空・長すぎる入力は断る", () => {
    expect(counselRequestSchema.parse({ consultation: "  疲れた  " }).consultation).toBe("疲れた");
    expect(counselRequestSchema.safeParse({ consultation: "   " }).success).toBe(false);
    expect(
      counselRequestSchema.safeParse({ consultation: "あ".repeat(MAX_INPUT_CHARS) }).success,
    ).toBe(true);
    expect(
      counselRequestSchema.safeParse({ consultation: "あ".repeat(MAX_INPUT_CHARS + 1) }).success,
    ).toBe(false);
    expect(counselRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("runCounsel", () => {
  it("箇所・本文・核心の節の印・解説・結論を、画面の形で返す(本文は、すべて画面に出す)", async () => {
    const result = await runCounsel({ consultation: "仮想通貨が暴落した" });
    if (result.kind !== "ok") throw new Error("ok のはず");
    expect(result.preface).toContain("聖書には載っていませんが");
    expect(result.conclusion).toBe("今日は早く休みましょう。");
    expect(result.showHelp).toBe(false);

    const [view] = result.passages;
    expect(view.reference).toBe("マタイによる福音書 6:19-21");
    expect(view.commentary).toBe("宝のある所に心もある、という言葉です。");
    expect(view.verses).toEqual([
      { label: "19", text: "地上に宝をたくわえるな。", core: false },
      { label: "20", text: "天に宝をたくわえよ。", core: false },
      { label: "21", text: "宝のある所に心もある。", core: true },
    ]);
  });

  it("AI の文章が異常に長くても、画面に出す長さに上限をかける", async () => {
    mocks.generateCounsel.mockResolvedValueOnce(
      counsel({
        preface: "あ".repeat(5_000),
        passages: [{ ...passage, commentary: "い".repeat(5_000) }],
        conclusion: "う".repeat(5_000),
      }),
    );
    const result = await runCounsel({ consultation: "疲れた" });
    if (result.kind !== "ok") throw new Error("ok のはず");
    expect(result.preface?.length).toBeLessThanOrEqual(401);
    expect(result.passages[0].commentary.length).toBeLessThanOrEqual(1_201);
    expect(result.conclusion.length).toBeLessThanOrEqual(1_501);
  });

  it("命の危険を示す語は、AI を呼ばずに、固定の画面にする", async () => {
    expect(await runCounsel({ consultation: "もう死にたい" })).toEqual({ kind: "crisis" });
    expect(mocks.generateCounsel).not.toHaveBeenCalled();
  });

  it("「それでも続ける」なら、続けて答える。相談窓口の案内(showHelp)を添える", async () => {
    const result = await runCounsel({
      consultation: "死にたいくらい恥ずかしい",
      continueAnyway: true,
    });
    expect(result).toMatchObject({ kind: "ok", showHelp: true });
    expect(mocks.generateCounsel).toHaveBeenCalledTimes(1);
  });

  it("「それでも続ける」のときだけ、生成に、危機の文脈(crisisContext)を渡す", async () => {
    await runCounsel({ consultation: "死にたいくらい恥ずかしい", continueAnyway: true });
    expect(mocks.generateCounsel.mock.calls[0][1]).toMatchObject({ crisisContext: true });

    mocks.generateCounsel.mockClear();
    await runCounsel({ consultation: "仕事で疲れた" });
    expect(mocks.generateCounsel.mock.calls[0][1]).toMatchObject({ crisisContext: false });
  });

  it("他人を傷つけたい気持ちを示す語があるときは、画面は止めず(AI を呼ぶ)、harmContext を渡す", async () => {
    const result = await runCounsel({ consultation: "あいつぶっ殺してやる" });
    expect(result.kind).toBe("ok");
    expect(mocks.generateCounsel.mock.calls[0][1]).toMatchObject({
      harmContext: true,
      crisisContext: false,
    });

    mocks.generateCounsel.mockClear();
    await runCounsel({ consultation: "仕事で疲れた" });
    expect(mocks.generateCounsel.mock.calls[0][1]).toMatchObject({ harmContext: false });
  });

  it("命の危険を示す語があって「それでも続ける」のとき、命が失われることを語る節を含む箇所を、コードで外す", async () => {
    const withLoss = {
      reference: "詩篇 37:9-10",
      verses: [{ label: "9", text: "悪を行う者は断ち滅ぼされ、", core: true }],
      commentary: "x",
    };
    mocks.generateCounsel.mockResolvedValue(counsel({ passages: [withLoss, passage] }));

    const crisis = await runCounsel({ consultation: "消えたい", continueAnyway: true });
    if (crisis.kind !== "ok") throw new Error("ok のはず");
    expect(crisis.passages.map((p) => p.reference)).toEqual(["マタイによる福音書 6:19-21"]);

    // ふつうの相談では、外さない
    const normal = await runCounsel({ consultation: "仕事で疲れた" });
    if (normal.kind !== "ok") throw new Error("ok のはず");
    expect(normal.passages).toHaveLength(2);
  });

  it("外したあとに、使える箇所が1つも残らなければ、止まる(空の画面を出さない)", async () => {
    const withLoss = {
      reference: "詩篇 37:9",
      verses: [{ label: "9", text: "悪を行う者は断ち滅ぼされ、", core: true }],
      commentary: "x",
    };
    mocks.generateCounsel.mockResolvedValue(counsel({ passages: [withLoss] }));
    await expect(runCounsel({ consultation: "消えたい", continueAnyway: true })).rejects.toThrow(
      GenerationError,
    );
  });

  it("AI が、命に関わる内容だと判断したら、解説を出さず、固定の画面にする(補助の防御)", async () => {
    mocks.generateCounsel.mockResolvedValueOnce(counsel({ crisis: true }));
    expect(await runCounsel({ consultation: "もう限界で、何も考えられない" })).toEqual({
      kind: "crisis",
    });
  });

  it("全体の締め切り(signal)を、生成に渡す。なければ、渡さない", async () => {
    const controller = new AbortController();
    await runCounsel({ consultation: "疲れた" }, controller.signal);
    expect(mocks.generateCounsel.mock.calls[0][1]).toMatchObject({ signal: controller.signal });

    mocks.generateCounsel.mockClear();
    await runCounsel({ consultation: "疲れた" });
    expect(mocks.generateCounsel.mock.calls[0][1]).not.toHaveProperty("signal");
  });
});
