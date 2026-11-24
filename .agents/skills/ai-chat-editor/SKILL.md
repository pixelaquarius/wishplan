---
name: ai-chat-editor
description: Dùng khi người dùng ra lệnh dựng hoặc chỉnh sửa video trực tiếp bằng ngôn ngữ tự nhiên trong Box Chat AI của WishEdit (cắt ngắn, đảo vị trí cảnh, đổi Hook, lọc từ bóp traffic, sửa phụ đề, thêm B-roll, chỉnh màu).
version: 1.0.0
---

# ai-chat-editor — Trợ lý Chat AI Điều Khiển Timeline (OpenChatCut / Pireel Pattern)

## Mục tiêu
Biến Box Chat AI thành người vận hành trực tiếp trên Timeline của WishEdit: hiểu yêu cầu tiếng Việt tự nhiên của người dựng và thực thi ngay các thao tác trên EDL, phụ đề, Hook, B-roll, màu sắc và bộ lọc chính sách.

## Các nhóm lệnh Chat AI hỗ trợ trực tiếp
1. **Cắt gọn & Điều chỉnh thời lượng**:
   - *"Cắt ngắn video xuống khoảng 40 giây"*, *"Rút gọn các đoạn lan man"* -> chạy cấu trúc lại EDL theo thời lượng mục tiêu, giữ trọn mạch chủ ngữ.
2. **Đảo vị trí cảnh & Khôi phục / Xóa cảnh**:
   - *"Đảo cảnh 5 lên trước cảnh 2"*, *"Đưa đoạn nói về iPhone lên trước đoạn sạc pin"* -> hoán đổi hoặc di chuyển vị trí các cảnh đang giữ trên Timeline.
   - *"Bỏ cảnh R12"*, *"Xóa đoạn nói về Trung Quốc"* -> tắt (`keep=0`) các cảnh khớp nội dung.
   - *"Khôi phục đoạn nói về 55g"* -> bật lại (`keep=1`) cảnh đã bị cắt từ transcript gốc.
3. **Tối ưu Hook 3 giây đầu**:
   - *"Đổi câu mở đầu sang đoạn màn hình E-Ink"*, *"Đặt tiêu đề hook là MÁY ĐỌC SÁCH BỎ TÚI"* -> cập nhật câu mở đầu EDL và `layers.hook.title`.
4. **Tự động lọc từ buôn bán / giá cả bóp tương tác & xóa logo thừa**:
   - *"Lọc các từ buôn bán, giá cả dễ bóp traffic"*, *"Xóa logo TikTok Shop"* -> quét toàn bộ câu giữ lại, loại bỏ câu chèo kéo mua bán cuối video, thay từ nhạy cảm bằng từ trung tính và xóa sạch `logoBadges` thừa.
5. **Sửa chính tả phụ đề & Đổi giao diện chữ / tốc độ / màu**:
   - *"Sửa chữ cuốn sát thành cuốn sách"*, *"Sửa lỗi chính tả phụ đề"* -> chuẩn hóa đồng âm ASR trên cả EDL và `captions`.
   - *"Đổi màu từ khóa sang vàng, cỡ chữ 58"*, *"Tăng tốc độ nói lên 1.12x"*, *"Bật chỉnh màu trong trẻo"* -> cập nhật `layers.style`, `layers.video`, `layers.color` và đồng bộ lại props.

## Nguyên tắc vận hành
- Không chặn lệnh bằng cổng tiết kiệm token cứng nhắc; khi có API key (Gemini/OpenAI) trong Cài đặt sẽ kết hợp LLM + bộ thực thi Timeline, và khi không có key vẫn thực thi chính xác bằng bộ phân tích ngữ nghĩa tiếng Việt cục bộ.
- Sau mỗi lệnh chat, trả về danh sách các thay đổi cụ thể (`actions_applied`) để giao diện cập nhật ngay Timeline, EDL và khung xem trước 9:16.
