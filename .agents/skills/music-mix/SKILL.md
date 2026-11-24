---
name: music-mix
description: Dùng khi cân bằng âm lượng giọng nói và nhạc nền (sidechain ducking, chuẩn hóa loudness) không tốn AI.
version: 1.0.0
---

# music-mix — Cân bằng nhạc nền so với giọng nói

## Mục tiêu
Chuẩn hóa giọng nói chính đạt chuẩn rõ ràng trên loa điện thoại (`-14 LUFS`), đồng thời trộn nhạc nền không bản quyền từ `04_assets/music/` ở mức êm (`-24` đến `-28 dB` dưới giọng hoặc tự động nén bằng `sidechaincompress`).

## Input
- Video đã ghép cắt từ EDL (`03_working/<ten>.video_cuts.mp4`).
- File nhạc nền hợp lệ (không bản quyền / thư viện TikTok Commercial / CC0) trong `04_assets/music/`.

## Output
- Track âm thanh hoặc video đã trộn nhạc chuẩn (`03_working/<ten>.mixed.mp4`).

## Các bước
1. Kiểm tra `04_assets/music/`; nếu chưa có nhạc thì chỉ chuẩn hóa giọng nói (`loudnorm=I=-14:TP=-1.5:LRA=9`) để tránh lỗi thiếu file và ghi chú vào log.
2. Kiểm tra thông tin bản quyền/nguồn file nhạc (nếu tên file chứa tag không rõ nguồn thì cảnh báo trên UI).
3. Dùng `ffmpeg` cắt/loop nhạc khớp đúng thời lượng video, thêm `afade=t=in:d=0.4` đầu video và `afade=t=out:d=1.0` cuối video.
4. Trộn nhạc nền ở mức `-22 dB` kèm `sidechaincompress` theo track giọng nói để nhạc tự nhỏ xuống khi Thịnh đang nói và nhích lên nhẹ ở nhịp nghỉ.
5. Kiểm tra peak không quá `-1.0 dBTP` để không bị rè trên TikTok.

## Checklist hoàn thành
- [ ] Giọng nói rõ ràng, không bị nhạc lấn.
- [ ] Nhạc nền fade in/out mượt, không cắt ngang đột ngột ở cuối clip.
- [ ] Không có clip bản quyền rủi ro tắt tiếng.

## Script liên quan trong `_tools/`
- `_tools/render_edl.py`
- `_tools/audio_mix.py`
