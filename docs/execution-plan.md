# WishPlan — quyết định sản phẩm và kế hoạch thực thi

## 1. Hướng đi chốt cho bản nâng cấp

**WishPlan là bộ công cụ nhỏ giúp hoàn thành những việc lặp lại, không phải một dashboard doanh nghiệp tổng hợp.**

Định vị trên trang chủ: **“Ít thao tác hơn. Rõ việc cần làm.”**

Đoạn giới thiệu: “Chuẩn bị ảnh để gửi duyệt và xem xét dữ liệu KOL trước khi hợp tác. Chọn công cụ, đưa dữ liệu vào, lấy kết quả để tiếp tục công việc.”

Quyết định thiết kế:
- Trang chủ thiên về **Operate — chọn việc để làm**; phần giới thiệu chỉ đủ giải thích, không chiếm chỗ của công cụ.
- Hai công cụ chính: **Ghép ảnh** và **Đánh giá KOL**.
- **L.ASY chỉ nằm trong nghiệp vụ KOL**. Không mặc định công việc cá nhân hoặc mọi tool của WishPlan thuộc L.ASY.
- **Lab** là mục phụ có thể mở ra: Tết solo và Grab mô phỏng. Không xóa, nhưng không đặt ngang hàng công cụ làm việc.
- Không yêu cầu đăng nhập toàn site. Ghép ảnh và đánh giá file dùng local; Google chỉ phục vụ cloud KOL.
- Mặc định tốt trước, tùy chỉnh mở sau: thông tin quan trọng luôn hiện; bảng chi tiết, cấu hình và AI không làm nghẽn luồng chính.

## 2. Trang chủ và cấu trúc website

**Header:** WishPlan | Công cụ | Hướng dẫn | Thử nghiệm.

**Nội dung chính:** một đoạn giới thiệu ngắn, rồi câu hỏi “Bạn muốn làm gì?”.

| Thẻ chính | Đầu vào | Đầu ra | Hành động |
|---|---|---|---|
| Ghép ảnh thành một bảng | Ảnh trên thiết bị | Ảnh ghép theo thứ tự đã xem | Mở ghép ảnh |
| Đánh giá KOL trước khi hợp tác | HTML/JSON Kalodata đã xuất hợp lệ | Tóm tắt có điều kiện, dữ liệu thiếu, lịch sử và so sánh | Mở đánh giá KOL |

**Phần phụ:** cách bắt đầu không cần tài khoản, dữ liệu đi đâu, Lab đóng gọn mặc định, link mã nguồn.

**Trang hướng dẫn:** chọn tác vụ → chuẩn bị gì → thực hiện → nhận gì → giới hạn. Không làm trang quảng cáo tính năng chưa có.

Giữ nguyên URL cũ, không đổi khóa lưu trữ tùy tiện. Tài nguyên 3D/bản đồ chỉ tải khi mở Lab.

## 3. Nâng cấp từng công cụ

### Ghép ảnh — hoàn tất công việc mà không mở editor lớn

Luồng chuẩn: **chọn ảnh → sắp xếp/xóa ảnh dư → xem trước → tải**.

Bản local có điều khiển thứ tự, số cột, kích thước, JPEG/PNG/WebP và hàng rào bộ nhớ. Các tùy chỉnh để trong phần mở rộng, mặc định JPEG 90%, cạnh dài tối đa 2048 px. Giới hạn đầu ra là giới hạn an toàn, không phải lời hứa giữ nguyên độ phân giải.

Cần nghiệm thu bằng ảnh tải thật, không chỉ thấy preview. Trường hợp kiểm tra: dọc/ngang, screenshot có chữ, tên tệp đặc biệt, ảnh lỗi, đổi bộ trong lúc xử lý, xóa ảnh cuối và đổi định dạng. Không xây trình thiết kế thay Canva; lợi thế muốn kiểm chứng là đường đi ngắn và không upload ảnh trong luồng ghép.

### KOL — hỗ trợ ra quyết định, không biến điểm thành sự thật

Luồng chuẩn: **nhập file → kiểm tra nguồn/kỳ/độ đầy đủ → xem kết luận có điều kiện → lưu/copy/so sánh**.

Màn hình đầu ưu tiên: creator, kỳ dữ liệu, chỉ số gốc, dữ liệu thiếu và khuyến nghị sơ bộ. Checklist và bảng shop/SKU chi tiết mở sau. Ngưỡng vẫn thuộc nghiệp vụ L.ASY, cần được người phụ trách xác nhận; không gọi là chuẩn chung cho mọi ngành.

Ưu tiên tiếp theo:
1. Đối chiếu parser với một file Kalodata thật được phép sử dụng; không tự bịa fixture để chứng minh nguồn thật đọc đúng.
2. Kiểm tra vòng export → import → đối chiếu và CSV an toàn khi mở trong bảng tính.
3. So sánh phải hiện khác biệt nguồn/kỳ; hai snapshot 30 ngày chồng lấn không chứng minh hiệu quả chiến dịch.
4. Kiểm chứng Google Login/cloud thật trên staging, sau đó mới quảng bá là đã dùng được trên website thật.
5. AI để sau; phân tích rule-based phải tự hoàn thành được công việc. Bookmarklet vẫn tắt cho đến khi có thiết kế nhập an toàn được kiểm thử với Kalodata thật.

### Tết và Grab — giữ giới hạn, không đầu tư lệch mục tiêu

- Tết: solo/NPC, về trang chủ dễ, ghi rõ giải trí. Không dùng quẻ làm tư vấn hoặc countdown hardcode làm lịch nghỉ chính thức.
- Grab: mô phỏng, không đơn/thanh toán/tài xế thật. Bản đồ dùng dịch vụ ngoài; không đề xuất biến demo thành một dịch vụ vận chuyển.
- Chỉ bảo trì an toàn và khả năng sử dụng; chưa mở multiplayer hoặc tính năng thương mại.

## 4. Ba cách sử dụng khả thi ngay

| Khi nào | Cách dùng | Tiêu chí có ích |
|---|---|---|
| Cần duyệt bộ ảnh sản phẩm/nội dung | Ghép ảnh theo thứ tự, mở ảnh tải xuống rồi gửi qua kênh đang dùng | Người nhận đọc được và không phải yêu cầu gửi lại từng ảnh |
| Chuẩn bị shortlist creator cho L.ASY | Nhập nguồn Kalodata, kiểm tra trường thiếu, xem nội dung kênh riêng rồi copy tóm tắt | Người phụ trách có bằng chứng để liên hệ hoặc yêu cầu bổ sung; không chọn chỉ theo điểm |
| Kiểm tra lại một creator đã đánh giá | Lưu snapshot mới, so với bản cũ cùng creator, đối chiếu kỳ/nguồn | Thấy thay đổi và dữ liệu cần kiểm tra; không quy toàn bộ thay đổi cho chiến dịch |

Dữ liệu công việc không tự gửi cho creator, đăng lên sàn hoặc thay quảng cáo. Giữ các thao tác đó trong quy trình đang được kiểm soát.

## 5. Lộ trình có cổng quyết định

Đây là thứ tự thực hiện, **không phải cam kết lịch phát hành**.

| Vòng | Công việc | Trợ lý chịu trách nhiệm | Cần từ bạn | Điều kiện chuyển vòng |
|---|---|---|---|---|
| **A — gọn và dùng được tại máy** | Trang chủ/guide, hai luồng tool, mobile/bàn phím, xử lý lỗi | Code, test, rà soát độc lập, demo local | Xem và phản hồi nếu có chỗ không đúng công việc | Tests không fail; xuất ảnh và vòng nhập dữ liệu thật dùng được |
| **B — xác nhận nghiệp vụ** | Thử bộ ảnh có chữ và file Kalodata có quyền sử dụng; xác nhận ngưỡng | Đối chiếu nguồn, ghi lỗi, sửa parser/nhãn và bảo mật | Một bộ dữ liệu được phép dùng; quyết định nghiệp vụ khi cần | Không tự đoán dữ liệu; kết quả được người dùng chấp nhận cho tác vụ thật |
| **C — cloud staging** | Đăng nhập Google, lịch sử theo UID, xóa/sync/backup | Cấu hình được cho phép, kiểm thử A/B, báo cáo | Tự duyệt OAuth và tài khoản kiểm thử khi cần | End-to-end xác nhận, không chỉ cấu hình hoặc emulator |
| **D — phát hành** | Rà diff, duyệt staging, push/deploy, kiểm tra live/rollback | Chuẩn bị và thực hiện phần được duyệt | Phê duyệt push/deploy riêng | Website thật và các tính năng công bố được xác minh |
| **E — một nâng cấp có bằng chứng** | Chọn nút thắt lặp lại lớn nhất, giải quyết từng việc | Đề xuất và làm một thay đổi, đo lại | Phản hồi từ công việc thật | Nếu không giúp hoặc ít dùng: không tiếp tục mở rộng |

Không lấy số tests hay số click làm bằng chứng hiệu quả kinh doanh.

## 6. Tool mới: chưa xây chỉ để website có vẻ phong phú

**Ứng viên 1 — bảng tính điều kiện hòa vốn chiến dịch:** phù hợp hơn khi người dùng thực sự phải duyệt booking/affiliate. Chỉ làm sau khi rõ giá vốn, phí, giảm giá, cơ sở hoa hồng, hoàn/hủy và VAT; phân biệt kịch bản với số thực. MVP local, không dùng dữ liệu thương mại mặc định, không cam kết ROI. Nếu sheet hiện tại đủ tốt thì dùng sheet.

**Ứng viên 2 — chuẩn hóa link chiến dịch:** chỉ hữu ích nếu đang gõ UTM lặp lại và có website/analytics nhận các tham số này. Không hứa thêm UTM vào link Shopee/TikTok sẽ tự đo được đơn hàng hoặc thay attribution của sàn. Google đã có Campaign URL Builder; chưa có lý do rõ để ưu tiên xây bản sao.

**Chưa làm:** CRM, chat team, quản lý đơn/tồn kho, dashboard KPI không có nguồn, AI agent đa năng, app mobile, thanh toán hoặc kho ảnh cloud. Không làm lại Canva, Sheets, Kalodata hay dịch vụ của sàn.

## 7. Cách trợ lý chủ động làm việc từ đây

- Trước mỗi vòng: tự kiểm tra hiện trạng và chọn một vấn đề thực, không chờ bạn mô tả từng nút hoặc màu.
- Đề xuất phải gồm lợi ích cho tác vụ, đầu vào/đầu ra, cách test và điều kiện không nên làm.
- Tự làm các bước local trong phạm vi đã thống nhất; chỉ hỏi ở điểm cần dữ liệu thật, quyền, chi phí hoặc quyết định khó đảo ngược.
- Báo ngắn: đã thay gì, test thật trả gì, điều chưa xong. Không nhận cấu hình là thành công vận hành.
- Có backup, test và rollback. Không tự push/deploy production, bật billing, gửi dữ liệu cho AI hoặc sửa gian hàng/quảng cáo.

## 8. Cơ sở nghiên cứu và điều chưa biết

Đã rà code hiện có và tài liệu sơ cấp: GOV.UK về nhu cầu người dùng, W3C WCAG 2.2 về khả năng truy cập, Google Analytics về campaign URLs; khảo sát trang chính thức Canva để tránh xây editor trùng chức năng. Tài liệu/sổ nguồn nằm trong C:/Users/Admin/Documents/WishPlan/research.

Các đề xuất về giá trị và tần suất sử dụng **vẫn là giả thuyết**, chưa có phỏng vấn hoặc đo tác vụ thật. Không có số liệu tiết kiệm thời gian, ROI hoặc tệp khách hàng đã được chứng minh. Kiểm tra browser/test kỹ thuật được báo riêng, không thay nghiên cứu người dùng.

Tài liệu chi tiết và nguồn tham khảo: docs/product-strategy.md. Kế hoạch này không cấp quyền phát hành production.
