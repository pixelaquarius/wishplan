import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CaptionItem } from './types';

interface CaptionsLayerProps {
  captions: CaptionItem[];
  accentColor: string;
  numberColor: string;
  captionColor: string;
  fontSize: number;
  bottomPx: number;
  stylePreset?: 'editorial' | 'boxed';
}

function renderWordTimedCaption(
  active: CaptionItem,
  frame: number,
  fps: number,
  accentColor: string,
  numberColor: string,
  baseColor: string
) {
  const words = active.words || [];
  if (!words.length) {
    return renderHighlightedText(
      active.text,
      active.keywords,
      accentColor,
      numberColor,
      baseColor
    );
  }
  const cleanKeywords = (active.keywords || [])
    .filter((k) => k && k.trim().length > 0)
    .map((k) => k.toLowerCase());

  return words.map((w, idx) => {
    const isCurrent = frame >= w.startFrame && frame < w.endFrame;
    const wClean = w.word.replace(/[.,!?;:"'()]/g, '').toLowerCase();
    const isKw = cleanKeywords.some(
      (kw) => kw === wClean || (wClean.length >= 3 && kw.includes(wClean))
    );
    const isNum = /\d/.test(w.word);
    const color = isNum
      ? numberColor
      : isKw || isCurrent
        ? accentColor
        : baseColor;
    const wordPop = spring({
      frame: Math.max(0, frame - w.startFrame),
      fps,
      config: { damping: 14, stiffness: 280, mass: 0.5 },
    });
    const wScale = isCurrent ? interpolate(wordPop, [0, 1], [0.95, 1.07]) : 1.0;

    return (
      <span
        key={idx}
        style={{
          display: 'inline-block',
          color,
          transform: `scale(${wScale})`,
          marginRight: '0.24em',
          textShadow:
            isCurrent || isKw || isNum
              ? `0 0 18px ${color}66, 0 4px 16px rgba(0, 0, 0, 0.96)`
              : undefined,
        }}
      >
        {w.word}
      </span>
    );
  });
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedText(
  text: string,
  keywords: string[],
  accentColor: string,
  numberColor: string,
  baseColor: string
) {
  const cleanKeywords = keywords.filter((k) => k && k.trim().length > 0);
  if (cleanKeywords.length === 0) {
    return <span style={{ color: baseColor }}>{text}</span>;
  }
  const sorted = [...cleanKeywords].sort((a, b) => b.length - a.length);
  const regex = new RegExp(`(${sorted.map(escapeRegExp).join('|')})`, 'giu');
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    const matched = sorted.some((kw) => kw.toLowerCase() === part.toLowerCase());
    if (!matched) {
      return (
        <span key={idx} style={{ color: baseColor }}>
          {part}
        </span>
      );
    }
    const isNumeric = /\d/.test(part);
    const hlColor = isNumeric ? numberColor : accentColor;
    return (
      <span
        key={idx}
        style={{
          color: hlColor,
          textShadow: `0 0 18px ${hlColor}55, 0 4px 16px rgba(0, 0, 0, 0.96)`,
        }}
      >
        {part}
      </span>
    );
  });
}

export const CaptionsLayer: React.FC<CaptionsLayerProps> = ({
  captions,
  accentColor,
  numberColor,
  captionColor,
  fontSize,
  bottomPx,
  stylePreset = 'editorial',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const active = captions.find(
    (item) => frame >= item.startFrame && frame < item.endFrame
  );
  if (!active) {
    return null;
  }

  const localFrame = frame - active.startFrame;
  const pop = spring({
    frame: localFrame,
    fps,
    config: { damping: 16, stiffness: 260, mass: 0.6 },
  });
  const scale = interpolate(pop, [0, 1], [0.94, 1]);
  const opacity = interpolate(localFrame, [0, 3], [0.4, 1], {
    extrapolateRight: 'clamp',
  });

  const isBoxed = stylePreset === 'boxed';

  return (
    <div
      style={{
        position: 'absolute',
        left: 64,
        right: 136, // Chừa lề phải cho nút Like/Comment/Share của TikTok
        bottom: bottomPx,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        pointerEvents: 'none',
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <div
        style={
          isBoxed
            ? {
                backgroundColor: 'rgba(10, 15, 28, 0.78)',
                borderRadius: 20,
                padding: '14px 26px',
                border: '2px solid rgba(255, 255, 255, 0.14)',
                boxShadow: '0 10px 28px rgba(0, 0, 0, 0.45)',
                maxWidth: '100%',
              }
            : {
                padding: '4px 10px',
                maxWidth: '100%',
              }
        }
      >
        <div
          style={{
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontWeight: 800,
            fontSize,
            lineHeight: 1.22,
            letterSpacing: '-0.015em',
            textShadow: isBoxed
              ? '0 3px 10px rgba(0,0,0,0.9)'
              : '0 4px 18px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.98), 0 0 2px rgba(0,0,0,0.95)',
            wordBreak: 'break-word',
            textWrap: 'balance',
          }}
        >
          {renderWordTimedCaption(
            active,
            frame,
            fps,
            accentColor,
            numberColor,
            captionColor
          )}
        </div>
        {active.subtext ? (
          <div
            style={{
              marginTop: 10,
              display: 'inline-block',
              padding: isBoxed ? '0px' : '6px 16px',
              borderRadius: isBoxed ? 0 : 999,
              backgroundColor: isBoxed ? 'transparent' : 'rgba(15, 23, 42, 0.62)',
              backdropFilter: isBoxed ? undefined : 'blur(8px)',
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontWeight: 600,
              fontSize: Math.max(24, Math.round(fontSize * 0.5)),
              lineHeight: 1.28,
              color: '#E2E8F0',
              letterSpacing: '0.01em',
            }}
          >
            {active.subtext}
          </div>
        ) : null}
      </div>
    </div>
  );
};
