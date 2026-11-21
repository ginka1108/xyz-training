// claude.ai の Artifact として公開する用に、index.html から <html>/<head>/<body> の枠を外した版を dist/ に作る。
// 実行: node scripts/build-artifact.js
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const out = src
  .split('\n')
  .filter((line) => !/^\s*(<!doctype html>|<\/?html[^>]*>|<\/?head>|<\/?body>|<meta charset=|<meta name="viewport")/i.test(line))
  .join('\n');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), out);
console.log('dist/index.html を作成しました');
