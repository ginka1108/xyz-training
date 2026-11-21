// 動画で使う文字だけのフォントを Google Fonts から取ってくる。文言を変えたら chars に足して再実行
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const chars = 'XYZトレーニングを引いたら切って待ち今日の問二向聴同じ枚決定0123456789/○△× .-abcdefghijklmnopqrstuvwxyz';
for (const [fam, out] of [['Dela+Gothic+One', 'display'], ['Zen+Kaku+Gothic+New:wght@700', 'body']]) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${fam}&text=${encodeURIComponent(chars)}`, { headers: { 'User-Agent': UA } })).text();
  const src = css.match(/url\((https:[^)]+)\)/)[1];
  const buf = Buffer.from(await (await fetch(src, { headers: { 'User-Agent': UA } })).arrayBuffer());
  writeFileSync(`public/fonts/${out}.woff2`, buf);
  console.log(out, buf.length);
}
