// 公開用のファイルを site/ にまとめる（Cloudflare Pages の「ビルドコマンド」で実行される）
// 実行: node scripts/build-site.js        （ランクチャレンジの問題パックも作る。1分ほど）
//       node scripts/build-site.js --quick （パックは各モード20個だけ。手元の確認用）
const fs = require('fs');
const path = require('path');
const M = require('../js/mahjong.js');

const root = path.join(__dirname, '..');
const out = path.join(root, 'site');
const FILES = ['index.html', 'style.css', 'og.png', 'js/mahjong.js', 'js/app.js', 'js/cert.js'];
const quick = process.argv.includes('--quick');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'js'), { recursive: true });
fs.mkdirSync(path.join(out, 'tiles'), { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(root, f), path.join(out, f));
const tiles = fs.readdirSync(path.join(root, 'tiles')).filter((f) => f.endsWith('.svg'));
for (const f of tiles) fs.copyFileSync(path.join(root, 'tiles', f), path.join(out, 'tiles', f));
if (tiles.length !== 34) throw new Error(`牌画像が34枚ではありません: ${tiles.length}`);

// ランクチャレンジの問題パック: site/packs/<版>/<モード>/<番号>.json
const packs = quick ? 20 : M.CHALLENGE_PACKS;
const t0 = Date.now();
for (let s = 0; s < M.CHALLENGE_SECTIONS.length; s++) {
  const dir = path.join(out, 'packs', M.CHALLENGE_VERSION, String(s));
  fs.mkdirSync(dir, { recursive: true });
  for (let n = 0; n < packs; n++) {
    const items = M.generateChallengePack(s, n).map((it) => ({
      hand: it.problem.hand,
      draw: it.problem.draw,
      answers: it.problem.answers,
      seriesNo: it.seriesNo,
      idx: it.idx,
      len: it.len,
    }));
    fs.writeFileSync(path.join(dir, n + '.json'), JSON.stringify(items));
  }
}
console.log(`site/ を作成しました（問題パック ${packs}×${M.CHALLENGE_SECTIONS.length}、${((Date.now() - t0) / 1000).toFixed(1)}秒）`);
