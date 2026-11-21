// ランキング：?period=week（今週）または all（歴代）
import { json, db, tokenHash, weekKey, topList, shownName } from '../../server/lib.mjs';
import { ANON } from '../../server/names.mjs';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') === 'all' ? 'all' : 'week';
  const th = await tokenHash(request);
  const DB = await db(env);
  const week = period === 'week' ? weekKey(Date.now()) : null;
  const rows = await topList(DB, week, 100);
  return json({
    period,
    week,
    rows: rows.map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: shownName(r, th, ANON),
      score: r.score,
      timeMs: r.time_ms,
      sections: JSON.parse(r.sections).map((s) => s.score),
      me: !!th && r.token_hash === th,
    })),
  });
}
