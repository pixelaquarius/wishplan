import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import type { CutTransition } from './types';

export function getCutTransitionMotion(
  frame: number,
  transitions: CutTransition[]
): { scaleBoost: number; translateX: number; flashOpacity: number; sweepPct: number | null } {
  let scaleBoost = 0;
  let translateX = 0;
  let flashOpacity = 0;
  let sweepPct: number | null = null;

  for (const t of transitions) {
    const dt = frame - t.frame;
    if (dt < -3 || dt > 6) continue;

    if (t.type === 'flash') {
      flashOpacity = Math.max(
        flashOpacity,
        interpolate(dt, [-2, 0, 5], [0, 0.42, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      );
      // subtle flash + nhẹ nhàng zoom_pop, tránh giật phóng đại vào mặt
      scaleBoost += interpolate(dt, [-2, 0, 5], [0, 0.025, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    } else if (t.type === 'whip_left' || t.type === 'whip_right') {
      const dir = t.type === 'whip_left' ? -1 : 1;
      if (dt < 0) {
        translateX += interpolate(dt, [-3, 0], [0, dir * 160], {
          easing: Easing.in(Easing.quad),
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
      } else {
        translateX += interpolate(dt, [0, 6], [-dir * 160, 0], {
          easing: Easing.out(Easing.cubic),
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
      }
      sweepPct = interpolate(dt, [-3, 6], [dir < 0 ? 110 : -10, dir < 0 ? -10 : 110], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    } else {
      // zoom_pop nhẹ nhàng
      scaleBoost += interpolate(dt, [-2, 0, 6], [0, 0.03, 0], {
        easing: Easing.out(Easing.quad),
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      flashOpacity = Math.max(
        flashOpacity,
        interpolate(dt, [-1, 0, 4], [0, 0.18, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      );
    }
  }

  return { scaleBoost, translateX, flashOpacity, sweepPct };
}

export const TransitionOverlay: React.FC<{ transitions: CutTransition[] }> = ({
  transitions,
}) => {
  const frame = useCurrentFrame();
  const { flashOpacity, sweepPct } = getCutTransitionMotion(frame, transitions);

  if (flashOpacity <= 0.01 && sweepPct === null) {
    return null;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {flashOpacity > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: `rgba(255, 255, 255, ${flashOpacity})`,
          }}
        />
      ) : null}
      {sweepPct !== null ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${sweepPct - 18}%`,
            width: '36%',
            background:
              'linear-gradient(90deg, rgba(56,189,248,0) 0%, rgba(56,189,248,0.28) 50%, rgba(250,204,21,0) 100%)',
          }}
        />
      ) : null}
    </div>
  );
};
