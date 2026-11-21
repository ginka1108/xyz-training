// ニックネームの検査。
// 1. 使える文字と長さを絞る  2. 運営をかたる名前は断る
// 3. 禁止語に当たる名前は「シャドウ」：本人には見えるが、ほかの人には「名無しさん」と表示する
// 禁止語は、表記をそろえた後（全角半角・大文字小文字・カタカナ→ひらがな・記号除去）で判定する。

export const NAME_MAX = 10;
export const ANON = '名無しさん';

// ひらがな・カタカナ・漢字・英数字と、長音・中黒など少しの記号
const ALLOWED = /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z0-9ー・_\-々〆]+$/u;

/** 表示用の名前に整える（全角英数→半角など）。前後の空白は落とす */
export function cleanName(raw) {
  return String(raw ?? '').normalize('NFKC').trim();
}

/** 比較用のキー：大文字小文字・カタカナひらがな・記号の違いを無視する。名前の重複判定にも使う */
export function nameKey(name) {
  return cleanName(name)
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[ー・_\-\s]/g, '');
}

// 禁止語の判定用：よくある言い換え（数字→文字）もそろえる
function looseKey(key) {
  return key.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't');
}

// 運営をかたる名前（断る）。キーとして完全一致または含む
const RESERVED = ['名無しさん', '運営', '公式', '管理人', '管理者', 'admin', 'administrator', 'moderator', 'official', 'staff', 'xyzとれーにんぐ'];

// 名前のどこに含まれていても当てる禁止語（長めで、ふつうの言葉と誤爆しにくいもの）。
// 麻雀用語（ちんいつ・まんず・ちょんぼ など）を巻き込まないよう、短い断片は入れない。
const DENY_ANYWHERE = [
  // 性的
  'ちんこ', 'ちんぽ', 'まんこ', 'おまんこ', 'せっくす', 'ぺにす', 'くりとりす', 'ふぇら', 'おなにー', 'ぱいぱん', 'れいぷ', 'ちかん', '痴漢', '強姦', '性器',
  'fuck', 'pussy', 'penis', 'vagina', 'porno', 'boobs',
  // 差別・侮辱
  'きちがい', '基地外', '気違い', 'がいじ', '池沼', 'めくら', 'つんぼ', 'かたわ', 'じゃっぷ', 'ちゃんころ', '支那', 'ちょうせんじんしね',
  'nigger', 'nigga', 'faggot', 'retard', 'bitch', 'asshole',
  // 暴力
  '死ね', 'ころすぞ', '殺す', 'ぶっころ', '自殺',
];

// 名前全体がこれと一致したときだけ当てる禁止語（短く、部分一致だと誤爆するもの）
// 英語の短い語も、部分一致だと Sexton や Dickens のような名前を巻き込むのでここに置く
const DENY_EXACT = ['sex', 'sexy', 'porn', 'cock', 'dick', 'rape', 'shit', 'しね', 'ころす', 'うんこ', 'ちんちん', 'まんまん', 'えろ', 'ero', 'hentai', 'へんたい', 'くず', 'かす', 'ごみ'];

/**
 * 名前の検査。
 * 戻り値: { ok: true, name, key, hidden } または { ok: false, error }
 *   hidden=true は禁止語に当たったもの（シャドウ：ほかの人には名無しさんと表示）
 */
export function checkName(raw) {
  const name = cleanName(raw);
  const len = [...name].length;
  if (len === 0) return { ok: false, error: '名前を入力してください' };
  if (len > NAME_MAX) return { ok: false, error: `名前は${NAME_MAX}文字までです` };
  if (!ALLOWED.test(name)) return { ok: false, error: '使える文字は、ひらがな・カタカナ・漢字・英数字です' };
  const key = nameKey(name);
  if (!key) return { ok: false, error: '名前を入力してください' };
  if (RESERVED.some((w) => key.includes(nameKey(w)))) return { ok: false, error: 'その名前は使えません' };
  const loose = looseKey(key);
  const hidden =
    DENY_ANYWHERE.some((w) => key.includes(nameKey(w)) || loose.includes(nameKey(w))) ||
    DENY_EXACT.some((w) => key === nameKey(w) || loose === nameKey(w));
  return { ok: true, name, key, hidden };
}
