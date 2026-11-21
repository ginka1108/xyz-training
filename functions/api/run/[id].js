// 1つの記録（成績証明書用）
import { json, fail, db, tokenHash, loadRun } from '../../../server/lib.mjs';

export async function onRequestGet({ request, env, params }) {
  const DB = await db(env);
  const run = await loadRun(DB, String(params.id), await tokenHash(request));
  return run ? json(run) : fail('記録が見つかりません', 404);
}
