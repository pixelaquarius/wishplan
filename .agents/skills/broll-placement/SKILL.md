---
name: broll-placement
description: Dùng khi ghép ảnh minh họa, thẻ tóm tắt từ khóa hoặc clip B-roll quay cận vào đúng đoạn giải thích trong video mà không tự chèn logo thương hiệu thừa.
version: 1.1.0
---

# broll-placement — Đặt B-Roll cận cảnh & Thẻ minh họa thông minh

## Mục tiêu
Giữ nhịp thị giác thay đổi mỗi `4–7 giây` bằng clip B-roll cận cảnh sản phẩm (trích từ những đoạn không dùng trong `01_raw/` hoặc do người dùng tải lên) và thẻ tóm tắt ý chính gọn gàng, tuyệt đối không làm rối khung hình bởi các logo không liên quan.

## Quy tắc cốt lõi
1. **Tuyệt đối không tự chèn logo mặc định**:
   - Không bao giờ tự tải hay tự gắn `logo_tiktokshop.png` hoặc bất kỳ logo thương hiệu nào vào video trừ khi người dùng chủ động thêm trong bảng điều chỉnh.
2. **Trích B-roll cận cảnh thực tế (`extract_self_broll_from_raw`)**:
   - Ưu tiên lấy các khoảnh khắc cầm/xoay sản phẩm trên tay từ phần footage dư (`keep=0`), crop cận `1.24x` chuẩn `1080x1920` và phát không tiếng đè lên đoạn thuyết minh tương ứng.
3. **Thẻ Callout B-roll cô đọng (`generate_visual_filler_cards`)**:
   - Đặt ở vùng trên (`pip_top`), tiêu đề 3–6 từ viết hoa rõ ý, không che mặt người nói và không đè lên phụ đề phía dưới.
