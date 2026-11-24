---
description: Rà soát định kỳ toàn bộ 17 skill hàng tuần để gộp kinh nghiệm trùng, lọc mục lỗi thời và kiểm tra độ dài.
---

# Workflow `/ra-soat-skill`: Bảo trì thư viện skill hàng tuần

## Các bước thực hiện

1. **Quét kiểm tra kỹ thuật bằng script**:
   - Chạy lệnh kiểm tra toàn bộ `.agents/skills/*/SKILL.md`, `references/lessons.md`, `CHANGELOG.md`:
     - Đếm số dòng `SKILL.md` (phải `< 150` dòng) và số ký tự (phải `< 12.000` ký tự).
     - Kiểm tra frontmatter đủ `name`, `description` (1 câu), `version`.
     - Kiểm tra phiên bản khớp giữa `SKILL.md`, `CHANGELOG.md` và `_tools/docs/SKILLS.md`.
2. **Rà soát nội dung `references/lessons.md` từng skill**:
   - Phát hiện các kinh nghiệm trùng lặp ý -> đề xuất gộp thành 1 mục cô đọng giữ lại bằng chứng mới nhất/rõ nhất.
   - Phát hiện các giả thuyết ban đầu chưa kiểm chứng hoặc kinh nghiệm đã lỗi thời so với quy tắc mới -> đánh dấu cần kiểm chứng hoặc đề xuất loại bỏ.
   - Kiểm tra các nhận xét lặp từ `>= 3` dự án chưa được nâng lên `SKILL.md`.
3. **Xuất báo cáo tình trạng**:
   - Trình bày bảng trạng thái 17 skill (Tên | Phiên bản | Số dòng `SKILL.md` | Số kinh nghiệm | Mục cần dọn/nâng cấp | Trạng thái Đạt/Cảnh báo).
   - Chỉ sửa file hoặc tạo commit Git sau khi người dùng duyệt các đề xuất gộp/xóa/nâng cấp.
