import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface HookBannerProps {
  enabled: boolean;
  title: string;
  eyebrow: string;
  startFrame: number;
  endFrame: number;
  topPx: number;
  accentColor: string;
  stylePreset?: 'editorial' | 'boxed';
}

export const HookBanner: React.FC<HookBannerProps> = ({
  enabled,
  title,
  eyebrow,
  startFrame,
  endFrame,
  topPx,
  accentColor,
  stylePreset = 'editorial',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!enabled || !title.trim() || frame < startFrame || frame >= endFrame) {
    return null;
  }

  const localFrame = frame - startFrame;
  const duration = Math.max(1, endFrame - startFrame);
  const enter = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 240, mass: 0.6 },
  });
  const exitOpacity = interpolate(
    localFrame,
    [Math.max(0, duration - 7), duration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  // Frame-1 instant visibility (iart short-form rule: no fade-up from invisible on frame 0)
  const scalePop = interpolate(enter, [0, 1], [1.06, 1]);

  if (stylePreset === 'boxed') {
    return (
      <div
        style={{
          position: 'absolute',
          top: topPx,
          left: 72,
          right: 72,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
          transform: `scale(${scalePop})`,
          opacity: exitOpacity,
        }}
      >
        {eyebrow ? (
          <div
            style={{
              backgroundColor: accentColor,
              color: '#0F172A',
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontWeight: 800,
              fontSize: 24,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 18px',
              borderRadius: 999,
              marginBottom: -12,
              zIndex: 2,
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div
          style={{
            backgroundColor: 'rgba(10, 15, 28, 0.90)',
            border: `3px solid ${accentColor}`,
            borderRadius: 20,
            padding: '16px 26px 14px',
            textAlign: 'center',
            boxShadow: '0 14px 36px rgba(0, 0, 0, 0.55)',
            maxWidth: '100%',
          }}
        >
          <div
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontWeight: 900,
              fontSize: 42,
              lineHeight: 1.15,
              color: '#FFFFFF',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </div>
        </div>
      </div>
    );
  }

  // Editorial Floating Style (không đóng hộp nặng nề, theo Ref mới _style_refs)
  const words = title.trim().split(/\s+/);
  const splitIdx = words.length > 3 ? Math.max(1, words.length - 3) : words.length;
  const leadText = words.slice(0, splitIdx).join(' ');
  const focusText = words.slice(splitIdx).join(' ');

  return (
    <div
      style={{
        position: 'absolute',
        top: topPx,
        left: 64,
        right: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
        transform: `scale(${scalePop})`,
        opacity: exitOpacity,
      }}
    >
      {eyebrow ? (
        <div
          style={{
            background: 'linear-gradient(90deg, #2563EB 0%, #0EA5E9 100%)',
            color: '#FFFFFF',
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            padding: '7px 20px',
            borderRadius: 999,
            marginBottom: 12,
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.45)',
          }}
        >
          {eyebrow}
        </div>
      ) : null}

      <div
        style={{
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontWeight: 900,
          fontSize: 48,
          lineHeight: 1.16,
          textAlign: 'center',
          textTransform: 'uppercase',
          color: '#FFFFFF',
          textShadow: '0 6px 26px rgba(0, 0, 0, 0.92), 0 2px 4px rgba(0, 0, 0, 0.95)',
          maxWidth: '100%',
        }}
      >
        <span>{leadText}</span>
        {focusText ? (
          <>
            {' '}
            <span
              style={{
                display: 'inline-block',
                position: 'relative',
                padding: '2px 14px',
                color: accentColor,
                textShadow: `0 0 24px rgba(56, 189, 248, 0.55), 0 4px 16px rgba(0, 0, 0, 0.95)`,
              }}
            >
              {/* Ngoặc góc viewfinder lấy cảm hứng từ video tham khảo */}
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 14,
                  height: 14,
                  borderTop: `3.5px solid ${accentColor}`,
                  borderLeft: `3.5px solid ${accentColor}`,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 14,
                  height: 14,
                  borderBottom: `3.5px solid ${accentColor}`,
                  borderRight: `3.5px solid ${accentColor}`,
                }}
              />
              {focusText}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
};
