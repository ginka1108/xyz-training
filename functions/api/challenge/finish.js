// ランクチャレンジ終了：答えと時間を受け取り、サーバーで採点し直して記録する（点数はブラウザから受け取らない）
import { M, json, fail, db, tokenHash, randomId, weekKey, rankOf } from '../../../server/lib.mjs';

const LIMIT_MS = 60 * 60 * 1000; // 開始から60分以内
const SLACK_S = 5; // 通信などのゆとり（秒）

export async function onRequestPost({ request, env }) {
  const th = await tokenHash(request);
  if (!th) return fail('端末の情報がありません', 401);
  let body;
  try { body = await request.json(); } catch (e) { return fail('送信内容が読めません'); }
  const { id, answers } = body || {};
  const total = M.CHALLENGE_SECTIONS.length * M.CHALLENGE_PER_SECTION;
  if (typeof id !== 'string' || !Array.isArray(answers) || answers.length !== total) return fail('送信内容が正しくありません');

  const DB = await db(env);
  const now = Date.now();
  const ses = await DB.prepare('SELECT * FROM sessions WHERE id = ?1').bind(id).first();
  if (!ses || ses.token_hash !== th) return fail('この挑戦は見つかりません', 404);
  if (ses.done) return fail('この挑戦はもう記録済みです', 409);
  if (now - ses.started_at > LIMIT_MS) return fail('開始から60分を過ぎたため記録できません', 410);
  // 1回しか使えないように、先に「済み」にする
  const mark = await DB.prepare('UPDATE sessions SET done = 1 WHERE id = ?1 AND done = 0').bind(id).run();
  if (!mark.meta || mark.meta.changes !== 1) return fail('この挑戦はもう記録済みです', 409);

  // 問題パックを読む（静的ファイル）
  const [ver, list] = ses.packs.includes(':') ? ses.packs.split(':') : ['v1', ses.packs];
  if (ver !== M.CHALLENGE_VERSION) return fail('問題の作り方が更新されたため、この挑戦は記録できません。もう一度挑戦してください', 410);
  const packs = list.split(',').map(Number);
  const items = [];
  for (let s = 0; s < packs.length; s++) {
    const url = new URL(`/packs/${M.CHALLENGE_VERSION}/${s}/${packs[s]}.json`, request.url);
    const res = await env.ASSETS.fetch(url);
    if (!res.ok) return fail('問題を読み込めませんでした', 500);
    for (const it of await res.json()) items.push({ section: s, problem: it });
  }

  // 採点し直す
  let score = 0;
  let timeS = 0;
  let flagged = 0;
  const sections = M.CHALLENGE_SECTIONS.map(() => ({ score: 0, marks: '' }));
  for (let i = 0; i < total; i++) {
    const a = answers[i] || {};
    const sec = M.CHALLENGE_SECTIONS[items[i].section];
    const tm = M.RANKED_TIMING[sec.shanten];
    const ans = {
      y: Number.isInteger(a.y) ? a.y : null,
      z: Array.isArray(a.z) ? a.z.slice(0, 34) : [],
      yTime: Number(a.yt),
      zTime: a.zt == null ? null : Number(a.zt),
      timeout: a.to === 'y' || a.to === 'z' ? a.to : null,
    };
    const g = M.gradeQuestion(items[i].problem, sec, tm, ans);
    score += g.score;
    const so = sections[items[i].section];
    so.score += g.score;
    so.marks += g.result === 'ok' ? '○' : g.result === 'part' ? '△' : '×';
    const yt = Number.isFinite(ans.yTime) ? Math.max(0, ans.yTime) : tm.yLimit;
    const zt = Number.isFinite(ans.zTime) ? Math.max(0, ans.zTime) : 0;
    timeS += yt + zt;
    // ありえないほど速い答え（人の反応では無理な速さ）はランキングから外す
    if (g.result !== 'ng' && (yt < 0.3 || zt < 0.1 * Math.max(1, ans.z.length))) flagged = 1;
  }
  // 申告された回答時間の合計が、実際に経過した時間より長いのはおかしい
  if (timeS > (now - ses.started_at) / 1000 + SLACK_S) return fail('時間の記録が合わないため記録できません');

  const run = {
    id: randomId(10),
    token_hash: th,
    score,
    time_ms: Math.round(timeS * 1000),
    created_at: now,
  };
  const week = weekKey(now);
  const weekRank = flagged ? null : await rankOf(DB, week, run);
  const allRank = flagged ? null : await rankOf(DB, null, run);
  await DB.prepare(
    'INSERT INTO runs (id, token_hash, score, time_ms, sections, week, week_rank, all_rank, flagged, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)',
  )
    .bind(run.id, th, score, run.time_ms, JSON.stringify(sections), week, weekRank, allRank, flagged, now)
    .run();
  const player = await DB.prepare('SELECT name FROM players WHERE token_hash = ?1').bind(th).first();
  return json({
    id: run.id,
    score,
    timeMs: run.time_ms,
    sections,
    weekRank,
    allRank,
    flagged: !!flagged,
    createdAt: now,
    name: player ? player.name : null,
  });
}
