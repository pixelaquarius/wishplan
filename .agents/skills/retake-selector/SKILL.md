---
name: retake-selector
description: Dùng khi video có nhiều lần nói lại (retake) cần gom nhóm, chọn take tốt nhất và sắp xếp lại ý qua cổng kiểm tra AI.
version: 1.0.0
---

# retake-selector — Gom câu nói lại & Chọn take tốt nhất

## Mục tiêu
Khi người nói quay nhiều take cho cùng một ý (hoặc nói vòng vo dài > `1.5x` mục tiêu), gom các take trùng ý và chọn đúng 1 take mượt nhất, tiết kiệm token bằng định dạng nén và cache.

## Input
- `03_working/<ten>.cleaned_segments.json`.
- Tín hiệu từ cổng kiểm tra AI (`pipeline.py`: danh sách cặp nghi lặp, tổng thời lượng, cờ `--force-ai`).

## Output
- Danh sách ID giữ/bỏ và thứ tự sắp xếp lại trong `03_working/<ten>.ai_decision.json` (cache theo SHA-256) và `03_working/<ten>.edl.ai.tsv`.

## Các bước
1. Code tự tính điểm chất lượng sơ bộ từng đoạn (tỷ lệ từ đệm, tốc độ nói, độ rõ từ Whisper probability, năng lượng RMS từ audio).
2. Chỉ khi cổng AI bật: nén toàn bộ danh sách thành bảng tối giản `id|giây|câu` (ví dụ `S04|2.8|Hôm nay Thịnh chia sẻ cách setup TikTok Shop`).
3. Kiểm tra cache `03_working/<ten>.ai_cache.json` theo SHA-256 input; trùng hash thì dùng lại kết quả cũ, không gọi AI.
4. Gửi AI (ưu tiên model nhẹ) kèm tiêu chí chọn take: ít từ đệm, tròn ý chính, năng lượng giọng tốt, hợp ngữ cảnh câu trước/sau.
5. Nếu cần đảo thứ tự ý, giữ ưu tiên mượt chuyển cảnh (ưu tiên giữ câu nối ý cùng bối cảnh/ánh sáng nếu có).

## Checklist hoàn thành
- [ ] Không bỏ sót ý chính trong dàn ý/câu nói gốc.
- [ ] Các take trùng chỉ giữ lại 1 take tốt nhất, các take còn lại đánh dấu `keep=0` kèm `note=retake_dropped`.
- [ ] Đã lưu cache SHA-256 để chạy lại không tốn thêm token.

## Script liên quan trong `_tools/`
- `_tools/pipeline.py` (chặng `gate_and_structure`)
- `_tools/prompts/retake_select.txt`
