import React from 'react';
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { BrollLayer } from './BrollLayer';
import { CaptionsLayer } from './CaptionsLayer';
import { DarkInterludeScene } from './DarkInterludeScene';
import { HookBanner } from './HookBanner';
import { InfoCardLayer } from './InfoCardLayer';
import { LogoBadgeLayer } from './LogoBadgeLayer';
import { TransitionOverlay, getCutTransitionMotion } from './TransitionOverlay';
import type { AnThinhProps } from './types';

const FONT_CSS = `
@font-face {
  font-family: 'Be Vietnam Pro';
  src: url('${staticFile('fonts/BeVietnamPro-Regular.ttf')}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Be Vietnam Pro';
  src: url('${staticFile('fonts/BeVietnamPro-Medium.ttf')}') format('truetype');
  font-weight: 500;
  font-style: normal;
}
@font-face {
  font-family: 'Be Vietnam Pro';
  src: url('${staticFile('fonts/BeVietnamPro-SemiBold.ttf')}') format('truetype');
  font-weight: 600;
  font-style: normal;
}
@font-face {
  font-family: 'Be Vietnam Pro';
  src: url('${staticFile('fonts/BeVietnamPro-Bold.ttf')}') format('truetype');
  font-weight: 700;
  font-style: normal;
}
@font-face {
  font-family: 'Be Vietnam Pro';
  src: url('${staticFile('fonts/BeVietnamPro-ExtraBold.ttf')}') format('truetype');
  font-weight: 800;
  font-style: normal;
}
@font-face {
  font-family: 'Be Vietnam Pro';
  src: url('${staticFile('fonts/BeVietnamPro-Black.ttf')}') format('truetype');
  font-weight: 900;
  font-style: normal;
}
`;

export const AnThinhVideo: React.FC<AnThinhProps> = (props) => {
  const frame = useCurrentFrame();
  const {
    videoSrc,
    muteVideo,
    style,
    hook,
    captions,
    infoCards,
    darkScenes,
    broll,
    zoomSegments = [],
    cutTransitions = [],
    logoBadges = [],
    watermarkHandle,
  } = props;

  // Dynamic zoom-in / zoom-out theo từng phân đoạn điểm nhấn (không zoom liên tục gây rối mắt)
  let baseScale = 1.0;
  let originY = '38%';
  const activeZoom = zoomSegments.find(
    (z) => frame >= z.startFrame && frame < z.endFrame
  );
  if (activeZoom) {
    baseScale = interpolate(
      frame,
      [activeZoom.startFrame, activeZoom.endFrame],
      [activeZoom.fromScale, activeZoom.toScale],
      {
        easing: Easing.inOut(Easing.quad),
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }
    );
    originY = activeZoom.originY || '38%';
  } else if (zoomSegments.length === 0 && style.enableSubtleZoom) {
    // Chỉ chạy subtle zoom fallback khi chưa có zoomSegments nào được định nghĩa
    const cycleFrame = frame % 240;
    baseScale = interpolate(cycleFrame, [0, 120, 240], [1.0, 1.03, 1.0]);
  }

  const cutMotion = getCutTransitionMotion(frame, cutTransitions);
  const userScale = Math.max(0.5, Math.min(2.5, Number(style.videoScale || 1.0)));
  const panX = Number(style.videoOffsetX || 0.0) * 10.8;
  const panY = Number(style.videoOffsetY || 0.0) * 19.2;
  const finalScale = baseScale * userScale + cutMotion.scaleBoost;

  const resolvedVideo =
    videoSrc && videoSrc.startsWith('http')
      ? videoSrc
      : videoSrc
        ? staticFile(videoSrc)
        : '';

  return (
    <AbsoluteFill style={{ backgroundColor: '#090D16', overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />

      {/* Layer 1: Video nền talking-head + zoom ra/vào + hiệu ứng chuyển cảnh */}
      <AbsoluteFill
        style={{
          transform: `translate(${cutMotion.translateX + panX}px, ${panY}px) scale(${finalScale})`,
          transformOrigin: `50% ${originY}`,
        }}
      >
        {resolvedVideo ? (
          <OffthreadVideo
            src={resolvedVideo}
            muted={muteVideo}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <AbsoluteFill
            style={{
              background:
                'radial-gradient(circle at 50% 35%, #1E293B 0%, #090D16 75%)',
            }}
          />
        )}
      </AbsoluteFill>

      <TransitionOverlay transitions={cutTransitions} />

      {/* Gradient nhẹ phía dưới để phụ đề không đóng hộp nổi rõ */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 560,
          background:
            'linear-gradient(to top, rgba(9, 13, 22, 0.82) 0%, rgba(9, 13, 22, 0.35) 55%, rgba(9, 13, 22, 0) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Layer 2: B-roll / ảnh minh họa */}
      <BrollLayer items={broll} accentColor={style.accentColor} />

      {/* Layer 3: Cảnh nền tối chèn giữa */}
      <DarkInterludeScene
        scenes={darkScenes}
        accentColor={style.accentColor}
        numberColor={style.numberColor}
      />

      {/* Layer 4: Logo minh họa, Hook 3s đầu & Thẻ thông tin */}
      <LogoBadgeLayer badges={logoBadges} accentColor={style.accentColor} />

      {hook ? (
        <HookBanner
          enabled={hook.enabled}
          title={hook.title}
          eyebrow={hook.eyebrow}
          startFrame={hook.startFrame}
          endFrame={hook.endFrame}
          topPx={style.hookTopPx}
          accentColor={style.accentColor}
          stylePreset={style.stylePreset}
        />
      ) : null}

      <InfoCardLayer
        cards={infoCards}
        accentColor={style.accentColor}
        hidden={darkScenes.some((s) => frame >= s.startFrame && frame < s.endFrame)}
      />

      {/* Handle nhỏ góc trên bên trái (chỉ hiện nếu người dùng chủ động đặt) */}
      {watermarkHandle && watermarkHandle !== '@thinhchapmach' ? (
        <div
          style={{
            position: 'absolute',
            top: 46,
            left: 44,
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontWeight: 700,
            fontSize: 22,
            color: 'rgba(255, 255, 255, 0.72)',
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            pointerEvents: 'none',
          }}
        >
          {watermarkHandle}
        </div>
      ) : null}

      {/* Layer 5: Phụ đề tiếng Việt vùng an toàn dưới-giữa */}
      <CaptionsLayer
        captions={captions}
        accentColor={style.accentColor}
        numberColor={style.numberColor}
        captionColor={style.captionColor}
        fontSize={style.captionFontSize}
        bottomPx={style.captionBottomPx}
        stylePreset={style.stylePreset}
      />
    </AbsoluteFill>
  );
};
