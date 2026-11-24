---
name: transcribe-vi
description: Dùng khi nhận diện giọng nói tiếng Việt chạy local bằng faster-whisper để xuất JSON câu nói và timestamp từng từ.
version: 1.0.0
---

# transcribe-vi — Tạo transcript tiếng Việt kèm word timestamps

## Mục tiêu
Chạy `faster-whisper` hoàn toàn local trên `03_working/<ten>.audio.wav` để tạo danh sách câu nói kèm timestamp chính xác tới từng từ (`word_timestamps=True`), phục vụ cắt không vấp từ ở Bước 2 và sub tiếng Việt ở Bước 4.

## Input
- `03_working/<ten>.audio.wav` (16kHz mono).
- Danh sách từ vựng gợi ý (`initial_prompt` tiếng Việt chuyên ngành TMĐT: `TikTok Shop, UGC, đơn hàng, hoàn hàng, tỷ lệ chuyển đổi, affiliate, livestream, đồng com`).

## Output
- `02_transcripts/<ten>.words.json`: toàn bộ từ kèm `start`, `end`, `word`, `probability`.
- `02_transcripts/<ten>.sentences.json`: các câu đã tách gọn (`id`, `start`, `end`, `text`, `words[]`).

## Các bước
1. Kiểm tra `state.json`; nếu `audio_wav_sha256` khớp bản cũ và đã có `.sentences.json` thì bỏ qua.
2. Nạp model `faster-whisper` (`small` mặc định cho CPU `int8`, hỗ trợ tham số `--whisper-model` dùng `medium` hoặc `large-v3-turbo` khi cần độ chính xác cao hơn).
3. Chạy `transcribe(..., language="vi", word_timestamps=True, vad_filter=True, initial_prompt=...)`.
4. Tách segment dài thành câu ngắn tự nhiên (ngắt theo dấu câu hoặc khoảng nghỉ `> 0.35s`, tối đa ~12–14 từ/câu để hiển thị đẹp trên khung dọc 9:16).
5. Ghi `.words.json`, `.sentences.json` và cập nhật `state.json`.

## Checklist hoàn thành
- [ ] Có đủ 2 file JSON trong `02_transcripts/`.
- [ ] Mỗi câu đều có `start < end` và mảng `words` không rỗng.
- [ ] Từ khóa TMĐT tiếng Việt / tiếng Anh xen kẽ được nhận diện đúng dấu.

## Script liên quan trong `_tools/`
- `_tools/pipeline.py` (chặng `transcribe`)
