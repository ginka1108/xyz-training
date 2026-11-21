import React from 'react';
import { Composition, Series, continueRender, delayRender, staticFile } from 'remotion';
import data from './data.json';
import { Daily, Outro, Play, Title, playLength } from './scenes';
import { Og } from './Og';

// フォントは public/fonts に置いた、動画で使う文字だけのサブセット
const fontHandle = delayRender('fonts');
Promise.all([
  new FontFace('XYZ Display', `url(${staticFile('fonts/display.woff2')})`).load(),
  new FontFace('XYZ Body', `url(${staticFile('fonts/body.woff2')})`, { weight: '700' }).load(),
])
  .then((fonts) => {
    fonts.forEach((f) => document.fonts.add(f));
    continueRender(fontHandle);
  })
  .catch((e) => {
    console.error(e);
    continueRender(fontHandle);
  });

const ONE_GAP = 14;
const TWO_GAP = 9;
// 連続設問：2問目以降は手牌がもう出ているので少し前倒し、判定は短めに見せる
const SERIES_GAP = 14;
const SERIES_SHIFT = 10;
const SERIES_HOLD = 50;

const steps = data.series.steps.map((st) => ({ hand: data.series.hand, ...st }));
const stepLen = steps.map((p, i) => playLength(p, SERIES_GAP, i === 0 ? 0 : SERIES_SHIFT, SERIES_HOLD));

const LEN = {
  title: 70,
  one: playLength(data.one, ONE_GAP),
  two: playLength(data.two, TWO_GAP),
  daily: 120,
  outro: 90,
};
const TOTAL = Object.values(LEN).reduce((a, b) => a + b, 0) + stepLen.reduce((a, b) => a + b, 0);

const Video: React.FC = () => (
  <Series>
    <Series.Sequence durationInFrames={LEN.title}>
      <Title />
    </Series.Sequence>
    <Series.Sequence durationInFrames={LEN.one}>
      <Play p={data.one} gap={ONE_GAP} />
    </Series.Sequence>
    {steps.map((p, i) => (
      <Series.Sequence key={i} durationInFrames={stepLen[i]}>
        <Play
          p={p}
          gap={SERIES_GAP}
          tag={`同じ13枚　${i + 1} / ${steps.length}`}
          shift={i === 0 ? 0 : SERIES_SHIFT}
          handReady={i > 0}
        />
      </Series.Sequence>
    ))}
    <Series.Sequence durationInFrames={LEN.two}>
      <Play p={data.two} gap={TWO_GAP} tag="二向聴" drop={6} />
    </Series.Sequence>
    <Series.Sequence durationInFrames={LEN.daily}>
      <Daily />
    </Series.Sequence>
    <Series.Sequence durationInFrames={LEN.outro}>
      <Outro />
    </Series.Sequence>
  </Series>
);

export const Root: React.FC = () => (
  <>
    <Composition id="XYZ" component={Video} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
    <Composition id="OG" component={Og} durationInFrames={1} fps={30} width={1200} height={630} />
  </>
);
