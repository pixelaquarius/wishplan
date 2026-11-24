# Quy tắc kỹ thuật dựng video — WishEdit

- **Nguồn và đích**: Chỉ đọc footage gốc từ `01_raw/`, ghi toàn bộ video xuất bản vào `05_output/`. Tuyệt đối không ghi đè hoặc xóa file trong `01_raw/`.
- **Quy ước đặt tên file xuất**: Đặt tên file **tự do, tự nhiên** theo chủ đề hoặc tên người dùng nhập (ví dụ: `Review máy đọc sách XTEINK.mp4` hoặc tên bất kỳ không ép tiền tố cá nhân và không ép nối gạch ngang kiểu máy móc).
- **Thông số kỹ thuật đầu ra**: Chuẩn hóa khung hình `1080x1920` (9:16), `30fps`, video codec `h264` (`yuv420p`), audio `aac` (`48kHz`, loudness chuẩn hóa `-14 LUFS` cho thoại rõ). Mọi tọa độ chữ và đồ họa phải đồng nhất ở hệ quy chiếu `1080x1920`.
- **Vùng an toàn phụ đề & chữ**: Đặt phụ đề ở vùng dưới-giữa (`y` khoảng 68%–80% chiều cao khung hình, chừa lề dưới >= 280px và lề phải >= 136px) để không bị nút tương tác và mô tả của TikTok / Reels / Shorts che khuất.
- **Kiểm tra từng cảnh (Scene-by-Scene QA) & Nhật ký**: Sau mỗi lần render, kiểm tra frame thực tế từng phân cảnh để đảm bảo không có logo thừa, không lỗi tỷ lệ chữ, không còn lỗi chính tả ASR; ghi đầy đủ lệnh đã chạy, thời gian xử lý và kết quả vào `06_logs/`.
