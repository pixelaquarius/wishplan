# Quy chuẩn phong cách kênh anthinh (`style.md`)

> Cập nhật từ **4 video tham khảo** mới nhất trong `_style_refs/` (`2snaptik.vn_7702817920237210898.mp4`, `snaptik.vn_7697994893678955794.mp4`, `snaptik.vn_7702817920237210898.mp4`, `snaptik.vn_7703548263919668498.mp4`) và đối chiếu trực tiếp khung hình talking-head của Thịnh (`Projects/_demo/`).

## 1. Số liệu đo được từ `_style_refs/`
| Video mẫu | Thời lượng | Độ phân giải | FPS | Chuyển cảnh lớn | Nhịp nói (WPM) | Đặc trưng đồ họa nổi bật (`editorial-talking-head`) |
|---|---|---|---|---|---|---|
| `2snaptik.vn_7702817920237210898.mp4` | `97.97s` | `576x1024` | `30.0` | `5` (`16.33s/cảnh`) | `303.2` | Pill xanh `#2563EB`, tiêu đề gradient trắng → xanh trời `#93C5FD`, phụ đề không đóng hộp chữ serif/italic nhấn, nền mờ `backdrop-blur` + thẻ trắng bo tròn |
| `snaptik.vn_7697994893678955794.mp4` | `57.90s` | `576x1024` | `30.0` | `11` (`4.83s/cảnh`) | `294.3` | Ngoặc khung `[ ]` ở Hook, nhịp cắt gãy gọn dưới `5s`, thẻ viền neon cyan + PiP tròn góc trên phải |
| `snaptik.vn_7702817920237210898.mp4` | `48.62s` | `576x1024` | `30.0` | `5` (`8.10s/cảnh`) | `292.5` | Chữ phụ giải thích nhỏ ngay dưới sub, thẻ UI gọn sạch |
| `snaptik.vn_7703548263919668498.mp4` | `108.97s` | `576x1024` | `30.0` | `29` (`3.63s/cảnh`) | `284.1` | Cut nhịp cao (`~3.6s`), chữ `SIÊU PHẨM AI` trắng + cyan `#22D3EE` không hộp đen, nền grid mờ + thẻ trắng bo góc + pill phụ đề tím/xanh mờ |

## 2. Quy tắc dựng & Nhịp cắt áp dụng cho kênh anthinh
- **Khung hình chuẩn**: `1080x1920` (9:16), `30fps`, render lossless PNG + CRF 14 (`h264`, `yuv420p`) + Lanczos, audio `aac 48kHz` `-14 LUFS`, chống ồn `afftdn` (tùy chọn).
- **Tốc độ & Pacing**:
  - Giọng nói đẩy nhịp nhanh gọn `1.08x–1.10x` (~`285–305 WPM`), giữ pitch tự nhiên.
  - Phá nhịp hình ảnh mỗi **`4–8 giây`** bằng zoom in/out mượt (`1.0x ↔ 1.12x` quanh vùng mặt `originY: 36%`), hiệu ứng cắt cảnh (`zoom_pop`, `whip_left`, `whip_right`, `flash`), logo thương hiệu minh họa, InfoCard hoặc Frosted Interlude.

## 3. Phong cách đồ họa Editorial-Talking-Head (thay hộp đen cũ)
- **Hook 3 giây đầu (`HookBanner`)**:
  - Đặt ở vùng trên an toàn (`top: 88px`), **không đóng hộp viền đen nặng nề**.
  - Pill nhãn xanh dương `#2563EB` + chữ hoa sắc nét màu trắng đổ bóng sâu kết hợp điểm nhấn gradient xanh trời `#38BDF8` / `#22D3EE` và dấu ngoặc góc `[ ]` tạo điểm nhìn thị giác ngay giây đầu.
- **Phụ đề (`CaptionsLayer` — Boxless Editorial)**:
  - Đặt vùng an toàn dưới-giữa (`bottom: 320px`, lề trái `72px`, lề phải `136px` tránh UI TikTok).
  - **Bỏ khung hộp tối bao quanh chữ**; dùng chữ trắng `#FFFFFF` `ExtraBold` + đổ bóng đa lớp (`0 4px 18px rgba(0,0,0,0.92)`) trên nền dải gradient tối dịu phía cạnh đáy khung hình.
  - Từ khóa chính tô màu xanh cyan rực `#38BDF8` / `#22D3EE`; số liệu/kết quả tô vàng ấm `#FACC15`. Chữ phụ nhỏ bên dưới dùng pill kính mờ nhẹ (`rgba(15, 23, 42, 0.56)`).
- **Cảnh chèn tóm tắt (`DarkInterludeScene` — Frosted Grid Glass)**:
  - Dùng nền kính mờ `blur(20px)` + lưới kỹ thuật mảnh trên nền `rgba(9, 15, 30, 0.72)` thay vì che đen hoàn toàn, giữ cảm giác không gian liên tục với speaker.
  - Thẻ nội dung màu trắng kem bo góc lớn (`rgba(255, 255, 255, 0.96)`), số thứ tự/icon chuyển sắc `#2563EB -> #06B6D4`.
- **Thẻ thông tin (`InfoCardLayer`) & Logo minh họa (`LogoBadgeLayer`)**:
  - Pill trắng kính mờ đặt vùng cổ/ngực (`top: 1210px`), viền thanh mảnh `rgba(56,189,248,0.55)`, hiện `2.2–2.6s`.
  - Logo thương hiệu (`TikTok`, `TikTok Shop`, `ChatGPT`, `Gemini`, `Claude`, `NotebookLM`, v.v.) tự động bật khớp từ khóa ở góc an toàn.

## 4. Âm thanh
- Lọc tạp âm nền trước khi ghép (`afftdn=nf=-22:tn=1` khi bật chống ồn), chuẩn hóa `-14 LUFS`, fade `0.03s` tại điểm cắt.
- Nhạc nền ducking `-22 dB` + SFX (`whoosh`, `pop`, `ding`) khớp từng nhịp motion, giãn cách `>= 1.5s`.
