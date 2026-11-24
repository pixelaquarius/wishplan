<div align="center">

# WishPlan

**Công cụ gọn, làm việc rõ ràng — ghép ảnh để gửi duyệt và xem xét KOL trước khi hợp tác.**

[![Deploy WishPlan to GitHub Pages](https://github.com/pixelaquarius/wishplan/actions/workflows/pages.yml/badge.svg)](https://github.com/pixelaquarius/wishplan/actions/workflows/pages.yml)
[![Static Site](https://img.shields.io/badge/Architecture-100%25%20Client--Side-B93829?style=flat-square)](https://pages.github.com/)


</div>

---

## Tổng quan (Overview)

**WishPlan** là bộ công cụ web tĩnh (100% HTML/CSS/JavaScript thuần phía client, không cần backend riêng; tính năng đồng bộ tùy chọn có thể cần cấu hình dịch vụ ngoài) được thiết kế phục vụ vận hành và sáng tạo hằng ngày cho team, triển khai tự động qua **GitHub Pages**.

## Danh sách công cụ

| Công cụ | Đường dẫn | Mô tả |
| :--- | :--- | :--- |
| **Ghép ảnh · Công việc** | [`ghepanh/index.html`](./ghepanh/index.html) | Chọn ảnh, sắp xếp/xóa, tùy chỉnh cột/nền/lề, xem trước và xuất JPEG/PNG/WebP theo trình duyệt. Giữ tỷ lệ, không cắt góc. |
| **Đánh giá KOL · Công việc L.ASY** | [`checkkol/index.html`](./checkkol/index.html) | Nhập HTML/JSON Kalodata, xem dữ liệu thiếu và kết luận có điều kiện, lưu lịch sử/so sánh. Không dự báo ROI; không tự truy cập Kalodata. |
| **Tết WishPlan · Lab** | [`tetlasy/index.html`](./tetlasy/index.html) | Chùa 3D solo/NPC và gieo quẻ giải trí. Đếm ngược dùng mốc demo, không xác nhận lịch nghỉ chính thức. |
| **Grab (giả lập)** | [`grab/index.html`](./grab/index.html) | Mô phỏng đặt đồ ăn, xe và giao hàng; không đặt đơn hoặc thanh toán thật. |

## Cấu trúc thư mục

```text
.
├── .github/
│   └── workflows/
│       └── pages.yml       # CI/CD tự động deploy lên GitHub Pages
├── checkkol/
│   └── index.html          # KOL Compatibility & Performance Auditor
├── grab/
│   └── index.html          # Grab giả lập
├── ghepanh/
│   └── index.html          # Công cụ ghép ảnh lưới nguyên bản
├── tetlasy/
│   └── index.html          # Đếm ngược Tết Đinh Mùi 2027 & Bóc Quẻ
├── index.html              # Trang chủ WishPlan Hub
└── README.md
```

## Chạy thử trên máy (Local Preview)

### Giới hạn và dữ liệu cục bộ

- **Chế độ solo** tại Tết WishPlan: nhân vật, NPC, quét lá, tụng kinh, gieo quẻ và lưu tiến độ vẫn hoạt động; MQTT công cộng và kết nối liên tab đã tắt. Không phát tên, vị trí, chat hoặc hoạt động của nhân vật tới người chơi khác.
- Ghép ảnh: tối đa **36 ảnh**, **12 MiB/tệp**, **24 triệu pixel/ảnh**, **72 triệu pixel tổng đầu vào**; ảnh đầu ra được thu nhỏ giữ tỷ lệ để không vượt **16 triệu pixel** hoặc **8192 px mỗi chiều**. Ảnh lỗi/quá lớn được báo trên màn hình; chọn lại bộ ảnh sẽ vô hiệu hóa kết quả cũ. Đây là hàng rào an toàn, không bảo đảm mọi thiết bị xử lý được mức trần.
- Đường dẫn cũ (`tetlasy/`, `ghepanh/`, `checkkol/`, `grab/`) và khóa localStorage được giữ nguyên. Dữ liệu chỉ tồn tại trong trình duyệt hiện tại trừ khi bật tính năng đồng bộ tùy chọn của KOL.
- Trang vẫn có tài nguyên CDN/font và Grab dùng dịch vụ bản đồ ngoài; chế độ solo không đồng nghĩa toàn bộ website chạy ngoại tuyến. Grab chỉ là mô phỏng, không xử lý tiền hay đặt xe thật.

Kiểm thử phần ngoài KOL (Node.js tích hợp sẵn, không cần cài package):

```bash
node --test tests/nonkol.test.cjs
```

Frontend là static site; dùng HTTP local server khi kiểm thử, đặc biệt với Firebase Auth, không dùng `file://`:

```bash
# Sử dụng Python 3
python3 -m http.server 8080

# Hoặc sử dụng Node.js
npx serve .
```

Sau đó truy cập `http://localhost:8080` trên trình duyệt.

## Triển khai (GitHub Pages Deployment)

Dự án tự động build và deploy lên **GitHub Pages** mỗi khi có commit được push lên nhánh `main` thông qua workflow [`.github/workflows/pages.yml`](./.github/workflows/pages.yml).

> **Lưu ý cấu hình lần đầu trên GitHub:** Vào **Settings → Pages → Build and deployment → Source** và chọn **GitHub Actions**.

## Hướng dẫn và kế hoạch

- [Hướng dẫn theo tác vụ, dữ liệu và giới hạn](./guide/index.html)
- [Kế hoạch thực thi ngắn gọn](./docs/execution-plan.md)
- [Chiến lược chi tiết và cơ sở nghiên cứu](./docs/product-strategy.md)
- [Firebase staging đã kiểm chứng](./docs/firebase-staging-setup.md)

Hai công cụ làm việc được ưu tiên; Tết và Grab nằm trong Lab. Không bắt đăng nhập để ghép ảnh hoặc đánh giá file tại máy. Google Login/cloud tùy chọn; lịch sử khách không tự chuyển sang tài khoản. Luôn xuất backup JSON trước khi xóa dữ liệu trình duyệt.

**Artifact Pages hiện mặc định tắt cloud/AI**, không đưa cấu hình `wishplan-staging` lên website công khai. Working copy vẫn giữ cấu hình staging để kiểm thử. Bật cloud production cần thay đổi phát hành riêng đã được duyệt; không tự push/deploy, bật billing hoặc chuyển dữ liệu cũ.

Kiểm thử đầy đủ dùng Node 22+ và Java 21+ cho emulator: `npm ci --ignore-scripts`, `npm test`, `npm run test:firebase`. Các test emulator bị skip trong lệnh unit phải được chạy riêng; không coi tests local là xác nhận production.
