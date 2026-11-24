---
name: hook-builder
description: Dùng khi chọn câu mở đầu 3 giây đầu thu hút nhất và rút tiêu đề Hook trọn nghĩa hiển thị ngay từ frame 1.
version: 1.1.0
---

# hook-builder — Dựng Hook 3 Giây Đầu & Tiêu Đề Trọn Nghĩa

## Mục tiêu
Giữ chân người xem ngay trong 3 giây đầu bằng một câu mở đầu trọn vẹn ý (không dùng câu mở đầu phản cảm hoặc bị cắt cụt) kèm tiêu đề Hook 4–7 chữ súc tích, tròn nghĩa hiển thị ngay từ frame 1.

## Quy tắc cốt lõi
1. **Không cắt cụt tiêu đề Hook theo số từ cứng (`words[:7]`)**:
   - Lược bỏ cụm từ dẫn nhập rườm rà ở đầu câu (*"Đây là chiếc"*, *"Hôm nay mình sẽ"*, *"Xin chào các bạn"*) để giữ trọn cụm danh từ/động từ đắt giá nhất (ví dụ: `"Đây là chiếc máy đọc sách gần như là nhỏ nhất thế giới"` -> `"MÁY ĐỌC SÁCH NHỎ NHẤT THẾ GIỚI"`, tuyệt đối không cắt thành `"ĐÂY LÀ CHIẾC MÁY ĐỌC SÁCH GẦN"`).
2. **Hiển thị ngay ở Frame 1**:
   - Không fade-in chậm từ màn hình trống ở frame 0; đặt tại vùng an toàn phía trên (`top: 88px` trên khung `1080x1920`).
