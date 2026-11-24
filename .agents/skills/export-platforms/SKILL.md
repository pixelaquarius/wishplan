---
name: export-platforms
description: Dùng khi xuất video dọc chuẩn 1080x1920 30fps với tên file tự do tự nhiên, bản dự phòng Reels/Shorts, ảnh thumbnail và file EDL CMX3600 cho DaVinci Resolve.
version: 1.1.0
---

# export-platforms — Xuất bản video chuẩn 1080x1920 & Đặt tên tự nhiên

## Mục tiêu
Xuất video thành phẩm sắc nét chuẩn `1080x1920` (`30fps`, `h264`, `aac -14 LUFS`) trên cả hai chế độ (`fast_gpu` và `remotion`), đồng bộ bộ lọc màu Filmic/LUT và sử dụng **tên file tự nhiên do người dùng chọn** (không ép tiền tố cá nhân, không ép gạch nối).

## Quy tắc xuất bản
1. **Đặt tên file tự do & tự nhiên (`sanitize_natural_filename`)**:
   - Giữ nguyên khoảng trắng và tên tự nhiên người dùng nhập (ví dụ: `Review máy đọc sách XTEINK.mp4`).
   - Nếu người dùng để trống ô tên file, hệ thống gợi ý tên tự nhiên có khoảng trắng dựa trên tiêu đề Hook hoặc câu mở đầu (không dùng dấu gạch ngang `-` hay tiền tố `anthinh_`).
2. **Đồng nhất độ phân giải `1080x1920` & Màu sắc trên mọi Engine**:
   - Dù clip gốc là 4K hay 1080p, bản xuất dọc luôn chuẩn hóa về `1080x1920` bằng thuật toán Lanczos (kèm tỷ lệ Zoom/Pan khung hình người dùng chỉnh trên Stage) để chữ và đồ họa hiển thị đúng 100% kích thước thiết kế.
   - Áp dụng đồng nhất bộ lọc màu (`build_ffmpeg_color_filter`) cho cả `fast_gpu` lẫn `remotion`.
