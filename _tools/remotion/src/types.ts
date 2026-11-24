import { z } from 'zod';

export const CaptionWordSchema = z.object({
  word: z.string(),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
});

export const CaptionItemSchema = z.object({
  id: z.string(),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  text: z.string(),
  keywords: z.array(z.string()).default([]),
  subtext: z.string().optional().default(''),
  words: z.array(CaptionWordSchema).optional().default([]),
});

export const HookBannerSchema = z.object({
  enabled: z.boolean().default(true),
  title: z.string().default(''),
  eyebrow: z.string().optional().default('THỰC CHIẾN TMĐT'),
  startFrame: z.number().int().nonnegative().default(0),
  endFrame: z.number().int().positive().default(90),
});

export const InfoCardSchema = z.object({
  id: z.string(),
  icon: z.enum(['check', 'alert', 'chart', 'bag', 'bolt', 'clock']).default('bolt'),
  label: z.string(),
  detail: z.string().optional().default(''),
  step: z.number().int().positive().optional(),
  bullets: z.array(z.string()).optional(),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
});

export const DarkInterludeSchema = z.object({
  id: z.string(),
  title: z.string(),
  metric: z.string().optional().default(''),
  bullets: z.array(z.string()).default([]),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
});

export const BrollItemSchema = z.object({
  id: z.string(),
  src: z.string(),
  mediaType: z.enum(['image', 'video']).default('image'),
  layout: z.enum(['pip_top', 'full']).default('pip_top'),
  caption: z.string().optional().default(''),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
});

export const ZoomSegmentSchema = z.object({
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  fromScale: z.number().default(1.0),
  toScale: z.number().default(1.12),
  originY: z.string().optional().default('36%'),
});

export const CutTransitionSchema = z.object({
  frame: z.number().int().nonnegative(),
  type: z
    .enum(['whip_left', 'whip_right', 'flash', 'zoom_pop'])
    .default('zoom_pop'),
});

export const LogoBadgeSchema = z.object({
  id: z.string(),
  brand: z.string(),
  label: z.string().optional().default(''),
  src: z.string().optional().default(''),
  position: z.enum(['top_right', 'top_left', 'chest_pill']).default('top_right'),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
});

export const StyleConfigSchema = z.object({
  accentColor: z.string().default('#38BDF8'),
  numberColor: z.string().default('#FACC15'),
  captionColor: z.string().default('#FFFFFF'),
  captionFontSize: z.number().default(52),
  captionBottomPx: z.number().default(320),
  hookTopPx: z.number().default(88),
  enableSubtleZoom: z.boolean().default(true),
  stylePreset: z.enum(['editorial', 'boxed']).default('editorial'),
  videoScale: z.number().optional().default(1.0),
  videoOffsetX: z.number().optional().default(0.0),
  videoOffsetY: z.number().optional().default(0.0),
});

export const AnThinhPropsSchema = z.object({
  projectName: z.string().default('demo'),
  fps: z.number().int().default(30),
  width: z.number().int().default(1080),
  height: z.number().int().default(1920),
  durationInFrames: z.number().int().positive().default(150),
  videoSrc: z.string().default(''),
  muteVideo: z.boolean().default(true),
  style: StyleConfigSchema.prefault({}),
  hook: HookBannerSchema.optional(),
  captions: z.array(CaptionItemSchema).default([]),
  infoCards: z.array(InfoCardSchema).default([]),
  darkScenes: z.array(DarkInterludeSchema).default([]),
  broll: z.array(BrollItemSchema).default([]),
  zoomSegments: z.array(ZoomSegmentSchema).default([]),
  cutTransitions: z.array(CutTransitionSchema).default([]),
  logoBadges: z.array(LogoBadgeSchema).default([]),
  watermarkHandle: z.string().optional().default(''),
});

export type AnThinhProps = z.infer<typeof AnThinhPropsSchema>;
export type CaptionItem = z.infer<typeof CaptionItemSchema>;
export type InfoCardItem = z.infer<typeof InfoCardSchema>;
export type DarkInterludeItem = z.infer<typeof DarkInterludeSchema>;
export type BrollItem = z.infer<typeof BrollItemSchema>;
export type ZoomSegment = z.infer<typeof ZoomSegmentSchema>;
export type CutTransition = z.infer<typeof CutTransitionSchema>;
export type LogoBadgeItem = z.infer<typeof LogoBadgeSchema>;
