// 動画で使う問題を mahjong.js から作って src/data.json に書き出す（シード固定）
// 実行: node video/make-data.js
const fs = require('fs');
const path = require('path');
const M = require('../js/mahjong.js');

// 聴牌版：正解の切り方が1つで、待ちが3種の問題
let one = null;
for (let i = 0; !one; i++) {
  const p = M.generateOneShantenProblem(M.seededRng('video-one-' + i));
  if (p.answers.length === 1 && p.answers[0].waits.length === 3) one = p;
}

// 連続設問：3問
let series = null;
for (let i = 0; !series; i++) {
  const s = M.generateSeries(M.seededRng('video-series-' + i), { minLen: 3, maxLen: 3 });
  if (s && s.problems.length === 3) series = s;
}

// 二向聴：受け入れ最大の切り方が1つで、受け入れ 7〜9種
let two = null;
for (let i = 0; !two; i++) {
  const p = M.generateTwoShantenProblem(M.seededRng('video-two-' + i));
  const best = M.correctDiscards(p, 'max');
  if (best.length === 1 && best[0].waits.length >= 7 && best[0].waits.length <= 9) two = { ...p, best: best[0] };
}

const codes = (ts) => ts.map(M.tileCode);
const out = {
  one: { hand: codes(one.hand), draw: M.tileCode(one.draw), y: M.tileCode(one.answers[0].discard), waits: codes(one.answers[0].waits) },
  series: {
    hand: codes(series.hand),
    steps: series.problems.map((p) => ({ draw: M.tileCode(p.draw), y: M.tileCode(p.answers[0].discard), waits: codes(p.answers[0].waits) })),
  },
  two: { hand: codes(two.hand), draw: M.tileCode(two.draw), y: M.tileCode(two.best.discard), waits: codes(two.best.waits) },
};
fs.writeFileSync(path.join(__dirname, 'src/data.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
