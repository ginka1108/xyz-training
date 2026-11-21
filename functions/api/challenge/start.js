// ランクチャレンジ開始：4モードそれぞれの問題パック番号を選んで渡す
import { M, json, fail, db, tokenHash, randomId } from '../../../server/lib.mjs';

export async function onRequestPost({ request, env }) {
  const th = await tokenHash(request);
  if (!th) return fail('端末の情報がありません', 401);
  const DB = await db(env);
  const n = M.CHALLENGE_PACKS;
  const r = crypto.getRandomValues(new Uint32Array(M.CHALLENGE_SECTIONS.length));
  const packs = [...r].map((x) => x % n);
  const id = randomId(16);
  await DB.prepare('INSERT INTO sessions (id, token_hash, packs, started_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(id, th, packs.join(','), Date.now())
    .run();
  return json({ id, version: M.CHALLENGE_VERSION, packs });
}
