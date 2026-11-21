/* XYZトレーニング — 成績証明書の表示と共有文。画面（ブラウザ）と証明書ページ（サーバー）の両方で使う */
(function (root) {
  'use strict';

  const SITE = 'https://xyz-training.pages.dev';
  const SECTION_LABELS = ['聴牌ランダム', '聴牌連続', '二向聴ランダム', '二向聴連続'];
  const MAX = 4000;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  /** 日本時間の "2026/11/21 22:05" */
  function jstTime(ms) {
    const d = new Date(ms + 9 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  }

  function certUrl(id) {
    return `${SITE}/c/${id}`;
  }

  function rankText(r) {
    return r ? `<b>${r}位</b>` : '<span class="none">対象外</span>';
  }

  /**
   * 証明書の HTML。data: { id, name, score, sections: [{ score, marks }], weekRank, allRank, createdAt }
   */
  function certHTML(data) {
    const secs = data.sections
      .map(
        (s, i) =>
          `<div class="cert-sec"><div class="cert-sec-h"><span>${SECTION_LABELS[i]}</span><b>${s.score}</b></div>` +
          `<div class="cert-marks">${[...s.marks].map((m) => `<i class="${m === '○' ? 'ok' : m === '△' ? 'part' : 'ng'}">${m}</i>`).join('')}</div></div>`,
      )
      .join('');
    return (
      `<article class="cert">` +
      `<header class="cert-head"><span class="cert-brand">XYZトレーニング</span><span class="cert-kind">ランクチャレンジ 成績証明書</span></header>` +
      `<div class="cert-seal" aria-hidden="true">XYZ</div>` +
      `<div class="cert-name">${esc(data.name)}</div>` +
      `<div class="cert-score"><b>${data.score}</b><small>/ ${MAX}</small></div>` +
      `<div class="cert-ranks"><span>今週 ${rankText(data.weekRank)}</span><span>歴代 ${rankText(data.allRank)}</span><small>（達成時）</small></div>` +
      `<div class="cert-secs">${secs}</div>` +
      `<footer class="cert-foot"><span>${jstTime(data.createdAt)}</span><span>No. ${esc(data.id)}</span><span class="cert-url">${esc(certUrl(data.id).replace('https://', ''))}</span></footer>` +
      `</article>`
    );
  }

  /** X に投稿する文 */
  function shareText(data) {
    const rank = data.weekRank ? `（今週${data.weekRank}位）` : '';
    return `XYZトレーニングのランクチャレンジで ${data.score}/${MAX}点${rank}\n#XYZトレーニング`;
  }

  /** X の投稿画面を開く URL */
  function xIntentUrl(data) {
    return 'https://x.com/intent/post?text=' + encodeURIComponent(shareText(data)) + '&url=' + encodeURIComponent(certUrl(data.id));
  }

  const api = { SITE, SECTION_LABELS, MAX, esc, jstTime, certUrl, certHTML, shareText, xIntentUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cert = api;
})(typeof window !== 'undefined' ? window : globalThis);
