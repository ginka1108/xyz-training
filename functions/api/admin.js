// 管理用：X-Admin-Key ヘッダーに Cloudflare の環境変数 ADMIN_KEY と同じ値を入れたときだけ使える
//   { action: 'hide' | 'unhide' | 'ban' | 'unban', name }   名前を隠す / 戻す / その人を締め出す / 戻す
//   { action: 'deleteRun', runId }                          記録を1件消す
//   { action: 'list', limit }                               最近登録された名前の一覧
import { json, fail, db, sha256 } from '../../server/lib.mjs';
import { nameKey } from '../../server/names.mjs';

async function same(a, b) {
  // 長さや中身で処理時間が変わらないよう、ハッシュ同士で比べる
  return (await sha256('k|' + a)) === (await sha256('k|' + b));
}

export async function onRequestPost({ request, env }) {
  const key = request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || !key || !(await same(key, env.ADMIN_KEY))) return fail('権限がありません', 403);
  let b;
  try { b = await request.json(); } catch (e) { return fail('送信内容が読めません'); }
  const DB = await db(env);
  const byName = (sql) => DB.prepare(sql).bind(nameKey(b.name || '')).run();
  let r;
  switch (b.action) {
    case 'hide': r = await byName('UPDATE players SET hidden = 1 WHERE name_key = ?1'); break;
    case 'unhide': r = await byName('UPDATE players SET hidden = 0 WHERE name_key = ?1'); break;
    case 'ban': r = await byName('UPDATE players SET banned = 1 WHERE name_key = ?1'); break;
    case 'unban': r = await byName('UPDATE players SET banned = 0 WHERE name_key = ?1'); break;
    case 'deleteRun': r = await DB.prepare('DELETE FROM runs WHERE id = ?1').bind(String(b.runId || '')).run(); break;
    case 'list': {
      const rows = (await DB.prepare('SELECT name, hidden, banned, created_at FROM players ORDER BY created_at DESC LIMIT ?1').bind(Math.min(500, Number(b.limit) || 100)).all()).results;
      return json({ rows });
    }
    default: return fail('action が正しくありません');
  }
  return json({ changes: r.meta ? r.meta.changes : 0 });
}
