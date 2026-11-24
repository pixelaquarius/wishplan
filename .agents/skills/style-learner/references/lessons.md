# Kinh nghiệm — `style-learner`

Ghi chú định dạng mỗi mục: `Ngày | Dự án | Điều đã thử | Kết quả | Bằng chứng`

## Giả thuyết ban đầu (cần kiểm chứng trên footage của kênh)
- **2026-11-17 | Khởi tạo | Tách khung hình mỗi 2 giây kết hợp đo scene cut**: Dùng ảnh trích `2s/khung` giúp AI đọc bố cục chữ, màu sắc và nhịp dựng từ video mẫu chính xác mà tốn rất ít token. *(Giả thuyết ban đầu, cần kiểm chứng trên footage của kênh)*
- **2026-11-17 | _style_refs (4 video) | Phân tích chuyển dịch phong cách editorial-talking-head**: 3 mẫu mới cho thấy xu hướng bỏ hộp đen sau phụ đề/hook, tăng nhịp nói 284–303 WPM, cắt chuyển mỗi 3.6–8.1s, dùng chữ trắng đổ bóng + nhấn xanh cyan/sky gradient (`#38BDF8`/`#22D3EE`) và cảnh tóm tắt kính mờ `backdrop-blur` với thẻ trắng. Đã cập nhật vào `references/style.md`.
