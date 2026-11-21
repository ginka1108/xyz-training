// サーバー側の共通処理（Cloudflare Pages Functions から使う）
import M from '../js/mahjong.js';
import { ANON } from './names.mjs';

export { M };

// ---- 応答 -------------------------------------------------------------------

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function fail(error, status = 400) {
  return json({ error }, status);
}

// ---- データベース -----------------------------------------------------------
// 初回のリクエストで表を作る（Cloudflare の画面で SQL を流す手間をなくすため）

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS players (
    token_hash TEXT PRIMARY KEY,
    name TEXT,
    name_key TEXT UNIQUE,
    hidden INTEGER NOT NULL DEFAULT 0,
    banned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL,
    packs TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL,
    score INTEGER NOT NULL,
    time_ms INTEGER NOT NULL,
    sections TEXT NOT NULL,
    week TEXT NOT NULL,
    week_rank INTEGER,
    all_rank INTEGER,
    flagged INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS runs_week ON runs (week, score DESC, time_ms)`,
  `CREATE INDEX IF NOT EXISTS runs_token ON runs (token_hash)`,
];

let schemaReady = null;
export function db(env) {
  if (!env.DB) throw new Error('D1 データベースが DB という名前でつながっていません');
  if (!schemaReady) schemaReady = env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).catch((e) => { schemaReady = null; throw e; });
  return schemaReady.then(() => env.DB);
}

// ---- プレイヤー -------------------------------------------------------------

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** リクエストの X-Player-Token（端末ごとの合言葉）をハッシュにして返す。なければ null */
export async function tokenHash(request) {
  const t = request.headers.get('x-player-token') || '';
  if (!/^[0-9a-f]{32,128}$/.test(t)) return null;
  return sha256('xyz-player|' + t);
}

export function randomId(len = 10) {
  const abc = '23456789abcdefghjkmnpqrstuvwxyz'; // 見間違えやすい 0 1 i l o は使わない
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => abc[b % abc.length]).join('');
}

// ---- 週（日本時間の月曜0時に切り替え） --------------------------------------

/** その時刻が属する週の月曜日 "YYYY-MM-DD"（日本時間） */
export function weekKey(ms) {
  const d = new Date(ms + 9 * 3600 * 1000);
  const dow = (d.getUTCDay() + 6) % 7; // 月曜=0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

// ---- ランキング -------------------------------------------------------------
// 1人1件（その人の最高記録）。点数が高い順、同点なら回答時間の合計が短い順、さらに同じなら先に出した順。

const BEST = (whereWeek) => `
  WITH best AS (
    SELECT r.*, ROW_NUMBER() OVER (PARTITION BY r.token_hash ORDER BY r.score DESC, r.time_ms ASC, r.created_at ASC) AS rn
    FROM runs r JOIN players p ON p.token_hash = r.token_hash
    WHERE r.flagged = 0 AND p.banned = 0 AND p.name IS NOT NULL ${whereWeek ? 'AND r.week = ?1' : ''}
  )`;

/** 上位の一覧 */
export async function topList(DB, week, limit = 100) {
  const sql = `${BEST(!!week)}
    SELECT b.id, b.score, b.time_ms, b.sections, b.created_at, b.token_hash, p.name, p.hidden
    FROM best b JOIN players p ON p.token_hash = b.token_hash
    WHERE b.rn = 1 ORDER BY b.score DESC, b.time_ms ASC, b.created_at ASC LIMIT ${Number(limit)}`;
  const st = week ? DB.prepare(sql).bind(week) : DB.prepare(sql);
  return (await st.all()).results;
}

/** この記録が何位に相当するか（自分以外の人の最高記録と比べる） */
export async function rankOf(DB, week, run) {
  const sql = `${BEST(!!week)}
    SELECT COUNT(*) AS n FROM best b
    WHERE b.rn = 1 AND b.token_hash != ?2
      AND (b.score > ?3 OR (b.score = ?3 AND (b.time_ms < ?4 OR (b.time_ms = ?4 AND b.created_at < ?5))))`;
  const row = await DB.prepare(sql)
    .bind(week || '', run.token_hash, run.score, run.time_ms, run.created_at)
    .first();
  return (row ? row.n : 0) + 1;
}

/** 表示用の名前（シャドウの名前は本人以外には名無しさん） */
export function shownName(row, viewerHash, anon) {
  if (!row.name) return anon;
  if (row.hidden && row.token_hash !== viewerHash) return anon;
  return row.name;
}

// ---- 記録1件（成績証明書用） --------------------------------------------------

export async function loadRun(DB, id, viewerHash) {
  if (!/^[0-9a-z]{6,20}$/.test(id)) return null;
  const r = await DB.prepare(
    'SELECT r.*, p.name, p.hidden, p.banned FROM runs r LEFT JOIN players p ON p.token_hash = r.token_hash WHERE r.id = ?1',
  )
    .bind(id)
    .first();
  if (!r || r.banned) return null;
  return {
    id: r.id,
    name: shownName(r, viewerHash, ANON),
    score: r.score,
    timeMs: r.time_ms,
    sections: JSON.parse(r.sections),
    weekRank: r.week_rank,
    allRank: r.all_rank,
    createdAt: r.created_at,
    me: !!viewerHash && r.token_hash === viewerHash,
  };
}

