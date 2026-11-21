import React from 'react';
import { AbsoluteFill } from 'remotion';
import data from './data.json';
import { Logo } from './scenes';
import { BODY, C, DISPLAY, Tile } from './ui';

// X などに貼ったときのカード画像（1200×630）。サイトの og.png
export const Og: React.FC = () => {
  const p = data.one;
  const tiles = [...p.hand, p.draw];
  const tw = 52;
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: BODY, color: C.ink }}>
      <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 16, display: 'flex' }}>
        <div style={{ flex: 1, background: C.x }} />
        <div style={{ flex: 1, background: C.y }} />
        <div style={{ flex: 1, background: C.z }} />
      </div>
      <Logo at={-100} size={96} top={64} left={80} />
      <div style={{ position: 'absolute', left: 80, top: 446 }}>
        {tiles.map((c, i) => (
          <Tile key={i} code={c} x={i * (tw + 4) + (i === 13 ? 18 : 0)} y={0} w={tw} shadow={i === 13 ? C.x : undefined} />
        ))}
      </div>
      <div style={{ position: 'absolute', left: 80, bottom: 44, fontFamily: DISPLAY, fontSize: 40, letterSpacing: '0.04em' }}>XYZトレーニング</div>
      <div style={{ position: 'absolute', right: 80, bottom: 50, fontSize: 26, fontWeight: 700, color: C.muted }}>xyz-training.pages.dev</div>
    </AbsoluteFill>
  );
};
