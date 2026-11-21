import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

// アプリと同じ色
export const C = {
  bg: '#f6f6f3',
  surface: '#ffffff',
  line: '#e2e2dc',
  ink: '#15161a',
  muted: '#6c6f78',
  x: '#ff4b1f',
  y: '#1f5bff',
  z: '#ffc414',
  good: '#0f9f4f',
  warn: '#f08a00',
};
export const DISPLAY = '"XYZ Display", "Hiragino Sans", sans-serif';
export const BODY = '"XYZ Body", "Hiragino Sans", sans-serif';

export const W = 1920;
export const H = 1080;
export const TILE_RATIO = 84 / 60;

/** "3m" → 牌番号 0〜33 */
export const num = (code: string) => 'mpsz'.indexOf(code[1]) * 9 + Number(code[0]) - 1;

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const ease = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], { ...clamp, easing: Easing.out(Easing.cubic) });

export const Tile: React.FC<{
  code: string;
  x: number;
  y: number;
  w: number;
  shadow?: string;
  outline?: string;
  opacity?: number;
  lift?: number;
  scale?: number;
}> = ({ code, x, y, w, shadow = '#d5d7dd', outline, opacity = 1, lift = 0, scale = 1 }) => (
  <Img
    src={staticFile(`tiles/${code}.svg`)}
    style={{
      position: 'absolute',
      left: x,
      top: y - lift,
      width: w,
      height: w * TILE_RATIO,
      opacity,
      transform: `scale(${scale})`,
      borderRadius: '13% / 9%',
      boxShadow: `0 ${w * 0.06}px 0 ${shadow}`,
      outline: outline ? `${w * 0.075}px solid ${outline}` : undefined,
      outlineOffset: outline ? 2 : undefined,
    }}
  />
);

/** 角丸の四角に X / Y / Z */
export const Key: React.FC<{ k: 'X' | 'Y' | 'Z' | '○' | '△'; size: number; style?: React.CSSProperties }> = ({ k, size, style }) => {
  const bg = { X: C.x, Y: C.y, Z: C.z, '○': C.good, '△': C.warn }[k];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: size * 0.18,
        background: bg,
        color: k === 'Z' ? C.ink : '#fff',
        fontFamily: DISPLAY,
        fontSize: size * 0.72,
        lineHeight: 1,
        flex: 'none',
        ...style,
      }}
    >
      {k}
    </span>
  );
};

/** 指（タップ位置）。keys: [frame, x, y]、taps: タップする frame */
export const Finger: React.FC<{ keys: [number, number, number][]; taps: number[]; show?: [number, number] }> = ({ keys, taps, show }) => {
  const f = useCurrentFrame();
  const fs = keys.map((k) => k[0]);
  const x = interpolate(f, fs, keys.map((k) => k[1]), { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const y = interpolate(f, fs, keys.map((k) => k[2]), { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const [s0, s1] = show ?? [keys[0][0], keys[keys.length - 1][0] + 15];
  const op = Math.min(ease(f, s0 - 6, s0), 1 - ease(f, s1, s1 + 8));
  const last = taps.filter((t) => t <= f).pop();
  const since = last == null ? 99 : f - last;
  const press = since < 6 ? interpolate(since, [0, 2, 6], [1, 0.82, 1]) : 1;
  return (
    <>
      {last != null && since < 14 && (
        <div
          style={{
            position: 'absolute',
            left: x - 60,
            top: y - 60,
            width: 120,
            height: 120,
            borderRadius: 60,
            border: `6px solid ${C.ink}`,
            opacity: interpolate(since, [0, 14], [0.5, 0]),
            transform: `scale(${interpolate(since, [0, 14], [0.4, 1.3])})`,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: x - 34,
          top: y - 34,
          width: 68,
          height: 68,
          borderRadius: 34,
          background: 'rgba(21,22,26,0.32)',
          border: '4px solid rgba(255,255,255,0.9)',
          opacity: op,
          transform: `scale(${press})`,
        }}
      />
    </>
  );
};

export const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; from?: number }> = ({
  at,
  children,
  style,
  from = 0.6,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 12, stiffness: 180 } });
  return (
    <div style={{ ...style, opacity: f < at ? 0 : Math.min(1, s * 1.5), transform: `${style?.transform ?? ''} scale(${from + (1 - from) * s})` }}>
      {children}
    </div>
  );
};
