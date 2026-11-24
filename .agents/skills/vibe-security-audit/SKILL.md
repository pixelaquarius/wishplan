---
name: vibe-security-audit
description: Dùng khi rà soát bảo mật Frontend và Backend để loại bỏ các lỗ hổng kinh điển của vibe code (XSS innerHTML, lộ API key, Path Traversal, SSRF webhook, CORS mở toang, upload file thực thi và thiếu Security Headers).
version: 1.0.0
updated: 2026-11-22
---

# Vibe Security Audit (`vibe-security-audit`)

Skill kiểm toán và gia cố bảo mật toàn diện cho ứng dụng Full-Stack (FastAPI + Vanilla/React Frontend), lấy cảm hứng từ `raroque/vibe-security-skill` và OWASP Top 10 để không một lập trình viên nào có thể chê "front-end/back-end lỏng lẻo kiểu vibe code".

## 7 Quy tắc Bảo mật Bắt buộc

1. **Chống DOM XSS tuyệt đối trên Frontend (OWASP A03)**:
   - Không bao giờ gắn trực tiếp chuỗi từ server/người dùng vào `innerHTML` mà không qua hàm `escHtml()`.
   - Khi cần định dạng nhấn mạnh (như `**bold**` trong hộp chat AI), phải `escHtml(raw)` trước rồi mới thay thế bằng thẻ an toàn, hoặc dựng cây DOM bằng `createElement` + `textContent`.
2. **Không bao giờ lưu hoặc trả về API Key thô cho Frontend (OWASP A02)**:
   - Tuyệt đối không lưu `GEMINI_API_KEY` hay `OPENAI_API_KEY` trong `localStorage` / `sessionStorage`.
   - Endpoint `/api/projects/{name}/overview` và `/api/ai/config` chỉ trả về trạng thái boolean (`has_external_key: true/false`, `active_provider: "gemini"`) — không bao giờ trả ngược chuỗi key ra JSON.
3. **Chống Path Traversal & Khóa chặt tên file/thư mục (OWASP A01)**:
   - Mọi tên dự án và tên file upload/xóa/đọc phải được kiểm tra bằng regex whitelist và `.resolve()` để xác minh nằm bên trong thư mục gốc (`PROJECTS_DIR` hoặc `STYLE_REFS_DIR`).
4. **Kiểm tra Whitelist phần mở rộng & Giới hạn kích thước Upload (OWASP A04)**:
   - Chỉ cho phép đúng định dạng media (`.mp4`, `.mov`, `.mkv`, `.webm`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.wav`, `.mp3`, `.m4a`, `.aac`, `.cube`, `.3dl`). Từ chối ngay `.py`, `.sh`, `.js`, `.html`, `.svg`, `.exe`.
5. **Chống SSRF qua Webhook URL (OWASP A10)**:
   - Mọi `remote_webhook_url` phải dùng giao thức `https://` hoặc `http://` hợp lệ và chặn dải IP nội bộ/metadata (`169.254.169.254`, `127.0.0.1`, `localhost`, `0.0.0.0`, `[::1]`).
6. **Gắn đầy đủ HTTP Security Headers & CSP chuẩn App (OWASP A05)**:
   - Mọi response từ server phải có `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, và `Content-Security-Policy` khóa `object-src 'none'`, `base-uri 'self'`.
7. **Mặc định Bind Localhost (`127.0.0.1`)**:
   - Server mặc định chỉ lắng nghe trên `127.0.0.1` trừ khi người dùng chủ động bật chia sẻ LAN trong Cài đặt.
