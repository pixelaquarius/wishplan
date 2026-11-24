---
name: ingest-footage
description: Dùng khi kiểm tra thông số kỹ thuật clip gốc trong 01_raw/ bằng ffprobe, chuẩn hóa fps/audio và lập metadata đầu vào.
version: 1.0.0
---

# ingest-footage — Chuẩn bị & Kiểm tra footage gốc

## Mục tiêu
Đọc toàn bộ clip trong `01_raw/` bằng `ffprobe`, ghi nhận thông số gốc, tạo bản làm việc chuẩn hóa `30fps` + audio `48kHz` (nếu lệch chuẩn hoặc VFR) mà không làm thay đổi file gốc.

## Input
- File video thô trong `Projects/<ten-du-an>/01_raw/` (`.mp4`, `.mov`, `.mkv`).

## Output
- `03_working/<ten>.ingest.json`: thông số từng clip (độ phân giải, fps, codec, thời lượng, sample rate, kênh audio, xoay/rotation).
- `03_working/<ten>.audio.wav`: audio mono `16kHz` tách riêng để `transcribe-vi` chạy nhanh.
- `03_working/<ten>.normalized.mp4` (chỉ tạo nếu clip gốc lệch VFR hoặc khác 30fps; giữ nguyên nếu đã đạt chuẩn để tiết kiệm thời gian).

## Các bước
1. Quét các file video hợp lệ trong `01_raw/` (không sửa hoặc di chuyển file gốc).
2. Chạy `ffprobe -v quiet -print_format json -show_format -show_streams <file>`.
3. Kiểm tra góc xoay (`side_data_list` / `tags.rotate`), VFR vs CFR (`r_frame_rate` vs `avg_frame_rate`), luồng audio.
4. Tách audio chuẩn WAV 16kHz mono bằng `ffmpeg` cho Whisper và audio 48kHz stereo cho hậu kỳ.
5. Cập nhật trạng thái vào `03_working/<ten>.state.json` để bỏ qua ở lần chạy lại nếu hash file gốc không đổi.

## Checklist hoàn thành
- [ ] Toàn bộ file trong `01_raw/` còn nguyên vẹn.
- [ ] Có `03_working/<ten>.ingest.json` và `03_working/<ten>.audio.wav`.
- [ ] Xác nhận luồng âm thanh không bị mất tiếng hoặc lệch sample rate.

## Script liên quan trong `_tools/`
- `_tools/pipeline.py` (chặng `ingest`)
