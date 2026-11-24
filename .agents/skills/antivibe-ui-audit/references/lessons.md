# Kinh nghiệm — `antivibe-ui-audit`

Ghi chú định dạng mỗi mục: `Ngày | Dự án | Điều đã thử | Kết quả | Bằng chứng`

- **2026-11-22 | _demo | Loại bỏ chữ thừa trên UI, sửa lỗi kéo Timeline và bỏ gạch nối tên file**: Các nhãn kỹ thuật như "0 Token", "Bridge AI (0 Key)" và tên file gạch nối máy móc tạo cảm giác vibe code; đã gom hết vào modal Cài đặt, sửa lỗi `renderTimeline()` phá hủy DOM khi đang kéo clip và chuyển sang đặt tên file tự nhiên.
