## Deliver & verify (rendered stills → MP4)

> **Packaged helper** (`scripts/`): tile your stills with `scripts/contact-sheet.sh sheet.png f-hook.png f-mid.png f-end.png`, then assert the encode with `scripts/probe-mp4.sh out.mp4 [WxH] [fps]`. See `scripts/README.md`.

Captions ship as a Remotion composition (`<Composition>` + zod `schema` + `defaultProps`) — all word motion frame-driven off `useCurrentFrame()`, never `Date.now()` / `Math.random()` / timers. Deliverable = `out/*.mp4` (burned-in) + the project + the sidecar SRT/VTT. 9:16 vertical (1080×1920) is the default.

**Verify loop — render stills → inspect → encode.** Word timing is the thing that breaks; check it at exact frames before you spend an encode.

```bash
# Stills at start / a sampled active-word frame / end — WITH SHIPPED PROPS (real tokens + audio)
npx remotion still Captions out/f-start.png --frame=0   --props='{"captionsSrc":"vo.json"}'
npx remotion still Captions out/f-mid.png   --frame=90  --props='{"captionsSrc":"vo.json"}'
npx remotion still Captions out/f-end.png   --frame=N   --props='{"captionsSrc":"vo.json"}'  # N = durationInFrames-1

# Inspect each PNG:
#  - the word highlighted at frame 90 is the word whose [startMs,endMs] contains 90/fps (no drift)
#  - burn-in legible: bold sans, stroke+shadow holds, no clipping
#  - 9:16 safe area: caption sits in the center band, clear of top ~12% and bottom ~20-35% (captions/CTA/audio UI) and the right action rail

npx remotion render Captions out/captions.mp4 --props='{"captionsSrc":"vo.json"}'   # encode once stills are right
npx remotion render Captions out/demo.gif --codec=gif                                # README proof clip
```

Use `npx remotion compositions` to read `durationInFrames`/`fps` and pick the active-word + end frames.

**Before you finish:**
1. Stills render cleanly at frame 0, a mid active-word frame, and last — no missing font/audio.
2. The correct word is highlighted at the sampled frame (frame/fps lands inside its token); no even-split fakery.
3. Burn-in is legible (stroke+shadow) and the caption is fully inside the 9:16 safe area at every checked frame.
4. Frame-driven only — no `Date.now()` / `Math.random()` / timers.
5. Shipped props (real tokens, not just `defaultProps`) render correctly; MP4 + sidecar SRT/VTT emitted, GIF optional.
