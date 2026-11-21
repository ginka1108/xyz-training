/*
 * XYZトレーニング — 麻雀ロジック
 *
 * 牌の番号 (0〜33)
 *   0〜8   : 1m〜9m (萬子)
 *   9〜17  : 1p〜9p (筒子)
 *   18〜26 : 1s〜9s (索子)
 *   27〜33 : 東 南 西 北 白 發 中
 *
 * 手牌は「牌の種類ごとの枚数」34要素の配列 (counts) で扱う。
 * 和了形は通常形 (4面子1雀頭) のみ。七対子・国士無双は対象外。
 */
(function (root) {
  'use strict';

  const SUITS = ['m', 'p', 's', 'z'];
  const HONOR_NAMES = ['東', '南', '西', '北', '白', '發', '中'];
  const NUM_KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

  /** 牌番号 → 画像ファイル名 ("1m" など) */
  function tileCode(t) {
    return (t % 9 + 1) + SUITS[Math.floor(t / 9)];
  }

  /** 牌番号 → 読みやすい名前 ("一萬" "5筒" "東" など) */
  function tileName(t) {
    if (t >= 27) return HONOR_NAMES[t - 27];
    const n = t % 9;
    if (t < 9) return NUM_KANJI[n] + '萬';
    if (t < 18) return (n + 1) + '筒';
    return (n + 1) + '索';
  }

  function emptyCounts() {
    return new Array(34).fill(0);
  }

  function countsToList(c) {
    const out = [];
    for (let t = 0; t < 34; t++) for (let k = 0; k < c[t]; k++) out.push(t);
    return out;
  }

  function listToCounts(list) {
    const c = emptyCounts();
    for (const t of list) c[t]++;
    return c;
  }

  // ---- 和了判定 ------------------------------------------------------------

  /** 雀頭を抜いた残りがすべて面子に分解できるか */
  function decomposeMentsu(c) {
    let i = 0;
    while (i < 34 && c[i] === 0) i++;
    if (i === 34) return true;
    // 一番小さい牌は、刻子か順子の先頭のどちらかで使うしかない
    if (c[i] >= 3) {
      c[i] -= 3;
      const ok = decomposeMentsu(c);
      c[i] += 3;
      if (ok) return true;
    }
    if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--;
      const ok = decomposeMentsu(c);
      c[i]++; c[i + 1]++; c[i + 2]++;
      if (ok) return true;
    }
    return false;
  }

  /** 14枚 (3n+2枚) が通常形の和了形か */
  function isAgari(c) {
    for (let p = 0; p < 34; p++) {
      if (c[p] < 2) continue;
      c[p] -= 2;
      const ok = decomposeMentsu(c);
      c[p] += 2;
      if (ok) return true;
    }
    return false;
  }

  /**
   * 13枚 (3n+1枚) の待ち牌一覧。
   * 自分の手牌で4枚使い切っている牌は待ちに含めない (空聴扱い)。
   */
  function getWaits(c) {
    const waits = [];
    for (let w = 0; w < 34; w++) {
      if (c[w] >= 4) continue;
      c[w]++;
      if (isAgari(c)) waits.push(w);
      c[w]--;
    }
    return waits;
  }

  // ---- シャンテン数 --------------------------------------------------------

  /**
   * 通常形 (4面子1雀頭) のシャンテン数。13枚なら 0=聴牌、14枚なら -1=和了。
   * 面子・塔子・雀頭の取り方を全通り探して 8 - 2×面子 - 塔子 - 雀頭 の最小を取る
   * (面子+塔子は4つまで)。
   */
  function shanten(c) {
    let best = 8;
    function dfs(i, m, t, p) {
      while (i < 34 && c[i] === 0) i++;
      if (i >= 34) {
        const s = 8 - 2 * m - Math.min(t, 4 - m) - p;
        if (s < best) best = s;
        return;
      }
      // これ以上どう取っても best を下回れないなら打ち切る。
      // 残りの牌1枚あたりの改善は最大 2/3（面子3枚で −2）なので、改善の上限は floor(2×残り枚数/3)。
      let rest = 0;
      for (let k = i; k < 34; k++) rest += c[k];
      const now = 8 - 2 * m - Math.min(t, 4 - m) - p;
      if (now - Math.floor((2 * rest) / 3) >= best) return;

      if (c[i] >= 3) { c[i] -= 3; dfs(i, m + 1, t, p); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) {
        c[i]--; c[i + 1]--; c[i + 2]--;
        dfs(i, m + 1, t, p);
        c[i]++; c[i + 1]++; c[i + 2]++;
      }
      if (c[i] >= 2) {
        c[i] -= 2;
        if (!p) dfs(i, m, t, 1);
        dfs(i, m, t + 1, p);
        c[i] += 2;
      }
      if (i < 27 && i % 9 <= 7 && c[i + 1]) {
        c[i]--; c[i + 1]--; dfs(i, m, t + 1, p); c[i]++; c[i + 1]++;
      }
      if (i < 27 && i % 9 <= 6 && c[i + 2]) {
        c[i]--; c[i + 2]--; dfs(i, m, t + 1, p); c[i]++; c[i + 2]++;
      }
      c[i]--; dfs(i, m, t, p); c[i]++; // 孤立牌として使わない
    }
    dfs(0, 0, 0, 0);
    return best;
  }

  /**
   * 受け入れ: 13枚に足すとシャンテン数が進む牌の一覧。
   * 自分の手牌で4枚使っている牌は含めない。
   */
  function getUkeire(c13) {
    const base = shanten(c13);
    const out = [];
    for (let w = 0; w < 34; w++) {
      if (c13[w] >= 4) continue;
      c13[w]++;
      if (shanten(c13) < base) out.push(w);
      c13[w]--;
    }
    return out;
  }

  /**
   * 14枚から1枚切って target シャンテンを保つ切り方をすべて返す。
   * 戻り値の waits は「受け入れ」（target=0 なら待ち牌そのもの）。
   */
  function keepShantenDiscards(c14, target) {
    const out = [];
    for (let d = 0; d < 34; d++) {
      if (c14[d] === 0) continue;
      c14[d]--;
      if (shanten(c14) === target) {
        const waits = getUkeire(c14);
        out.push({ discard: d, waits, remaining: remainingCount(c14, waits) });
      }
      c14[d]++;
    }
    return out;
  }

  /** 待ち牌の残り枚数 (自分の手牌だけを見えている牌として数える) */
  function remainingCount(c13, waits) {
    let n = 0;
    for (const w of waits) n += 4 - c13[w];
    return n;
  }

  /**
   * 14枚から1枚切って聴牌になる切り方をすべて返す。
   * [{ discard, waits, remaining }] (discard は牌番号、牌の種類ごとに1つ)
   */
  function tenpaiDiscards(c14) {
    const out = [];
    for (let d = 0; d < 34; d++) {
      if (c14[d] === 0) continue;
      c14[d]--;
      const waits = getWaits(c14);
      if (waits.length > 0) {
        out.push({ discard: d, waits, remaining: remainingCount(c14, waits) });
      }
      c14[d]++;
    }
    return out;
  }

  // ---- 問題生成 ------------------------------------------------------------

  function randInt(rng, n) {
    return Math.floor(rng() * n);
  }

  /** 手牌にある数牌から1枚ランダムに選ぶ（なければ -1） */
  function randomNumberTileInHand(rng, c) {
    const list = [];
    for (let t = 0; t < 27; t++) if (c[t] > 0) list.push(t);
    return list.length ? list[randInt(rng, list.length)] : -1;
  }

  /**
   * 面子1つの置き場所を決める。
   * near >= 0 なら、その牌と同じ色の近く (±2) に置く → 345+456 や 5556 のような複合形ができる。
   */
  function pickMentsu(rng, opts, near) {
    if (near >= 0) {
      const s = Math.floor(near / 9) * 9;
      const n = near % 9;
      if (rng() < opts.sequenceRate) {
        const lo = Math.max(0, n - 2);
        const hi = Math.min(6, n + 2);
        return { type: 'seq', t: s + lo + randInt(rng, hi - lo + 1) };
      }
      const m = Math.min(8, Math.max(0, n + randInt(rng, 5) - 2));
      return { type: 'pon', t: s + m };
    }
    if (rng() < opts.sequenceRate) {
      return { type: 'seq', t: randInt(rng, 3) * 9 + randInt(rng, 7) };
    }
    return { type: 'pon', t: rng() < opts.honorRate ? 27 + randInt(rng, 7) : randInt(rng, 27) };
  }

  /** 枚数制限 (各牌4枚) を守って和了形14枚をランダムに作る */
  function randomCompleteHand(rng, opts) {
    for (let tries = 0; tries < 200; tries++) {
      const c = emptyCounts();
      let ok = true;
      for (let m = 0; m < 4 && ok; m++) {
        let placed = false;
        for (let k = 0; k < 20 && !placed; k++) {
          const near = m > 0 && rng() < opts.clusterRate ? randomNumberTileInHand(rng, c) : -1;
          const mz = pickMentsu(rng, opts, near);
          if (mz.type === 'seq') {
            const t = mz.t;
            if (c[t] < 4 && c[t + 1] < 4 && c[t + 2] < 4) {
              c[t]++; c[t + 1]++; c[t + 2]++;
              placed = true;
            }
          } else if (c[mz.t] <= 1) {
            c[mz.t] += 3;
            placed = true;
          }
        }
        if (!placed) ok = false;
      }
      if (!ok) continue;
      for (let k = 0; k < 20; k++) {
        let t;
        const near = rng() < opts.clusterRate ? randomNumberTileInHand(rng, c) : -1;
        if (near >= 0) {
          const s = Math.floor(near / 9) * 9;
          t = s + Math.min(8, Math.max(0, (near % 9) + randInt(rng, 5) - 2));
        } else {
          t = rng() < opts.honorRate ? 27 + randInt(rng, 7) : randInt(rng, 27);
        }
        if (c[t] <= 2) {
          c[t] += 2;
          return c;
        }
      }
    }
    return null;
  }

  /** 手牌の牌とつながる牌か（同じ牌、または同じ色で ±2 以内に牌がある） */
  function isConnected(c, t) {
    if (c[t] > 0) return true;
    if (t >= 27) return false;
    const s = Math.floor(t / 9) * 9;
    const n = t % 9;
    for (let d = -2; d <= 2; d++) {
      const m = n + d;
      if (d !== 0 && m >= 0 && m <= 8 && c[s + m] > 0) return true;
    }
    return false;
  }

  /** 浮き牌か（1枚だけで、同じ色の ±2 以内に他の牌がない。字牌は1枚だけなら浮き牌） */
  function isIsolated(c, t) {
    if (c[t] !== 1) return false;
    c[t]--;
    const connected = isConnected(c, t);
    c[t]++;
    return !connected;
  }

  /** 正解がすべて浮き牌を切るだけの、易しい問題か */
  function isTrivial(problem) {
    const c = listToCounts([...problem.hand, problem.draw]);
    return problem.answers.every((a) => isIsolated(c, a.discard));
  }

  /** 山に残っている牌から、残り枚数に比例した確率で1枚引く */
  function drawFromWall(rng, c, filter) {
    let total = 0;
    for (let t = 0; t < 34; t++) if (!filter || filter(t)) total += 4 - c[t];
    if (total === 0) return -1;
    let r = randInt(rng, total);
    for (let t = 0; t < 34; t++) {
      if (filter && !filter(t)) continue;
      r -= 4 - c[t];
      if (r < 0) return t;
    }
    return -1;
  }

  const DEFAULT_GEN_OPTIONS = {
    sequenceRate: 0.72,     // 面子を順子にする確率
    honorRate: 0.18,        // 刻子・雀頭を字牌にする確率
    clusterRate: 0.55,      // 面子・雀頭を既存の牌の近くに置く確率（複合形を増やす）
    connectedAddRate: 0.75, // 和了形を崩すときに足す牌を、手牌とつながる牌から選ぶ確率
    trivialKeepRate: 0.3,   // 浮き牌を切るだけの問題を残す確率（全体の5%前後になる）
  };

  /**
   * 一向聴の13枚と、聴牌するツモ牌 X を作る。
   * 戻り値: {
   *   hand: 13枚の牌番号 (昇順),
   *   draw: X の牌番号,
   *   answers: [{ discard, waits, remaining }]  ← 聴牌になる切り方すべて
   * }
   */
  function generateOneShantenProblem(rng, options) {
    rng = rng || Math.random;
    const opts = Object.assign({}, DEFAULT_GEN_OPTIONS, options || {});
    let problem = null;
    for (let attempt = 0; attempt < 50; attempt++) {
      const { c, candidates } = generateOneShantenHand(rng, opts);
      // 残り枚数に比例して X を選ぶ
      const ok = new Set(candidates.map((cd) => cd.x));
      const x = drawFromWall(rng, c, (t) => ok.has(t));
      const chosen = candidates.find((cd) => cd.x === x);
      problem = { hand: countsToList(c), draw: x, answers: chosen.answers };
      if (opts.accept && !opts.accept(problem)) continue;
      if (isTrivial(problem) && rng() >= opts.trivialKeepRate) continue;
      return problem;
    }
    return problem;
  }

  /**
   * 問題の「形」を表すキー。萬・筒・索の入れ替えと、字牌の種類の入れ替えを同一視する。
   * 同じキーなら、色や字牌が違うだけの実質同じ問題。
   */
  function shapeKey(hand, draw) {
    const c = listToCounts(hand);
    const suits = [0, 1, 2].map((s) => {
      let a = '';
      let x = '';
      for (let i = 0; i < 9; i++) {
        a += c[s * 9 + i];
        x += draw === s * 9 + i ? 1 : 0;
      }
      return a + '/' + x;
    });
    suits.sort();
    const honors = [];
    for (let t = 27; t < 34; t++) if (c[t] || draw === t) honors.push(c[t] + '' + (draw === t ? 1 : 0));
    honors.sort();
    return suits.join(' ') + '|' + honors.join(',');
  }

  /** 切り方の組み合わせを比べるためのキー ("3,12" など) */
  function discardKey(answers) {
    return answers.map((a) => a.discard).sort((a, b) => a - b).join(',');
  }

  function shuffle(rng, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(rng, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * 連続設問: 同じ13枚に対して、ツモ牌 X ごとに正解の切り方 Y が変わる問題のセット。
   * 正解の切り方の組み合わせが互いに異なる X を minLen〜maxLen 個選ぶ。
   * 戻り値: { hand, problems: [{ hand, draw, answers }] }
   */
  function generateSeries(rng, options) {
    rng = rng || Math.random;
    // uniqueOnly: 正解の切り方が1通りだけの X に限る（「X によって切る牌が変わる」をはっきりさせる）
    const o = Object.assign({ minLen: 3, maxLen: 5, uniqueOnly: true }, options || {});
    for (let attempt = 0; attempt < 5000; attempt++) {
      const { c, candidates } = generateOneShantenHand(rng, o);
      // 正解の切り方が同じ X はまとめる
      const groups = new Map();
      for (const cd of candidates) {
        if (o.uniqueOnly && cd.answers.length !== 1) continue;
        const key = discardKey(cd.answers);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(cd);
      }
      if (groups.size < o.minLen) continue;
      const picked = shuffle(rng, [...groups.values()])
        .slice(0, o.maxLen)
        .map((g) => g[randInt(rng, g.length)]);
      const hand = countsToList(c);
      return {
        hand,
        problems: picked.map((cd) => ({ hand: hand.slice(), draw: cd.x, answers: cd.answers })),
      };
    }
    throw new Error('連続設問を生成できませんでした');
  }

  /**
   * 二向聴版: 二向聴の13枚と、一向聴に進むツモ牌 X。
   * answers は「切っても一向聴を保つ切り方」すべてで、waits はその後の受け入れ（聴牌に進む牌）。
   * 同じ牌を4枚持つ手は出さない（空聴の扱いがややこしくなるため）。
   */
  /**
   * 二向聴の13枚を1つ作り、一向聴に進むツモ牌の候補 xs と一緒に返す。作れなければ null。
   * 同じ牌を4枚持つ手は出さない（X を足して4枚になる牌も候補に入れない）。
   */
  function twoShantenBase(rng, opts) {
    const c = randomCompleteHand(rng, opts);
    if (!c) return null;
    // 和了形14枚から (n+1) 枚抜いて n 枚足す → 13枚。2枚以上入れ替えて二向聴にする
    const n = rng() < 0.4 ? 3 : 2;
    for (let k = 0; k < n + 1; k++) {
      const list = countsToList(c);
      c[list[randInt(rng, list.length)]]--;
    }
    for (let k = 0; k < n; k++) {
      const add = rng() < opts.connectedAddRate
        ? drawFromWall(rng, c, (t) => isConnected(c, t) && c[t] < 3)
        : drawFromWall(rng, c, (t) => c[t] < 3);
      if (add < 0) return null;
      c[add]++;
    }
    if (c.some((v) => v >= 4)) return null;
    if (shanten(c) !== 2) return null;
    const xs = [];
    for (let x = 0; x < 34; x++) {
      if (c[x] >= 3) continue;
      c[x]++;
      if (shanten(c) === 1) xs.push(x);
      c[x]--;
    }
    return xs.length ? { c, xs } : null;
  }

  /**
   * 二向聴の連続設問: 同じ13枚で、X ごとに「受け入れ最大の切り方」が変わる問題のセット。
   * 受け入れ最大の切り方が1通りに決まる X だけを使い、その切り方が互いに違う X を選ぶ。
   * 戻り値: { hand, problems: [{ hand, draw, answers, shanten: 2 }] }
   */
  function generateTwoShantenSeries(rng, options) {
    rng = rng || Math.random;
    const o = Object.assign({}, DEFAULT_GEN_OPTIONS, { minLen: 3, maxLen: 5 }, options || {});
    for (let attempt = 0; attempt < 5000; attempt++) {
      const base = twoShantenBase(rng, o);
      if (!base) continue;
      const { c, xs } = base;
      if (xs.length < o.minLen) continue;
      const byBest = new Map(); // 最大の切り方 → その X の一覧
      for (const x of xs) {
        c[x]++;
        const answers = keepShantenDiscards(c, 1);
        c[x]--;
        const best = Math.max(...answers.map((a) => a.remaining));
        const top = answers.filter((a) => a.remaining === best);
        if (top.length !== 1) continue;
        const key = top[0].discard;
        if (!byBest.has(key)) byBest.set(key, []);
        byBest.get(key).push({ x, answers });
      }
      if (byBest.size < o.minLen) continue;
      const picked = shuffle(rng, [...byBest.values()])
        .slice(0, o.maxLen)
        .map((g) => g[randInt(rng, g.length)]);
      const hand = countsToList(c);
      return {
        hand,
        problems: picked.map((cd) => ({ hand: hand.slice(), draw: cd.x, answers: cd.answers, shanten: 2 })),
      };
    }
    throw new Error('二向聴の連続設問を生成できませんでした');
  }

  function generateTwoShantenProblem(rng, options) {
    rng = rng || Math.random;
    const opts = Object.assign({}, DEFAULT_GEN_OPTIONS, options || {});
    let problem = null;
    for (let attempt = 0; attempt < 3000; attempt++) {
      const base = twoShantenBase(rng, opts);
      if (!base) continue;
      const { c, xs } = base;
      const ok = new Set(xs);
      const x = drawFromWall(rng, c, (t) => ok.has(t));
      c[x]++;
      const answers = keepShantenDiscards(c, 1);
      c[x]--;
      problem = { hand: countsToList(c), draw: x, answers, shanten: 2 };
      if (opts.accept && !opts.accept(problem)) continue;
      if (isTrivial(problem) && rng() >= opts.trivialKeepRate) continue;
      return problem;
    }
    if (problem) return problem;
    throw new Error('二向聴の問題を生成できませんでした');
  }

  /** 一向聴の13枚と、聴牌できるツモ牌の候補すべて */
  function generateOneShantenHand(rng, options) {
    const opts = Object.assign({}, DEFAULT_GEN_OPTIONS, options || {});
    for (let attempt = 0; attempt < 500; attempt++) {
      const c = randomCompleteHand(rng, opts);
      if (!c) continue;

      // 和了形から (n+1) 枚抜いて、n 枚足す → 13枚。たまに大きめに崩して形を散らす
      const n = rng() < 0.35 ? 2 : 1;
      for (let k = 0; k < n + 1; k++) {
        const list = countsToList(c);
        c[list[randInt(rng, list.length)]]--;
      }
      let failed = false;
      for (let k = 0; k < n && !failed; k++) {
        // 手牌とつながる牌を足すと、浮き牌を切るだけの問題になりにくい
        const add = rng() < opts.connectedAddRate
          ? drawFromWall(rng, c, (t) => isConnected(c, t))
          : drawFromWall(rng, c);
        if (add < 0) failed = true;
        else c[add]++;
      }
      if (failed) continue;

      // 13枚が聴牌していたらやり直し (一向聴にしたい)
      if (getWaits(c).length > 0) continue;

      // 聴牌できるツモ牌 X の候補を集める
      const candidates = [];
      for (let x = 0; x < 34; x++) {
        if (c[x] >= 4) continue;
        c[x]++;
        const answers = tenpaiDiscards(c);
        c[x]--;
        if (answers.length > 0) candidates.push({ x, answers });
      }
      if (candidates.length === 0) continue; // 二向聴以上だった
      return { c, candidates };
    }
    throw new Error('問題を生成できませんでした');
  }

  // ---- 採点 ----------------------------------------------------------------

  /**
   * 正解になる切り方。
   * rule 'any' : 聴牌になる切り方はすべて正解 (現在のルール)
   * rule 'max' : 待ち枚数が最大の切り方だけ正解 (後から追加する予定のモード)
   */
  function correctDiscards(problem, rule) {
    if (rule === 'max') {
      const best = Math.max(...problem.answers.map((a) => a.remaining));
      return problem.answers.filter((a) => a.remaining === best);
    }
    return problem.answers;
  }

  /** 選んだ待ち牌の判定。完全一致で正解。 */
  function judgeWaits(correct, selected) {
    const want = new Set(correct);
    const got = new Set(selected);
    const hit = correct.filter((t) => got.has(t));
    const missed = correct.filter((t) => !got.has(t));
    const extra = selected.filter((t) => !want.has(t));
    return { ok: missed.length === 0 && extra.length === 0, hit, missed, extra };
  }

  /**
   * 1問の得点。正解なら 100点から時間超過分を減点 (下限 minScore)、不正解は0点。
   * yTime / zTime は秒。
   */
  function scoreQuestion(s, yTime, zTime, waitKinds, accuracy) {
    if (accuracy == null) accuracy = 1;
    const yOver = Math.max(0, yTime - s.yGrace);
    const zGrace = (s.zBase || 0) + s.zPerKind * waitKinds;
    const zOver = Math.max(0, zTime - zGrace);
    const yPenalty = yOver * s.yPenalty;
    const zPenalty = zOver * s.zPenalty;
    const timeScore = Math.max(s.minScore, 100 - yPenalty - zPenalty);
    const score = Math.round(timeScore * accuracy);
    return { score, timeScore, yPenalty, zPenalty, zGrace };
  }

  /**
   * 部分点の割合。(当たった数 − 余計に選んだ数) ÷ 正解の数。0〜1。
   * 全部当てて余計なものがなければ 1。
   */
  function zAccuracy(judge, correctCount) {
    if (correctCount === 0) return 0;
    return Math.max(0, judge.hit.length - judge.extra.length) / correctCount;
  }


  // ---- シード付き乱数と「今日の10問」 ---------------------------------------
  // 同じシードなら、どの端末でも同じ問題になる。サーバーで採点し直すときもこれを使う。

  /** 文字列 → 32bit のシード（FNV-1a） */
  function seedFromString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  /** mulberry32。0 以上 1 未満を返す関数を作る */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededRng(str) {
    return mulberry32(seedFromString(str));
  }

  /** 日本時間の日付 "YYYY-MM-DD"。日付の切り替わりは全員そろって 0:00 JST */
  function dailyDate(now) {
    const t = (now == null ? Date.now() : now instanceof Date ? now.getTime() : now) + 9 * 3600 * 1000;
    return new Date(t).toISOString().slice(0, 10);
  }

  // 問題の作り方を変えたら版を上げる（同じ日付でも別の問題になる）
  const DAILY_VERSION = 'v1';
  const DAILY_COUNT = 10;

  /**
   * 今日の10問。聴牌版（一向聴 → 聴牌）のランダム出題を日付のシードで10問。
   * 同じ日の中では同じ形を出さない。
   * 戻り値: { date, seed, problems: [{hand, draw, answers}] }
   */
  function generateDailySet(date, options) {
    const o = Object.assign({ count: DAILY_COUNT }, options);
    const seed = 'xyz-daily-' + DAILY_VERSION + '|' + date;
    const rng = seededRng(seed);
    const seen = new Set();
    const problems = [];
    while (problems.length < o.count) {
      const p = generateOneShantenProblem(rng, { accept: (q) => !seen.has(shapeKey(q.hand, q.draw)) });
      seen.add(shapeKey(p.hand, p.draw));
      problems.push(p);
    }
    return { date, seed, problems };
  }

  const api = {
    tileCode,
    tileName,
    emptyCounts,
    countsToList,
    listToCounts,
    isAgari,
    getWaits,
    shanten,
    getUkeire,
    keepShantenDiscards,
    remainingCount,
    tenpaiDiscards,
    generateOneShantenProblem,
    generateSeries,
    generateTwoShantenProblem,
    generateTwoShantenSeries,
    shapeKey,
    isTrivial,
    correctDiscards,
    judgeWaits,
    zAccuracy,
    scoreQuestion,
    seedFromString,
    mulberry32,
    seededRng,
    dailyDate,
    generateDailySet,
    DAILY_VERSION,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Mahjong = api;
})(typeof window !== 'undefined' ? window : globalThis);
