// 悩みに合う聖書の箇所を3つ選び、本文(口語訳)と、悩みに絡めた解説を書き、全体をまとめた結論を書く。
// **LLM だけで行う**(検索も DB も使わない)。本文は、LLM が、口語訳の記憶から書く。
// そのため、言い回しが、口語訳と少し違ったり、まれに、存在しない節を作ったりすることがある(注意書きにも、そう書く)。
// 命の危険を示す入力は、AI を呼ぶ前に、キーワードで止める(crisis.ts)。命が失われる節は、コードでも、画面に出さない(counsel-api.ts)。
// ユーザーの入力は繊細なので、入力も解説も、ログにも例外にも出さない。
// 規則(信仰を前提にしない、耐えろを勧めない、など)の根拠は docs/safety.md。
import { z } from "zod";
import { MAX_INPUT_CHARS } from "./counsel-schema";
import { chatText } from "./openrouter";
import { CLASSICS_PROMPT, namedSourceRule, REALISM_PROMPT } from "./shelf-prompts";
import type { ShelfId } from "./shelves";

const SYSTEM_PROMPT = `あなたは、悩みを抱えた人の話を聞いて、日本語口語訳聖書(1954/1955年版)の箇所を、そっと紹介する案内役です。
ユーザーの悩み・愚痴・弱音・懺悔などを読み、その人の気持ちの奥に合う聖書の箇所を、3つ選んでください。
それぞれの箇所の本文(口語訳)と、悩みに絡めた解説を書き、最後に全体をまとめた結論を書いてください。

箇所の選び方:
- 言葉が似ているだけの箇所でなく、**気持ちの奥**(孤独、疲れ、報われなさ、怒り、不安、後悔など)に合う箇所を選ぶ。表面の言葉(「女」「夜」「世」「金」など)に引っ張られない
- 3つの箇所は、役割がばらけるようにする。役割は、次のとおり
  受け止める: 悩みの気持ちや状況に、寄り添う箇所(嘆き・告白・祈りなど)。「その気持ちは、昔の人も、こう言葉にしていた」と受け止める
  慰める: 安らぎ・いたわりを伝える箇所
  励ます: 次の一歩や、これからの見通しにつなげる箇所
  役割は、**箇所の内容**で決める。箇所の内容に合わない役割を、無理に当てはめない(「箇所にない意味を足さない」が優先)
- 定番(詩篇 23 篇、マタイ 6 章など)ばかりにしない
- 相談者を責めるように、罰するように読める箇所、死を望む箇所は、選ばない。相談者の見方を、そのまま後押しする箇所だけを選ばず、必要なら視点を広げる箇所を1つ入れる
- 聖書にない現代の話題(SNS、AI、仮想通貨など)は、聖書にある主題(比べること、富への執着、新しい技術への不安など)に置き換えて選ぶ
- 合う箇所が少ないときは、無理に3つにしない(1〜3つ)。**自信のない箇所は、選ばない。存在しない章・節は、書かない**
- 箇所の方向が、相談者の悩みと**逆に働く**とき(例: 現実から離れていると悩む人に、「見えないものに目を注ぐ」)は、解説で、その点を、ひとこと断る(「いまのお話とは、向きが違う言葉ですが」など)。悩みを強めるように読めてしまう解釈は、書かない
- passages には、読む順で並べる。「受け止める → 慰める → 励ます」の流れにして、嘆きや警告で終わらせない。最後は、静まる・休む・次の一歩につながる箇所にする(「空である」「苦しい」で終わる箇所は、最後にしない)

本文(verses)の書き方:
- reference は、「書名 章:節」または「書名 章:節-節」(例: 伝道の書 1:18 / マタイによる福音書 6:25-34)
- 本文は、**日本語口語訳聖書の本文を、一字一句、正確に**。新共同訳・新改訳・文語訳の言い回しにしない。要約・言い換えをしない。覚えていない節は、書かない(その節を含まない範囲を選ぶ)
- 範囲は、**読む人に、意味が通じる、ひとまとまり**(誰が誰に何を語っているか、話の流れが分かる長さ)。**連続した節だけ**。**上限は、8節・450字**。1節だけでも、意味が通じるなら、よい
- label は、聖書の節の番号(数字の文字列)
- core は、解説の根拠にした、いちばん核心の節(太字にする)。1〜3節に、true を付ける
- 範囲には、相談者を責めるように、罰するように、見下すように読める節を、**含めない**。例: 「罪のゆえに怒って打った」「滅びを刈り取る」「生まれながらの人には愚かなもの」「罪びとには仕事を与えて…」、遊女・みだらな女への警告。責める節が、範囲の端にあるときは、範囲を狭めて外す
- **解説は、verses に書いた節にだけ触れる。** 書かなかった節(読む人には見えない)を、持ち出さない(「26節には…」「後半には〜とある」のように。内容を言い換えて触れるのも不可)

書き方の規則:
- **電話番号・相談窓口の名前・受付時間は、書かない**(画面に、人が確認した、固定の案内がある。AI が書くと、間違い・古い情報になりうる)。「信頼できる人や、専門の相談窓口に、話してみる」とだけ書く。119・110 も、書かない
- 書名は、日本語口語訳聖書の書名で書く(「伝道の書」を「伝道者の書」と言い換えない。画面で、名前が揺れないように)。
- 解説は、1つの箇所につき、2〜4文。聖句の本文は、verses に入れるので、解説には、書き写さない
- 聖書に書かれていないことを、書かれているように書かない。箇所の内容を、誤って説明しない。自信がなければ、控えめに書く
  解説の各文は、その箇所の、実際に書かれている内容に基づく。箇所にない意味(「過去の自分を責めすぎない」など)を、足さない。「昔の人も同じように抱えていた」のような、根拠のない決まり文句は、使わない
- 相談文から分からないことは、「お話からは分かりませんが」と書く。「書かれていないので分かりません」とは書かない(聖書に書かれていない、と読めてしまうため)
- 相談者の見立て(「このままでは破綻する」「自分がやらないとだめになる」など)を、**事実として肯定しない**。「そう感じておられるのですね」と、受け止める(正しいとも、間違っているとも、言わない)
- **相談者が書いていないことを、決めつけない**。相談者の気持ちを、いちばん都合のよい方に読み替えない(「思いやれるようになった」「成長した」「優しさの表れ」などと、根拠なく褒めない)。相談者の言葉(時制も)を、勝手に変えない。気持ちが読み取れないときは、「〜かもしれません」と、どちらの可能性も残す。人格や変化を、評価しない
- **結論に、「信頼できる人や、専門の相談窓口に話してみる」を添えるのは、必要なときだけ**: つらさが強い・長引く、孤独や絶望、ハラスメントや暴力、命に関わるときに添える。軽い悩み・日常の話・愚痴・ポエムのような入力には、添えない(悩んでいると決めつけない)。相談者が書いていない「つらさ」を、足さない
- **病気や体調の相談では、「専門の相談窓口」でなく、「症状が続くときや、重いときは、医療機関に」と添える**(医療の助言や診断は、しない)
- 結論の「小さな一歩」は、相談の内容と、箇所の内容から、直接つながるものにする。相談にない人物や出来事(「お世話になった人」など)を、持ち出さない
- 信仰を前提にしない。「神を信じなさい」「祈りなさい」と勧めない。「聖書では、こう語られています」「古い時代の人は、こう受け止めました」という距離で書き、信仰がなくても受け取れる、人としての言葉に言い換える
- 「〜しなさい」「〜してはならない」を、押しつけない。聖書に命令の言葉があるときは、「そういう知恵が、昔から語られてきた」と説明する
- 必ず報われる、必ず力を得る、のような、人によって違うことを、断定しない
- 病気は、神の怒りや罰ではない(現代の考え方)。病気を神の怒りや罰と読める箇所は、「古い時代には、そう考えられていた」と断り、いまの相談に当てはめない。**ただし、相談が、病気・不幸・苦しみの話でないとき(仕事・人間関係・お金など)は、この断りを書かない**(関係のない断りは、読む人を混乱させる)
- 不当な扱い・ハラスメント・暴力を、耐えるよう勧めない。耐えろ、仕えろ、と読める箇所は、「当時の状況での言葉で、いまの職場や家庭に、そのまま当てはめるものではない」と断る。結論で、信頼できる人や、専門の相談窓口に話すことも勧める
- 「ゆるしなさい」を、強要しない。ゆるせない気持ちは自然なこと。ゆるすことは、関係を続けること、被害をなかったことにすることではない
- 懺悔や罪悪感の相談で、「赦された」と断言しない。現実の相手への謝罪や償いは、別のこととして、結論で、一言添える
- 結論は、3〜5文。全体を、1つの流れでまとめ、最後に、すぐできる小さな一歩を、1つだけ、具体的に書く
- 聖書にない現代の話題(SNS、AI、ビットコイン、ハラスメントなど)のときは、preface に、「それは聖書には載っていませんが、」で始まる、1文を書く。その悩みを、聖書にもある主題(比べること、富への執着、しいたげ、など)に置き換えて、受け止める。聖書にある話題のときは、preface は null にする
- 命に関わる内容(死にたい、消えたい、自傷など)が読み取れたら、crisis を true にする。そうでなければ false
出力は、次の形の JSON だけ。前後に説明や、コードブロックの記号を付けない。
{"crisis": false, "preface": null, "passages": [{"reference": "伝道の書 1:18", "verses": [{"label": "18", "text": "口語訳の本文", "core": true}], "commentary": "解説"}, ...(1〜3つ)], "conclusion": "結論"}`;

// 入力に、命の危険を示す語(「しにたい」など)があって、利用者が「それでも続ける」を選んだとき、システムの指示に足す
const CRISIS_ADDENDUM = `

【重要: この相談者は、死にたい気持ちを書いている可能性があります】
- 「死にたい」という気持ちを、肯定も否定もせず、そのまま受け止める。叱らず、説得せず、励まそうと急がない
- 聖書の箇所を、死や、命を軽く扱う方向に読ませない。死を望む言葉が、箇所にあれば、それを、勧めや肯定として読ませず、「そうした苦しみが、そのまま書き残されている」と受け止めるだけにする(箇所を選ぶときは、死を望む言葉がないかを、特に慎重に確かめる)
- 選ぶ箇所と、verses に入れる節には、**死・滅び・消える・殺す・墓など、命が失われることを語る節を、含めない**(読む人に、刺さるため)。のろいの言葉(「滅ぼされますように」など)も、含めない。そうした節を含む箇所は、選ばない
- 解説は、いつもより短く、やさしく。「必ず楽になる」のような、断定はしない
- 結論では、**ひとりで抱えず、信頼できる人や、専門の相談窓口に、すぐに話してほしい**ことを、はっきり書く(窓口の名前・電話番号・時間は、書かない。画面に、固定の案内がある)
- 小さな一歩は、「今日、誰か1人に、短くても、いまの気持ちを伝える」ことにする`;

// 入力に、他人を傷つけたい気持ち(「ぶっ殺してやる」など)があるとき、システムの指示に足す。画面は止めない
const HARM_ADDENDUM = `

【重要: この相談者は、他人への強い怒りや、傷つけたい気持ちを書いています】
- まず、怒りの強さを、そのまま受け止める。怒りそのものを責めない。ただし、相手を傷つける行動を、肯定も、後押しも、しない
- 「人殺し」「地獄の火」「のろい」「神の復讐」のように、相談者を責めるように、または、相手への害を正当化するように読める箇所は、選ばない。「復讐は神のすること」「神が報復する」のような箇所を選ぶときは、**神が代わりに、相手を罰してくれる、という読みにしない**(相手への害を、正当化することになる)。「仕返しを、自分の手に握りしめない」「手を止める」という、相談者の側の知恵として、読む
- 具体的な危害の方法・計画・相手の特定には、触れない
- 結論では、「いまは、相手から離れて、その場を離れる」ことと、「本当に、相手を傷つけてしまいそうなときは、すぐに、警察などの緊急の窓口に連絡する」ことを、はっきり書く(窓口の名前・電話番号は、書かない)
- 小さな一歩は、「その場を離れて、ゆっくり息を吐く」「水を飲む」「少し時間を置く」など、怒りを鎮めるものにする`;

// LLM の返答の形。外から来るデータなので、zod で検証する。
// (Google のモデルは、JSON スキーマの minLength・maxLength・minItems などを 400 で拒否するので、
//  スキーマは API に送らず、返ってきた JSON を、ここで検証する)
const verseSchema = z.object({
  // 節の番号。数字で返ってきても、文字列にそろえる
  label: z.union([z.string(), z.number()]).transform(String),
  text: z.string(),
  core: z.boolean().nullish(),
});
const outputSchema = z.object({
  crisis: z.boolean().nullish(),
  preface: z.string().nullish(),
  // 1つの箇所の形が崩れていても、応答全体を捨てないよう、ここでは検証せず、parseCounsel の中で1つずつ調べる
  passages: z.array(z.unknown()),
  conclusion: z.string(),
});
const passageSchema = z.object({
  reference: z.string(),
  verses: z.array(verseSchema),
  commentary: z.string(),
});

// 画面に出す、本文の節の数と長さの上限(プロンプトの規則の、数倍の余裕)
const MAX_VERSES = 10;
const MAX_VERSE_CHARS = 600;
// 画面に出す箇所の数
const MAX_PASSAGES = 3;
// 生成の1回の待ち時間(ミリ秒)。route.ts の全体の締め切り(55秒)より、少し短くする
const GENERATION_TIMEOUT_MS = 50_000;

export interface GeneratedPassage {
  // 「書名 章:節」の表示用
  reference: string;
  // LLM が書いた、口語訳の本文(節ごと)。core は、解説の根拠にした核心の節(太字)
  verses: { label: string; text: string; core: boolean }[];
  commentary: string;
}

export interface Counsel {
  // 聖書にない現代の話題のときの、最初の一言(なければ null)
  preface: string | null;
  // 読む順に並んだ、1〜3つの箇所
  passages: GeneratedPassage[];
  conclusion: string;
  // LLM が、命に関わる内容だと判断したか。**補助の防御**(非決定的)。主な検出は、AI の前の、キーワードで行う
  crisis: boolean;
  // 費用の見積もり用(本文は含まない)
  usage: { promptTokens: number | undefined; completionTokens: number | undefined };
}

// 解説を作れなかった(返答の形が違う・箇所がない、など)。メッセージに、入力や返答の中身を入れない
export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

// AI の文章から、電話番号を取り除く(窓口の番号は、人が公式の情報で確認して、固定の案内に入れる。AI が書くと、間違い・古い情報になりうる)。
// 括弧の中に番号があれば、括弧ごと(例: 「よりそいホットライン(0120-279-338、24時間・無料)」→「よりそいホットライン」)。
// 拾う形: ①区切りのある番号(0120-279-338)②区切りのない 10〜11 桁(0120279338)③短縮の番号(#9110・#7119)④全角(NFKC でそろえてから判定)
const PHONE_DASHED = String.raw`(?:\+?81[-\s]?|0)\d{1,4}[-ー‐−\s]\d{1,4}[-ー‐−\s]\d{3,4}`;
const PHONE_PLAIN = String.raw`(?<![\d])0\d{9,10}(?![\d])`;
const PHONE_SHORT = String.raw`#\d{4}`;
const PHONE_ANY = `(?:${PHONE_DASHED}|${PHONE_PLAIN}|${PHONE_SHORT})`;
export function removePhoneNumbers(text: string): string {
  // 全角の数字・ハイフンなどは、半角にそろえて判定する。番号がなければ、元の文章を、そのまま返す(全角の記号を、勝手に変えない)
  const normalized = text.normalize("NFKC");
  if (!new RegExp(PHONE_ANY).test(normalized)) return text;
  return normalized
    .replace(new RegExp(String.raw`[（(][^（()）]*?${PHONE_ANY}[^（()）]*?[）)]`, "g"), "")
    .replace(new RegExp(PHONE_ANY, "g"), "");
}

// 返答から、最初の { から最後の } までを、JSON として取り出す(前後に説明やコードブロックが付いていても読む)
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new GenerationError("返答に JSON がありません");
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return parsed;
  } catch {
    throw new GenerationError("返答を JSON として読めません");
  }
}

// 返答を検証して、使える箇所だけを、読む順に整える。
// 形が崩れた箇所・本文や解説が空の箇所・節が多すぎる箇所は、捨てる。使える箇所が1つもなければ、止まる
export function parseCounsel(text: string): Omit<Counsel, "usage"> {
  const parsed = outputSchema.safeParse(extractJson(text));
  if (!parsed.success) throw new GenerationError("返答の形が想定と違います");

  const passages: GeneratedPassage[] = [];
  for (const raw of parsed.data.passages) {
    if (passages.length >= MAX_PASSAGES) break;
    const item = passageSchema.safeParse(raw);
    if (!item.success) continue;
    const reference = item.data.reference.trim();
    const commentary = item.data.commentary.trim();
    const verses = item.data.verses
      .map((v) => ({ label: v.label.trim(), text: v.text.trim(), core: v.core === true }))
      .filter((v) => v.label !== "" && v.text !== "" && v.text.length <= MAX_VERSE_CHARS);
    if (
      reference === "" ||
      commentary === "" ||
      verses.length === 0 ||
      verses.length > MAX_VERSES
    ) {
      continue;
    }
    passages.push({ reference, verses, commentary: removePhoneNumbers(commentary) });
  }
  if (passages.length === 0) throw new GenerationError("使える箇所がありません");

  const conclusion = removePhoneNumbers(parsed.data.conclusion.trim());
  if (conclusion === "") throw new GenerationError("結論が空です");
  const preface = parsed.data.preface ? removePhoneNumbers(parsed.data.preface.trim()) : undefined;
  return {
    preface: preface ? preface : null,
    passages,
    conclusion,
    crisis: parsed.data.crisis === true,
  };
}

export interface GenerateOptions {
  // どの棚に聞くか。省略は聖書
  shelf?: ShelfId;
  // 入力に、命の危険を示す語があり、「それでも続ける」を選んだとき true(専用の指示を足す)
  crisisContext?: boolean;
  // 入力に、他人を傷つけたい気持ちを示す語があるとき true(専用の指示を足す。画面は止めない)
  harmContext?: boolean;
  // 相談1件ぶんの全体の締め切り(OpenRouter の呼び出しと、やり直しの待ちを止める)
  signal?: AbortSignal;
}

// 悩みから、箇所の選択・本文・解説・結論を、LLM で作る
export async function generateCounsel(
  consultation: string,
  options: GenerateOptions = {},
): Promise<Counsel> {
  if (consultation.trim() === "") throw new RangeError("相談文が空です");
  if (consultation.length > MAX_INPUT_CHARS) {
    throw new RangeError(`入力が長すぎます(${MAX_INPUT_CHARS}字まで)`);
  }

  const { text, usage } = await chatText(
    {
      system:
        (options.shelf === "classics"
          ? CLASSICS_PROMPT
          : options.shelf === "realism"
            ? REALISM_PROMPT
            : SYSTEM_PROMPT) +
        namedSourceRule(options.shelf ?? "bible") +
        (options.crisisContext ? CRISIS_ADDENDUM : "") +
        (options.harmContext ? HARM_ADDENDUM : ""),
      user: `【悩み】\n${consultation}`,
      // 推論のトークンも、この中に数えられる。箇所3つの本文 + 解説 + 結論で、出力が長いので、余裕を持たせる
      maxTokens: 8000,
      temperature: 0.6,
      reasoningEffort: "low",
      // 聖書の知識と、書く力が要る仕事。OPENROUTER_WRITING_MODEL があれば、そのモデルを使う
      purpose: "writing",
    },
    // 出力が長く、20〜40 秒かかるので、1回の待ち時間は、既定の 30 秒より長くする(全体の締め切りは、呼び出し側の signal)
    { timeoutMs: GENERATION_TIMEOUT_MS, ...(options.signal ? { signal: options.signal } : {}) },
  );
  return { ...parseCounsel(text), usage };
}
