// 公開用のファイルだけを site/ にまとめる（Cloudflare Pages の「ビルドコマンド」で実行される）
// 実行: node scripts/build-site.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'site');
const FILES = ['index.html', 'style.css', 'js/mahjong.js', 'js/app.js'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'js'), { recursive: true });
fs.mkdirSync(path.join(out, 'tiles'), { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(root, f), path.join(out, f));
const tiles = fs.readdirSync(path.join(root, 'tiles')).filter((f) => f.endsWith('.svg'));
for (const f of tiles) fs.copyFileSync(path.join(root, 'tiles', f), path.join(out, 'tiles', f));
if (tiles.length !== 34) throw new Error(`牌画像が34枚ではありません: ${tiles.length}`);
console.log(`site/ を作成しました（${FILES.length + tiles.length} ファイル）`);
