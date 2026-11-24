import React from 'react';
import {
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { BrollItem } from './types';

interface BrollLayerProps {
  items: BrollItem[];
  accentColor: string;
}

export const BrollLayer: React.FC<BrollLayerProps> = ({ items, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const active = items.find((b) => frame >= b.startFrame && frame < b.endFrame);
  if (!active || !active.src) {
    return null;
  }

  const localFrame = frame - active.startFrame;
  const duration = Math.max(1, active.endFrame - active.startFrame);
  const enter = spring({
    frame: localFrame,
    fps,
    config: { damping: 16, stiffness: 200 },
  });
  const fadeOut = interpolate(
    localFrame,
    [Math.max(0, duration - 5), duration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const resolvedSrc = active.src.startsWith('http')
    ? active.src
    : staticFile(active.src);

  if (active.layout === 'full') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: enter * fadeOut,
          backgroundColor: '#000',
        }}
      >
        {active.mediaType === 'video' ? (
          <OffthreadVideo
            src={resolvedSrc}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Img
            src={resolvedSrc}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 220,
        left: 84,
        right: 84,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: enter * fadeOut,
        transform: `scale(${interpolate(enter, [0, 1], [0.95, 1])})`,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          maxHeight: 680,
          borderRadius: 28,
          overflow: 'hidden',
          border: `3px solid ${accentColor}`,
          backgroundColor: '#0F172A',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.55)',
        }}
      >
        {active.mediaType === 'video' ? (
          <OffthreadVideo
            src={resolvedSrc}
            muted
            style={{ width: '100%', height: 560, objectFit: 'cover' }}
          />
        ) : (
          <Img
            src={resolvedSrc}
            style={{ width: '100%', maxHeight: 600, objectFit: 'contain' }}
          />
        )}
        {active.caption ? (
          <div
            style={{
              padding: '12px 22px',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontWeight: 700,
              fontSize: 28,
              color: '#F8FAFC',
              textAlign: 'center',
            }}
          >
            {active.caption}
          </div>
        ) : null}
      </div>
    </div>
  );
};
