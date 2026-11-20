// 相談1件ぶんの処理(危機の検出 → 箇所の選択・本文・解説・結論を LLM で作る)と、画面に渡す形。
// API ルート(src/app/api/counsel/route.ts)から呼ぶ。ルートは、入力の検証と、エラーの変換だけにする。
// ユーザーの入力は繊細なので、入力も結果も、ログにも例外にも出さない。
import type { CounselRequestInput, CounselResponse, PassageView } from "./counsel-schema";
import { LIFE_LOSS_WORDS, detectCrisis, detectHarmToOthers } from "./crisis";
import { GenerationError, generateCounsel } from "./generate-counsel";

export { MAX_INPUT_CHARS, counselRequestSchema } from "./counsel-schema";

// 画面に出す、AI の文章の長さの上限(字)。プロンプトの規則(解説は2〜4文、結論は3〜5文)の、数倍の余裕。
// 相談文に「長く書け」と書かれて、AI が従っても、画面が、際限なく長くならないための、表示側の上限
const MAX_COMMENTARY_CHARS = 1_200;
const MAX_CONCLUSION_CHARS = 1_500;
const MAX_PREFACE_CHARS = 400;

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

// 命の危険を示す入力か(「それでも続ける」を選んでいなければ)。AI を呼ばない固定の画面にする入力。
// API の入口で、回数制限の**前**に判定する(数えず、上限でも止めない。限度に達した人にも、案内が届くように)
export function isCrisisInput(request: CounselRequestInput): boolean {
  return !request.continueAnyway && detectCrisis(request.consultation);
}

export async function runCounsel(
  request: CounselRequestInput,
  signal?: AbortSignal,
): Promise<CounselResponse> {
  const { consultation } = request;

  // 1. 命の危険を示す語は、AI を呼ぶ前に、キーワードで止める
  const keywordHit = detectCrisis(consultation);
  if (keywordHit && !request.continueAnyway) return { kind: "crisis" };

  // 2. 箇所の選択・本文・解説・結論(LLM)
  // 命の危険を示す語があって、「それでも続ける」を選んだときは、専用の指示を足す(死を望む箇所を、勧めに読ませない など)。
  // 他人を傷つけたい気持ちを示す語があるときは、画面は止めずに、専用の指示を足す(神が代わりに罰する、と読ませない など)
  const counsel = await generateCounsel(consultation, {
    ...(signal ? { signal } : {}),
    shelf: request.shelf ?? "bible",
    crisisContext: keywordHit,
    harmContext: detectHarmToOthers(consultation),
  });

  // 補助の防御: AI が、命に関わる内容だと判断したら、解説を出さずに、固定の画面にする
  if (counsel.crisis && !request.continueAnyway) return { kind: "crisis" };

  // 命の危険を示す語があって「それでも続ける」を選んだときは、命が失われることを語る節(滅び・消える・殺す など)を含む箇所を、
  // コードでも外す(プロンプトの頼みだけに、任せない)
  const usable = keywordHit
    ? counsel.passages.filter((p) => !p.verses.some((v) => LIFE_LOSS_WORDS.test(v.text)))
    : counsel.passages;
  if (usable.length === 0) throw new GenerationError("使える箇所がありません");

  const passages = usable.map((passage): PassageView => ({
    reference: passage.reference,
    // LLM が書いた本文は、すべて、画面に出す(引用の範囲を、あとから切らない)。全文を開く、の折りたたみは、出ない
    verses: passage.verses.map((v) => ({
      label: v.label,
      text: v.text,
      inQuote: true,
      core: v.core,
    })),
    commentary: clip(passage.commentary, MAX_COMMENTARY_CHARS),
  }));

  return {
    kind: "ok",
    preface: counsel.preface === null ? null : clip(counsel.preface, MAX_PREFACE_CHARS),
    passages,
    conclusion: clip(counsel.conclusion, MAX_CONCLUSION_CHARS),
    showHelp: keywordHit || counsel.crisis,
  };
}
