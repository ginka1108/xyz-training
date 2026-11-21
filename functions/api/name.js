// 名前の登録・変更（端末の合言葉ごとに1つ）
import { json, fail, db, tokenHash } from '../../server/lib.mjs';
import { checkName } from '../../server/names.mjs';

export async function onRequestPost({ request, env }) {
  const th = await tokenHash(request);
  if (!th) return fail('端末の情報がありません', 401);
  let body;
  try { body = await request.json(); } catch (e) { return fail('送信内容が読めません'); }
  const c = checkName(body && body.name);
  if (!c.ok) return fail(c.error);
  const DB = await db(env);
  const taken = await DB.prepare('SELECT token_hash FROM players WHERE name_key = ?1').bind(c.key).first();
  if (taken && taken.token_hash !== th) return fail('その名前はほかの人が使っています', 409);
  const now = Date.now();
  await DB.prepare(
    `INSERT INTO players (token_hash, name, name_key, hidden, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
     ON CONFLICT(token_hash) DO UPDATE SET name = ?2, name_key = ?3, hidden = MAX(hidden, ?4), updated_at = ?5`,
  )
    .bind(th, c.name, c.key, c.hidden ? 1 : 0, now)
    .run();
  // シャドウ（hidden）でも本人にはふつうに登録できたように見せる
  return json({ name: c.name });
}

// 自分の名前を確認する
export async function onRequestGet({ request, env }) {
  const th = await tokenHash(request);
  if (!th) return json({ name: null });
  const DB = await db(env);
  const p = await DB.prepare('SELECT name FROM players WHERE token_hash = ?1').bind(th).first();
  return json({ name: p ? p.name : null });
}
