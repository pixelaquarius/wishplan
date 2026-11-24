# Kinh nghiệm — `hook-builder`

Ghi chú định dạng mỗi mục: `Ngày | Dự án | Điều đã thử | Kết quả | Bằng chứng`

- **2026-11-22 | _demo | Sửa lỗi cắt cụt tiêu đề Hook giữa chừng**: Bản cũ lấy `words[:7]` khiến câu `"Đây là chiếc máy đọc sách gần như là nhỏ nhất thế giới"` bị cắt cụt thành `"ĐÂY LÀ CHIẾC MÁY ĐỌC SÁCH GẦN"`; đã đổi sang thuật toán chắt lọc cụm ý hoàn chỉnh -> `"MÁY ĐỌC SÁCH NHỎ NHẤT THẾ GIỚI"`.
