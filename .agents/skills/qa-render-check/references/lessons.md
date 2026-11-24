# Kinh nghiệm — `qa-render-check`

Ghi chú định dạng mỗi mục: `Ngày | Dự án | Điều đã thử | Kết quả | Bằng chứng`

- **2026-11-22 | _demo | Duyệt ảnh từng phân cảnh phát hiện lỗi chữ nhỏ 50% trên 4K và logo TikTok Shop thừa**: Chỉ kiểm tra ffprobe JSON là chưa đủ vì `2160x3840` vẫn qua bài test 9:16 nhưng làm chữ Remotion/ASS nhỏ đi một nửa và sót logo TikTok Shop; bắt buộc xuất frame từng cảnh và khóa chuẩn canvas `1080x1920`.
