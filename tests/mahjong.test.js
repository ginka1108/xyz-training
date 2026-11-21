// 実行: node tests/mahjong.test.js
const assert = require('node:assert/strict');
const M = require('../js/mahjong.js');

// 表記 "123m456p789s11z" → 牌番号の配列
function parse(str) {
  const out = [];
  const re = /(\d+)([mpsz])/g;
  let m;
  while ((m = re.exec(str))) {
    const base = { m: 0, p: 9, s: 18, z: 27 }[m[2]];
    for (const d of m[1]) out.push(base + Number(d) - 1);
  }
  return out;
}
const names = (ts) => ts.map(M.tileName).join(' ');
const waitsOf = (s) => M.getWaits(M.listToCounts(parse(s)));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

test('両面待ち', () => assert.deepEqual(waitsOf('123m456p789s11z23m'), parse('14m')));
test('嵌張待ち', () => assert.deepEqual(waitsOf('123m456p789s11z13m'), parse('2m')));
test('シャンポン待ち', () => assert.deepEqual(waitsOf('123m456p789s11z22m'), parse('2m1z')));
test('単騎待ち', () => assert.deepEqual(waitsOf('123m456p789s111z5m'), parse('5m')));
test('ノベタン', () => assert.deepEqual(waitsOf('123p456p789s2345m'), parse('25m')));
test('三面張 23456', () => assert.deepEqual(waitsOf('123p789s11z23456m'), parse('147m')));
test('九蓮宝燈は9面待ち', () => assert.deepEqual(waitsOf('1112345678999m'), parse('123456789m')));
test('4枚使いの牌は待ちにしない', () =>
  assert.deepEqual(waitsOf('2222m123p456p789s'), []));
test('ノーテン', () => assert.deepEqual(waitsOf('1357m2468p13579s'), []));

test('切って聴牌になる牌の列挙', () => {
  const c = M.listToCounts(parse('123m456p789s11z235m'));
  const ans = M.tenpaiDiscards(c);
  const map = Object.fromEntries(ans.map((a) => [M.tileName(a.discard), names(a.waits)]));
  assert.equal(map['五萬'], '一萬 四萬');
  assert.equal(map['二萬'], '四萬');
  assert.equal(ans.length, 2); // 三萬切りは 1225萬 が残ってノーテン
});

test('採点: 猶予内は100点、超過で減点、下限あり', () => {
  const s = { yGrace: 3, yPenalty: 10, zPerKind: 3, zPenalty: 5, minScore: 10 };
  assert.equal(M.scoreQuestion(s, 2, 5, 2).score, 100);
  assert.equal(M.scoreQuestion(s, 4, 8, 2).score, 80);
  assert.equal(M.scoreQuestion(s, 10, 30, 1).score, 10);
  // 基本時間あり: 待ち2種 → 3 + 3×2 = 9秒まで減点なし
  const s2 = Object.assign({}, s, { zBase: 3 });
  assert.equal(M.scoreQuestion(s2, 2, 9, 2).score, 100);
  assert.equal(M.scoreQuestion(s2, 2, 11, 2).score, 90);
});

test('ランダム生成 300問: 13枚は一向聴、答えはすべて正しく聴牌', () => {
  let seed = 12345;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 300; i++) {
    const p = M.generateOneShantenProblem(rng);
    assert.equal(p.hand.length, 13);
    const c13 = M.listToCounts(p.hand);
    assert.ok(c13.every((n) => n <= 4));
    assert.equal(M.getWaits(c13).length, 0, '13枚が聴牌している');
    const c14 = M.listToCounts([...p.hand, p.draw]);
    assert.ok(c14[p.draw] <= 4);
    assert.ok(p.answers.length >= 1);
    for (const a of p.answers) {
      c14[a.discard]--;
      for (const w of a.waits) {
        c14[w]++;
        assert.ok(M.isAgari(c14));
        c14[w]--;
      }
      c14[a.discard]++;
    }
  }
});

test('連続設問 100セット: 同じ13枚で、Xごとに正解の切り方が変わる', () => {
  for (let i = 0; i < 100; i++) {
    const s = M.generateSeries();
    assert.ok(s.problems.length >= 3 && s.problems.length <= 5);
    const keys = new Set();
    for (const p of s.problems) {
      assert.deepEqual(p.hand, s.hand);
      const c14 = M.listToCounts([...p.hand, p.draw]);
      assert.ok(c14[p.draw] <= 4);
      // answers がこの14枚の聴牌打牌と一致している
      assert.deepEqual(p.answers, M.tenpaiDiscards(c14));
      assert.equal(p.answers.length, 1, '正解の切り方が1通りではない');
      keys.add(p.answers.map((a) => a.discard).join(','));
    }
    assert.equal(keys.size, s.problems.length, '正解の切り方が重複している');
  }
});

test('部分点: (当たり − 余計) ÷ 正解数', () => {
  const s = { yGrace: 3, yPenalty: 10, zBase: 0, zPerKind: 3, zPenalty: 5, minScore: 10 };
  const j = M.judgeWaits([1, 2, 3, 4], [1, 2, 3, 9]); // 3つ当たり、1つ余計
  const acc = M.zAccuracy(j, 4);
  assert.equal(acc, 0.5);
  assert.equal(M.scoreQuestion(s, 1, 1, 4, acc).score, 50);
  assert.equal(M.zAccuracy(M.judgeWaits([1, 2], [5, 6, 7]), 2), 0);
});

test('形のキー: 色や字牌の種類を入れ替えても同じ', () => {
  // 萬子と筒子を入れ替え、東を南に入れ替えた手牌
  const h1 = parse('1234m456p789s11z');
  const h2 = parse('1234p456m789s22z');
  assert.equal(M.shapeKey(h1, parse('5m')[0]), M.shapeKey(h2, parse('5p')[0]));
  assert.notEqual(M.shapeKey(h1, parse('5m')[0]), M.shapeKey(h1, parse('6m')[0]));
});

test('浮き牌を切るだけの問題は少なめ', () => {
  let trivial = 0;
  for (let i = 0; i < 2000; i++) if (M.isTrivial(M.generateOneShantenProblem())) trivial++;
  assert.ok(trivial / 2000 < 0.15, `浮き牌を切るだけ ${trivial / 20}%`);
});

test('シャンテン数: 基本形', () => {
  const sh = (s) => M.shanten(M.listToCounts(parse(s)));
  assert.equal(sh('123m456p789s11z234m'), -1); // 14枚の和了形
  assert.equal(sh('123m456p789s11z23m'), 0);   // 両面待ち
  assert.equal(sh('123m456p789s11z25m'), 1);   // 3面子+雀頭+浮き牌2枚
  assert.equal(sh('123m456p11z159m15s'), 3);   // 2面子+雀頭+浮き牌5枚
  assert.equal(sh('159m159p159s1234z'), 8);    // 面子も塔子もない
});

test('シャンテン数: 総当たりと一致（聴牌・一向聴の判定）', () => {
  const canAgari = (c) => {
    for (let w = 0; w < 34; w++) {
      if (c[w] >= 4) continue;
      c[w]++;
      const a = M.isAgari(c);
      c[w]--;
      if (a) return true;
    }
    return false;
  };
  for (let i = 0; i < 300; i++) {
    const p = M.generateTwoShantenProblem();
    const c = M.listToCounts(p.hand);
    assert.equal(M.shanten(c), 2);
    assert.equal(canAgari(c), false);
  }
});

test('二向聴版 300問: 13枚・X で一向聴・各切り方の受け入れが正しい', () => {
  for (let i = 0; i < 300; i++) {
    const p = M.generateTwoShantenProblem();
    assert.equal(p.hand.length, 13);
    const c14 = M.listToCounts([...p.hand, p.draw]);
    assert.ok(c14.every((v) => v <= 3), '4枚持ちの手は出さない');
    assert.equal(M.shanten(c14), 1);
    assert.ok(p.answers.length >= 1);
    for (const a of p.answers) {
      c14[a.discard]--;
      assert.equal(M.shanten(c14), 1);
      // 受け入れの牌はすべて聴牌に進み、それ以外の牌は進まない
      const set = new Set(a.waits);
      for (let w = 0; w < 34; w++) {
        if (c14[w] >= 4) continue;
        c14[w]++;
        assert.equal(M.shanten(c14) === 0, set.has(w));
        c14[w]--;
      }
      c14[a.discard]++;
    }
  }
});

test('二向聴の連続設問 50セット: 同じ13枚で、Xごとに受け入れ最大の切り方が1通りかつ互いに違う', () => {
  for (let i = 0; i < 50; i++) {
    const s = M.generateTwoShantenSeries();
    assert.ok(s.problems.length >= 3 && s.problems.length <= 5);
    assert.equal(M.shanten(M.listToCounts(s.hand)), 2);
    const bests = new Set();
    for (const p of s.problems) {
      assert.deepEqual(p.hand, s.hand);
      const c14 = M.listToCounts([...p.hand, p.draw]);
      assert.equal(M.shanten(c14), 1);
      assert.deepEqual(p.answers, M.keepShantenDiscards(c14, 1));
      const top = M.correctDiscards(p, 'max');
      assert.equal(top.length, 1, '受け入れ最大の切り方が1通りではない');
      bests.add(top[0].discard);
    }
    assert.equal(bests.size, s.problems.length, '受け入れ最大の切り方が重複している');
  }
});

test('生成速度', () => {
  const t0 = Date.now();
  for (let i = 0; i < 100; i++) M.generateOneShantenProblem();
  const ms = (Date.now() - t0) / 100;
  console.log('    1問あたり ' + ms.toFixed(1) + 'ms');
  assert.ok(ms < 100);
});

test('シード付き乱数：同じシードなら同じ列、違えば違う列', () => {
  const a = M.seededRng('abc'), b = M.seededRng('abc'), c = M.seededRng('abd');
  const xa = [], xb = [], xc = [];
  for (let i = 0; i < 100; i++) { xa.push(a()); xb.push(b()); xc.push(c()); }
  assert.deepEqual(xa, xb);
  assert.notDeepEqual(xa, xc);
  assert.ok(xa.every((v) => v >= 0 && v < 1));
});

test('日本時間の日付', () => {
  assert.equal(M.dailyDate(Date.UTC(2026, 10, 20, 14, 59)), '2026-11-20');
  assert.equal(M.dailyDate(Date.UTC(2026, 10, 20, 15, 0)), '2026-11-21');
});

test('今日の10問：同じ日付なら同じ問題、日付が違えば違う問題、日の中で形の重複なし', () => {
  const key = (s) => s.problems.map((p) => p.hand.join(',') + '/' + p.draw).join('|');
  for (const d of ['2026-11-21', '2026-11-22', '2027-01-01']) {
    const s1 = M.generateDailySet(d), s2 = M.generateDailySet(d);
    assert.equal(s1.problems.length, 10);
    assert.equal(key(s1), key(s2));
    const shapes = new Set(s1.problems.map((p) => M.shapeKey(p.hand, p.draw)));
    assert.equal(shapes.size, 10);
    for (const p of s1.problems) {
      const c = M.listToCounts([...p.hand, p.draw]);
      assert.deepEqual(M.tenpaiDiscards(c).map((a) => a.discard), p.answers.map((a) => a.discard));
    }
  }
  assert.notEqual(key(M.generateDailySet('2026-11-21')), key(M.generateDailySet('2026-11-22')));
});

console.log(`\n${passed} tests passed`);
