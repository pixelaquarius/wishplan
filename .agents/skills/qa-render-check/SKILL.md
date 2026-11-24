---
name: qa-render-check
description: Dùng khi kiểm tra kỹ thuật và trích xuất hình ảnh từng phân cảnh (Scene-by-Scene Visual QA) của video đã render để phát hiện lỗi tỷ lệ chữ, logo thừa, lỗi chính tả phụ đề và âm lượng.
version: 1.1.0
---

# qa-render-check — Kiểm tra kỹ thuật & Duyệt hình ảnh từng phân cảnh (Scene-by-Scene QA)

## Mục tiêu
Đảm bảo video xuất bản không chỉ đạt thông số kỹ thuật (`1080x1920`, `30fps`, `h264`, `aac`, `-14 LUFS`) mà còn được **trích frame kiểm tra trực quan từng phân cảnh (Hook, các đoạn thân bài, cảnh B-roll, kết bài)** để không lọt bất kỳ lỗi hiển thị nào ra thành phẩm.

## Các hạng mục kiểm tra bắt buộc (`_tools/qa_check.py`)
1. **Độ phân giải chuẩn `1080x1920` (9:16)**:
   - Bắt buộc đồng nhất ở `1080x1920` để phụ đề, Hook và thẻ đồ họa không bao giờ bị thu nhỏ 50% khi nguồn quay là 4K (`2160x3840`).
2. **Trích xuất frame theo từng phân cảnh (`06_logs/qa_frames/`)**:
   - Trích ít nhất 6–8 frame trải đều qua cảnh mở đầu (Hook), các cảnh giữa có B-roll/InfoCard và cảnh kết thúc (`scene_01.jpg` .. `scene_06.jpg`) cùng 1 ảnh bảng tổng hợp (`contact_sheet.jpg`).
3. **Kiểm tra trực quan trên ảnh trích xuất**:
   - Không có logo thương hiệu lạ (như `logo_tiktokshop.png`) tự hiện lên khi nội dung không liên quan.
   - Tiêu đề Hook trọn nghĩa, không bị cắt cụt giữa chừng.
   - Phụ đề đúng chính tả tiếng Việt, không tràn khỏi vùng an toàn (`bottom >= 280px`, `right >= 136px`).
4. **Kiểm tra âm thanh & ánh sáng**:
   - Không có khoảng lặng `> 1.5s`, đỉnh âm không bị clip (`<= -0.2 dB`), vùng sáng không bị cháy trắng (`highlight clip < 9%`).
