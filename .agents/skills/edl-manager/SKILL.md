---
name: edl-manager
description: Dùng khi đọc, ghi, sắp xếp thứ tự dòng EDL TSV, tách bản AI với bản final và đối chiếu khác biệt giữa hai bản EDL.
version: 1.0.0
---

# edl-manager — Quản lý EDL TSV & Đối chiếu chỉnh sửa

## Mục tiêu
Quản lý file EDL dạng bảng TSV làm nguồn sự thật duy nhất giữa code pipeline, giao diện web duyệt storyboard, bước sửa riêng cảnh có ghi chú và bước học kinh nghiệm.

## Input
- File EDL chuẩn TSV tại `Projects/<ten>/03_working/<ten>.edl.tsv` (cùng bản snapshot `<ten>.edl.ai.tsv` và `<ten>.edl.final.tsv`).

## Output
- File EDL TSV hợp lệ với 6 cột cố định theo thứ tự xuất hiện trong video cuối:
  `keep` | `start` | `end` | `label` | `text` | `note`
- Bảng tổng hợp thay đổi từ `edl_diff.py` khi so sánh `.edl.ai.tsv` với `.edl.final.tsv`.

## Các bước
1. Chuẩn hóa đọc/ghi TSV mã hóa UTF-8 (tab-separated, làm sạch `\t` và xuống dòng trong `text`/`note` để không vỡ cột).
2. Khi kết thúc Bước 3: ghi đồng thời `<ten>.edl.ai.tsv` (bản gốc AI/pipeline) và `<ten>.edl.tsv` (bản làm việc cho web UI).
3. Trong Bước 5 (web UI): cho phép bật/tắt (`keep=1/0`), đổi thứ tự dòng (↑↓), chỉnh `start`/`end` và sửa cột `note`.
4. Trước khi render cuối (hoặc sau Bước 6): lưu `<ten>.edl.final.tsv`.
5. Chạy `_tools/edl_diff.py` để thống kê đoạn bật lại, tắt đi, đổi thứ tự, sửa thời lượng và trích xuất `note`.

## Checklist hoàn thành
- [ ] File TSV đủ đúng 6 cột: `keep`, `start`, `end`, `label`, `text`, `note`.
- [ ] Mọi dòng giữ (`keep=1`) có `0 <= start < end`.
- [ ] Còn giữ nguyên bản `.edl.ai.tsv` để so sánh khi chạy `/cap-nhat-skill`.

## Script liên quan trong `_tools/`
- `_tools/edl_utils.py`
- `_tools/edl_diff.py`
- `_tools/server/app.py`
