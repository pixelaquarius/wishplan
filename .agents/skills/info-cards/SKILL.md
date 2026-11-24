---
name: info-cards
description: Dùng khi cần chèn thẻ thông tin (icon + nhãn) hoặc cảnh nền tối giữa video để nhấn mạnh số liệu, checklist hoặc sơ đồ ý.
version: 1.0.0
---

# info-cards — Thẻ thông tin & Cảnh nền tối chèn giữa

## Mục tiêu
Giữ nhịp thị giác cho video talking-head bằng cách tự động chèn **thẻ thông tin** (icon + nhãn gọn) ở góc trên/giữa khi có liệt kê bước/con số, và **cảnh nền tối** toàn màn hình khi giải thích sơ đồ hoặc tóm tắt 3 ý chính.

## Input
- Danh sách đoạn giữ lại trong `03_working/<ten>.edl.tsv` và cấu trúc layer từ giao diện duyệt.
- Quy cách thẻ từ `style.md`.

## Output
- Mảng `infoCards[]` và `darkScenes[]` trong `03_working/<ten>.remotion_props.json`.

## Các bước
1. Quét văn bản các đoạn giữ lại để phát hiện câu liệt kê (`bước 1`, `đầu tiên`, `thứ hai`, `lưu ý`, `sai lầm`) hoặc con số/chỉ số nổi bật.
2. Tạo thẻ thông tin gọn (`icon` SVG đơn giản + nhãn `<= 6 từ`), thời lượng `1.8s–2.8s`, hiệu ứng vào/ra mượt khớp điểm `sfx-by-motion`.
3. Khi cần tóm tắt sơ đồ hoặc danh sách nhiều ý (`darkScene`), chèn lớp nền tối `85%` opacity đè lên hình (giữ nguyên tiếng nói) để hiện tiêu đề + 2–3 gạch đầu dòng hoặc con số lớn.
4. Cho phép chỉnh sửa trực tiếp nội dung thẻ/thời điểm trên layer UI ở Bước 5 trước khi render Remotion.

## Checklist hoàn thành
- [ ] Nhãn thẻ ngắn gọn (`<= 6 từ`), không che mặt người nói khi ở chế độ góc/trên.
- [ ] Cảnh nền tối giữ giọng nói gốc liên tục, không ngắt nhịp.
- [ ] Props JSON hợp lệ để Remotion render không lỗi.

## Script liên quan trong `_tools/`
- `_tools/remotion_props.py`
- `_tools/remotion/src/InfoCardLayer.tsx`
- `_tools/remotion/src/DarkInterludeScene.tsx`
