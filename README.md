# WishEdit (`wishedit`) v3.0 — Ứng dụng Dựng Video Ngắn AI & NLE chuẩn CapCut Desktop

**WishEdit** là ứng dụng dựng video ngắn dọc `9:16` (`1080×1920`, `30fps`, `H.264`, `-14 LUFS`) mang giao diện và trải nghiệm **App Desktop chuyên nghiệp chuẩn CapCut / DaVinci Resolve**, tích hợp **Trợ lý AI chỉnh sửa trực tiếp ngay tại khung Timeline**, **Trang Quản lý Dự án đầu tiên**, **Timeline phân tầng có Filmstrip Thumbnail**, và hệ thống bảo mật **Vibe Security Hardening**.

---

## 1. Điểm nổi bật của WishEdit v3.0

1. **Ứng dụng Độc lập 1 Bước (`WishEdit.app` & Icon Đen-Trắng phong cách Claude)**:
   - Thiết kế bộ icon đen trắng tối giản (`#0B0B0D` & `#FAFAFA`) lấy cảm hứng từ phong cách hình học của Claude.
   - Mở [`WishEdit.app`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/WishEdit.app), [`WishEdit.command`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/WishEdit.command) hoặc chạy `_tools/server/app.py` đều tự động khởi chạy cửa sổ App độc lập không thanh địa chỉ chỉ trong 1 bước.
2. **Trang Quản lý Dự án (`#homeLauncherScreen`) chuẩn CapCut / DaVinci Resolve**:
   - Màn hình đầu tiên trước khi vào trình dựng: Tạo dự án mới, ra lệnh nhanh cho **Trợ lý AI EditPilot**, quản lý danh sách dự án gần đây với ảnh thumbnail, dung lượng và thời lượng thực tế.
3. **Timeline Phân tầng chuẩn CapCut / Premiere & Thanh kéo chiều cao Thumbnail kiểu DaVinci**:
   - Phân chia rõ ràng: `V3 · Phụ đề & Hook` (trên cùng) → `V2 · B-Roll & Màu` → `V1 · Video chính` (có dải ảnh filmstrip thumbnail lặp theo chiều dài clip) → `A1 · Âm thanh` (dưới cùng).
   - Thanh trượt **`Thumb`** trên thanh công cụ Timeline cho phép phóng to / thu nhỏ chiều cao dải thumbnail video (`32px–76px`) giống DaVinci Resolve.
   - Kim **Playhead** bám chuột mượt mà theo thời gian thực (`60fps`) trong suốt quá trình kéo.
   - **Xem video gốc ngay trên Media Pool**: Rê chuột vào thẻ clip trong Media Pool để xem và tua nhanh video gốc như CapCut.
4. **Trợ lý AI thay thế trực tiếp khung Timeline & Inspector theo Ngữ cảnh**:
   - Nhấn **`Trợ lý AI`** sẽ chuyển toàn bộ khung Timeline phía dưới thành **Bảng Chat AI** để gõ lệnh chỉnh sửa ngay lập tức, không dùng icon màu mè và đồng bộ cỡ chữ chuẩn.
   - **Inspector ngữ cảnh thông minh**: Chọn phần tử nào trên Timeline chỉ hiển thị đúng tab chỉnh sửa của phần tử đó (ví dụ: chọn `Âm thanh` chỉ mở tab `Âm thanh`, chọn `ADJ LAYER / LUT` chỉ mở tab `Màu`).
5. **Cửa sổ `Settings` (4 Tab) & `Export` (2 Cột) chuẩn CapCut Desktop — Mặc định `Remotion Full`**:
   - **Settings**: 4 tab `Draft | Edit | Performance | General` quản lý đường dẫn lưu dự án, xóa bộ nhớ đệm (Cache) trực tiếp, cấu hình GPU và trạng thái API Key.
   - **Export**: Khung xem trước `Ảnh bìa 9:16` bên trái và bảng thông số xuất video bên phải, mặc định luôn là **`Remotion Full`** kèm nút **`Áp dụng`** trực tiếp trên thanh Header.
6. **Bảo mật Chống Lỗi "Vibe Code" (`vibe-security-audit`)**:
   - Chặn Path Traversal tuyệt đối bằng Regex + `.resolve().relative_to()`, kiểm soát whitelist định dạng upload (`ALLOWED_UPLOAD_EXTS`), chống SSRF trên Webhook URL, ẩn giá trị khóa API khỏi response Frontend và gắn đầy đủ HTTP Security Headers (`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`).

---

## 2. Cấu trúc thư mục chuẩn (Không dùng dấu `_` ở đầu tên thư mục hiển thị)

- [`WishEdit.app`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/WishEdit.app) / [`WishEdit.command`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/WishEdit.command): Bộ khởi chạy ứng dụng Desktop macOS 1 chạm.
- [`StyleRefs/`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/StyleRefs): Thư mục chứa video mẫu tham chiếu phong cách và `style.md`.
- [`Projects/`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/Projects):
  - [`Projects/Demo/`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/Projects/Demo): Dự án mẫu đã dựng hoàn chỉnh (`00_brief`, `01_raw`, `02_transcripts`, `03_working`, `04_assets`, `05_output`, `06_logs`).
  - [`Projects/Template/`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/Projects/Template): Khung mẫu khi tạo dự án mới.
- [`_tools/`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools): Mã nguồn Python, Desktop Launcher (`desktop_app.py`), FastAPI Server (`server/app.py` + `server/static/`) và Remotion (`remotion/`).
- [`.agents/skills/`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/.agents/skills): 21 Skills chuyên biệt (bao gồm `ai-chat-editor`, `antivibe-ui-audit`, `vibe-security-audit`), đạt `21/21 OK` qua `skill_audit.py`.

---

## 3. Khởi chạy Ứng dụng WishEdit

### Cách 1: Mở trực tiếp App Desktop (Khuyên dùng)
Nhấp đúp vào **[`WishEdit.app`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/WishEdit.app)** hoặc **[`WishEdit.command`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/WishEdit.command)** (hoặc chạy lệnh dưới đây để tự động bật cả Backend lẫn cửa sổ App độc lập):
```bash
_tools/.venv/bin/python _tools/desktop_app.py
```

### Cách 2: Chạy qua CLI
```bash
_tools/.venv/bin/python _tools/pipeline.py --project Demo --up-to 3 --force-ai
_tools/.venv/bin/python _tools/render_edl.py --project Demo --topic "Review máy đọc sách XTEINK" --engine remotion --overwrite
```
