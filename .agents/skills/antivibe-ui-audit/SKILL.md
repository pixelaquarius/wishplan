---
name: antivibe-ui-audit
description: Dùng khi thiết kế, kiểm thử giao diện WishEdit và rà soát trải nghiệm NLE kiểu CapCut để loại bỏ dấu hiệu vibe code, gom cấu hình kỹ thuật vào Cài đặt và kiểm tra trọn hành trình từng nút bấm.
version: 1.0.0
---

# antivibe-ui-audit — Chuẩn Hóa Giao Diện NLE & Kiểm Thử Trọn Hành Trình (Anti-Vibe-Code)

## Mục tiêu
Đảm bảo phần mềm WishEdit có giao diện sạch, trực quan đúng chuẩn công cụ dựng video chuyên nghiệp (CapCut / Descript), không phô bày thuật ngữ kỹ thuật thừa ("0 Token", "0 API Key", "SHA-256 Cached") ra màn hình làm việc và mọi thao tác kéo thả đều hoạt động mượt.

## 5 Quy tắc chống "Vibe Code" bắt buộc
1. **Gom toàn bộ thông số kỹ thuật vào nút `⚙️ Cài đặt` (Settings Modal)**:
   - Không đặt các nút/nhãn kỹ thuật (`API Key`, `Auto GPU`, `Bridge AI`, `0 Token Leak`, `PRO NLE`) trên thanh Header hoặc xen lẫn vào bảng làm việc hằng ngày.
2. **Thao tác Timeline & Khung hình 9:16 đúng chuẩn CapCut**:
   - Kéo 2 cạnh trái/phải `[ ]` của từng clip trên Track 1 để cắt ra/vào (`trim in/out`) mượt mà không làm giật hay mất DOM đang kéo.
   - Kéo thả trực tiếp clip trên Track 1 hoặc danh sách EDL để **đảo vị trí video** có vạch chỉ dẫn vị trí thả.
   - Cuộn chuột / kéo trực tiếp trên khung Stage 9:16 để **phóng to/thu nhỏ (`zoom`) và dịch chuyển vị trí khung hình video (`pan X/Y`)**.
3. **Đặt tên file tự do, tự nhiên**:
   - Không ép tiền tố tên cá nhân và không ép nối gạch ngang kiểu máy móc (`anthinh_tim-ugc-mien-phi_v1.mp4`). Cho phép đặt tên tự nhiên có khoảng trắng (ví dụ: `Review máy đọc sách XTEINK.mp4`).
4. **Không tự động chèn thành phần lạ khi chưa được yêu cầu**:
   - Tuyệt đối không tự gắn logo thương hiệu mặc định (như `logo_tiktokshop.png`) vào video nếu người dùng không chủ động thêm.
5. **Kiểm thử trọn hành trình (End-to-End Journey & Scene-by-Scene Verification)**:
   - Mỗi tính năng và nút bấm trên UI phải được test thực tế qua API và giao diện; sau khi xuất video phải trích frame kiểm tra từng cảnh trước khi kết thúc công việc.
