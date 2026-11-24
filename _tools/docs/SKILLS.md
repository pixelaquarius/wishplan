# Chỉ mục Thư viện Skill — Hệ thống dựng video AI WishEdit

Cập nhật lần cuối: `2026-11-22` (Đã lược bỏ 3 skill không phù hợp/trùng lặp: `countdown-video`, `lower-thirds`, `caption-style`; bổ sung 2 skill mới: `ai-chat-editor`, `antivibe-ui-audit`)

| Nhóm | Tên skill | Mục đích | Phiên bản | Ngày cập nhật | Dùng AI |
|---|---|---|---|---|---|
| A. Điều phối & Chat AI | [`anthinh-edit-master`](../../.agents/skills/anthinh-edit-master/SKILL.md) | Điều phối quy trình 5 giai đoạn WishEdit, kết hợp Box Chat AI, Timeline CapCut và QA từng cảnh | `1.1.0` | `2026-11-22` | Có |
| A. Điều phối & Chat AI | [`ai-chat-editor`](../../.agents/skills/ai-chat-editor/SKILL.md) | Xử lý lệnh dựng và chỉnh sửa video bằng ngôn ngữ tự nhiên trong Box Chat AI trên giao diện chính | `1.0.0` | `2026-11-22` | Có |
| B. Chuẩn bị | [`ingest-footage`](../../.agents/skills/ingest-footage/SKILL.md) | Kiểm tra ffprobe, chuẩn hóa fps/audio, tổ chức file từ `01_raw/` | `1.0.0` | `2026-11-17` | Không |
| B. Chuẩn bị | [`transcribe-vi`](../../.agents/skills/transcribe-vi/SKILL.md) | Tạo transcript tiếng Việt kèm timestamp từng từ và tách câu bằng faster-whisper | `1.0.0` | `2026-11-17` | Không |
| C. Cắt và cấu trúc | [`silence-filler-cut`](../../.agents/skills/silence-filler-cut/SKILL.md) | Loại bỏ khoảng lặng, từ đệm, câu vấp (`Mà cứ...`) và sửa lỗi đồng âm ASR tiếng Việt | `1.0.0` | `2026-11-17` | Không |
| C. Cắt và cấu trúc | [`retake-selector`](../../.agents/skills/retake-selector/SKILL.md) | Gom các lần nói lại (retake), chọn take tốt nhất và giữ trọn mạch chủ ngữ | `1.0.0` | `2026-11-17` | Có |
| C. Cắt và cấu trúc | [`hook-builder`](../../.agents/skills/hook-builder/SKILL.md) | Chọn câu mở đầu 3 giây đầu đắt giá và rút tiêu đề Hook trọn nghĩa từ frame 1 | `1.1.0` | `2026-11-22` | Có |
| C. Cắt và cấu trúc | [`edl-manager`](../../.agents/skills/edl-manager/SKILL.md) | Đọc/ghi EDL TSV, kéo cắt 2 đầu, đảo vị trí cảnh và đối chiếu bản AI vs bản duyệt | `1.0.0` | `2026-11-17` | Không |
| C. Cắt và cấu trúc | [`short-form-video`](../../.agents/skills/short-form-video/SKILL.md) | Cấu trúc Hook→Retention→Loop 9:16, ngắt nhịp mỗi 2–4s và vùng an toàn dọc | `0.1.0` | `2026-11-17` | Ít |
| D. Chữ và đồ họa | [`caption-animation`](../../.agents/skills/caption-animation/SKILL.md) | Phụ đề tiếng Việt động theo từng từ (`.words.json`), tô màu từ khóa/số liệu trong vùng an toàn `1080x1920` | `1.1.0` | `2026-11-22` | Không |
| D. Chữ và đồ họa | [`info-cards`](../../.agents/skills/info-cards/SKILL.md) | Dựng thẻ thông tin (icon + nhãn) và cảnh nền kính mờ chèn giữa | `1.0.0` | `2026-11-17` | Ít |
| D. Chữ và đồ họa | [`broll-placement`](../../.agents/skills/broll-placement/SKILL.md) | Trích B-roll cận cảnh từ clip gốc và đặt thẻ minh họa khớp lời nói (không tự chèn logo lạ) | `1.1.0` | `2026-11-22` | Ít |
| E. Âm thanh | [`music-mix`](../../.agents/skills/music-mix/SKILL.md) | Cân bằng âm lượng nhạc nền (sidechain ducking) so với giọng nói chính `-14 LUFS` | `1.0.0` | `2026-11-17` | Không |
| E. Âm thanh | [`sfx-by-motion`](../../.agents/skills/sfx-by-motion/SKILL.md) | Gắn sound effect khớp điểm chuyển cảnh, thẻ thông tin và chữ nổi | `1.0.0` | `2026-11-17` | Không |
| F. Kiểm tra & UI Audit | [`content-claims-check`](../../.agents/skills/content-claims-check/SKILL.md) | Tự động phát hiện, loại bỏ hoặc làm mềm từ ngữ buôn bán, giá cả, cam kết dễ bị bóp tương tác | `1.1.0` | `2026-11-22` | Có |
| F. Kiểm tra & UI Audit | [`qa-render-check`](../../.agents/skills/qa-render-check/SKILL.md) | Kiểm tra kỹ thuật `1080x1920` và trích ảnh kiểm tra trực quan từng phân cảnh (Scene-by-Scene QA) | `1.1.0` | `2026-11-22` | Không |
| F. Kiểm tra & UI Audit | [`antivibe-ui-audit`](../../.agents/skills/antivibe-ui-audit/SKILL.md) | Chuẩn hóa giao diện NLE kiểu CapCut, gom thông số kỹ thuật vào Cài đặt và test trọn hành trình nút bấm | `1.0.0` | `2026-11-22` | Không |
| F. Kiểm tra & Bảo mật | [`vibe-security-audit`](../../.agents/skills/vibe-security-audit/SKILL.md) | Rà soát & gia cố bảo mật Frontend/Backend chống lỗi vibe code (XSS, Path Traversal, SSRF, CSP) | `1.0.0` | `2026-11-22` | Không |
| G. Xuất bản | [`export-platforms`](../../.agents/skills/export-platforms/SKILL.md) | Xuất video `1080x1920` với tên file tự do tự nhiên, bản nền tảng phụ, thumbnail và EDL CMX3600 | `1.1.0` | `2026-11-22` | Không |
| H. Học và cập nhật | [`style-learner`](../../.agents/skills/style-learner/SKILL.md) | Phân tích video tham khảo trong `_style_refs/` để rút quy tắc vào `style.md` | `1.0.0` | `2026-11-17` | Có |
| H. Học và cập nhật | [`skill-updater`](../../.agents/skills/skill-updater/SKILL.md) | Rút kinh nghiệm từ EDL diff và phản hồi người dùng để cập nhật skill & `NOTES.md` | `1.0.0` | `2026-11-17` | Có |
