---
description: Phân tích khác biệt giữa EDL AI và EDL đã duyệt để rút kinh nghiệm, cập nhật skill và tạo commit git.
---

# Workflow `/cap-nhat-skill`: Học từ chỉnh sửa thực tế

Đầu vào: Tên dự án `Projects/<ten-du-an>/` đã có `03_working/<ten>.edl.ai.tsv` và `<ten>.edl.final.tsv` (hoặc yêu cầu trực tiếp `"cập nhật skill X theo nhận xét này"`).

## Các bước thực hiện

1. **So sánh EDL bằng code**:
   - Chạy `_tools/.venv/Scripts/python.exe _tools/edl_diff.py --project <ten-du-an>`.
   - Thu bảng thay đổi: đoạn bật lại, đoạn tắt đi, đoạn đổi thứ tự, đoạn sửa thời lượng và nội dung cột `note`.
2. **Nhóm nhận xét theo skill** (`skill-updater`):
   - Đọc bảng diff và ghi chú người dùng nhập (nếu có).
   - Quy mỗi thay đổi về đúng skill chịu trách nhiệm (`silence-filler-cut`, `retake-selector`, `hook-builder`, `caption-style`, `info-cards`, `broll-placement`, `music-mix`, `sfx-by-motion`, `content-claims-check`...).
3. **Đề xuất cập nhật `references/lessons.md`**:
   - Với mỗi nhận xét, soạn đúng 1 mục mới gồm: `Ngày`, `Dự án`, `Điều đã thử`, `Kết quả`, `Bằng chứng (đoạn/giây)`.
   - Kiểm tra xem nhận xét tương tự đã xuất hiện ở **>= 3 dự án khác nhau** chưa; nếu rồi, đề xuất nâng thành quy tắc chính thức trong `SKILL.md` (giữ dưới 150 dòng).
4. **Trình bày & Chờ người dùng duyệt**:
   - Hiển thị rõ từng dòng đề xuất thêm vào skill nào, tăng version dự kiến (`x.y.Z` cho sửa nhỏ/thêm kinh nghiệm, `x.Y.0` cho thêm quy tắc mới vào `SKILL.md`).
   - **Chỉ ghi file sau khi người dùng đồng ý.**
5. **Ghi file, cập nhật chỉ mục & commit Git**:
   - Cập nhật `references/lessons.md` (và `SKILL.md` nếu được duyệt nâng quy tắc).
   - Cập nhật version trong frontmatter `SKILL.md`, ghi thêm mục vào `CHANGELOG.md` của skill đó, cập nhật `_tools/docs/SKILLS.md`.
   - Tạo commit Git theo định dạng: `skill: <tên-skill> vX.Y.Z - <lý do ngắn>`.
