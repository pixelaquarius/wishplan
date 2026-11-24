---
name: content-claims-check
description: Dùng khi tự động quét, loại bỏ hoặc làm mềm các từ ngữ buôn bán, giá cả, điều hướng ngoài nền tảng và cam kết tuyệt đối dễ làm video bị bóp tương tác hoặc vi phạm chính sách.
version: 1.1.0
---

# content-claims-check — Tự động lọc từ bóp tương tác & vi phạm chính sách

## Mục tiêu
Tự động phát hiện và xử lý các từ ngữ thương mại nhạy cảm (`buôn bán`, `bán hàng`, `mua ngay`, `giá cả`, `giá rẻ`, `chốt đơn`, `giỏ hàng`, `inbox`, `zalo`, `cam kết 100%`...) trong cả câu nói lẫn phụ đề hiển thị để video không bị nền tảng đánh dấu quảng cáo rác hoặc bóp traffic tự nhiên.

## Cơ chế xử lý 2 lớp
1. **Loại bỏ câu chèo kéo mua bán / mở đầu phản cảm ở Bước 2–3**:
   - Các câu thuần kêu gọi mua hàng/chốt đơn cuối clip (ví dụ: *"anh em thích con này thì cứ chốt ha"*) hoặc câu mồi phản cảm (*"ai điên khùng mà đi mua..."*) được tự động đánh dấu loại bỏ (`policy_traffic_risk`).
2. **Tự động làm mềm từ khóa nhạy cảm trong các câu chia sẻ trải nghiệm**:
   - Chuyển tự động các từ nhạy cảm về thương mại/giá cả sang từ trung tính chỉ trải nghiệm cá nhân:
     - `"từ lúc tôi mua"` / `"khi mua"` -> `"từ lúc tôi dùng"` / `"khi sở hữu"`
     - `"buôn bán"` / `"bán hàng"` -> `"chia sẻ"` / `"vận hành"`
     - `"giá rẻ"` / `"giá cả"` -> `"mức hợp lý"` / `"chi phí"`
     - `"chốt đơn"` / `"mua ngay"` -> `"tham khảo"` / `"trải nghiệm"`
     - `"cam kết 100%"` / `"chắc chắn"` -> `"ưu tiên"` / `"khả năng cao"`

## Tài liệu tham chiếu
- Danh sách từ khóa theo dõi: `references/watchlist.md`
- Hàm thực thi: `scan_watchlist()`, `sanitize_traffic_and_policy_text()` trong `_tools/ai_client.py`
