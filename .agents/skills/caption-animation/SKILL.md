---
name: caption-animation
description: Dùng khi tạo phụ đề tiếng Việt động theo từng từ (word-timed pop, karaoke highlight từ .words.json), tô màu từ khóa/số liệu và đặt chuẩn vùng an toàn 9:16 trong WishEdit.
version: 1.1.0
---

# caption-animation — Phụ đề Tiếng Việt Động Theo Từng Từ & Tô Màu Từ Khóa

## Mục tiêu
Kết hợp ưu điểm của phụ đề động theo từng từ (`02_transcripts/*.words.json` từ `faster-whisper`) với tô màu từ khóa quan trọng (`#38BDF8`) và số liệu (`#FACC15`) trong vùng an toàn dưới-giữa của khung dọc `1080x1920`.

## Quy tắc cốt lõi
1. **Dùng timestamp từng từ thực tế từ `.words.json`**:
   - Mỗi cụm phụ đề hiển thị `3–5 từ`, ánh xạ trực tiếp mảng `words: [{ word, startFrame, endFrame }]` từ kết quả `faster-whisper` (đã chia theo `speechSpeed`) thay vì chỉ chia đều theo độ dài ký tự.
   - Từ đang được phát âm tại `frame` hiện tại được phóng nhẹ (`scale 1.06`) và sáng nổi bật, kết hợp tô màu từ khóa chính và chữ số.
2. **Đặt chuẩn vùng an toàn `1080x1920`**:
   - Font `Be Vietnam Pro ExtraBold` (`52px`), đặt tại `bottom: 320px`, chừa lề trái `64px` và lề phải `136px` để không bao giờ bị nút Like/Comment/Share hay phần mô tả video che khuất.
3. **Chuẩn hóa chính tả trước khi tạo phụ đề**:
   - Mọi từ trong phụ đề đều đi qua bộ lọc sửa lỗi đồng âm ASR tiếng Việt và bộ lọc làm mềm từ ngữ thương mại/giá cả.
