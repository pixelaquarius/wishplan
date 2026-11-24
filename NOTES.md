# Nhật ký Kiểm tra, Sửa lỗi, Tái cấu trúc & Bài học Kinh nghiệm — **WishEdit (`wishedit`) v3.0**

> **Cập nhật lần cuối**: 2026-11-22  
> **Trạng thái**: Hoàn tất nâng cấp **WishEdit v3.0 (CapCut Desktop Mindmap UI + Standalone App + Vibe Security Hardening + End-to-End QA)**

---

## 1. Xác định lại Mục đích & Kiến trúc Giao diện chuẩn CapCut của **WishEdit v3.0**

### 1.1. Mục đích cốt lõi
**WishEdit** là ứng dụng dựng video ngắn dọc `9:16` (`1080×1920`, `30fps`, `H.264`, `-14 LUFS`) mang trải nghiệm **App Desktop chuyên nghiệp kiểu CapCut / DaVinci Resolve / Premiere Pro**, kết hợp 2 trụ cột:
1. **Dựng video bằng hội thoại AI (`Trợ lý AI` thay thế trực tiếp khung Timeline dưới)**:
   - Khi nhấn **`Trợ lý AI`**, toàn bộ khu vực Timeline phía dưới chuyển ngay thành **Bảng Chat Trợ lý AI (`#tlAiChatBar`)** để người dùng gõ lệnh sửa video tức thì (cắt ngắn, đảo vị trí cảnh, đổi Hook 3 giây đầu, lọc từ buôn bán / giá cả bóp traffic, sửa chính tả phụ đề, chèn B-Roll, cân màu) và bấm **`Quay lại Timeline`** bất cứ lúc nào.
   - Giao diện Trợ lý AI đã lược bỏ toàn bộ icon/emoji rườm rà, đồng bộ kích thước chữ `11px–12px` chuẩn phần mềm chuyên nghiệp.
2. **Kiến trúc NLE chuẩn CapCut Desktop (4 khu vực + Trang Quản lý Dự án đầu tiên)**:
   - **Màn hình Quản lý Dự án (`#homeLauncherScreen`)**: Hiển thị ngay khi mở app giống CapCut / DaVinci Resolve / Photoshop, gồm thanh điều hướng trái (`Trang chủ dự án`, `Mẫu phong cách`, `Cài đặt`), banner Cyan lớn **`+ Tạo dự án mới`**, thanh nhắc lệnh **`Trợ lý AI EditPilot`** kèm 4 ô tác vụ nhanh, và lưới **`Dự án gần đây`** có ảnh thumbnail thực tế, dung lượng và thời lượng.
   - **Bố cục Timeline phân tầng chuẩn CapCut / Premiere**:
     - Trên cùng (`V3 · Phụ đề & Hook`): Các lớp chữ Hook và Phụ đề phủ lên trên.
     - Giữa trên (`V2 · B-Roll & Màu`): Các lớp ảnh/video B-Roll và thanh `ADJ LAYER` (LUT & Chỉnh màu).
     - Trục chính (`V1 · Video chính`): Thanh video chính có **dải ảnh filmstrip thumbnail lặp liên tục theo chiều dài clip** kèm thanh kéo độ cao thumbnail **`Thumb` (`32px–76px`)** học từ DaVinci Resolve.
     - Dưới cùng (`A1 · Âm thanh`): Thanh sóng âm thanh và nhạc nền nằm riêng ở đáy.
   - **Playhead bám chuột thời gian thực (`60fps Live Scrubbing`)**: Kéo kim thời gian trên thước `#tlRuler`, đầu kim `#tlPlayhead` hoặc lòng `#tlViewport` đều đi mượt theo chuột ngay trong lúc kéo (`pointermove`), không còn hiện tượng thả chuột mới nhảy.
   - **Inspector ngữ cảnh thông minh (`Contextual Inspector Tabs`)**: Nhấn vào phần tử nào trên Timeline thì cột phải chỉ hiện đúng các tab phù hợp với phần tử đó (nhấn vào `Âm thanh` chỉ hiện tab `Âm thanh`; nhấn vào `ADJ LAYER / LUT Màu` chỉ hiện tab `Màu`; nhấn vào `Phụ đề` chỉ hiện tab `Phụ đề`; nhấn vào `Hook` chỉ hiện tab `Hook`; nhấn vào `Video chính` hiện `Video`, `Màu`, `Âm thanh`).

---

## 2. Toàn bộ các Vấn đề đã Phát hiện & Đã Xử lý Triệt để trong đợt Nâng cấp v3.0

### 2.1. Thiết kế lại Icon `WishEdit` đen trắng tối giản phong cách Claude & Đóng gói thành App độc lập (`WishEdit.app`)
- **Vấn đề**: Người dùng muốn icon phần mềm chỉ dùng 2 màu đen & trắng cách điệu theo phong cách tối giản của Claude, đồng thời mở lên là chạy thẳng thành cửa sổ App độc lập chứ không phải mở server rồi mở trình duyệt web qua 2 bước.
- **Cách khắc phục**:
  - Thiết kế bộ icon đen trắng tối giản mới (nền Squircle đen tuyền `#0B0B0D` + tia sao 12 cánh геометри trắng `#FAFAFA` phong cách Claude) trên toàn bộ [`_tools/server/static/favicon.svg`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/static/favicon.svg), [`icon-512.png`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/static/icon-512.png), [`apple-touch-icon.png`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/static/apple-touch-icon.png), [`favicon.ico`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/static/favicon.ico) và bộ icon macOS `.icns` trong [`WishEdit.app/Contents/Resources/WishEdit.icns`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/WishEdit.app/Contents/Resources/WishEdit.icns).
  - Đổi tên `AnThinh Studio.app` -> [`WishEdit.app`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/WishEdit.app) và `AnThinh Studio.command` -> [`WishEdit.command`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/WishEdit.command).
  - Nâng cấp [`_tools/desktop_app.py`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/desktop_app.py) và [`_tools/server/app.py`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/app.py) (`_open_standalone_app_window`) để khi khởi chạy từ bất kỳ đâu, hệ thống tự động bật cửa sổ App原生 không thanh địa chỉ (`--app=http://127.0.0.1:8000?mode=desktop`) chỉ trong 1 bước duy nhất.

### 2.2. Xây dựng Trang Quản lý Dự án (`#homeLauncherScreen`) giống CapCut / DaVinci Resolve / Photoshop
- **Vấn đề**: Phần mềm trước đây mở thẳng vào màn hình cắt ghép mà thiếu trang Quản lý Dự án đầu tiên.
- **Cách khắc phục**:
  - Thiết kế `#homeLauncherScreen` trong [`_tools/server/static/index.html`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/static/index.html) bám sát ảnh chụp giao diện CapCut Desktop:
    - Cột trái gồm nhận diện `WishEdit`, nút `Trang chủ dự án`, `Mẫu phong cách`, `Cài đặt` và trạng thái `Remotion Full · 1080×1920 30fps`.
    - Vùng chính gồm nút banner lớn màu Cyan **`+ Tạo dự án mới`**, khung **`Trợ lý AI EditPilot`** (*"Hôm nay bạn muốn dựng video như thế nào?"*) + 4 thẻ tính năng nhanh (`Dựng tự động AI`, `Lọc từ bóp traffic`, `Tạo Hook 3 giây`, `Chèn B-Roll & Màu`), cùng lưới **`Dự án gần đây`** hiển thị ảnh thumbnail trích từ clip, dung lượng (`MB`), thời lượng (`MM:SS`) và tìm kiếm dự án.

### 2.3. Thiết kế lại Cửa sổ `Settings` (4 tab) và `Export` (2 cột) chuẩn giao diện CapCut Desktop
- **Vấn đề**: Cửa sổ Cài đặt và Xuất video cũ bố trí rời rạc, không đồng bộ với chuẩn CapCut mà người dùng gửi ảnh tham chiếu.
- **Cách khắc phục**:
  - **Cửa sổ `Settings` ([`index.html`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/static/index.html#L422-L579))**:
    - Thiết kế thanh chuyển 4 tab ngang (`Draft` | `Edit` | `Performance` | `General`) giống hệt CapCut Settings.
    - Tab **`Draft`**: Các dòng `Thư mục dự án (Save to)`, `Mẫu phong cách (StyleRefs)`, tùy chọn radio `Bộ nhớ đệm (Cache)` (*Không tự xóa* / *Tự động xóa cache cũ hơn 7/15/30 ngày*), hiển thị `Dung lượng Cache` thực tế kèm nút thùng rác xóa cache (`/api/system/cache` & `/api/system/clear-cache`), và công tắc `Cửa sổ App độc lập`.
    - Tab **`Edit`**, **`Performance`**, **`General`**: Quản lý thời lượng mặc định, vùng an toàn 9:16, tự lọc từ bóp traffic, chế độ Render mặc định (`Remotion Full`), GPU encoder, và khóa API Gemini/OpenAI.
  - **Cửa sổ `Export` ([`index.html`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/static/index.html#L581-L678))**:
    - Thiết kế 2 cột chuẩn CapCut Export: Cột trái là khung xem trước **`Ảnh bìa 9:16`** của video; cột phải là bảng thông số sạch sẽ (`Timeline xuất`, `Tên video`, `Lưu tại`, `Chế độ Render`, `Độ phân giải 1080P`, `Bit rate`, `Codec H.264 / AVC`, `Định dạng mp4`, `Khung hình 30fps`, `Không gian màu Rec. 709 SDR`).
    - Dưới đáy hiển thị `Thời lượng | Dung lượng ước tính` cùng 2 nút `Cancel` và `Export` màu Cyan.

### 2.4. Mặc định luôn là `Remotion Full` & Nút `Áp dụng` rõ ràng
- **Vấn đề**: Người dùng yêu cầu mặc định luôn dùng `Remotion Full` và cần biết nhấn vào đâu để cập nhật khi chuyển giữa chế độ nhanh (`Fast GPU`) và `Remotion Full`.
- **Cách khắc phục**:
  - Đặt mặc định `remotion` (`Remotion Full`) tại tất cả các tầng: [`index.html`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/static/index.html), [`app.js`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/static/app.js), [`app.py`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/app.py), và [`render_edl.py`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/render_edl.py).
  - Bổ sung nút **`Áp dụng`** (`#btnApplyEngineNow`) nằm ngay cạnh hộp chọn `Remotion Full / Fast GPU` trên thanh Header, đồng thời tự động áp dụng và thông báo trạng thái ngay khi người dùng đổi chế độ.

### 2.5. Xóa bỏ các nhãn & tính năng dư thừa, xem video gốc bằng cách rê chuột (Hover) vào Media Pool
- **Đã loại bỏ hoàn toàn**:
  1. Chữ `(đặt tự do)` thừa trong nhãn `"Tên video xuất"`.
  2. Tùy chọn `"Xuất thêm bản Reels & YT Shorts"` (dùng chung 1 bản master `1080×1920` chuẩn cho mọi nền tảng).
  3. Ô nhập `"Watermark góc trên trái"` (xóa khỏi cả giao diện lẫn pipeline).
  4. Cặp nút `"Render | Gốc"` trên thanh tiêu đề khung Stage.
- **Xem video gốc kiểu CapCut**:
  - Khi rê chuột (`mouseenter` / `mousemove`) vào bất kỳ thẻ clip nào trong **Media Pool (`Clip gốc`)**, thẻ đó lập tức phát video preview trực tiếp kèm scrubbing theo vị trí con trỏ chuột giống hệt CapCut.

### 2.6. Chuẩn hóa Tên thư mục (Không dùng dấu gạch dưới `_` ở đầu)
- **Vấn đề**: Các tên thư mục như `_style_refs/`, `_demo`, `_template` nhìn giống thư mục tạm của code, thiếu thẩm mỹ khi hiển thị trong phần mềm.
- **Cách khắc phục**:
  - Đổi tên `_style_refs/` -> [`StyleRefs/`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/StyleRefs), `Projects/_template/` -> [`Projects/Template/`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/Projects/Template), `Projects/_demo/` -> [`Projects/Demo/`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/Projects/Demo) (cùng toàn bộ file `Demo.edl.tsv`, `Demo.layers.json`, `wishedit_upbeat_pulse.wav`).
  - Xóa bỏ mọi đường dẫn thư mục thô (`01_raw/`, `_style_refs/`, `04_assets/`) khỏi tiêu đề giao diện.

### 2.7. Gia cố Bảo mật Frontend & Backend chống lỗi "Vibe Code" (`vibe-security-audit`)
- **Xây dựng skill mới [`.agents/skills/vibe-security-audit/SKILL.md`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/.agents/skills/vibe-security-audit/SKILL.md)** và áp dụng trực tiếp vào hệ thống:
  1. **Chống Path Traversal tuyệt đối**: Hàm `ensure_project()` trong [`_tools/common.py`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/common.py) kiểm tra biểu thức chính quy `PROJECT_NAME_RE` và xác thực `.resolve().relative_to(PROJECTS_DIR.resolve())`.
  2. **Whitelist định dạng file Upload**: Hàm `_sanitize_media_filename()` trong [`_tools/server/app.py`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/app.py) chỉ cho phép các đuôi media/font/LUT hợp lệ (`ALLOWED_UPLOAD_EXTS`), chặn hoàn toàn việc tải lên file thực thi/script (`.py`, `.sh`, `.html`, `.js`).
  3. **Chống SSRF qua Webhook**: Hàm `_validate_webhook_url()` chặn các địa chỉ loopback và cloud metadata (`127.0.0.1`, `localhost`, `169.254.169.254`).
  4. **HTTP Security Headers & Content-Security-Policy (CSP)**: Middleware `_security_headers_middleware` gắn `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin` cho mọi phản hồi và ẩn danh sách khóa API nhạy cảm khỏi Frontend (chỉ trả về trạng thái `gemini_key_configured: true/false`).

### 2.8. Tinh gọn Thanh công cụ Chính, Tự động Lưu, Timeline Tự do & Bảng màu 2 Tông (v3.1)
- **Loại bỏ hoàn toàn nút thừa khỏi màn hình Edit ([`index.html`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/static/index.html), [`app.js`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/server/static/app.js))**:
  - Xóa nút **`+ Dự án mới`** khỏi Header màn hình Edit (quản lý tạo/chuyển dự án tập trung ở **Trang Quản lý Dự án**).
  - Xóa nút **`Lưu dự án`** & **`Lưu Inspector`** thủ công; thay bằng cơ chế **`Tự động lưu` (`scheduleAutoSave()`)** tự lưu EDL & Layers sau mỗi thao tác chỉnh sửa.
  - Xóa nhãn **`QA PASS`** & nút **`QA / Logs`** khỏi màn hình chính; dời **`Báo cáo kỹ thuật (QA) & Nhật ký xử lý (Logs)`** vào **`Cài đặt → General`**.
  - Dời bộ chọn chế độ **`Remotion Full / Nhanh GPU`** vào **`Cài đặt → Edit`**.
- **Gom `Trợ lý AI` về 1 điểm duy nhất & Gộp `AI Mode` vào `Xuất Video`**:
  - Chỉ giữ **1 nút `Trợ lý AI` duy nhất** ngay trên thanh công cụ Timeline (`#btnToggleBottomAiChat`), xóa bỏ các nút/khung Trợ lý AI trùng lặp trên Header, Tab trái và Trang chủ.
  - Gộp toàn bộ cấu hình **`AI Mode`** (kiểu cắt nhịp, số thẻ B-Roll, B-Roll quay cận, đổi góc Zoom, Auto Color + LUT, nhạc nền & SFX) vào bên trong cửa sổ **`Xuất Video` (`Export`)**.
- **Timeline Tự do kiểu CapCut & Nút Toàn màn hình**:
  - Bỏ nhãn gắn cứng `V1 / V2 / V3 / A1` ở cột trái Timeline; chia thành **Vùng Hình ảnh / Lớp phủ tự do ở trên** và **Vùng Âm thanh ở dưới**.
  - Bổ sung 2 nút **Toàn màn hình**: **`#btnToggleAppFullscreen`** trên Header (toàn ứng dụng) và **`#btnToggleStageFullscreen`** dưới khung xem trước `9:16`.
- **Thống nhất Bảng màu 2 Tông (Dark Slate + Cyan)**:
  - Loại bỏ toàn bộ màu vàng/cam (`amber-*` / `yellow-*` / `orange-*`) khỏi giao diện chính và thanh Timeline, đồng bộ bảng màu tối + xanh Cyan chủ đạo (`#22D3EE`).

- **Kiểm định Skills ([`_tools/skill_audit.py`](file:///Users/m2/Developer/Antigravity%20Work/AnThinh-Studio/_tools/skill_audit.py))**: **21/21 skills đạt chuẩn `OK`, 0 cảnh báo**.
- **Kiểm định trực quan trên trình duyệt thực tế (`http://127.0.0.1:8000`)**:
  - Đã kiểm tra và chụp ảnh xác nhận từng màn hình:
    1. **Trang Quản lý Dự án (`#homeLauncherScreen`)** với dự án `Demo` (`47.9 MB | 00:52`).
    2. **Timeline phân tầng CapCut (`V3` -> `V2` -> `V1` -> `A1`)** có dải filmstrip thumbnail, thanh kéo chiều cao `Thumb`, và kim Playhead bám chuột mượt mà.
    3. **Inspector ngữ cảnh (`Contextual Inspector Tabs`)**: Nhấn vào `Video` hiện `Video | Màu | Âm thanh`; nhấn vào `Âm thanh` chỉ hiện `Âm thanh`; nhấn vào `ADJ LAYER` chỉ hiện `Màu`; nhấn vào `Phụ đề` chỉ hiện `Phụ đề`; nhấn vào `Hook` chỉ hiện `Hook`.
    4. **Bảng Chat Trợ lý AI (`#tlAiChatBar`)** thay thế gọn gàng khu vực Timeline phía dưới khi nhấn `Trợ lý AI`.
    5. **Cửa sổ `Settings` 4 tab (`Draft | Edit | Performance | General`)** và **Cửa sổ `Export` 2 cột** với mặc định `Remotion Full`.
