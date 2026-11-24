# Preset: Chọn take tốt & Sắp xếp ý logic (`retake_select`)

## Mục tiêu
Gom các đoạn nói lặp hoặc quay nhiều take trong footage thô, chọn đúng một take tốt nhất cho mỗi ý và sắp xếp lại trình tự mạch lạc theo cấu trúc Hook -> Vấn đề -> Trải nghiệm / Giải pháp -> Kết luận tự nhiên.

## Input
- Danh sách câu đã cắt khoảng lặng/từ đệm theo định dạng nén: `id|giây|câu`.
- Độ dài mục tiêu: `30–65 giây` (linh hoạt theo nội dung).

## Quy tắc
1. Chỉ chọn 1 take tốt nhất trong mỗi nhóm nói lặp; ưu tiên take ít từ đệm, tròn ý chính, nhịp nói dứt khoát.
2. Giữ trọn ngữ cảnh & chủ ngữ (Coreference Rule): KHÔNG giữ câu mở bằng đại từ/liên từ ("Nhưng mà...", "Cái con này...", "Nó...", "Đó là lý do...", "Tôi không thể...") nếu thiếu câu danh từ làm rõ chủ thể ngay trước nó.
3. Không giữ những mảnh câu cụt nửa chừng (`"Mà cứ..."`), câu chèo kéo mua bán/giá cả dễ bị bóp tương tác, hoặc câu mở đầu phản cảm.
4. Giữ tối đa ý tự nhiên của người nói, kèm `text_fixes` để sửa sạch lỗi chính tả do nhận diện giọng nói (ASR).
5. Trả về đúng định dạng JSON yêu cầu để cập nhật thẳng vào EDL TSV.

## Output
```json
{
  "selected_ids": ["S01", "S02", "S18", "S19"],
  "dropped": [{"id": "S03", "reason": "retake_lap_y"}],
  "hook_id": "S01",
  "hook_title": "MÁY ĐỌC SÁCH NHỎ NHẤT THẾ GIỚI",
  "text_fixes": {"S10": "câu đã sửa chính tả chuẩn"}
}
```
