/* XYZトレーニング — 画面とタイマー */
(function () {
  'use strict';
  const M = window.Mahjong;
  const Cert = window.Cert;
  const $ = (id) => document.getElementById(id);

  // ---- モード --------------------------------------------------------------

  const MODES = {
    random: { shanten: 1, zWord: '待ち', zPrompt: '待ちをすべて選んで決定', yFail: '聴牌しない牌を切った', tag: null },
    series: { shanten: 1, zWord: '待ち', zPrompt: '待ちをすべて選んで決定', yFail: '聴牌しない牌を切った', tag: 'series' },
    two: {
      shanten: 2,
      zWord: '受け入れ',
      zPrompt: '聴牌に進む牌をすべて選んで決定',
      yFail: '一向聴を保てない牌を切った',
      tag: '二向聴 → 一向聴',
      partial: true, // Z は部分点あり
    },
    twoSeries: {
      shanten: 2,
      zWord: '受け入れ',
      zPrompt: '聴牌に進む牌をすべて選んで決定',
      yFail: '一向聴を保てない牌を切った',
      tag: 'series',
      partial: true,
      forceMax: true, // X ごとに変わるのは「受け入れ最大の切り方」なので、それだけを正解にする
    },
    // 今日の10問：日付で問題が決まる。全員同じ問題・初期設定で採点
    daily: { shanten: 1, zWord: '待ち', zPrompt: '待ちをすべて選んで決定', yFail: '聴牌しない牌を切った', tag: 'daily', daily: true },
    // ランクチャレンジ：4モード×10問。問題ごとのモードは item.modeKey（下の SECTION_MODES）
    challenge: { shanten: 1, tag: 'challenge', challenge: true },
  };
  // ランクチャレンジの各モードが、どの出題モードと同じ見た目・判定か
  const SECTION_MODES = ['random', 'series', 'two', 'twoSeries'];
  const CHALLENGE_DESC = '4モード×10問・40問の消耗戦';

  /** いま出題中の問題のモード（ランクチャレンジでは問題ごとに変わる） */
  function curMode() {
    return MODES[(game.item && game.item.modeKey) || game.mode];
  }

  // ---- 設定 ----------------------------------------------------------------

  const DEFAULTS = {
    questions: 10,
    minScore: 10,
    yPenalty: 5,
    zPenalty: 3,
    // 聴牌版
    yGrace: 5,
    yLimit: 15,
    zBase: 3,
    zPerKind: 3,
    zLimit: 40,
    minWaitKinds: 1,
    // 二向聴版
    y2Grace: 8,
    y2Limit: 25,
    z2Base: 5,
    z2PerKind: 2,
    z2Limit: 60,
    y2MaxOnly: 0,
  };

  const FIELDS = [
    { group: '共通' },
    { key: 'questions', label: '1セットの問題数', unit: '問', min: 1, max: 50, step: 1 },
    { key: 'yPenalty', label: '切る牌 Y：1秒ごとの減点', unit: '点', min: 0, max: 50, step: 1 },
    { key: 'zPenalty', label: 'Z：1秒ごとの減点', unit: '点', min: 0, max: 50, step: 1 },
    { key: 'minScore', label: '正解したときの最低点', unit: '点', min: 0, max: 100, step: 1 },
    { group: '聴牌（ランダム・連続設問）' },
    { key: 'yGrace', label: 'Y：減点なしの時間', unit: '秒', min: 0.5, max: 30, step: 0.5 },
    { key: 'yLimit', label: 'Y：制限時間', unit: '秒', min: 1, max: 60, step: 1 },
    { key: 'zBase', label: '待ち：減点なしの時間（基本）', unit: '秒', min: 0, max: 30, step: 0.5 },
    { key: 'zPerKind', label: '待ち：1種ごとに追加', unit: '秒', min: 0.5, max: 30, step: 0.5 },
    { key: 'zLimit', label: '待ち：制限時間', unit: '秒', min: 1, max: 120, step: 1 },
    { key: 'minWaitKinds', label: '出題する待ち（○種以上）', unit: '種', min: 1, max: 3, step: 1 },
    { group: '二向聴' },
    { key: 'y2Grace', label: 'Y：減点なしの時間', unit: '秒', min: 0.5, max: 60, step: 0.5 },
    { key: 'y2Limit', label: 'Y：制限時間', unit: '秒', min: 1, max: 120, step: 1 },
    { key: 'z2Base', label: '受け入れ：減点なしの時間（基本）', unit: '秒', min: 0, max: 60, step: 0.5 },
    { key: 'z2PerKind', label: '受け入れ：1種ごとに追加', unit: '秒', min: 0.5, max: 30, step: 0.5 },
    { key: 'z2Limit', label: '受け入れ：制限時間', unit: '秒', min: 1, max: 180, step: 1 },
    { key: 'y2MaxOnly', label: '受け入れ最大の切り方だけ正解にする', type: 'check' },
  ];

  // v2: 初期値を緩めたので、v1 で保存された古い値は読まない
  const STORAGE_KEY = 'xyz-training-settings-v2';
  let settings = loadSettings();

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return Object.assign({}, DEFAULTS, saved);
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }
  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* 保存できない環境では無視 */ }
  }

  /** モードごとの時間と減点の設定 */
  function timing(mode, ranked) {
    // 今日の10問とランクチャレンジは公平に比べられるよう、設定を変えていても初期値で採点する
    if (ranked) return Object.assign({}, M.RANKED_TIMING[MODES[mode].shanten]);
    const s = settings;
    if (MODES[mode].shanten === 2) {
      return {
        yGrace: s.y2Grace, yLimit: s.y2Limit, yPenalty: s.yPenalty,
        zBase: s.z2Base, zPerKind: s.z2PerKind, zLimit: s.z2Limit, zPenalty: s.zPenalty,
        minScore: s.minScore,
      };
    }
    return {
      yGrace: s.yGrace, yLimit: s.yLimit, yPenalty: s.yPenalty,
      zBase: s.zBase, zPerKind: s.zPerKind, zLimit: s.zLimit, zPenalty: s.zPenalty,
      minScore: s.minScore,
    };
  }

  function renderSettings() {
    const grid = $('settingsGrid');
    grid.innerHTML = '';
    for (const f of FIELDS) {
      if (f.group) {
        const h = document.createElement('div');
        h.className = 'field-group';
        h.textContent = f.group;
        grid.appendChild(h);
        continue;
      }
      const row = document.createElement('div');
      row.className = 'field';
      const id = 'set-' + f.key;
      if (f.type === 'check') {
        row.classList.add('check');
        row.innerHTML = `<label for="${id}">${f.label}</label><input id="${id}" type="checkbox"${settings[f.key] ? ' checked' : ''}>`;
        const input = row.querySelector('input');
        input.addEventListener('change', () => {
          settings[f.key] = input.checked ? 1 : 0;
          saveSettings();
        });
      } else {
        row.innerHTML =
          `<label for="${id}">${f.label}</label>` +
          `<span class="input"><input id="${id}" type="number" inputmode="decimal" min="${f.min}" max="${f.max}" step="${f.step}" value="${settings[f.key]}">${f.unit}</span>`;
        const input = row.querySelector('input');
        input.addEventListener('change', () => {
          let v = Number(input.value);
          if (!Number.isFinite(v)) v = DEFAULTS[f.key];
          v = Math.min(f.max, Math.max(f.min, v));
          input.value = v;
          settings[f.key] = v;
          saveSettings();
        });
      }
      grid.appendChild(row);
    }
  }

  // ---- 牌の描画 -------------------------------------------------------------

  function tileEl(t, opts) {
    opts = opts || {};
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile' + (opts.cls ? ' ' + opts.cls : '');
    b.dataset.t = t;
    if (opts.disabled) b.disabled = true;
    const img = document.createElement('img');
    img.src = 'tiles/' + M.tileCode(t) + '.svg';
    img.alt = M.tileName(t);
    img.draggable = false;
    b.appendChild(img);
    return b;
  }

  function preloadTiles() {
    for (let t = 0; t < 34; t++) {
      const img = new Image();
      img.src = 'tiles/' + M.tileCode(t) + '.svg';
    }
  }

  function renderHandRow(container, tiles13, draw, interactive) {
    container.innerHTML = '';
    container.classList.toggle('active', !!interactive);
    for (const t of tiles13) container.appendChild(tileEl(t, { disabled: !interactive }));
    if (draw != null) container.appendChild(tileEl(draw, { cls: 'draw', disabled: !interactive }));
  }

  // ---- 画面切り替え ---------------------------------------------------------

  function show(name) {
    for (const s of ['start', 'play', 'summary', 'cert', 'rank']) $('screen-' + s).hidden = s !== name;
    $('progress').hidden = name !== 'play';
    window.scrollTo(0, 0);
  }

  // ---- 出題と進行 -----------------------------------------------------------

  const game = {
    mode: 'random', // 'random' | 'series' | 'two'
    results: [],
    queue: [],      // これから出す問題（連続設問は同じ手牌の問題が並ぶ）
    item: null,     // 出題中の { problem, seriesNo, idx, len }
    seriesNo: 0,
    q: null,        // 現在の問題の状態
    raf: 0,
  };

  // ---- 出題履歴（同じ形を繰り返さない） ------------------------------------
  // 形のキーを直近 HISTORY_MAX 件だけ、この端末のブラウザに覚えておく。
  const HISTORY_KEY = 'xyz-training-history-v1';
  const HISTORY_MAX = 3000;
  const history = loadHistory();

  function loadHistory() {
    try {
      const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return { list: arr, set: new Set(arr) };
    } catch (e) {
      return { list: [], set: new Set() };
    }
  }
  function remember(key) {
    if (history.set.has(key)) return;
    history.list.push(key);
    history.set.add(key);
    while (history.list.length > HISTORY_MAX) history.set.delete(history.list.shift());
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.list)); } catch (e) { /* 保存できない環境では無視 */ }
  }

  function makeProblem() {
    const key = (p) => M.shapeKey(p.hand, p.draw);
    const accept = (p) =>
      !history.set.has(key(p)) &&
      Math.max(...p.answers.map((a) => a.waits.length)) >= settings.minWaitKinds;
    const p = M.generateOneShantenProblem(null, { accept });
    remember(key(p));
    return p;
  }

  function makeTwoShantenProblem() {
    const key = (p) => '2|' + M.shapeKey(p.hand, p.draw);
    const p = M.generateTwoShantenProblem(null, { accept: (p) => !history.set.has(key(p)) });
    remember(key(p));
    return p;
  }

  function makeSeries(two) {
    const gen = two ? M.generateTwoShantenSeries : M.generateSeries;
    const key = (s) => (two ? '2s|' : '') + M.shapeKey(s.hand, -1);
    let s;
    for (let i = 0; i < 20; i++) {
      s = gen();
      if (!history.set.has(key(s))) break;
    }
    remember(key(s));
    return s;
  }

  function startSet(mode) {
    if (mode === 'challenge') {
      startChallenge();
      return;
    }
    game.mode = mode;
    game.results = [];
    game.queue = [];
    game.answers = null;
    game.seriesNo = 0;
    if (MODES[mode].daily) {
      game.daily = M.generateDailySet(M.dailyDate());
      game.queue = game.daily.problems.map((problem, i) => ({ problem, idx: i + 1, len: game.daily.problems.length }));
    }
    show('play');
    nextQuestion();
  }

  /** セットが終わったか。連続設問は同じ手牌の途中では終わらない */
  function setFinished() {
    if (MODES[game.mode].daily || MODES[game.mode].challenge) return game.queue.length === 0;
    return game.results.length >= settings.questions && game.queue.length === 0;
  }

  function updateProgress() {
    const total = game.results.reduce((s, r) => s + r.score, 0);
    const n = game.results.length + (game.q && game.q.phase !== 'result' ? 1 : 0);
    $('progress').textContent = `第${n}問　合計 ${total} 点`;
  }

  function fillQueue() {
    if (MODES[game.mode].tag === 'series') {
      const s = makeSeries(game.mode === 'twoSeries');
      game.seriesNo++;
      game.queue = s.problems.map((problem, i) => ({
        problem, seriesNo: game.seriesNo, idx: i + 1, len: s.problems.length,
      }));
    } else if (game.mode === 'two') {
      game.queue = [{ problem: makeTwoShantenProblem() }];
    } else {
      game.queue = [{ problem: makeProblem() }];
    }
  }

  function nextQuestion() {
    if (game.queue.length === 0) fillQueue();
    game.item = game.queue.shift();
    const problem = game.item.problem;
    const mode = curMode();
    const tag = $('seriesTag');
    tag.hidden = !mode.tag;
    if (game.mode === 'challenge') {
      const it = game.item;
      const sec = M.CHALLENGE_SECTIONS[it.section];
      tag.hidden = false;
      tag.textContent = `${sec.label} ${it.no}/${M.CHALLENGE_PER_SECTION}` +
        (it.seriesNo ? `・同じ13枚 ${it.idx}/${it.len}` : '') + `　${it.overall}/${game.total}`;
    } else if (mode.tag === 'series') {
      tag.textContent = (mode.shanten === 2 ? '二向聴 ' : '') +
        `連続設問 ${game.item.seriesNo}　同じ13枚 ${game.item.idx} / ${game.item.len}`;
    } else if (mode.daily) {
      tag.textContent = `今日の10問　${shortDate(game.daily.date)}　${game.item.idx} / ${game.item.len}`;
    } else if (mode.tag) {
      tag.textContent = mode.tag;
    }
    game.q = {
      problem,
      phase: 'y',
      yTime: 0,
      zTime: 0,
      discard: null,
      answer: null,     // 選んだ切り方に対応する { discard, waits, remaining }
      selected: new Set(),
      yPenalty: 0,
      tm: timing(game.item.modeKey || game.mode, game.mode === 'challenge' || game.mode === 'daily'),
    };
    updateProgress();
    $('resultPanel').hidden = true;
    $('zPanel').hidden = true;
    $('river').innerHTML = '';
    $('phaseLabel').innerHTML = '<span class="badge y">Y</span>切る牌をタップ';
    renderHandRow($('hand'), problem.hand, problem.draw, true);
    startTimer(game.q.tm.yLimit, game.q.tm.yGrace);
  }

  // ---- タイマー -------------------------------------------------------------

  function startTimer(limit, grace) {
    cancelAnimationFrame(game.raf);
    const q = game.q;
    q.limit = limit;
    q.grace = grace;
    q.start = performance.now();
    $('timer').classList.remove('over', 'done');
    const tick = (now) => {
      const e = (now - q.start) / 1000;
      const remain = Math.max(0, 1 - e / q.limit);
      $('timerFill').style.transform = `scaleX(${remain})`;
      const over = e > q.grace;
      $('timer').classList.toggle('over', over);
      $('liveScore').textContent = provisionalScore(e);
      $('liveScore').parentElement.classList.toggle('dropping', over);
      if (e >= q.limit) {
        onTimeout();
        return;
      }
      game.raf = requestAnimationFrame(tick);
    };
    game.raf = requestAnimationFrame(tick);
  }

  function elapsed() {
    return (performance.now() - game.q.start) / 1000;
  }

  function stopTimer() {
    cancelAnimationFrame(game.raf);
    $('timer').classList.add('done');
    $('timer').classList.remove('over');
    $('liveScore').parentElement.classList.remove('dropping');
  }

  /** 経過時間 e 秒でいま全問正解したら何点か */
  function provisionalScore(e) {
    const q = game.q;
    const tm = q.tm;
    let pen;
    if (q.phase === 'y') pen = Math.max(0, e - tm.yGrace) * tm.yPenalty;
    else pen = q.yPenalty + Math.max(0, e - q.grace) * tm.zPenalty;
    return Math.max(tm.minScore, Math.round(100 - pen));
  }

  function onTimeout() {
    const q = game.q;
    if (q.phase === 'y') {
      q.yTime = q.limit;
      finish({ ok: false, timeout: 'y', reason: '時間切れ（切る牌）' });
    } else if (q.phase === 'z') {
      q.zTime = q.limit;
      finish({ ok: false, timeout: 'z', reason: `時間切れ（${curMode().zWord}）` });
    }
  }

  // ---- Y: 切る牌 ------------------------------------------------------------

  function yRule() {
    if (game.mode === 'challenge') return M.CHALLENGE_SECTIONS[game.item.section].rule;
    const mode = curMode();
    if (mode.forceMax) return 'max';
    return mode.shanten === 2 && settings.y2MaxOnly ? 'max' : 'any';
  }

  function onHandClick(ev) {
    const btn = ev.target.closest('.tile');
    const q = game.q;
    if (!btn || !q || q.phase !== 'y') return;
    q.yTime = elapsed();
    const d = Number(btn.dataset.t);
    q.discard = d;
    q.yPenalty = Math.max(0, q.yTime - q.tm.yGrace) * q.tm.yPenalty;

    const remaining13 = [...q.problem.hand, q.problem.draw];
    remaining13.splice(remaining13.indexOf(d), 1);
    remaining13.sort((a, b) => a - b);
    q.hand13 = remaining13;

    renderHandRow($('hand'), remaining13, null, false);
    showRiver(d);

    const mode = curMode();
    const valid = q.problem.answers.find((a) => a.discard === d);
    const ans = M.correctDiscards(q.problem, yRule()).find((a) => a.discard === d);
    if (!valid) {
      finish({ ok: false, reason: mode.yFail });
      return;
    }
    if (!ans) {
      finish({ ok: false, reason: '受け入れが最大の切り方ではない' });
      return;
    }
    q.answer = ans;
    q.phase = 'z';
    q.selected = new Set();
    $('phaseLabel').innerHTML = `<span class="badge z">Z</span>${mode.zPrompt}`;
    renderPalette();
    $('zPanel').hidden = false;
    const zGrace = q.tm.zBase + q.tm.zPerKind * ans.waits.length;
    startTimer(Math.max(q.tm.zLimit, zGrace + 5), zGrace);
  }

  function showRiver(d) {
    const r = $('river');
    r.innerHTML = '<span>打</span>';
    r.appendChild(tileEl(d, { disabled: true }));
  }

  // ---- Z: 待ち・受け入れ ----------------------------------------------------

  function renderPalette() {
    const pal = $('palette');
    pal.innerHTML = '';
    for (let t = 0; t < 34; t++) {
      const el = tileEl(t);
      el.setAttribute('aria-pressed', 'false');
      pal.appendChild(el);
    }
  }

  function onPaletteClick(ev) {
    const btn = ev.target.closest('.tile');
    const q = game.q;
    if (!btn || !q || q.phase !== 'z') return;
    const t = Number(btn.dataset.t);
    if (q.selected.has(t)) q.selected.delete(t);
    else q.selected.add(t);
    const on = q.selected.has(t);
    btn.classList.toggle('sel', on);
    btn.setAttribute('aria-pressed', String(on));
  }

  function clearSelection() {
    const q = game.q;
    if (!q || q.phase !== 'z') return;
    q.selected.clear();
    for (const b of $('palette').querySelectorAll('.tile')) {
      b.classList.remove('sel');
      b.setAttribute('aria-pressed', 'false');
    }
  }

  function submitZ() {
    const q = game.q;
    if (!q || q.phase !== 'z') return;
    q.zTime = elapsed();
    const judge = M.judgeWaits(q.answer.waits, [...q.selected].sort((a, b) => a - b));
    q.judge = judge;
    const mode = curMode();
    if (judge.ok) {
      finish({ ok: true });
      return;
    }
    const acc = M.zAccuracy(judge, q.answer.waits.length);
    if (mode.partial && acc > 0) {
      finish({
        ok: false,
        partial: true,
        acc,
        reason: `${q.answer.waits.length}種中 ${judge.hit.length}種正解` + (judge.extra.length ? `・余計 ${judge.extra.length}種` : ''),
      });
      return;
    }
    finish({ ok: false, reason: `${mode.zWord}が違う` });
  }

  // ---- 答え合わせ -----------------------------------------------------------

  function finish(outcome) {
    stopTimer();
    const q = game.q;
    const prevPhase = q.phase;
    q.phase = 'result';
    if (q.answer && !q.judge) {
      q.judge = M.judgeWaits(q.answer.waits, [...q.selected].sort((a, b) => a - b));
    }

    let score = 0;
    if (outcome.ok || outcome.partial) {
      score = M.scoreQuestion(q.tm, q.yTime, q.zTime, q.answer.waits.length, outcome.ok ? 1 : outcome.acc).score;
    }
    $('liveScore').textContent = score;

    // ランクチャレンジ：サーバーに送る答え（点数は送らない。サーバーが採点し直す）
    if (game.answers) {
      game.answers.push({
        y: q.discard,
        z: [...q.selected].sort((a, b) => a - b),
        yt: Math.round(q.yTime * 1000) / 1000,
        zt: prevPhase === 'y' ? null : Math.round(q.zTime * 1000) / 1000,
        to: outcome.timeout || null,
      });
    }
    game.results.push({
      shanten: curMode().shanten,
      section: game.item.section,
      ok: outcome.ok,
      partial: !!outcome.partial,
      score,
      reason: outcome.reason || '',
      yTime: q.yTime,
      zTime: prevPhase === 'y' ? null : q.zTime,
      waits: q.answer ? q.answer.waits : [],
      discard: q.discard,
      draw: q.problem.draw,
      seriesNo: game.item.seriesNo || null,
    });
    updateProgress();

    $('zPanel').hidden = true;
    const badge = outcome.ok ? '<span class="badge ok">○</span>'
      : outcome.partial ? '<span class="badge part">△</span>'
        : '<span class="badge ng">×</span>';
    $('phaseLabel').innerHTML = badge + '答え合わせ';
    renderResult(outcome, score);
  }

  function fmt(s) {
    return s == null ? '—' : s.toFixed(1) + '秒';
  }

  function renderResult(outcome, score) {
    const q = game.q;
    const tm = q.tm;
    const mode = curMode();
    const v = $('verdict');
    if (outcome.ok) {
      v.className = 'verdict ok';
      v.innerHTML = `正解<small>${score}点</small>`;
    } else if (outcome.partial) {
      v.className = 'verdict part';
      v.innerHTML = `部分点<small>${score}点　${outcome.reason}</small>`;
    } else {
      v.className = 'verdict ng';
      v.innerHTML = `不正解<small>${outcome.reason}</small>`;
    }

    // 時間と減点の内訳
    const yPen = Math.max(0, q.yTime - tm.yGrace) * tm.yPenalty;
    const rows = [];
    rows.push(row('切る牌 Y', `${fmt(q.yTime)}（減点なし ${tm.yGrace}秒まで）`, yPen));
    if (q.answer && q.zTime) {
      const kinds = q.answer.waits.length;
      const zGrace = tm.zBase + tm.zPerKind * kinds;
      const zPen = Math.max(0, q.zTime - zGrace) * tm.zPenalty;
      rows.push(row(`${mode.zWord} Z`, `${fmt(q.zTime)}（${kinds}種 → ${zGrace}秒まで）`, zPen));
    }
    $('breakdown').innerHTML = rows.join('');

    // Z の答え合わせ（Y が正しかったときだけ）
    const rp = $('reviewPalette');
    rp.innerHTML = '';
    const showReview = !!q.answer;
    rp.hidden = !showReview;
    $('legend').hidden = !showReview;
    if (showReview) {
      const j = q.judge || M.judgeWaits(q.answer.waits, []);
      const hit = new Set(j.hit), missed = new Set(j.missed), extra = new Set(j.extra);
      for (let t = 0; t < 34; t++) {
        let cls = '';
        if (hit.has(t)) cls = 'hit';
        else if (missed.has(t)) cls = 'missed';
        else if (extra.has(t)) cls = 'extra';
        rp.appendChild(tileEl(t, { cls, disabled: true }));
      }
    }

    // 正しい切り方の一覧（枚数の多い順）
    $('answersTitle').textContent = mode.shanten === 2
      ? 'この手で一向聴を保つ切り方（受け入れの多い順）'
      : 'この手で聴牌する切り方';
    const list = $('answers');
    list.innerHTML = '';
    const sorted = q.problem.answers.slice().sort((a, b) => b.remaining - a.remaining || b.waits.length - a.waits.length);
    const best = sorted.length ? sorted[0].remaining : 0;
    for (const a of sorted) {
      const div = document.createElement('div');
      div.className = 'answer' + (a.discard === q.discard ? ' mine' : '');
      const g1 = document.createElement('span');
      g1.className = 'grp';
      g1.innerHTML = '<span class="lbl">打</span>';
      g1.appendChild(tileEl(a.discard, { disabled: true }));
      const g2 = document.createElement('span');
      g2.className = 'grp wrap';
      g2.innerHTML = `<span class="lbl">${mode.zWord}</span>`;
      for (const w of a.waits) g2.appendChild(tileEl(w, { disabled: true }));
      const cnt = document.createElement('span');
      cnt.className = 'cnt';
      const tags = [];
      if (a.discard === q.discard) tags.push('<span class="tag">あなたの打牌</span>');
      if (mode.shanten === 2 && a.remaining === best) tags.push('<span class="tag best">最大</span>');
      cnt.innerHTML = tags.join(' ') + (tags.length ? '　' : '') + `${a.waits.length}種${a.remaining}枚`;
      div.append(g1, g2, cnt);
      list.appendChild(div);
    }

    let label = '次の問題';
    if (setFinished()) label = '結果を見る';
    else if (game.mode !== 'challenge' && curMode().tag === 'series' && game.queue.length > 0) label = '同じ13枚で次のX';
    else if (game.mode !== 'challenge' && curMode().tag === 'series') label = '次の手牌へ';
    else if (game.mode === 'challenge' && game.queue.length && game.queue[0].section !== game.item.section) {
      label = `次は ${M.CHALLENGE_SECTIONS[game.queue[0].section].label}`;
    } else if (game.mode === 'challenge' && game.item.seriesNo && game.queue.length && game.queue[0].seriesNo === game.item.seriesNo) {
      label = '同じ13枚で次のX';
    }
    $('nextBtn').textContent = label;
    $('resultPanel').hidden = false;
    $('nextBtn').focus({ preventScroll: true });
  }

  function row(label, text, pen) {
    const p = Math.round(pen);
    return `<div class="row"><span>${label}　${text}</span><span class="${p > 0 ? 'pen' : ''}">${p > 0 ? '−' + p : '±0'}</span></div>`;
  }

  function onNext() {
    if (setFinished()) {
      if (MODES[game.mode].challenge) {
        submitChallenge();
        return;
      }
      if (MODES[game.mode].daily) saveDaily();
      renderSummary();
      show('summary');
      return;
    }
    nextQuestion();
    window.scrollTo(0, 0);
  }

  // ---- 結果画面 -------------------------------------------------------------

  function avg(xs) {
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  }

  function renderSummary() {
    const rs = game.results;
    const total = rs.reduce((s, r) => s + r.score, 0);
    $('totalScore').textContent = total;
    $('totalMax').textContent = '/ ' + rs.length * 100;
    const okRs = rs.filter((r) => r.ok);
    const ay = avg(okRs.map((r) => r.yTime));
    const az = avg(okRs.map((r) => r.zTime));
    $('stats').innerHTML =
      stat(`${okRs.length}/${rs.length}`, '正解') +
      stat(ay == null ? '—' : ay.toFixed(1) + 's', 'Yの平均時間') +
      stat(az == null ? '—' : az.toFixed(1) + 's', 'Zの平均時間');
    renderDailySummary();
    $('stats').className = 'stats';
    $('challengeBox').hidden = true;
    const log = $('log');
    log.innerHTML = '';
    rs.forEach((r, i) => {
      const li = document.createElement('li');
      let waits = '';
      if (r.waits.length) {
        waits = r.shanten === 2
          ? `受け入れ${r.waits.length}種`
          : r.waits.map(M.tileName).join('・') + '待ち';
      }
      const head = (r.seriesNo ? `形${r.seriesNo}　` : '') + `X ${M.tileName(r.draw)}`;
      const detail = r.ok
        ? `${waits}　Y ${r.yTime.toFixed(1)}s / Z ${r.zTime.toFixed(1)}s`
        : `${r.reason}${waits && !r.partial ? '（' + waits + '）' : ''}`;
      const mark = r.ok ? ['ok', '○'] : r.partial ? ['part', '△'] : ['ng', '×'];
      li.innerHTML =
        `<span class="mark ${mark[0]}">${mark[1]}</span>` +
        `<span class="detail">${i + 1}. ${head}　${detail}</span>` +
        `<span class="pts">${r.score}</span>`;
      log.appendChild(li);
    });
  }

  function stat(v, k) {
    return `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`;
  }

  // ---- 今日の10問の記録（この端末に保存） -----------------------------------
  // 日付ごとに { first, best, plays, marks }。first は初回の点（ランキングを作るときに使う想定）
  const DAILY_KEY = 'xyz-training-daily-v1';

  function loadDaily() {
    try { return JSON.parse(localStorage.getItem(DAILY_KEY) || '{}'); } catch (e) { return {}; }
  }

  function marksOf(rs) {
    return rs.map((r) => (r.ok ? '○' : r.partial ? '△' : '×')).join('');
  }

  function saveDaily() {
    const all = loadDaily();
    const date = game.daily.date;
    const total = game.results.reduce((s, r) => s + r.score, 0);
    const rec = all[date] || { first: total, best: 0, plays: 0, marks: marksOf(game.results) };
    rec.plays++;
    if (total > rec.best) { rec.best = total; rec.marks = marksOf(game.results); }
    all[date] = rec;
    game.dailyIsFirst = rec.plays === 1;
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(all)); } catch (e) { /* 保存できない環境では無視 */ }
  }

  function shortDate(d) {
    const [, m, day] = d.split('-');
    return `${Number(m)}/${Number(day)}`;
  }

  /** 連続で遊んだ日数（今日か昨日まで続いていれば数える） */
  function streak(all, today) {
    let n = 0;
    let t = Date.parse(today + 'T00:00:00Z');
    if (!all[today]) t -= 86400000;
    while (all[new Date(t).toISOString().slice(0, 10)]) { n++; t -= 86400000; }
    return n;
  }

  function updateDailyButton() {
    const today = M.dailyDate();
    const all = loadDaily();
    const rec = all[today];
    $('dailyDate').textContent = shortDate(today);
    const st = streak(all, today);
    $('dailyDesc').textContent = rec
      ? `初回 ${rec.first}点・ベスト ${rec.best}点` + (st > 1 ? `・${st}日連続` : '')
      : '全員同じ10問・毎日0時に更新' + (st > 0 ? `・${st}日連続中` : '');
    $('startDaily').classList.toggle('played', !!rec);
  }

  function shareText() {
    const total = game.results.reduce((s, r) => s + r.score, 0);
    return `XYZトレーニング 今日の10問 ${shortDate(game.daily.date)}\n${total}/1000点 ${marksOf(game.results)}`;
  }

  function renderDailySummary() {
    const box = $('dailyBox');
    const daily = MODES[game.mode].daily;
    box.hidden = !daily;
    if (!daily) return;
    const rec = loadDaily()[game.daily.date];
    $('dailyNote').textContent = game.dailyIsFirst
      ? '今日の初回の記録として保存しました'
      : `2回目以降の挑戦（初回 ${rec.first}点・ベスト ${rec.best}点）`;
    $('shareBtn').textContent = '結果をコピー';
  }

  async function copyShare() {
    const text = shareText();
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      // クリップボードが使えない環境：選択して手でコピーしてもらう
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
    }
    $('shareBtn').textContent = ok ? 'コピーしました' : text;
  }

  // ---- サーバーとのやりとり ---------------------------------------------------
  // 端末ごとの合言葉（ランダムな文字列）。名前の持ち主の証明になるので、ほかの人に見せない
  const PLAYER_KEY = 'xyz-training-player-v1';

  function playerToken() {
    let t = null;
    try { t = localStorage.getItem(PLAYER_KEY); } catch (e) { /* 保存できない環境 */ }
    if (!t || !/^[0-9a-f]{64}$/.test(t)) {
      t = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
      try { localStorage.setItem(PLAYER_KEY, t); } catch (e) { /* 保存できない環境 */ }
    }
    return t;
  }

  /** サーバーがある場所（公開サイトや wrangler での確認）で開いているか */
  function serverAvailable() {
    return location.protocol.startsWith('http') && !/claude(usercontent)?\.(ai|com)$/.test(location.hostname);
  }

  async function api(path, body) {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: Object.assign({ 'x-player-token': playerToken() }, body ? { 'content-type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* 応答が JSON でない */ }
    if (!res.ok) throw new Error(data.error || `通信に失敗しました（${res.status}）`);
    return data;
  }

  let toastTimer = 0;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }

  // ---- ランクチャレンジ -------------------------------------------------------

  let me = { name: null, loaded: false };

  async function loadMe() {
    if (!serverAvailable()) return;
    try {
      me = { name: (await api('/api/name')).name, loaded: true };
    } catch (e) { /* つながらなくても遊べる */ }
    renderMe();
  }

  function renderMe() {
    $('meName').textContent = me.name || '未登録';
  }

  async function startChallenge() {
    if (!serverAvailable()) {
      toast('ランクチャレンジは公開サイト（xyz-training.pages.dev）で遊べます');
      return;
    }
    const btn = $('startChallenge');
    if (btn.disabled) return;
    btn.disabled = true;
    $('challengeDesc').textContent = '問題を準備中…';
    try {
      const ses = await api('/api/challenge/start', {});
      const packs = await Promise.all(
        ses.packs.map((n, s) => fetch(`packs/${ses.version}/${s}/${n}.json`).then((r) => {
          if (!r.ok) throw new Error('問題を読み込めませんでした');
          return r.json();
        })),
      );
      game.mode = 'challenge';
      game.results = [];
      game.answers = [];
      game.challenge = { id: ses.id };
      game.queue = [];
      packs.forEach((items, s) => items.forEach((it, i) => game.queue.push({
        problem: { hand: it.hand, draw: it.draw, answers: it.answers },
        section: s,
        modeKey: SECTION_MODES[s],
        seriesNo: it.seriesNo,
        idx: it.idx,
        len: it.len,
        no: i + 1,
        overall: game.queue.length + 1,
      })));
      game.total = game.queue.length;
      show('play');
      nextQuestion();
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
      $('challengeDesc').textContent = CHALLENGE_DESC;
    }
  }

  async function submitChallenge() {
    renderSummary();
    show('summary');
    const box = $('challengeBox');
    box.hidden = false;
    box.innerHTML = '<div class="ch-note">採点中…</div>';
    try {
      const r = await api('/api/challenge/finish', { id: game.challenge.id, answers: game.answers });
      game.challenge.result = r;
      if (r.name) me.name = r.name;
      renderChallengeSummary();
    } catch (e) {
      box.innerHTML = `<div class="ch-note bad">${Cert.esc(e.message)}</div>`;
    }
  }

  function renderChallengeSummary() {
    const r = game.challenge.result;
    $('totalScore').textContent = r.score;
    $('totalMax').textContent = '/ ' + Cert.MAX;
    $('stats').className = 'stats four';
    $('stats').innerHTML = r.sections.map((s, i) => stat(s.score, Cert.SECTION_LABELS[i])).join('');
    const box = $('challengeBox');
    const rank = r.flagged
      ? '<div class="ch-note bad">回答が速すぎる問題があったため、ランキングには載りません</div>'
      : `<div class="ch-ranks"><span>今週 <b>${r.weekRank}位</b></span><span>歴代 <b>${r.allRank}位</b></span></div>`;
    if (me.name) {
      box.innerHTML = rank + `<button class="btn primary big" id="toCert" type="button">成績証明書を見る</button>`;
      $('toCert').addEventListener('click', () => openCert(r.id));
    } else {
      box.innerHTML = rank +
        '<form class="name-form" id="nameForm">' +
        '<label for="nameInput">名前を登録すると、ランキングに載って成績証明書が発行されます</label>' +
        '<div class="name-row"><input id="nameInput" maxlength="10" autocomplete="nickname" placeholder="10文字まで" required>' +
        '<button class="btn primary" type="submit">登録</button></div>' +
        '<small>ひらがな・カタカナ・漢字・英数字。この端末に結び付きます</small></form>';
      $('nameForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        try {
          me.name = (await api('/api/name', { name: $('nameInput').value })).name;
          renderMe();
          openCert(r.id);
        } catch (e) {
          toast(e.message);
        }
      });
    }
  }

  // ---- 成績証明書 ---------------------------------------------------------------

  async function openCert(id) {
    try {
      const run = await api('/api/run/' + id);
      $('certBox').innerHTML = Cert.certHTML(run);
      $('certX').href = Cert.xIntentUrl(run);
      $('certCopy').onclick = async () => {
        try {
          await navigator.clipboard.writeText(Cert.certUrl(run.id));
          toast('証明書のリンクをコピーしました');
        } catch (e) {
          toast(Cert.certUrl(run.id));
        }
      };
      show('cert');
    } catch (e) {
      toast(e.message);
    }
  }

  // ---- ランキング ---------------------------------------------------------------

  let rankPeriod = 'week';

  async function openRanking(period) {
    if (!serverAvailable()) {
      toast('ランキングは公開サイト（xyz-training.pages.dev）で見られます');
      return;
    }
    if (period) rankPeriod = period;
    show('rank');
    for (const b of document.querySelectorAll('.rank-tabs button')) b.setAttribute('aria-selected', String(b.dataset.period === rankPeriod));
    const list = $('rankList');
    list.innerHTML = '<li class="rank-empty">読み込み中…</li>';
    try {
      const d = await api('/api/ranking?period=' + rankPeriod);
      list.innerHTML = '';
      if (!d.rows.length) list.innerHTML = '<li class="rank-empty">まだ記録がありません。一番乗りのチャンス</li>';
      for (const r of d.rows) {
        const li = document.createElement('li');
        li.className = 'rank-row' + (r.me ? ' me' : '') + (r.rank <= 3 ? ' top' + r.rank : '');
        li.innerHTML =
          `<span class="rk">${r.rank}</span>` +
          `<span class="nm">${Cert.esc(r.name)}<small>${r.sections.join(' · ')}</small></span>` +
          `<span class="sc">${r.score}</span>`;
        li.addEventListener('click', () => openCert(r.id));
        list.appendChild(li);
      }
      $('rankWeek').textContent = d.week ? `${d.week.slice(5).replace('-', '/')} の週（月曜0時に切り替え）` : 'すべての期間';
    } catch (e) {
      list.innerHTML = `<li class="rank-empty">${Cert.esc(e.message)}</li>`;
    }
  }

  async function changeName(ev) {
    ev.preventDefault();
    try {
      me.name = (await api('/api/name', { name: $('renameInput').value })).name;
      renderMe();
      $('renameForm').hidden = true;
      toast('名前を変更しました');
      openRanking();
    } catch (e) {
      toast(e.message);
    }
  }

  // ---- 起動 -----------------------------------------------------------------

  function renderDemo() {
    const p = M.generateOneShantenProblem();
    renderHandRow($('demoHand'), p.hand, p.draw, false);
  }

  function updateModeDesc() {
    $('randomDesc').textContent = `${settings.questions}問・毎回ちがう手牌`;
  }

  function init() {
    preloadTiles();
    renderSettings();
    renderDemo();
    updateModeDesc();
    updateDailyButton();
    loadMe();
    $('startChallenge').addEventListener('click', () => startChallenge());
    $('openRanking').addEventListener('click', () => openRanking());
    for (const b of document.querySelectorAll('.rank-tabs button')) b.addEventListener('click', () => openRanking(b.dataset.period));
    $('rankHome').addEventListener('click', () => show('start'));
    $('certHome').addEventListener('click', () => { renderDemo(); updateDailyButton(); show('start'); });
    $('certRank').addEventListener('click', () => openRanking('week'));
    $('renameOpen').addEventListener('click', () => {
      $('renameForm').hidden = !$('renameForm').hidden;
      $('renameInput').value = me.name || '';
    });
    $('renameForm').addEventListener('submit', changeName);
    $('startDaily').addEventListener('click', () => startSet('daily'));
    $('shareBtn').addEventListener('click', copyShare);
    $('startRandom').addEventListener('click', () => startSet('random'));
    $('startSeries').addEventListener('click', () => startSet('series'));
    $('startTwo').addEventListener('click', () => startSet('two'));
    $('startTwoSeries').addEventListener('click', () => startSet('twoSeries'));
    $('settingsGrid').addEventListener('change', updateModeDesc);
    $('resetSettings').addEventListener('click', () => {
      settings = Object.assign({}, DEFAULTS);
      saveSettings();
      renderSettings();
      updateModeDesc();
    });
    $('hand').addEventListener('click', onHandClick);
    $('palette').addEventListener('click', onPaletteClick);
    $('clearBtn').addEventListener('click', clearSelection);
    $('submitBtn').addEventListener('click', submitZ);
    $('nextBtn').addEventListener('click', onNext);
    $('againBtn').addEventListener('click', () => startSet(game.mode));
    $('homeBtn').addEventListener('click', () => { renderDemo(); updateDailyButton(); show('start'); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && game.q && game.q.phase === 'z') {
        e.preventDefault();
        submitZ();
      }
    });
  }

  init();
})();
