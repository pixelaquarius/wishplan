---
name: sfx-by-motion
description: Dùng khi gắn sound effect (whoosh, pop, click) khớp chính xác các điểm hiện hook, thẻ thông tin hoặc chuyển cảnh.
version: 1.0.0
---

# sfx-by-motion — Gắn Sound Effect khớp chuyển động

## Mục tiêu
Tự động đọc mốc xuất hiện của hook, thẻ thông tin (`infoCards`), cảnh nền tối (`darkScenes`) và chuyển cảnh B-roll từ file props để chèn SFX nhẹ bằng code, tăng độ cuốn khi xem mà không gây chói tai.

## Input
- `03_working/<ten>.remotion_props.json` (các mốc `startFrame` của chuyển động).
- File SFX ngắn (`.wav` / `.mp3`) trong `04_assets/sfx/` (ví dụ `whoosh.wav`, `pop.wav`, `ding.wav`) hoặc SFX tổng hợp mặc định từ FFmpeg nếu thư mục trống.

## Output
- Danh sách sự kiện SFX (`sfxEvents[]`) và bản mix audio hoàn chỉnh đưa vào bước xuất cuối.

## Các bước
1. Quét `remotion_props.json` lấy danh sách mốc chuyển động: xuất hiện hook banner (`pop`), thẻ thông tin (`pop`/`ding`), chuyển cảnh nền tối hoặc B-roll (`whoosh`).
2. Giới hạn mật độ SFX: khoảng cách giữa 2 SFX liên tiếp `>= 1.5s` để tránh rối tai.
3. Tính timestamp chính xác (`frame / 30.0`), trộn qua `ffmpeg adelay` với mức âm lượng `-14` đến `-18 dB` so với giọng.
4. Nếu `04_assets/sfx/` trống, cho phép bỏ qua êm hoặc sinh file SFX nhẹ mẫu bằng FFmpeg theo config dự án.

## Checklist hoàn thành
- [ ] Mọi SFX khớp đúng khung hình chuyển động (`sai số <= 1 frame`).
- [ ] Khoảng cách giữa 2 SFX không quá dày (`>= 1.5s`).
- [ ] Âm lượng SFX dịu, không gây giật mình trên tai nghe.

## Script liên quan trong `_tools/`
- `_tools/audio_mix.py`
- `_tools/remotion_props.py`
