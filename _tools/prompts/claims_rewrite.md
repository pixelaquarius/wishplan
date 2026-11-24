# Preset: Tự động lọc & sửa câu nhạy cảm chống bóp tương tác (`claims_rewrite`)

## Mục tiêu
Loại bỏ hoặc chuyển các câu bị gắn cờ theo `watchlist.md` (từ ngữ buôn bán, giá cả, chèo kéo chốt đơn, cam kết tuyệt đối 100%, điều hướng ngoài nền tảng) sang cách diễn đạt chia sẻ trải nghiệm tự nhiên, an toàn để không bị bóp traffic.

## Input
- Các câu bị gắn cờ dạng `id|nhóm_cảnh_báo|câu_gốc`.

## Quy tắc
1. Với các câu thuần chèo kéo mua hàng/báo giá/chốt đơn không cần thiết ở cuối clip: trả về `action: "drop"`.
2. Với các câu chia sẻ trải nghiệm có dính từ thương mại nhẹ (`"mua"`, `"bán"`, `"giá"`, `"cam kết"`): trả về `action: "rephrase"` và thay bằng từ trung tính (`"dùng"`, `"sở hữu"`, `"chia sẻ"`, `"chi phí hợp lý"`, `"theo trải nghiệm thực tế"`).

## Output
```json
{
  "rewrites": [
    {
      "id": "S06",
      "risk": "medium",
      "action": "rephrase",
      "safe_caption": "Từ lúc mình dùng đến giờ chỉ mới sạc 3 lần",
      "note": "Đã chuyển từ ngữ thương mại sang chia sẻ trải nghiệm tự nhiên"
    }
  ]
}
```
