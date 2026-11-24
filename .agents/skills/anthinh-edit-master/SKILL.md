---
name: anthinh-edit-master
description: Dùng khi điều phối toàn bộ quy trình dựng video dọc 9:16 của phần mềm WishEdit kết hợp Box Chat AI và Timeline NLE kiểu CapCut.
version: 1.1.0
---

# anthinh-edit-master — Điều phối quy trình dựng video WishEdit

## Mục tiêu
Điều hướng trọn vẹn quy trình biến footage thô trong `01_raw/` thành video dọc `1080x1920` hoàn chỉnh trên **WishEdit**, kết hợp biên tập thông minh bằng AI (không cắt bớt bước làm giảm chất lượng video), tự động lọc từ ngữ buôn bán/giá cả dễ bóp tương tác, điều khiển hai chiều qua **Box Chat AI** + **Timeline CapCut** và kiểm tra hình ảnh từng phân cảnh trước khi xuất.

## Quy trình 5 giai đoạn chuẩn WishEdit

| # | Giai đoạn | Skill con gọi | Cách thực hiện |
|---|---|---|---|
| 1 | Chuẩn hóa & Tách lời từng từ | `ingest-footage` -> `transcribe-vi` | Chuẩn hóa 30fps CFR, chạy `faster-whisper` lấy `.words.json` & `.sentences.json`, sửa lỗi đồng âm ASR theo ngữ cảnh |
| 2 | Lọc khoảng lặng & Từ ngữ bóp traffic | `silence-filler-cut`, `content-claims-check` | Cắt khoảng lặng, từ đệm, câu vấp (`Mà cứ...`); tự động loại bỏ/làm mềm từ buôn bán, giá cả, điều hướng ngoài luồng |
| 3 | AI Biên tập cấu trúc, Hook & Đồ họa | `retake-selector`, `hook-builder`, `caption-animation`, `info-cards`, `broll-placement` | Gom retake giữ trọn mạch chủ ngữ, tạo tiêu đề Hook 3s trọn ý, phụ đề từng từ, trích B-roll cận cảnh (không tự chèn logo lạ) |
| 4 | Tương tác đôi: Box Chat AI + Timeline CapCut | `ai-chat-editor`, `edl-manager`, `antivibe-ui-audit` | Chat trực tiếp với AI để sửa/đảo/cắt cảnh hoặc kéo 2 đầu clip `[ ]`, kéo đảo vị trí video và zoom/pan khung hình 9:16 |
| 5 | Render `1080x1920` & Kiểm tra từng cảnh | `music-mix`, `sfx-by-motion`, `qa-render-check`, `export-platforms`, `skill-updater` | Xuất video chuẩn `1080x1920` với tên file tự nhiên, trích frame từng cảnh kiểm tra thực tế và lưu bài học vào `NOTES.md` |

## Checklist hoàn thành
- [ ] Có đủ `02_transcripts/*.words.json`, `*.sentences.json` và đã chuẩn hóa hết lỗi chính tả ASR tiếng Việt.
- [ ] Đã loại bỏ tự động các câu/từ khóa buôn bán, giá cả, cam kết dễ bị bóp traffic và không chèn logo lạ (như TikTok Shop).
- [ ] Phụ đề, Hook và thẻ đồ họa hiển thị đúng tỷ lệ `1080x1920`, tiêu đề Hook trọn nghĩa không bị cắt cụt từ.
- [ ] Đã trích frame kiểm tra từng cảnh (Scene-by-Scene QA) của video xuất bản và cập nhật bài học vào `NOTES.md`.
