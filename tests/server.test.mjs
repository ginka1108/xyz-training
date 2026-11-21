// 実行: node tests/server.test.mjs
import assert from 'node:assert/strict';
import M from '../js/mahjong.js';
import Cert from '../js/cert.js';
import { checkName, nameKey } from '../server/names.mjs';
import { weekKey } from '../server/lib.mjs';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

test('名前：使える文字と長さ', () => {
  assert.equal(checkName('ぎんか').ok, true);
  assert.equal(checkName('ＧＩＮＫＡ１１').name, 'GINKA11'); // 全角→半角
  assert.equal(checkName('').ok, false);
  assert.equal(checkName('あいうえおかきくけこさ').ok, false); // 11文字
  assert.equal(checkName('a b').ok, false); // 空白
  assert.equal(checkName('🀄麻雀').ok, false); // 絵文字
  assert.equal(checkName('http://x').ok, false);
  assert.equal(checkName('a​b').ok, false); // 見えない文字
});

test('名前：運営をかたる名前は断る', () => {
  for (const n of ['運営', '公式アカ', 'Admin', 'ADMIN2', 'XYZトレーニング', '名無しさん']) assert.equal(checkName(n).ok, false, n);
});

test('名前：禁止語はシャドウ（登録はできるが hidden）', () => {
  for (const n of ['ちんこ', 'チンコ太郎', 'ｆｕｃｋ', 'FuCk', 'sh1t', 'しね', '死ね死ね', 'キチガイ']) {
    const c = checkName(n);
    assert.equal(c.ok, true, n);
    assert.equal(c.hidden, true, n);
  }
});

test('名前：麻雀用語などは誤爆しない', () => {
  const ok = ['チンイツ', 'ちんいつ大好き', '清一色', 'マンズ', '満貫', 'チョンボ', 'まんがん', '九蓮宝燈', '国士無双', 'カンチャン', 'ペンチャン', 'リーチ一発',
    '東風戦', '魂天', '西家', 'よしねこ', 'ちくわ', 'シャンテン', 'えろあ', 'ころすけ', 'くずもち', 'ごみの日', 'かすてら', 'Sexton', 'class', 'Dickens', 'grape', 'Shitake'];
  for (const n of ok) {
    const c = checkName(n);
    assert.equal(c.ok, true, n);
    assert.equal(c.hidden, false, n);
  }
});

test('名前：カタカナとひらがな、大文字小文字は同じ名前扱い', () => {
  assert.equal(nameKey('ギンカ'), nameKey('ぎんか'));
  assert.equal(nameKey('Ginka'), nameKey('ＧＩＮＫＡ'));
  assert.notEqual(nameKey('ぎんか'), nameKey('きんか'));
});

test('週の区切りは日本時間の月曜0時', () => {
  // 2026-11-23(月) 0:00 JST = 2026-11-22 15:00 UTC
  assert.equal(weekKey(Date.UTC(2026, 10, 22, 14, 59)), '2026-11-16');
  assert.equal(weekKey(Date.UTC(2026, 10, 22, 15, 0)), '2026-11-23');
});

test('問題パック：同じ番号なら同じ、10問ずつ、連続設問は同じ13枚', () => {
  for (let s = 0; s < 4; s++) {
    const a = M.generateChallengePack(s, 7), b = M.generateChallengePack(s, 7);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.equal(a.length, 10);
    if (M.CHALLENGE_SECTIONS[s].series) {
      for (const it of a) {
        const first = a.find((x) => x.seriesNo === it.seriesNo);
        assert.deepEqual(it.problem.hand, first.problem.hand);
        assert.ok(it.len >= 2 && it.len <= 5);
      }
    }
  }
  assert.notEqual(JSON.stringify(M.generateChallengePack(0, 1)), JSON.stringify(M.generateChallengePack(0, 2)));
});

test('採点：正解・部分点・不正解・時間切れ', () => {
  const sec1 = M.CHALLENGE_SECTIONS[0];
  const tm1 = M.RANKED_TIMING[1];
  const p = M.generateChallengePack(0, 3)[0].problem;
  const a = p.answers[0];
  // 速く正解 → 100
  assert.deepEqual(
    [M.gradeQuestion(p, sec1, tm1, { y: a.discard, z: a.waits, yTime: 2, zTime: 2 }).score, M.gradeQuestion(p, sec1, tm1, { y: a.discard, z: a.waits, yTime: 2, zTime: 2 }).result],
    [100, 'ok'],
  );
  // Y で 3秒超過 → −15
  assert.equal(M.gradeQuestion(p, sec1, tm1, { y: a.discard, z: a.waits, yTime: 8, zTime: 1 }).score, 85);
  // 待ちが違う（聴牌版は部分点なし）
  assert.equal(M.gradeQuestion(p, sec1, tm1, { y: a.discard, z: [], yTime: 1, zTime: 1 }).result, 'ng');
  // 時間切れ
  assert.equal(M.gradeQuestion(p, sec1, tm1, { y: a.discard, z: a.waits, yTime: 16, zTime: 1 }).result, 'ng');
  assert.equal(M.gradeQuestion(p, sec1, tm1, { y: null, z: [], yTime: 15, zTime: null, timeout: 'y' }).score, 0);
  // 聴牌しない牌
  const bad = [...p.hand, p.draw].find((t) => !p.answers.some((x) => x.discard === t));
  if (bad != null) assert.equal(M.gradeQuestion(p, sec1, tm1, { y: bad, z: [], yTime: 1, zTime: 0 }).result, 'ng');
  // 二向聴は部分点
  const sec2 = M.CHALLENGE_SECTIONS[2];
  const q = M.generateChallengePack(2, 3).find((it) => it.problem.answers[0].waits.length >= 2).problem;
  const b = q.answers[0];
  const g = M.gradeQuestion(q, sec2, M.RANKED_TIMING[2], { y: b.discard, z: b.waits.slice(1), yTime: 1, zTime: 1 });
  assert.equal(g.result, 'part');
  assert.equal(g.score, Math.round(100 * (b.waits.length - 1) / b.waits.length));
  // 二向聴連続は受け入れ最大のみ
  const sec3 = M.CHALLENGE_SECTIONS[3];
  const r = M.generateChallengePack(3, 3)[0].problem;
  const best = Math.max(...r.answers.map((x) => x.remaining));
  const notBest = r.answers.find((x) => x.remaining < best);
  if (notBest) assert.equal(M.gradeQuestion(r, sec3, M.RANKED_TIMING[2], { y: notBest.discard, z: notBest.waits, yTime: 1, zTime: 1 }).result, 'ng');
});

test('ランク用の採点設定はアプリの初期値と同じ', () => {
  assert.deepEqual(M.RANKED_TIMING[1], { yGrace: 5, yLimit: 15, yPenalty: 5, zBase: 3, zPerKind: 3, zLimit: 40, zPenalty: 3, minScore: 10 });
  assert.deepEqual(M.RANKED_TIMING[2], { yGrace: 8, yLimit: 25, yPenalty: 5, zBase: 5, zPerKind: 2, zLimit: 60, zPenalty: 3, minScore: 10 });
});

test('証明書：名前はエスケープされる・X の投稿リンク', () => {
  const html = Cert.certHTML({ id: 'abc234', name: '<b>x</b>', score: 3210, sections: [0, 1, 2, 3].map(() => ({ score: 800, marks: '○○○○○○○○△×' })), weekRank: 2, allRank: 5, createdAt: 0 });
  assert.ok(!html.includes('<b>x</b>'));
  assert.ok(html.includes('&lt;b&gt;'));
  const u = Cert.xIntentUrl({ id: 'abc234', score: 3210, weekRank: 2 });
  assert.ok(u.startsWith('https://x.com/intent/post?text='));
  assert.ok(decodeURIComponent(u).includes('https://xyz-training.pages.dev/c/abc234'));
});

console.log(`\n${passed} tests passed`);
