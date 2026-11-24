# Bài học kinh nghiệm — `vibe-security-audit`

## Kinh nghiệm đã kiểm chứng
- **[2026-11-22] Khóa chặt Path Traversal và Upload Extension Whitelist**: Khi nhận file qua FastAPI `UploadFile` hoặc tham số URL `{filename}`, chỉ dùng `Path(filename).name` là chưa đủ nếu tên file là `..` hoặc `.env` hoặc file script `.html`/`.svg` chứa mã độc XSS. Phải kiểm tra `ext in ALLOWED_EXTS` và xác minh `target.resolve().is_relative_to(base_dir.resolve())`.
