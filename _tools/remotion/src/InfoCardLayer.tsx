import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { InfoCardItem } from './types';

interface InfoCardLayerProps {
  cards: InfoCardItem[];
  accentColor: string;
  hidden?: boolean;
}

const ICON_GLYPHS: Record<InfoCardItem['icon'], string> = {
  check: '✓',
  alert: '!',
  chart: '↗',
  bag: '★',
  bolt: '⚡',
  clock: '◷',
};

export const InfoCardLayer: React.FC<InfoCardLayerProps> = ({
  cards,
  accentColor,
  hidden = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (hidden) {
    return null;
  }

  const activeIdx = cards.findIndex(
    (c) => frame >= c.startFrame && frame < c.endFrame
  );
  if (activeIdx === -1) {
    return null;
  }

  const active = cards[activeIdx];
  const localFrame = frame - active.startFrame;
  const duration = Math.max(1, active.endFrame - active.startFrame);
  const slide = spring({
    frame: localFrame,
    fps,
    config: { damping: 15, stiffness: 220, mass: 0.65 },
  });
  const fadeOut = interpolate(
    localFrame,
    [Math.max(0, duration - 6), duration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Chế độ 1: Card có sẵn mảng bullets -> Pop-up liệt kê từng dòng bật ra lần lượt
  if (active.bullets && active.bullets.length > 0) {
    const scaleIn = interpolate(slide, [0, 1], [0.92, 1]);
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 430,
          left: 64,
          right: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
          transform: `scale(${scaleIn})`,
          opacity: slide * fadeOut,
        }}
      >
        <div
          style={{
            width: '100%',
            borderRadius: 24,
            backgroundColor: 'rgba(15, 23, 42, 0.90)',
            backdropFilter: 'blur(14px)',
            border: `2px solid ${accentColor}`,
            padding: '20px 24px',
            boxShadow: '0 18px 44px rgba(2, 6, 23, 0.55)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #2563EB, #06B6D4)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '"Be Vietnam Pro", sans-serif',
                fontWeight: 900,
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {ICON_GLYPHS[active.icon] || '⚡'}
            </div>
            <div
              style={{
                fontFamily: '"Be Vietnam Pro", sans-serif',
                fontWeight: 800,
                fontSize: 28,
                color: '#F8FAFC',
                lineHeight: 1.2,
              }}
            >
              {active.label}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active.bullets.slice(0, 4).map((b, bIdx) => {
              const itemPop = spring({
                frame: Math.max(0, localFrame - bIdx * 9),
                fps,
                config: { damping: 16, stiffness: 210 },
              });
              return (
                <div
                  key={bIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 14px',
                    borderRadius: 14,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    opacity: itemPop,
                    transform: `translateY(${interpolate(itemPop, [0, 1], [14, 0])}px)`,
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: accentColor,
                      color: '#0F172A',
                      fontFamily: '"Be Vietnam Pro", sans-serif',
                      fontWeight: 900,
                      fontSize: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {bIdx + 1}
                  </span>
                  <span
                    style={{
                      fontFamily: '"Be Vietnam Pro", sans-serif',
                      fontWeight: 600,
                      fontSize: 24,
                      lineHeight: 1.25,
                      color: '#E2E8F0',
                    }}
                  >
                    {b}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Chế độ 2: Chuỗi các card có step -> xếp chồng các ý đã liệt kê (tối đa 3 ý gần nhất)
  if (active.step && active.step > 0) {
    const stackCards = cards
      .slice(0, activeIdx + 1)
      .filter((c) => Boolean(c.step))
      .slice(-3);

    return (
      <div
        style={{
          position: 'absolute',
          bottom: 430,
          left: 64,
          right: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 10,
          pointerEvents: 'none',
          opacity: fadeOut,
        }}
      >
        {stackCards.map((item) => {
          const isCurrent = item.id === active.id;
          const itemPop = isCurrent ? slide : 1;
          const itemTranslateX = isCurrent
            ? interpolate(itemPop, [0, 1], [-44, 0])
            : 0;
          const itemScale = isCurrent
            ? interpolate(itemPop, [0, 1], [0.92, 1])
            : 0.95;

          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                backgroundColor: isCurrent
                  ? 'rgba(255, 255, 255, 0.96)'
                  : 'rgba(15, 23, 42, 0.84)',
                backdropFilter: 'blur(12px)',
                border: isCurrent
                  ? `2.5px solid ${accentColor}`
                  : '1.5px solid rgba(148, 163, 184, 0.35)',
                borderRadius: 20,
                padding: isCurrent ? '12px 22px 12px 14px' : '8px 18px 8px 12px',
                boxShadow: isCurrent
                  ? '0 14px 36px rgba(14, 165, 233, 0.32)'
                  : '0 8px 20px rgba(0, 0, 0, 0.35)',
                transform: `translateX(${itemTranslateX}px) scale(${itemScale})`,
                transformOrigin: 'left center',
                opacity: isCurrent ? itemPop : 0.88,
                maxWidth: '96%',
              }}
            >
              <div
                style={{
                  minWidth: isCurrent ? 46 : 36,
                  height: isCurrent ? 46 : 36,
                  borderRadius: 13,
                  background: isCurrent
                    ? 'linear-gradient(135deg, #2563EB, #06B6D4)'
                    : 'rgba(56, 189, 248, 0.22)',
                  color: isCurrent ? '#FFFFFF' : '#7DD3FC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: '"Be Vietnam Pro", sans-serif',
                  fontWeight: 900,
                  fontSize: isCurrent ? 22 : 18,
                  flexShrink: 0,
                }}
              >
                {String(item.step).padStart(2, '0')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div
                  style={{
                    fontFamily: '"Be Vietnam Pro", sans-serif',
                    fontWeight: isCurrent ? 800 : 700,
                    fontSize: isCurrent ? 30 : 23,
                    lineHeight: 1.18,
                    color: isCurrent ? '#0F172A' : '#E2E8F0',
                  }}
                >
                  {item.label}
                </div>
                {isCurrent && item.detail ? (
                  <div
                    style={{
                      fontFamily: '"Be Vietnam Pro", sans-serif',
                      fontWeight: 600,
                      fontSize: 21,
                      lineHeight: 1.2,
                      color: '#334155',
                    }}
                  >
                    {item.detail}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Chế độ 3: Card đơn lẻ mặc định
  const translateX = interpolate(slide, [0, 1], [-48, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        top: 1210,
        left: 64,
        right: 136,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        transform: `translateX(${translateX}px)`,
        opacity: slide * fadeOut,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(12px)',
          border: `2px solid ${accentColor}`,
          borderRadius: 999,
          padding: '12px 24px 12px 14px',
          boxShadow: '0 12px 32px rgba(14, 165, 233, 0.30)',
          maxWidth: '96%',
        }}
      >
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563EB, #06B6D4)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontWeight: 900,
            fontSize: 26,
            flexShrink: 0,
          }}
        >
          {ICON_GLYPHS[active.icon] || '⚡'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontWeight: 800,
              fontSize: 32,
              lineHeight: 1.15,
              color: '#0F172A',
            }}
          >
            {active.label}
          </div>
          {active.detail ? (
            <div
              style={{
                fontFamily: '"Be Vietnam Pro", sans-serif',
                fontWeight: 600,
                fontSize: 22,
                lineHeight: 1.2,
                color: '#334155',
              }}
            >
              {active.detail}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
