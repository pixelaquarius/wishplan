---
name: skill-updater
description: Dùng khi rút kinh nghiệm từ chênh lệch giữa EDL AI và EDL đã duyệt (hoặc nhận xét trực tiếp) để cập nhật skill và commit Git.
version: 1.0.0
---

# skill-updater — Rút kinh nghiệm & Cập nhật skill liên tục

## Mục tiêu
Biến mỗi lần Thịnh sửa tay trên giao diện web (hoặc góp ý trực tiếp) thành kinh nghiệm có bằng chứng trong `references/lessons.md`, nâng thành quy tắc cứng trong `SKILL.md` khi lặp ở từ `>= 3` video khác nhau, và lưu lịch sử bằng commit Git.

## Input
- `03_working/<ten>.edl.ai.tsv` và `03_working/<ten>.edl.final.tsv` (hoặc nhận xét trực tiếp từ người dùng).
- Kết quả chạy `_tools/edl_diff.py`.

## Output
- Đề xuất cập nhật `references/lessons.md` / `SKILL.md` chờ duyệt; sau khi duyệt sẽ cập nhật `CHANGELOG.md`, `_tools/docs/SKILLS.md` và tạo commit Git.

## Các bước
1. Chạy `_tools/edl_diff.py --project <ten>` để lấy bảng thay đổi (đoạn bật lại, tắt đi, đổi thứ tự, chỉnh thời lượng, `note`).
2. Đọc bảng diff và ghi chú người dùng, nhóm thành các nhận xét theo đúng tên skill liên quan.
3. Với mỗi nhận xét, đề xuất 1 dòng thêm vào `references/lessons.md` của skill đó gồm: `Ngày`, `Dự án`, `Điều đã thử`, `Kết quả`, `Bằng chứng (đoạn nào, giây nào)`.
4. Nếu mẫu nhận xét lặp lại ở **>= 3 dự án khác nhau**, đề xuất nâng thành quy tắc chính thức trong `SKILL.md` (giữ `SKILL.md < 150` dòng).
5. **Chờ người dùng duyệt**, sau đó mới ghi file, tăng version (`x.y.Z` cho sửa nhỏ / thêm kinh nghiệm, `x.Y.0` cho thêm quy tắc mới), ghi `CHANGELOG.md`, cập nhật `_tools/docs/SKILLS.md` và chạy `git commit -m "skill: <tên> vX.Y.Z - <lý do>"`.

## Checklist hoàn thành
- [ ] Mọi thay đổi đều có bằng chứng cụ thể (dự án, đoạn, giây).
- [ ] Người dùng đã duyệt trước khi ghi đè file skill và tạo commit.
- [ ] Phiên bản khớp giữa `SKILL.md`, `CHANGELOG.md` và `_tools/docs/SKILLS.md`.

## Script liên quan trong `_tools/`
- `_tools/edl_diff.py`
- `_tools/skill_audit.py`
