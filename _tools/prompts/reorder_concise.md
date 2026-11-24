# Preset: Cắt gọn mạnh tay còn 35–50 giây (`reorder_concise`)

## Mục tiêu
Rút gọn video nói dài hoặc lan man xuống nhịp ngắn gọn `35–50 giây` bằng cách giữ những ý có giá trị hành động cao nhất cho người xem TikTok.

## Input
- Danh sách câu hiện tại `id|giây|câu` và thời lượng mục tiêu (`45s`).

## Quy tắc
1. Cắt bỏ các câu lặp ý, giải thích vòng vo, ví dụ thừa nhưng vẫn giữ đủ 3 phần: Hook -> Nội dung chính -> CTA ngắn.
2. Tổng thời lượng các đoạn chọn không vượt quá `52 giây`.
3. Đánh dấu lý do rõ ràng cho từng ID bị loại để người dùng dễ kiểm tra lại trên web UI.

## Output
```json
{
  "selected_ids": ["S01", "S03", "S04", "S07"],
  "dropped": [{"id": "S02", "reason": "giai_thich_trung_y"}],
  "hook_id": "S01",
  "hook_title": "CÁCH GIỮ ĐƠN TIKTOK SHOP"
}
```
