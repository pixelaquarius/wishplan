# WishPlan — nghiệm thu bản cục bộ 24/11/2026

## Phạm vi đã triển khai

- Trang chủ chọn tác vụ, hai tool làm việc và Lab riêng; trang hướng dẫn có luồng dùng, dữ liệu, giới hạn, kế hoạch.
- Ghép ảnh: xem/sắp xếp/xóa, tùy chỉnh mở rộng, định dạng xuất; vô hiệu hóa kết quả cũ khi lựa chọn mới lỗi; giới hạn giải mã/canvas và xử lý lỗi tải.
- KOL L.ASY: nguồn/kỳ và bằng chứng thiếu hiện rõ, đọc số theo quy ước Việt Nam, không bịa archetype/ROI/kết quả booking; so sánh hiện ngữ cảnh; CSV phòng formula injection; avatar nguồn không tự tải.
- Bảo toàn đường dẫn cũ. Auth/UID, import, XSS và rules có test hồi quy; AI tùy chọn, mặc định tắt.
- Pages artifact tắt cloud/AI; working copy giữ cấu hình staging riêng. Không tác động project KOL cũ.

## Kết quả chạy trực tiếp tại checkout cuối

Lệnh `npm run test:ci` và `git diff --check` exit 0:

- Lượt unit/integration: 88 trường hợp được nhận diện, 79 pass, 0 fail, 9 test emulator skip có chủ đích.
- Lượt emulator riêng: 9/9 pass, không skip, project `demo-wishplan`.
- Các log PERMISSION_DENIED trong emulator là các phép thử cố ý truy cập sai quyền; không phải lỗi bị bỏ qua.
- Diff whitespace sạch.

Browser `http://localhost:8765/` xác nhận trang chủ và các liên kết chính. Kiểm tra reflow bằng clientWidth/scrollWidth:

| Trang | Viewport | Client / scroll |
|---|---|---|
| Trang chủ | 320 px | 320 / 320 |
| Hướng dẫn | 320 px | 320 / 320 |
| Hướng dẫn | 1280 px | 1265 / 1265 |
| KOL | 320 px | 320 / 320 |
| KOL | 1280 px | 1274 / 1274 |

Link trở về WishPlan vẫn hiện trên guide/KOL. Khác biệt client/viewport trên desktop do scrollbar; không có tràn ngang trong các phép đo này. Đây không phải chứng nhận toàn diện accessibility hoặc mọi thiết bị.

Đã dựng bản preview từ allowlist static, chạy guard thực bằng Node, xác minh config artifact rỗng, AI false, staging working config còn nguyên, không có Functions/dependencies/env. ZIP kiểm tra CRC đạt. Gói hiện nằm tại `C:/Users/Admin/Documents/WishPlan/release-local-20261124-1800/wishplan-public-preview.zip`.

## Rà soát độc lập cuối

Lượt review read-only sau thay đổi cuối không phát hiện blocker high/critical mới trong parser số, diagnosis theo bằng chứng, ngữ cảnh so sánh, chống công thức CSV và guard cấu hình Pages. Reviewer chạy riêng 43 test UX/security/config: 43 pass, 0 fail. Đây là review có trọng tâm, không phải chứng nhận bảo mật toàn diện; không cộng số test chạy lại này vào tổng test duy nhất.

## Còn cần nghiệm thu bằng công việc thật

1. File Kalodata có quyền sử dụng để đối chiếu parser với nguồn thực và xác nhận ngưỡng L.ASY. Fixture tổng hợp không chứng minh mọi phiên bản Kalodata tương thích.
2. Người dùng tự thực hiện OAuth và thử cloud end-to-end trên staging; provider Enabled và emulator pass chưa chứng minh đăng nhập/sync thật.
3. Duyệt phát hành riêng trước push/deploy. Bản trên domain công khai chưa được thay bằng thay đổi này.
4. Chưa có đo thời gian tiết kiệm, ROI hoặc nghiên cứu người dùng hoàn tất. Các use case vẫn cần thử thực tế.

## Tình trạng phát hành

Không commit/push/deploy production, không bật billing, không tự đưa dữ liệu công việc lên AI. Xem `execution-plan.md` cho trách nhiệm và cổng quyết định; `product-strategy.md` cho nghiên cứu chi tiết.
