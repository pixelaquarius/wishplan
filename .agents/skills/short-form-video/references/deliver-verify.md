## Deliver & verify (rendered stills → MP4)

> **Packaged helper** (`scripts/`): tile your stills with `scripts/contact-sheet.sh sheet.png f-hook.png f-mid.png f-end.png`, then assert the encode with `scripts/probe-mp4.sh out.mp4 [WxH] [fps]`. See `scripts/README.md`.

The short ships as a Remotion composition (`<Composition>` + zod `schema` + `defaultProps`) — every cut, punch-in, and interrupt driven by `useCurrentFrame()`, never `Date.now()` / `Math.random()` / timers. Deliverable = `out/*.mp4` + the project (re-render per topic). 9:16 vertical (1080×1920) is the default.

**Verify loop — render stills → inspect → encode.** Three frames test the three things that make or break retention: the hook, the pacing, and the loop seam.

```bash
# Stills at hook / mid-body / last frame — WITH SHIPPED PROPS (the real topic, not defaults)
npx remotion still Short out/f-hook.png --frame=10  --props='{"topic":"...","hook":"..."}'   # ~first 3s reads instantly
npx remotion still Short out/f-mid.png  --frame=N   --props='{"topic":"...","hook":"..."}'
npx remotion still Short out/f-end.png  --frame=L   --props='{"topic":"...","hook":"..."}'   # L = durationInFrames-1

# Inspect each PNG:
#  - HOOK frame (~frame 0-ish / first 3s): hook line is on-screen text and reads instantly; strongest visual already up (no fade-up)
#  - LOOP seam: compare f-hook(frame 0) vs f-end(last frame) — same composition/position/color for an invisible loop cut
#  - 9:16 safe area: hook + key subject inside the center 900x1400 box; clear of top ~12%, bottom ~20-35% (captions/CTA/audio), right action rail

npx remotion render Short out/short.mp4 --props='{"topic":"...","hook":"..."}'   # encode once stills verify
npx remotion render Short out/demo.gif --codec=gif                                # README proof clip
```

**Per topic / batch**: verify ONE topic via stills *before* rendering all of them. Use `npx remotion compositions` for `durationInFrames`/`fps` to pick the mid + last frames.

**Before you finish:**
1. Stills render cleanly at the hook, mid, and last frame — no errors.
2. The hook frame reads instantly (on-screen text + strongest visual up front, no fade-up); first vs last frame match for a clean loop seam.
3. Hook + subject + captions sit inside the 9:16 center 900×1400 safe box at every checked frame.
4. Frame-driven only — no `Date.now()` / `Math.random()` / timers; cuts uneven, no flat middle.
5. A real topic's shipped props (not `defaultProps`) render correctly; MP4 encoded, GIF optional.
