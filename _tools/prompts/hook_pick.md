# Preset: Tối ưu Hook 3 giây đầu (`hook_pick`)

## Mục tiêu
Chọn câu đắt giá nhất trong video để kéo lên 3 giây mở đầu (hoặc giữ nguyên nếu câu đầu đã mạnh) và đặt tiêu đề hook ngắn thu hút đúng đối tượng nhà bán hàng mới / làm TikTok Shop.

## Input
- Danh sách câu giữ lại theo định dạng nén: `id|giây|câu`.

## Quy tắc
1. Hook phải gói gọn trong `<= 3.5 giây`, đi thẳng vào vấn đề thực tế hoặc kết quả rõ ràng.
2. Tiêu đề hook hiển thị trên màn hình tối đa `4–8 chữ`, tiếng Việt dễ đọc ngay trên điện thoại.
3. Không dùng lời hứa cam kết tuyệt đối vi phạm chính sách TikTok.
4. Nếu câu đầu tiên đã đủ mạnh, giữ nguyên thứ tự để tránh nhảy khung hình không cần thiết.

## Output
```json
{
  "hook_id": "S01",
  "move_to_front": false,
  "hook_title": "3 LỖI SETUP TIKTOK SHOP",
  "reason": "Câu mở đầu đi thẳng vào nỗi đau của nhà bán mới trong 2.8 giây."
}
```
