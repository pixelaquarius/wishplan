---
name: silence-filler-cut
description: Dùng khi cắt bỏ khoảng lặng dài, từ đệm (ờ, ừm, à) và câu vấp ngắn hoàn toàn bằng code theo ranh giới từ.
version: 1.0.0
---

# silence-filler-cut — Cắt khoảng lặng, từ đệm & câu vấp (Code-only)

## Mục tiêu
Làm sạch nhịp nói tự nhiên bằng code không tốn token AI: loại khoảng lặng > `0.35s`, lọc từ đệm phổ biến và các đoạn mở đầu bị nói vấp/ngắt giữa chừng, giữ mượt âm thanh tại điểm nối.

## Input
- `02_transcripts/<ten>.sentences.json` (có `words[]` từng từ).
- `03_working/<ten>.audio.wav` (dùng nếu cần đối chiếu `ffmpeg silencedetect`).

## Output
- `03_working/<ten>.cleaned_segments.json`: danh sách câu/đoạn đã làm sạch kèm timestamp căn chỉnh.

## Các bước
1. Quét danh sách từ trong từng câu, đánh dấu bỏ các từ đệm thuần túy (`ờ`, `ừm`, `à`, `ừ`, `ơ`, `thì là`, `kiểu như` khi đứng đầu/lẻ).
2. Phát hiện câu vấp cục bộ (câu < 4 từ kết thúc bằng lặp từ hoặc đứt quãng ngắn `< 0.4s` trước khi nói lại cùng cụm đầu).
3. Căn điểm cắt `start`/`end` theo **ranh giới từ** (`word.start`, `word.end`), chừa **đệm `0.05s` hai đầu** (`max(0, start - 0.05)` và `end + 0.05`) để không bị xén mất âm đầu/cuối chữ.
4. Gộp các đoạn có khoảng cách sau đệm `< 0.12s` để tránh nhảy cut liên tục gây giật hình.
5. Ghi dấu các điểm nối để bước `render_edl.py` áp dụng **fade âm `0.03s`** tại ranh giới.

## Checklist hoàn thành
- [ ] Không có đoạn nào bị xén âm tiết đầu hoặc cuối (đủ đệm `0.05s`).
- [ ] Mọi đoạn giữ lại đều có thời lượng `>= 0.40s`.
- [ ] Đã lưu `03_working/<ten>.cleaned_segments.json`.

## Script liên quan trong `_tools/`
- `_tools/pipeline.py` (chặng `clean_segments`)
- `_tools/render_edl.py` (`afade` / `acrossfade` `0.03s`)
