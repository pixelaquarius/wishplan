# Preset: Cắt & Giữ ý khớp B-Roll / Demo sản phẩm (`sync_broll`)

## Mục tiêu
Chọn lọc các câu thuyết minh rõ nét nhất khớp với cảnh demo sản phẩm, thao tác trên tay hoặc các file B-roll có trong `04_assets/broll/`, đồng thời loại bỏ hoàn toàn các đoạn lặp ý và từ ngữ chèo kéo mua bán/giá cả.

## Quy tắc
1. Ưu tiên giữ các câu mô tả trực quan đặc điểm sản phẩm, trải nghiệm thực tế, kích thước, màn hình, pin, thao tác sử dụng.
2. Giữ trọn mạch chủ ngữ (không giữ câu mở đầu bằng đại từ/liên từ nếu thiếu câu danh từ ngay trước nó).
3. Loại bỏ các câu chèo kéo mua hàng, báo giá hoặc điều hướng ngoài nền tảng dễ làm bóp tương tác.
4. Trả về JSON gồm `selected_ids`, `dropped`, `hook_id`, `hook_title` (trọn nghĩa, không cắt cụt) và `text_fixes`.
