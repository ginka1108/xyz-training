// バグ報告を受け取る。報告はほかの人には見えない（管理用の reports で見る）
import { json, fail, db, tokenHash, randomId } from '../../server/lib.mjs';

const REPORT_KINDS = ['judge', 'display', 'stuck', 'other'];
const COMMENT_MAX = 200;
const CONTEXT_MAX = 8000;     // 自動で付ける情報（手牌・端末・エラー）の上限（文字数）
const PER_HOUR = 10;          // 1台から1時間に送れる件数

export async function onRequestPost({ request, env }) {
  const th = await tokenHash(request);
  if (!th) return fail('端末の情報がありません', 401);
  let b;
  try { b = await request.json(); } catch (e) { return fail('送信内容が読めません'); }
  const kind = String(b && b.kind);
  if (!REPORT_KINDS.includes(kind)) return fail('種類を選んでください');
  const comment = String((b && b.comment) || '').normalize('NFKC').trim();
  if ([...comment].length > COMMENT_MAX) return fail(`コメントは${COMMENT_MAX}文字までです`);
  if (kind === 'other' && !comment) return fail('「その他」のときは内容を書いてください');
  const context = JSON.stringify((b && b.context) || {});
  if (context.length > CONTEXT_MAX) return fail('送信内容が大きすぎます');

  const DB = await db(env);
  const now = Date.now();
  const recent = await DB.prepare('SELECT COUNT(*) AS n FROM reports WHERE token_hash = ?1 AND created_at > ?2')
    .bind(th, now - 3600 * 1000)
    .first();
  if (recent && recent.n >= PER_HOUR) return fail('短い時間に送れる件数を超えました。しばらくしてから送ってください', 429);

  const id = randomId(8);
  await DB.prepare('INSERT INTO reports (id, token_hash, kind, comment, context, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(id, th, kind, comment, context, now)
    .run();
  return json({ id });
}
