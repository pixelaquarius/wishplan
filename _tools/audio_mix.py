"""Mix speech track with loudness normalization, ducked background music, and frame-aligned SFX."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from common import AUDIO_EXTS, TEMPLATE_DIR, ffprobe_json


def _resolve_sfx_file(proj_dir: Path, filename: str) -> Path | None:
    proj_sfx = proj_dir / "04_assets" / "sfx" / filename
    if proj_sfx.exists():
        return proj_sfx
    tpl_sfx = TEMPLATE_DIR / "04_assets" / "sfx" / filename
    if tpl_sfx.exists():
        return tpl_sfx
    return None


def _resolve_music_file(proj_dir: Path, music_name: str) -> Path | None:
    music_dir = proj_dir / "04_assets" / "music"
    if music_name:
        cand = music_dir / music_name
        if cand.exists() and cand.is_file():
            return cand
    if music_dir.exists():
        for p in sorted(music_dir.iterdir()):
            if p.is_file() and p.suffix.lower() in AUDIO_EXTS:
                return p
    return None


def mix_project_audio(
    proj_dir: Path,
    speech_video_path: Path,
    out_audio_wav: Path,
    audio_cfg: dict[str, Any],
    sfx_events: list[dict[str, Any]],
    fps: int = 30,
) -> dict[str, Any]:
    """Produce final stereo 48kHz WAV combining normalized speech, ducked music, and SFX."""
    info = ffprobe_json(speech_video_path)
    duration = float(info.get("format", {}).get("duration", 1.0) or 1.0)
    has_audio = any(s.get("codec_type") == "audio" for s in info.get("streams", []))

    if not has_audio:
        subprocess.run(
            [
                "ffmpeg", "-y", "-f", "lavfi",
                "-i", f"anullsrc=channel_layout=stereo:sample_rate=48000:d={duration:.3f}",
                str(out_audio_wav),
            ],
            check=True,
            capture_output=True,
        )
        return {"has_speech": False, "music": None, "sfx_count": 0}

    inputs: list[str] = ["-i", str(speech_video_path)]
    input_count = 1
    filter_parts: list[str] = []

    norm = bool(audio_cfg.get("normalizeSpeech", True))
    denoise = bool(audio_cfg.get("denoiseSpeech", True))
    speech_filters = ["aresample=48000", "aformat=channel_layouts=stereo"]
    if denoise:
        # Lọc tạp âm nền, ù quạt/máy lạnh (<85Hz), rít cao (>13kHz) và nén giọng nói đều hơn
        speech_filters.extend([
            "highpass=f=85",
            "lowpass=f=13000",
            "afftdn=nr=14:nf=-32:tn=1",
            "acompressor=threshold=-20dB:ratio=2.5:attack=10:release=120:makeup=2dB",
        ])
    if norm:
        speech_filters.append("loudnorm=I=-14:TP=-1.5:LRA=9")
    speech_chain = "[0:a]" + ",".join(speech_filters) + "[speech]"
    filter_parts.append(speech_chain)

    mix_labels = ["[speech]"]
    music_path = _resolve_music_file(proj_dir, str(audio_cfg.get("musicFile", "") or ""))
    if music_path is not None:
        m_idx = input_count
        input_count += 1
        inputs.extend(["-stream_loop", "-1", "-i", str(music_path)])
        music_db = float(audio_cfg.get("musicDb", -22.0))
        fade_out_st = max(0.0, duration - 1.0)
        # Sidechain ducking: music ducks smoothly when speech is active
        filter_parts.append("[speech]asplit=2[sp_mix][sp_sc]")
        mix_labels[0] = "[sp_mix]"
        filter_parts.append(
            f"[{m_idx}:a]aresample=48000,aformat=channel_layouts=stereo,"
            f"atrim=0:{duration:.3f},asetpts=PTS-STARTPTS,"
            f"volume={music_db}dB,"
            f"afade=t=in:st=0:d=0.4,afade=t=out:st={fade_out_st:.3f}:d=1.0[music_raw]"
        )
        filter_parts.append(
            "[music_raw][sp_sc]sidechaincompress=threshold=0.03:ratio=4:attack=25:release=250[music_ducked]"
        )
        mix_labels.append("[music_ducked]")

    applied_sfx = 0
    if bool(audio_cfg.get("enableSfx", True)) and sfx_events:
        sfx_db = float(audio_cfg.get("sfxDb", -16.0))
        for ev in sfx_events:
            sfx_path = _resolve_sfx_file(proj_dir, str(ev.get("sfx", "pop.wav")))
            if sfx_path is None:
                continue
            delay_ms = max(0, int(round((float(ev.get("frame", 0)) / fps) * 1000)))
            if delay_ms >= int(duration * 1000):
                continue
            s_idx = input_count
            input_count += 1
            inputs.extend(["-i", str(sfx_path)])
            lbl = f"[sfx{applied_sfx}]"
            ev_db = float(ev.get("gain_db", sfx_db))
            filter_parts.append(
                f"[{s_idx}:a]aresample=48000,aformat=channel_layouts=stereo,"
                f"volume={ev_db}dB,adelay={delay_ms}|{delay_ms}{lbl}"
            )
            mix_labels.append(lbl)
            applied_sfx += 1

    if len(mix_labels) == 1:
        filter_parts.append(f"{mix_labels[0]}alimiter=limit=0.95[aout]")
    else:
        n_in = len(mix_labels)
        filter_parts.append(
            "".join(mix_labels)
            + f"amix=inputs={n_in}:duration=first:normalize=0,alimiter=limit=0.95[aout]"
        )

    cmd = [
        "ffmpeg", "-y", *inputs,
        "-filter_complex", ";".join(filter_parts),
        "-map", "[aout]",
        "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
        str(out_audio_wav),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return {
        "has_speech": True,
        "music": music_path.name if music_path else None,
        "sfx_count": applied_sfx,
    }
