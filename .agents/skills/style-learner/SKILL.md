---
name: style-learner
description: Dùng khi phân tích 3-5 video tham khảo trong _style_refs/ để rút bộ quy tắc phong cách định lượng vào style.md.
version: 1.0.0
---

# style-learner — Học phong cách từ video tham khảo

## Mục tiêu
Biến 3–5 video tham khảo trong `_style_refs/` thành bộ quy tắc dựng phim cụ thể có số liệu trong `references/style.md` (nhịp cắt, vị trí chữ, bảng màu, zoom/chuyển cảnh, tần suất SFX), trình bày cho người dùng duyệt trước khi áp dụng cho footage riêng của kênh `anthinh`.

## Input
- 3–5 video tham khảo trong `_style_refs/` (hoặc tải qua `yt-dlp` theo link người dùng chọn).

## Output
- Ảnh trích khung hình mỗi `2 giây` và transcript trong `_style_refs/_frames/`.
- File `references/style.md` chứa quy tắc định lượng (không copy nội dung hay hình ảnh của video mẫu).

## Các bước
1. Chạy `_tools/style_extract.py` quét video trong `_style_refs/`: tách khung hình mỗi `2 giây`, chạy `ffprobe` + phát hiện scene change (`ffmpeg select='gt(scene,0.3)'`), chạy `faster-whisper` lấy tốc độ nói và nhịp câu.
2. Quan sát khung hình trích xuất & dữ liệu đo: ghi nhận nhịp cắt trung bình (giây/cảnh), vị trí & kích thước chữ (tỷ lệ khung), màu chủ đạo (hex), kiểu highlight từ khóa, tần suất zoom nhẹ/chuyển cảnh, vị trí đặt thẻ thông tin và SFX.
3. Tổng hợp thành quy tắc cụ thể có số liệu vào `references/style.md` (kèm cấu hình JSON đồng bộ cho `remotion_props.py`).
4. Trình bày `style.md` cho Thịnh chỉnh sửa và duyệt; video của kênh luôn dùng footage, hình ảnh và nội dung riêng.

## Checklist hoàn thành
- [ ] Đã phân tích tối thiểu 3 video trong `_style_refs/`.
- [ ] Mọi quy tắc trong `style.md` đều có thông số cụ thể (giây, pixel/%, mã màu hex).
- [ ] Người dùng đã duyệt bản `style.md`.

## Script liên quan trong `_tools/`
- `_tools/style_extract.py`
- `_tools/remotion_props.py`
