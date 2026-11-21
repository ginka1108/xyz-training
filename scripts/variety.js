// 問題のバリエーションを測る。
// 実行: node scripts/variety.js [問題数]
//
// 「形」= 萬・筒・索の入れ替えと、字牌の種類の入れ替えを同一視したときの (13枚, X) の組。
const M = require('../js/mahjong.js');

const N = Number(process.argv[2] || 20000);

function report(name, gen) {
  const seen = new Set();
  const waitKinds = new Map();
  let trivial = 0;
  let honorOnly = 0;
  let multi = 0;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const p = gen();
    seen.add(M.shapeKey(p.hand, p.draw));
    const most = Math.max(...p.answers.map((a) => a.waits.length));
    waitKinds.set(most, (waitKinds.get(most) || 0) + 1);
    if (M.isTrivial(p)) trivial++;
    if (p.answers.every((a) => a.discard >= 27)) honorOnly++;
    if (p.answers.length > 1) multi++;
  }
  const ms = (Date.now() - t0) / N;
  const pct = (v) => (100 * v / N).toFixed(1) + '%';
  const wk = [...waitKinds.entries()].sort((a, b) => a[0] - b[0])
    .map(([k, v]) => `${k}種 ${pct(v)}`).join(' / ');
  console.log(name);
  console.log(`  ${N}問中 ちがう形 ${seen.size}（重複 ${pct(N - seen.size)}）  ${ms.toFixed(2)}ms/問`);
  console.log(`  浮き牌を切るだけ ${pct(trivial)}　字牌を切るだけ ${pct(honorOnly)}　正解の切り方が複数 ${pct(multi)}`);
  console.log(`  待ちの種類数: ${wk}`);
}

report('ランダム', () => M.generateOneShantenProblem());

const t0 = Date.now();
for (let i = 0; i < 100; i++) M.generateSeries();
console.log(`連続設問  ${((Date.now() - t0) / 100).toFixed(1)}ms/セット`);
