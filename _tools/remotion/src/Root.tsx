import React from 'react';
import { Composition } from 'remotion';
import { AnThinhVideo } from './AnThinhVideo';
import { AnThinhPropsSchema, type AnThinhProps } from './types';

const defaultProps: AnThinhProps = {
  projectName: 'demo',
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 180,
  videoSrc: '',
  muteVideo: true,
  style: {
    accentColor: '#38BDF8',
    numberColor: '#FACC15',
    captionColor: '#FFFFFF',
    captionFontSize: 52,
    captionBottomPx: 320,
    hookTopPx: 88,
    enableSubtleZoom: true,
    stylePreset: 'editorial',
    videoScale: 1.0,
    videoOffsetX: 0.0,
    videoOffsetY: 0.0,
  },
  zoomSegments: [],
  cutTransitions: [],
  logoBadges: [],
  hook: {
    enabled: true,
    eyebrow: 'THỰC CHIẾN TMĐT',
    title: '3 LỖI SETUP TIKTOK SHOP',
    startFrame: 0,
    endFrame: 90,
  },
  captions: [
    {
      id: 'C1',
      startFrame: 0,
      endFrame: 90,
      text: 'Lỗi khiến shop mới bị bóp tương tác ngay từ đầu',
      keywords: ['shop mới', 'tương tác'],
      subtext: 'Kiểm tra ngay phần thiết lập gian hàng',
      words: [],
    },
    {
      id: 'C2',
      startFrame: 90,
      endFrame: 180,
      text: 'Để lại bình luận mình giải đáp chi tiết hơn nha',
      keywords: ['bình luận'],
      subtext: '',
      words: [],
    },
  ],
  infoCards: [
    {
      id: 'IC1',
      icon: 'alert',
      label: 'Tránh từ ngữ dễ bóp tương tác',
      detail: 'Tự động lọc từ khóa thương mại nhạy cảm',
      startFrame: 35,
      endFrame: 110,
    },
  ],
  darkScenes: [],
  broll: [],
  watermarkHandle: '',
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="AnThinhVideo"
      component={AnThinhVideo}
      durationInFrames={180}
      fps={30}
      width={1080}
      height={1920}
      schema={AnThinhPropsSchema}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, props.durationInFrames || 180),
        fps: props.fps || 30,
        width: props.width || 1080,
        height: props.height || 1920,
      })}
    />
  );
};
