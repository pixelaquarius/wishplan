---
description: Quy trình 7 bước dựng video bán tự động cho kênh anthinh, dừng ở bước 5 chờ duyệt trên giao diện web.
---

# Workflow `/dung-video`: Dựng video 7 bước

Đầu vào: Tên dự án trong `Projects/<ten-du-an>/` (có clip gốc trong `01_raw/`).

## Các bước thực hiện

1. **Bước 1 — Chuẩn hóa & Transcribe** (`ingest-footage` -> `transcribe-vi`):
   - Chạy `_tools/pipeline.py --project <ten-du-an> --up-to 1`.
   - Kiểm tra `02_transcripts/*.sentences.json` và file trạng thái `03_working/*.state.json`.
2. **Bước 2 — Cắt khoảng lặng, từ đệm, câu vấp** (`silence-filler-cut`):
   - Chạy bằng code (`pipeline.py --up-to 2`), đệm `0.05s` hai đầu theo ranh giới từ, tạo EDL nháp.
3. **Bước 3 — Cổng kiểm tra AI & Sắp xếp ý** (`retake-selector`, `hook-builder`, `edl-manager`):
   - Chạy `pipeline.py --up-to 3` (tùy chọn `--force-ai` nếu muốn ép gọi AI).
   - Nếu cổng tắt: tạo thẳng `03_working/<ten>.edl.tsv` và `<ten>.edl.ai.tsv` không tốn token.
   - Nếu cổng bật: gửi AI bản nén `id|giây|câu` (có cache theo hash), chọn take tốt nhất, kéo hook 3 giây đầu, lưu `<ten>.edl.ai.tsv` và `<ten>.edl.tsv`.
4. **Bước 4 — Chữ, hook, thẻ thông tin & b-roll** (`caption-style`, `info-cards`, `broll-placement`):
   - Áp quy tắc từ `style-learner` (`style.md`) nếu có, sinh dữ liệu props JSON cho Remotion.
5. **Bước 5 — DỪNG CHỜ DUYỆT TRÊN GIAO DIỆN WEB**:
   - Mở server `_tools/server/app.py` tại `http://127.0.0.1:8000` (nếu chưa chạy).
   - Báo người dùng duyệt storyboard trên web: bật/tắt đoạn, đổi thứ tự (↑↓), sửa text/layer, ghi chú ở cột `note` cho cảnh cần AI sửa, rồi lưu bản duyệt.
   - **Dừng tại đây và chờ người dùng xác nhận xong bước 5.**
6. **Bước 6 — Sửa riêng các cảnh có ghi chú**:
   - Chỉ gửi các dòng EDL có `note` khác rỗng (kèm ngữ cảnh 1 câu liền kề) cho AI xử lý hoặc cập nhật theo chỉ đạo, lưu `03_working/<ten>.edl.final.tsv`.
7. **Bước 7 — Âm thanh, QA & Xuất bản** (`music-mix`, `sfx-by-motion`, `content-claims-check`, `qa-render-check`, `export-platforms`):
   - Quét watchlist câu giữ lại; nếu sạch thì chạy `render_edl.py` + Remotion + mix nhạc/SFX -> xuất `05_output/tiktok_9x16/anthinh_<chu-de>_v1.mp4`, thumbnail, EDL CMX3600 và log vào `06_logs/`.
