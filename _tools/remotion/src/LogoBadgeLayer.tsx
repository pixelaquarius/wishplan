import React from 'react';
import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { LogoBadgeItem } from './types';

function BrandSvgIcon({ brand }: { brand: string }) {
  const key = brand.toLowerCase();

  if (key.includes('shop') || key.includes('cart') || key.includes('don')) {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#FACC15" />
        <path
          d="M15 18h18l-1.5 16h-15L15 18Zm4.5 0a4.5 4.5 0 0 1 9 0"
          stroke="#0F172A"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (key.includes('tiktok')) {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#0F172A" />
        <path
          d="M27 11v18.2a5.8 5.8 0 1 1-4.2-5.6v4.3a1.8 1.8 0 1 0 1.4 1.7V11H27c1 3.7 3.7 6.3 7.4 6.9v3.8c-2.9-.2-5.4-1.3-7.4-3.1V11Z"
          fill="#22D3EE"
        />
        <path
          d="M28.4 11c1 3.4 3.5 5.8 6.8 6.4v3.4c-2.8-.2-5.1-1.3-6.8-3v11.4a5.8 5.8 0 1 1-5.8-5.8c.5 0 1 .1 1.4.2v3.9a2 2 0 1 0 1.6 1.9V11h2.8Z"
          fill="#F43F5E"
          fillOpacity="0.85"
        />
      </svg>
    );
  }

  if (key.includes('notebook')) {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#0EA5E9" />
        <path
          d="M12 33c0-9.94 8.06-18 18-18h4v4h-4c-7.73 0-14 6.27-14 14h-4Zm7 0c0-6.08 4.92-11 11-11h4v4h-4c-3.87 0-7 3.13-7 7h-4Zm7 0c0-2.21 1.79-4 4-4h4v4h-8Z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  if (key.includes('google') || key.includes('gemini')) {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#FFFFFF" />
        <path
          d="M24 9c1.2 8.2 6.8 13.8 15 15-8.2 1.2-13.8 6.8-15 15-1.2-8.2-6.8-13.8-15-15 8.2-1.2 13.8-6.8 15-15Z"
          fill="#3B82F6"
        />
      </svg>
    );
  }

  if (key.includes('chatgpt') || key.includes('openai')) {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#10A37F" />
        <circle cx="24" cy="24" r="10" stroke="#FFFFFF" strokeWidth="3.2" strokeDasharray="8 4" />
        <circle cx="24" cy="24" r="4" fill="#FFFFFF" />
      </svg>
    );
  }

  if (key.includes('claude')) {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#D97757" />
        <path
          d="M24 11v26M11 24h26M14.8 14.8l18.4 18.4M33.2 14.8 14.8 33.2"
          stroke="#FFFFFF"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (key.includes('capcut') || key.includes('video')) {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#1E293B" />
        <rect x="12" y="16" width="16" height="16" rx="4" stroke="#FACC15" strokeWidth="3" />
        <path d="M28 21l8-4v14l-8-4v-6Z" fill="#38BDF8" />
      </svg>
    );
  }

  // Generic AI / Tech badge
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill="#1D4ED8" />
      <path
        d="M17 31l5-14h4l5 14m-11-4h8"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const LogoBadgeLayer: React.FC<{ badges: LogoBadgeItem[]; accentColor: string }> = ({
  badges,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const active = badges.find((b) => frame >= b.startFrame && frame < b.endFrame);
  if (!active) return null;

  const localFrame = frame - active.startFrame;
  const duration = Math.max(1, active.endFrame - active.startFrame);
  const pop = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 220, mass: 0.65 },
  });
  const fadeOut = interpolate(
    localFrame,
    [Math.max(0, duration - 6), duration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const floatY = Math.sin(localFrame / 10) * 4;

  const posStyle: React.CSSProperties =
    active.position === 'top_left'
      ? { top: 230, left: 48 }
      : active.position === 'chest_pill'
        ? { top: 1140, left: '50%', transform: `translate(-50%, ${floatY}px) scale(${pop})` }
        : { top: 230, right: 48 };

  const transformVal =
    active.position === 'chest_pill'
      ? `translate(-50%, ${floatY}px) scale(${pop})`
      : `translateY(${floatY}px) scale(${pop})`;

  return (
    <div
      style={{
        position: 'absolute',
        ...posStyle,
        transform: transformVal,
        opacity: pop * fadeOut,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          backgroundColor: 'rgba(15, 23, 42, 0.78)',
          backdropFilter: 'blur(12px)',
          border: `2px solid ${accentColor}`,
          borderRadius: 20,
          padding: '10px 18px 10px 12px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        }}
      >
        {active.src ? (
          <Img
            src={active.src.startsWith('http') ? active.src : staticFile(active.src)}
            style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'contain' }}
          />
        ) : (
          <BrandSvgIcon brand={active.brand} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontWeight: 800,
              fontSize: 26,
              color: '#FFFFFF',
              lineHeight: 1.15,
            }}
          >
            {active.label || active.brand}
          </span>
        </div>
      </div>
    </div>
  );
};
