// 成績証明書の公開ページ /c/<記録ID>
// サーバーにある記録をそのまま表示するので、スクショよりも確かな証明になる。X に貼るとカードが出る。
import { db, loadRun } from '../../server/lib.mjs';
import Cert from '../../js/cert.js';

function page({ title, desc, url, body }) {
  const e = Cert.esc;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:url" content="${e(url)}">
<meta property="og:image" content="${Cert.SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="app cert-page">
${body}
</div>
</body>
</html>`;
}

export async function onRequestGet({ request, env, params }) {
  const DB = await db(env);
  const run = await loadRun(DB, String(params.id), null); // 公開ページはだれが見ても同じ表示
  if (!run) {
    return new Response(
      page({
        title: '記録が見つかりません｜XYZトレーニング',
        desc: '',
        url: Cert.SITE,
        body: `<p class="cert-missing">この成績証明書は見つかりませんでした。</p><a class="btn primary big" href="/">XYZトレーニングを開く</a>`,
      }),
      { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }
  const title = `${run.name}さんの成績証明書 ${run.score}/${Cert.MAX}点｜XYZトレーニング`;
  const desc = `ランクチャレンジ（4モード×10問）で ${run.score}点` + (run.weekRank ? `・今週${run.weekRank}位` : '') + '。Xを引いたらYを切ってZ待ち。';
  const body =
    Cert.certHTML(run) +
    `<p class="cert-verify">この証明書は XYZトレーニングのサーバーに保存された記録から表示しています。</p>` +
    `<a class="btn primary big" href="/">あなたもランクチャレンジに挑戦する</a>`;
  return new Response(page({ title, desc, url: Cert.certUrl(run.id), body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' },
  });
}
