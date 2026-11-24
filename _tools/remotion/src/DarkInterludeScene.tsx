import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { DarkInterludeItem } from './types';

interface DarkInterludeSceneProps {
  scenes: DarkInterludeItem[];
  accentColor: string;
  numberColor: string;
}

export const DarkInterludeScene: React.FC<DarkInterludeSceneProps> = ({
  scenes,
  accentColor,
  numberColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const active = scenes.find((s) => frame >= s.startFrame && frame < s.endFrame);
  if (!active) {
    return null;
  }

  const localFrame = frame - active.startFrame;
  const duration = Math.max(1, active.endFrame - active.startFrame);
  const fadeIn = interpolate(localFrame, [0, 6], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(
    localFrame,
    [Math.max(0, duration - 6), duration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const opacity = fadeIn * fadeOut;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(circle at 50% 28%, rgba(30, 58, 138, 0.94) 0%, rgba(9, 15, 30, 0.96) 72%)',
        backgroundImage:
          'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '100px 72px 430px',
        opacity,
        pointerEvents: 'none',
      }}
    >
      {active.metric ? (
        <div
          style={{
            marginBottom: 14,
            padding: '6px 18px',
            borderRadius: 999,
            background: 'linear-gradient(90deg, #2563EB, #06B6D4)',
            color: '#FFFFFF',
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
          }}
        >
          {active.metric}
        </div>
      ) : null}

      <div
        style={{
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontWeight: 900,
          fontSize: 48,
          lineHeight: 1.18,
          color: '#FFFFFF',
          textAlign: 'center',
          textTransform: 'uppercase',
          textShadow: `0 4px 24px rgba(56, 189, 248, 0.45), 0 4px 12px rgba(0, 0, 0, 0.85)`,
          marginBottom: 28,
        }}
      >
        {active.title}
      </div>

      {/* Frosted white glass card theo phong cách mới trong _style_refs */}
      <div
        style={{
          width: '100%',
          borderRadius: 28,
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          border: `2px solid ${accentColor}`,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(14, 165, 233, 0.28)',
        }}
      >
        <div
          style={{
            padding: '30px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {active.bullets.map((b, idx) => {
            const itemAppear = spring({
              frame: Math.max(0, localFrame - idx * 5),
              fps,
              config: { damping: 16, stiffness: 200 },
            });
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  opacity: itemAppear,
                  transform: `translateY(${interpolate(itemAppear, [0, 1], [16, 0])}px)`,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: idx === 0
                      ? 'linear-gradient(135deg, #2563EB, #06B6D4)'
                      : `linear-gradient(135deg, ${accentColor}, ${numberColor})`,
                    color: '#FFFFFF',
                    fontFamily: '"Be Vietnam Pro", sans-serif',
                    fontWeight: 900,
                    fontSize: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 6px 14px rgba(37, 99, 235, 0.25)',
                  }}
                >
                  {idx + 1}
                </div>
                <div
                  style={{
                    fontFamily: '"Be Vietnam Pro", sans-serif',
                    fontWeight: 700,
                    fontSize: 33,
                    lineHeight: 1.28,
                    color: '#0F172A',
                  }}
                >
                  {b}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
