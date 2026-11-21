import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { BODY, C, DISPLAY, Finger, Key, Pop, Tile, TILE_RATIO, W, clamp, ease, num } from './ui';

// 横長 1920×1080。左に「状況・手牌・打牌・判定」、右に「Z の入力パレット」。
const PAD = 80;
const LEFT_CX = 560; // 左の列の中心
const RIGHT_X = 1130; // 右の列（パレット）の左端

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: BODY, color: C.ink, opacity: ease(f, 0, 6) }}>{children}</AbsoluteFill>
  );
};

const Brand: React.FC = () => (
  <div style={{ position: 'absolute', left: PAD, top: 48, fontFamily: DISPLAY, fontSize: 36, letterSpacing: '0.04em' }}>XYZトレーニング</div>
);

const Pill: React.FC<{ text: string; at?: number }> = ({ text, at = 0 }) => (
  <Pop at={at} style={{ position: 'absolute', left: 460, top: 50, transformOrigin: 'left center' }}>
    <span style={{ background: C.z, borderRadius: 999, padding: '6px 26px', fontSize: 32, fontWeight: 700 }}>{text}</span>
  </Pop>
);

// ---- ロゴ ----------------------------------------------------------------

export const Logo: React.FC<{ at?: number; size?: number; top?: number; left?: number }> = ({ at = 0, size = 150, top = 0, left = 0 }) => {
  const lines: ['X' | 'Y' | 'Z', string][] = [
    ['X', 'を引いたら'],
    ['Y', 'を切って'],
    ['Z', '待ち'],
  ];
  return (
    <div style={{ position: 'absolute', left, top, display: 'flex', flexDirection: 'column', gap: size * 0.2 }}>
      {lines.map(([k, rest], i) => (
        <Pop key={k} at={at + i * 12} from={0.3} style={{ transformOrigin: 'left center', marginLeft: i * size * 0.45 }}>
          <div style={{ display: 'flex', alignItems: 'center', fontFamily: DISPLAY, fontSize: size * 0.78, lineHeight: 1, whiteSpace: 'nowrap' }}>
            <Key k={k} size={size} style={{ marginRight: size * 0.12 }} />
            {rest}
          </div>
        </Pop>
      ))}
    </div>
  );
};

export const Title: React.FC = () => (
  <Frame>
    <Logo at={4} size={150} top={250} left={600} />
  </Frame>
);

export const Outro: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Frame>
      <Logo at={2} size={120} top={190} left={640} />
      <div
        style={{
          position: 'absolute',
          width: W,
          top: 800,
          textAlign: 'center',
          fontFamily: DISPLAY,
          fontSize: 64,
          letterSpacing: '0.06em',
          opacity: ease(f, 36, 50),
          transform: `translateY(${ease(f, 36, 50, 20, 0)}px)`,
        }}
      >
        XYZトレーニング
      </div>
    </Frame>
  );
};

// ---- 手牌の配置 -----------------------------------------------------------

const TW = 62;
const TG = 4;
const HAND_GAP_X = 26;

function handX(i: number, total: number, cx = LEFT_CX) {
  // total = 14（ツモあり）: 13枚 + すき間 + ツモ
  const width = 13 * (TW + TG) + (total === 14 ? HAND_GAP_X + TW : -TG);
  const x0 = cx - width / 2;
  return i < 13 ? x0 + i * (TW + TG) : x0 + 13 * (TW + TG) + HAND_GAP_X;
}

/** 切った牌の id（手牌の index、ツモなら 13）と、残り13枚の並び順 */
function afterDiscard(hand: string[], draw: string, y: string) {
  const all = [...hand, draw];
  const cut = draw === y ? 13 : hand.indexOf(y);
  const rest = all.map((c, id) => ({ c, id })).filter((t) => t.id !== cut);
  rest.sort((a, b) => num(a.c) - num(b.c) || a.id - b.id);
  const rank = new Map(rest.map((t, r) => [t.id, r]));
  return { cut, rank };
}

const Hand: React.FC<{
  hand: string[];
  draw: string;
  y: string;
  top: number;
  inAt: number;
  drawAt: number;
  cutAt: number;
  river: { x: number; y: number; w: number };
}> = ({ hand, draw, y, top, inAt, drawAt, cutAt, river }) => {
  const f = useCurrentFrame();
  const th = TW * TILE_RATIO;
  const tiles = [...hand, draw];
  const after = afterDiscard(hand, draw, y);
  const t = ease(f, cutAt + 4, cutAt + 18);
  return (
    <>
      {tiles.map((code, id) => {
        const isDraw = id === 13;
        const appear = isDraw ? ease(f, drawAt, drawAt + 10) : ease(f, inAt + id, inAt + id + 8);
        let x = handX(id, 14);
        let yy = top + (1 - appear) * (isDraw ? -80 : 40);
        let w = TW;
        let shadow = isDraw ? C.x : undefined;
        let lift = 0;
        if (f >= cutAt) {
          if (id === after.cut) {
            lift = ease(f, cutAt, cutAt + 4, 0, 18) * (1 - t);
            x = interpolate(t, [0, 1], [x, river.x]);
            yy = interpolate(t, [0, 1], [yy, river.y]);
            w = interpolate(t, [0, 1], [TW, river.w]);
            shadow = C.y;
          } else {
            x = interpolate(t, [0, 1], [x, handX(after.rank.get(id)!, 13)]);
            shadow = undefined;
          }
        }
        return <Tile key={id} code={code} x={x} y={yy} w={w} shadow={shadow} opacity={appear} lift={lift} />;
      })}
      <div
        style={{
          position: 'absolute',
          left: handX(13, 14),
          width: TW,
          top: top + th + 14,
          textAlign: 'center',
          fontFamily: DISPLAY,
          fontSize: 26,
          color: C.x,
          opacity: ease(f, drawAt + 6, drawAt + 12) * (1 - ease(f, cutAt, cutAt + 6)),
        }}
      >
        X
      </div>
    </>
  );
};

// ---- Z の入力パレット（右の列） ------------------------------------------

const PW = 74;
const PG = 8;
const P_TOP = 330;
const P_ROW = PW * TILE_RATIO + 16;
const P_WIDTH = 9 * PW + 8 * PG;
const pPos = (code: string) => {
  const t = num(code);
  return { x: RIGHT_X + (t % 9) * (PW + PG), y: P_TOP + Math.floor(t / 9) * P_ROW };
};
const ALL = [...'mps'].flatMap((s) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => n + s)).concat([1, 2, 3, 4, 5, 6, 7].map((n) => n + 'z'));

const Palette: React.FC<{ at: number; selected: Map<string, number> }> = ({ at, selected }) => {
  const f = useCurrentFrame();
  const a = ease(f, at, at + 14);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: a, transform: `translateX(${(1 - a) * 120}px)` }}>
      {ALL.map((code) => {
        const p = pPos(code);
        const s = selected.get(code);
        const on = s != null && f >= s;
        return <Tile key={code} code={code} x={p.x} y={p.y} w={PW} lift={on ? 8 : 0} outline={on ? C.z : undefined} shadow={on ? C.z : undefined} />;
      })}
    </div>
  );
};

const SUBMIT = { x: RIGHT_X + P_WIDTH / 2, y: P_TOP + 4 * P_ROW + 70 };

const SubmitButton: React.FC<{ at: number; pressedAt: number }> = ({ at, pressedAt }) => {
  const f = useCurrentFrame();
  const a = ease(f, at, at + 14);
  const pressed = f >= pressedAt && f < pressedAt + 5;
  return (
    <div
      style={{
        position: 'absolute',
        left: RIGHT_X,
        width: P_WIDTH,
        top: SUBMIT.y - 50,
        height: 100,
        borderRadius: 22,
        background: C.ink,
        color: '#fff',
        fontSize: 42,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: a,
        transform: `translateX(${(1 - a) * 120}px) translateY(${pressed ? 4 : 0}px)`,
      }}
    >
      決定
    </div>
  );
};

// ---- 出題画面（Y → Z → 判定） --------------------------------------------

export type Problem = { hand: string[]; draw: string; y: string; waits: string[] };

/** shift: 手牌がもう出ている場合に前倒しするフレーム数。hold: 判定を見せる長さ */
const timeline = (p: Problem, gap: number, shift: number) => {
  const yTap = 52 - shift;
  const zAt = 64 - shift;
  const tapsZ = p.waits.map((_, i) => 84 - shift + i * gap);
  const submit = tapsZ[tapsZ.length - 1] + 16;
  return { yTap, zAt, tapsZ, submit, verdict: submit + 4 };
};

export const playLength = (p: Problem, gap: number, shift = 0, hold = 80) => timeline(p, gap, shift).verdict + hold;

export const Play: React.FC<{ p: Problem; tag?: string; gap: number; drop?: number; shift?: number; handReady?: boolean }> = ({
  p,
  tag,
  gap,
  drop = 0,
  shift = 0,
  handReady = false,
}) => {
  const f = useCurrentFrame();
  const HAND_TOP = 370;
  const RIVER = { x: LEFT_CX - 33, y: 580, w: 66 };
  const { yTap, zAt, tapsZ, submit, verdict } = timeline(p, gap, shift);
  const drawAt = handReady ? 4 : 14;

  const after = afterDiscard(p.hand, p.draw, p.y);
  const yTile = { x: handX(after.cut, 14) + TW / 2, y: HAND_TOP + 46 };

  // 指の動き
  const keys: [number, number, number][] = [
    [yTap - 22, yTile.x + 120, yTile.y + 240],
    [yTap - 6, yTile.x, yTile.y],
    [zAt + 8, (yTile.x + RIGHT_X) / 2 + 200, yTile.y + 160],
  ];
  tapsZ.forEach((t, i) => {
    const q = pPos(p.waits[i]);
    keys.push([t - 2, q.x + PW / 2, q.y + 50]);
    keys.push([t + 1, q.x + PW / 2, q.y + 50]);
  });
  keys.push([submit - 2, SUBMIT.x, SUBMIT.y]);
  keys.push([submit + 2, SUBMIT.x, SUBMIT.y]);

  // タイマーと点
  const phaseZ = f >= zAt;
  const fill = phaseZ ? interpolate(f, [zAt, submit], [1, 0.62], clamp) : interpolate(f, [drawAt + 6, yTap], [1, 0.82], clamp);
  const dropStart = submit - 30;
  const dropping = drop > 0 && f >= dropStart && f < verdict;
  const score = drop > 0 ? Math.round(100 - drop * ease(f, dropStart, submit)) : 100;
  const done = f >= verdict;

  const selected = new Map(p.waits.map((w, i) => [w, tapsZ[i]] as const));

  return (
    <Frame>
      <Brand />
      {tag && <Pill text={tag} />}
      {/* 状況：Y / Z と点数、タイマー（左の列） */}
      <div style={{ position: 'absolute', left: PAD, top: 160 }}>
        <Key k={done ? '○' : phaseZ ? 'Z' : 'Y'} size={80} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: W - 1040,
          top: 142,
          fontFamily: DISPLAY,
          fontSize: 104,
          lineHeight: 1,
          color: dropping ? C.x : C.ink,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {score}
      </div>
      <div style={{ position: 'absolute', left: PAD, top: 280, width: 1040 - PAD, height: 16, borderRadius: 8, background: C.line, overflow: 'hidden' }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            background: done ? '#c9cbd2' : dropping ? C.x : C.ink,
            transform: `scaleX(${fill})`,
            transformOrigin: 'left',
          }}
        />
      </div>

      <Hand hand={p.hand} draw={p.draw} y={p.y} top={HAND_TOP} inAt={handReady ? -100 : 0} drawAt={drawAt} cutAt={yTap} river={RIVER} />

      <Palette at={zAt} selected={selected} />
      <SubmitButton at={zAt} pressedAt={submit} />

      {/* 判定（左の列の下） */}
      <Pop at={verdict} from={0.4} style={{ position: 'absolute', left: LEFT_CX - 400, width: 800, top: 760, display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, fontFamily: DISPLAY, fontSize: 130, lineHeight: 1, color: C.good }}>
          <Key k="○" size={140} />
          {score}
        </div>
      </Pop>

      <Finger keys={keys} taps={[yTap, ...tapsZ, submit]} show={[yTap - 22, submit + 12]} />
    </Frame>
  );
};

// ---- 今日の10問 -----------------------------------------------------------

export const Daily: React.FC = () => {
  const f = useCurrentFrame();
  const tap = 28;
  const sw = 40; // 結果画面に切り替わる
  const marks = '○○○○×○○△○○';
  const total = Math.round(interpolate(f, [sw + 6, sw + 50], [0, 874], { ...clamp }));
  const btnOut = ease(f, sw - 6, sw);
  return (
    <Frame>
      <Brand />
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - btnOut }}>
        <Pop at={2} style={{ position: 'absolute', left: (W - 900) / 2, top: 400, width: 900 }}>
          <div
            style={{
              background: C.x,
              color: '#fff',
              borderRadius: 36,
              padding: '64px 0',
              textAlign: 'center',
              fontFamily: DISPLAY,
              fontSize: 110,
              lineHeight: 1,
              transform: f >= tap && f < tap + 5 ? 'translateY(4px)' : undefined,
            }}
          >
            今日の10問
          </div>
        </Pop>
        <Finger keys={[[10, 1300, 860], [tap - 4, 1080, 520], [tap + 6, 1080, 520]]} taps={[tap]} show={[10, sw - 8]} />
      </div>

      <div style={{ position: 'absolute', inset: 0, opacity: ease(f, sw, sw + 8) }}>
        <div style={{ position: 'absolute', top: 170, width: W, textAlign: 'center', fontFamily: DISPLAY, fontSize: 64, color: C.x }}>今日の10問</div>
        <div style={{ position: 'absolute', top: 280, width: W, textAlign: 'center', fontFamily: DISPLAY, fontSize: 280, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {total}
          <span style={{ fontSize: 76, color: C.muted, marginLeft: 12 }}>/1000</span>
        </div>
        <div style={{ position: 'absolute', top: 700, left: 0, width: W, display: 'flex', justifyContent: 'center', gap: 14 }}>
          {[...marks].map((m, i) => {
            const at = sw + 10 + i * 4;
            const color = m === '○' ? C.good : m === '△' ? C.warn : '#e5383b';
            return (
              <Pop key={i} at={at} from={0.2}>
                <div style={{ width: 100, height: 100, borderRadius: 20, background: color, color: '#fff', fontSize: 64, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {m}
                </div>
              </Pop>
            );
          })}
        </div>
      </div>
    </Frame>
  );
};

