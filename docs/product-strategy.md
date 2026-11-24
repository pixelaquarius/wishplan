# WishPlan — chiến lược sản phẩm và lộ trình sử dụng thực tế

Ngày rà soát: **24/11/2026**. Phạm vi: bộ công cụ web nhỏ phục vụ việc hằng ngày, không phải một nền tảng vận hành doanh nghiệp mới.

## 1. Quyết định sản phẩm

**Đề xuất định vị:** “WishPlan — Công cụ nhỏ, việc rõ ràng.”

**Đoạn giới thiệu trang chủ:** “Ghép ảnh để chia sẻ và xem xét dữ liệu KOL trong một nơi gọn gàng. Chọn công cụ, đưa dữ liệu vào, lấy kết quả để tiếp tục công việc.”

Không gắn mọi hoạt động cá nhân với L.ASY. **WishPlan là lớp điều hướng chung; KOL Auditor là không gian đánh giá riêng cho L.ASY.** Giữ tên L.ASY, tham chiếu sản phẩm và tiêu chí kinh doanh ở trong công cụ KOL, thay vì đổi chúng thành những tiêu chí “trung lập” không còn đúng nghiệp vụ.

Hai nhóm tách biệt:

- **Công việc / Work:** Ghép ảnh; KOL Auditor · L.ASY. Đây là hai công cụ cần được ưu tiên về đầu vào, đầu ra, độ tin cậy và đường quay lại trang chủ.
- **Thử nghiệm / Lab:** Tết 3D solo; Grab mô phỏng. Giữ lại để giải trí/thử giao diện, nhưng không dùng để chứng minh hiệu suất làm việc hay đặt cạnh Work với lời hứa tương đương.

**Không tuyên bố** tiết kiệm một số phút cụ thể, tăng doanh thu, cải thiện ROI, có người dùng thường xuyên hay có kết nối dịch vụ thật khi chưa đo/kiểm chứng. Không dùng “AI” làm giá trị chính của một công cụ vốn làm việc bằng checklist và dữ liệu người dùng cung cấp.

### Quy ước bằng chứng

- **Hiện có trong mã:** được đọc từ checkout đang làm việc, không tự động đồng nghĩa đã kiểm thử trình duyệt hay đã phát hành.
- **Đề xuất:** quyết định thiết kế/ưu tiên trong tài liệu, chưa phải tính năng đã chạy.
- **Chưa xác minh:** cần tài khoản, cấu hình, dữ liệu thật hoặc kiểm thử trước khi quảng bá.
- Các số trong tiêu chí nghiệm thu dưới đây là **điều kiện kiểm thử đề xuất**, không phải số liệu sử dụng hay cam kết ngày ra mắt.

Checkout nền: `5c2d6d889f13dc549604c7fdfd0e16bfb7070c46`, có thay đổi chưa commit và các nhánh công việc song song. Hồ sơ mã nội bộ ở mục 10 là bằng chứng cho mô tả hiện có; nguồn ngoài đánh số ở cuối là cơ sở cho nguyên tắc nghiên cứu, khả năng truy cập, lưu trữ và vận hành. Không dùng tài liệu này để xác nhận production hoặc kết quả kiểm thử của người khác.

## 2. Người dùng và việc cần hoàn thành

| Nhóm / ngữ cảnh | Việc cần hoàn thành (giả thuyết cần xác thực) | Đầu ra hữu ích | Không suy diễn |
| --- | --- | --- | --- |
| Cá nhân hoặc người làm nội dung | Khi có một bộ ảnh, tôi muốn gom thành một ảnh dễ gửi/đối chiếu mà không dựng một thiết kế mới | JPEG đúng thứ tự và đọc được ở nơi sẽ gửi | Không mặc định ảnh thuộc L.ASY; không cần tài khoản doanh nghiệp |
| Người phụ trách KOL cho L.ASY | Khi có dữ liệu Kalodata hợp lệ, tôi muốn kiểm tra mức phù hợp và điểm còn thiếu trước khi quyết định liên hệ | Tóm tắt có nguồn, kỳ dữ liệu, tiêu chí và điều kiện cần xác minh | Không đồng nhất điểm phù hợp với dự báo đơn hàng hoặc lợi nhuận |
| Người quay lại WishPlan | Tôi muốn mở đúng công cụ, biết phải chuẩn bị gì và dữ liệu đi đâu | Chuyển thẳng đến một tác vụ, không phải đọc một bài giới thiệu dài | Chưa có bằng chứng cần dashboard, tài khoản chung hoặc feed |
| Người vào Lab | Tôi muốn trải nghiệm giải trí hoặc thử một luồng tương tác | Trải nghiệm solo / giao dịch giả lập được nhận diện rõ | Không coi đây là người đặt dịch vụ thật hay khách hàng KOL |

Cần quan sát công việc hiện tại trước khi mở rộng: bộ ảnh họ thường gửi ở đâu; một lần xem KOL đang dùng những nguồn nào; bước nào khiến họ quay về cách cũ. GOV.UK phân biệt nhu cầu có bằng chứng từ người dùng với ý kiến/đề xuất cần kiểm chứng; ở đây các nhóm và nhu cầu trên vẫn là giả thuyết tuyển người thử, chưa phải nghiên cứu đã hoàn thành.[1]

**Cách xác thực ít chi phí — đề xuất:** mời người đang thực hiện từng việc dùng một bộ dữ liệu họ được phép chia sẻ, quan sát không hướng dẫn trước; ghi điểm mắc, kết quả có dùng tiếp không và lý do. Dùng ảnh/dữ liệu mẫu đã làm sạch nếu thông tin thật không thể chia sẻ. Nếu không tìm được một công việc đang diễn ra, chưa xây thêm công cụ cho công việc đó.

## 3. Trang chủ: ít nội dung, rõ lựa chọn

### Thứ tự thông tin đề xuất

1. **Header:** WishPlan; liên kết “Công cụ”, “Lab”, “Về dữ liệu”. Không đăng nhập bắt buộc hoặc thanh điều hướng nhiều cấp.
2. **Intro ngắn:** định vị và đoạn giới thiệu ở mục 1. CTA chính “Chọn công cụ” cuộn đến Work; CTA phụ “Xem Lab”. Không nền 3D, video tự chạy hoặc băng chuyền ở trang chủ.
3. **Work — chỉ hai thẻ đang có:**
   - **Ghép ảnh:** “Gom nhiều ảnh thành một ảnh lưới, giữ nguyên nội dung.” Nhãn “Xử lý ảnh trong trình duyệt”; đầu vào “Ảnh trên thiết bị”; đầu ra “JPEG”; nút “Ghép ảnh”. Không nói “giữ nguyên độ phân giải” vì có giới hạn đầu ra.
   - **KOL Auditor · L.ASY:** “Xem xét dữ liệu Kalodata theo tiêu chí hợp tác của L.ASY.” Nhãn “Không gian L.ASY”; đầu vào “HTML / JSON”; đầu ra “Tóm tắt, lịch sử, so sánh”; nút “Mở KOL Auditor”. Đăng nhập chỉ thuộc phần cloud của công cụ này.
4. **Lab — vùng thứ cấp:** “Thử nghiệm và giải trí, không phải dịch vụ giao dịch.” Hai thẻ gọn: “Tết 3D · Solo” và “Grab · Mô phỏng, không đặt đơn thật”. Không gắn nhãn “mới” hoặc “nổi bật” vĩnh viễn.
5. **Về dữ liệu:** mô tả theo từng công cụ; local không có nghĩa toàn site ngoại tuyến. Link đến cách sao lưu/xóa của KOL và lưu ý bản đồ ngoài của Grab. Không hứa “không có kết nối bên ngoài”.
6. **Footer:** một đường gửi phản hồi đã được chủ sở hữu chấp thuận; chưa có kênh thật thì không tạo email/nút giả.

Giữ nguyên đường dẫn `ghepanh/`, `checkkol/`, `tetlasy/`, `grab/`; không phá bookmark hay khóa lưu trữ để đổi thương hiệu. Không thêm ô tìm kiếm, bộ lọc hoặc danh mục trống khi chỉ có hai Work tools.

### Nghiệm thu trải nghiệm đề xuất

- Ở màn hình rộng 320 CSS px, nội dung chính đọc được không cần cuộn ngang; bảng KOL/canvas có thể dùng vùng cuộn riêng khi thực sự cần bố cục hai chiều. Kiểm tra reflow theo tiêu chí 1.4.10, không chỉ thu nhỏ chữ.[2]
- Điều khiển dùng được bằng bàn phím, có focus thấy rõ, tên nút cụ thể; không chỉ đổi màu để báo lỗi/trạng thái. Đây là các mục kiểm tra phù hợp với WCAG 2.2, không phải tuyên bố toàn site đã đạt chuẩn.[2]
- Chữ thường đạt tương phản tối thiểu 4.5:1, chữ lớn 3:1; kiểm tra target tối thiểu 24 × 24 CSS px hoặc ngoại lệ phù hợp trong tiêu chí 2.5.8.[2]
- Người thử phân biệt được Work và Lab; nêu đúng việc cần chuẩn bị cho công cụ mình chọn; quay về trang chủ không mất hướng. Ghi kết quả quan sát, không gán sẵn tỷ lệ thành công.

## 4. Work tool 1 — Ghép ảnh

### Hiện có trong mã

Đọc ảnh từ thiết bị qua object URL, vẽ Canvas, xem trước và tải JPEG/PNG/WebP theo hỗ trợ của trình duyệt; chọn nền/khoảng cách, tự tạo lưới gần vuông hoặc chọn 1–6 cột, fit-in thay vì cắt nội dung. Có giới hạn 36 ảnh, 12 MiB/tệp, 24 triệu pixel/ảnh, 72 triệu pixel tổng; đầu ra tối đa 16 triệu pixel và 8192 px mỗi chiều. Các giới hạn này là hàng rào kỹ thuật hiện có, **không phải bảo đảm mọi thiết bị xử lý được mức trần**. Có danh sách thumbnail, đổi thứ tự trái/phải và xóa từng ảnh; trạng thái nghiệm thu tham khảo biên bản QA, không suy ra từ việc tính năng có trong code (C2).

### Quy trình thực dùng

1. **Chuẩn bị:** ảnh sản phẩm, ảnh mẫu thiết kế hoặc ảnh cần gửi cùng một ngữ cảnh; chỉ dùng ảnh được phép xử lý/chia sẻ.
2. **Đưa vào:** chọn/kéo ảnh; kiểm tra số lượng và thứ tự thumbnail. Không giả định thứ tự file picker chính là thứ tự câu chuyện mong muốn.
3. **Xem trước:** chọn nền/khoảng cách; đổi thứ tự hoặc bỏ ảnh dư nếu phiên bản đang dùng đã có các nút này; kiểm tra chữ nhỏ và ảnh dọc/ngang.
4. **Lấy ra:** tải JPEG, mở lại chính tệp tải xuống, gửi qua kênh làm việc hiện có. Nếu chữ không đọc được, giảm số ảnh thay vì chỉ phóng to bản xem trước.

**Đầu vào:** bộ ảnh trình duyệt giải mã được; thứ tự, màu nền, khoảng cách. **Đầu ra:** một JPEG; không phải file thiết kế nhiều lớp, kho tài sản, hoặc mẫu đúng chuẩn mọi sàn.

**Ranh giới:** không upload nội dung ảnh trong luồng ghép được đọc ở C2; vẫn phải kiểm tra Network khi sửa tính năng và không suy rộng thành toàn website không gọi mạng. Chưa có bằng chứng cần lưu ảnh cloud. Chọn bộ mới thay bộ hiện tại, không hứa tự lưu để phục hồi sau tải lại. Định dạng không đọc được và máy thiếu bộ nhớ phải có lỗi hữu ích; không quảng bá mọi `image/*` đều hỗ trợ.

### Nâng cấp ưu tiên — đề xuất / cổng nghiệm thu

- **P0: chốt luồng sửa bộ ảnh** đang được phát triển: đổi thứ tự bằng chuột lẫn bàn phím, xóa từng ảnh, reset; bản tải đúng thứ tự đang xem. Thử ảnh dọc/ngang, tên file có ký tự đặc biệt, xóa ảnh cuối, đổi bộ khi đang giải mã.
- **P0: đầu ra có thể tin:** hiển thị kích thước JPEG trước tải; báo lỗi đầu vào/thiếu bộ nhớ; thử tệp lỗi, quá giới hạn, tải lại cùng tệp và không để tải kết quả cũ khi quá trình mới thất bại.
- **P1, chỉ khi có nhu cầu:** preset đầu ra theo nơi người thử thực sự gửi ảnh, hoặc mức kích thước/chất lượng đơn giản. Nghiệm thu bằng tệp tải mở lại ở nơi nhận, không bằng nhãn “HD”. Chưa thêm editor tự do, template marketplace hay upload.

## 5. Work tool 2 — KOL Auditor · không gian L.ASY

### Hiện có trong mã

Nhập HTML Kalodata đã lưu hoặc HTML/JSON được dán thủ công; parser đọc dữ liệu, checklist phân biệt short-video/livestream, có tiêu chí phù hợp với L.ASY Galacto Cleansing Balm và tham chiếu nhóm beauty/skincare. Có tóm tắt sao chép, snapshot lịch sử, lọc, so sánh, xuất CSV và backup JSON/import. Mã đã vô hiệu hóa bookmarklet/console extraction và nhận tin nhắn chéo cửa sổ; không viết lại hướng dẫn yêu cầu dán mã vào trang ngoài (C3).

Có mã Google sign-in, phân tách lịch sử guest/UID, đẩy/lấy snapshot có chủ ý, xử lý xóa, và gọi AI qua backend bảo vệ. Đây là **đường tích hợp có điều kiện**, không phải bằng chứng đăng nhập, đồng bộ hoặc AI đang hoạt động trên production. Staging đang do nhánh công việc riêng xác minh; chỉ gắn trạng thái “đã dùng được” sau khi đọc biên bản thực chạy (C4).

### Quy trình thực dùng

1. **Chuẩn bị nguồn có quyền truy cập:** người phụ trách mở Kalodata bằng tài khoản/quyền hợp lệ, chọn kỳ xem và lưu HTML hoặc lấy JSON đã xuất. Không xây cách vượt đăng nhập hoặc tự quét TikTok.
2. **Kiểm tra đầu vào:** đối chiếu handle, thời gian, đơn vị tiền, tổng/chi tiết và các ô thiếu với trang nguồn; nếu parser không đọc được thì dừng kết luận thay vì đoán.
3. **Đánh giá có điều kiện:** dùng đúng track; xem tiêu chí đạt/chưa đạt/chưa có dữ liệu; ghi điểm nào cần hỏi người phụ trách/creator. Giá và ngưỡng trong công cụ là cấu hình nghiệp vụ cần người L.ASY xác nhận, không phải giá bán thị trường được tài liệu này xác minh.
4. **Bàn giao quyết định:** copy tóm tắt và/hoặc xuất bảng cho quy trình liên hệ sẵn có; người phụ trách chốt “liên hệ”, “cần thêm bằng chứng” hoặc “không phù hợp” bên ngoài điểm số tự động. Chưa có CRM hoặc luồng gửi tin thật.
5. **Lưu theo kỳ:** lưu snapshot và backup JSON. Khi so sánh, chọn cùng creator và kỳ/phương pháp có thể so sánh; biến động snapshot không chứng minh tác động của chiến dịch L.ASY.
6. **Cloud tùy chọn:** chỉ khi staging đã nghiệm thu, đăng nhập đúng tài khoản rồi chủ động upload/download. Guest history không tự biến thành dữ liệu tài khoản. Không khuyến nghị người dùng đẩy dữ liệu nhạy cảm trước khi hiểu phạm vi và quyền xóa.

**Đầu vào:** dữ liệu người dùng cung cấp; không phải nguồn live đã tự xác thực. **Đầu ra:** đánh giá hỗ trợ quyết định, lịch sử/so sánh và bản xuất; không dự báo đảm bảo doanh số, xác minh gian lận hay tư vấn y khoa.

**Ranh giới dữ liệu:** `localStorage` giữ dữ liệu qua các phiên trình duyệt, nhưng chế độ riêng tư xóa khi phiên riêng tư cuối đóng và trình duyệt có thể từ chối việc lưu.[3] Vì vậy **đề xuất** có hướng dẫn backup và lỗi lưu rõ ràng; không gọi dữ liệu local là bản sao lưu lâu dài, đồng bộ đa máy hoặc kho dùng chung.

### Nâng cấp ưu tiên — đề xuất / cổng nghiệm thu

- **P0: minh bạch nguồn:** hiện kỳ nguồn, thời điểm lưu và dữ liệu thiếu ngay cạnh kết luận; xác nhận thủ công thông tin nguồn nếu parser chưa trích được. Dùng fixture hợp lệ, thiếu trường, kỳ khác, HTML không tương thích; thiếu dữ liệu không được biến thành số 0 hay một kết luận chắc chắn.
- **P0: đóng vòng backup và so sánh:** export → xóa bộ thử → import → đối chiếu snapshot; CSV mở được trong bảng tính và không thực thi nội dung kiểu công thức. Cảnh báo khi chọn khác creator/kỳ không tương thích; điểm số phải tách khỏi bằng chứng gốc.
- **P0: giữ L.ASY đúng ngữ cảnh:** người nghiệp vụ xác nhận ngưỡng, sản phẩm và giải thích checklist. Không thay tên hàng loạt; nhãn điều hướng chung có thể là WishPlan, nhãn chuyên môn vẫn L.ASY.
- **P1: cloud sau cổng staging:** đăng nhập popup/redirect theo môi trường đã cấu hình, kiểm tra hai tài khoản không đọc chéo, guest không tự upload, đổi tài khoản hủy thao tác cũ, xóa không hồi sinh sau sync và có đường khôi phục từ backup hợp lệ. Không coi tên dự án Firebase trong config là bằng chứng các luồng này đã pass.
- **P2: AI chỉ khi có lý do sử dụng:** nhãn rõ “phân tích dữ liệu đã cung cấp”, xem phần dữ liệu sẽ gửi, backend giữ bí mật máy chủ, lỗi không giả thành kết quả AI. Khi chưa bật phải vẫn hoàn tất được checklist/xuất cục bộ. Không coi AI là live research.

## 6. Lab — giữ lại nhưng giới hạn phạm vi

| Công cụ | Quy trình và đầu vào → đầu ra hiện có trong mã | Ranh giới | Ưu tiên đề xuất |
| --- | --- | --- | --- |
| **Tết 3D solo** | Mở cảnh 3D, thao tác nhân vật/NPC, quét lá, tụng kinh, gieo quẻ; trạng thái nhân vật → trải nghiệm và tiến độ local (C5) | Giải trí, không tư vấn vận mệnh hay quyết định nghề nghiệp. MQTT công cộng/kết nối liên tab đã tắt; tài nguyên CDN vẫn có thể tải. Countdown trong mã không là nguồn xác nhận lịch nghỉ chính thức | P0 giữ nhãn solo/giải trí, có về trang chủ và lỗi WebGL dễ hiểu; P1 nút tắt âm/chuyển động và chế độ nhẹ nếu thử máy yếu cho thấy cần. Không ưu tiên multiplayer |
| **Grab mô phỏng** | Chọn luồng food/ride/express, địa điểm hoặc GPS nếu được cho phép, giỏ hàng và lựa chọn demo → phí/trạng thái/chuyến đi mô phỏng, dữ liệu local (C6) | Không đặt đơn, kết nối tài xế, nạp ví hay thanh toán thật; logo và giá demo không xác nhận hợp tác. Có bản đồ, reverse geocode Nominatim và route OSRM ngoài | P0 nhãn mô phỏng trước bước “đặt”, không thu thẻ/tiền thật; nêu trước khi xin vị trí rằng tọa độ có thể dùng với dịch vụ bản đồ ngoài; P1 chế độ demo không GPS và fallback khi route lỗi, chỉ khi tiếp tục đầu tư Lab |

Không yêu cầu mọi người dùng Work tải Three.js, bản đồ hoặc dữ liệu nhà hàng. Chỉ tải tài nguyên Lab khi mở công cụ tương ứng. Khi cần xác minh lịch nghỉ Tết, phải thêm nguồn chính thức có ngày kiểm tra riêng; tài liệu này **không xác nhận lịch nghỉ 2027**.

## 7. Chỉ hai ứng viên mở rộng, chưa cam kết xây

Đây là backlog có điều kiện, **không đưa lên homepage như công cụ đã có**. Chưa có nghiên cứu người dùng xác nhận nhu cầu. Không đề xuất nền tảng CRM, kho dữ liệu, chat hoặc đăng ký SaaS mới.

### 7.1. Trình tạo liên kết UTM — ưu tiên thử trước

- **Giả thuyết việc cần làm:** người thực sự chia sẻ link chiến dịch đang gõ UTM bằng tay và hay không thống nhất tên.
- **Lý do có cơ sở kỹ thuật:** tài liệu Google Analytics khuyến nghị dùng `utm_source`, `utm_medium`, `utm_campaign` khi thêm tham số, đồng thời chuẩn hóa cách đặt tên để tránh phân mảnh báo cáo.[5] Điều đó không chứng minh người dùng WishPlan đang gặp vấn đề; cần quan sát link hiện tại trước.
- **MVP đề xuất:** URL đích + ba trường chính, `utm_content` tùy chọn → URL mã hóa đúng, preview và copy. Dùng `URL`/`URLSearchParams`; cho xem xung đột với UTM sẵn có, không ghi đè im lặng; giữ query không liên quan và fragment. Chỉ nhận HTTP(S), không tự mở hay fetch URL đích. Nhắc không đặt dữ liệu cá nhân/bí mật trong URL.
- **Nghiệm thu:** tiếng Việt, khoảng trắng, ký tự `&`, URL đã có query/fragment/UTM được kiểm tra; thao tác copy lỗi có cách sao chép thủ công; có reset và không cần đăng nhập. Không hứa track click, đơn hàng hoặc thiết lập Analytics hộ người dùng.
- **Quyền/chi phí:** có thể chạy cục bộ trong bộ web hiện tại, chưa cần backend/API trả phí. Muốn đánh giá chiến dịch sau đó cần người có quyền vào analytics của website đích; không phải quyền WishPlan mặc nhiên có.
- **Cổng tiếp tục:** người đang tạo link dùng đầu ra cho một tác vụ thật và chấp nhận quy ước đặt tên; nếu bảng tính hiện tại đã làm đủ tốt, dừng ở quy ước thay vì thêm tool.

### 7.2. Bảng tính kinh tế chiến dịch — sau khi định nghĩa được dữ liệu

- **Giả thuyết việc cần làm:** người phụ trách cần xem điều kiện hòa vốn trước khi chấp thuận booking, chưa cần mô hình dự đoán doanh số. Mặc định độc lập thương hiệu; chỉ cho preset L.ASY sau khi người nghiệp vụ xác nhận.
- **Đầu vào đề xuất:** doanh thu thuần dự kiến mỗi đơn sau giảm giá, giá vốn/đơn, chi phí biến đổi/đơn, tỷ lệ hoa hồng và cơ sở tính, chi phí cố định chiến dịch; số đơn giữ lại để mô phỏng. Xác nhận rõ hoàn/hủy, VAT và phí vận chuyển có nằm trong số nào; không cộng hai lần, không tự lấy GMV KOL thay doanh thu thương hiệu.
- **Mô hình đề xuất, chưa có trong mã:** hoa hồng/đơn = cơ sở hoa hồng × tỷ lệ; đóng góp/đơn = doanh thu thuần/đơn − giá vốn − chi phí biến đổi − hoa hồng/đơn; kết quả kịch bản = số đơn × đóng góp/đơn − chi phí cố định. Khi đóng góp/đơn dương, số đơn hòa vốn = làm tròn lên (chi phí cố định / đóng góp/đơn). Khi bằng/nhỏ hơn 0, hiện “không có điểm hòa vốn hữu hạn trong mô hình này”, không chia cho 0.
- **Đầu ra:** giả định và kết quả kịch bản, không phải ROI đảm bảo, dự báo hay sổ kế toán. Chưa thêm mô hình lợi nhuận sau thuế; nếu dữ liệu chưa thống nhất thì dùng sheet đang có thay vì viết phần mềm.
- **Nghiệm thu trước build:** người nghiệp vụ chấp nhận công thức/phạm vi; so khớp với bảng tính đã xác nhận, gồm số 0, tỷ lệ 0/100%, ô trống, số âm không hợp lệ, đóng góp không dương và làm tròn đơn. Không có dữ liệu mặc định trông như số liệu thật.
- **Quyền/chi phí:** chủ sở hữu cung cấp và cho phép dùng dữ liệu thương mại; MVP local, không đồng bộ giá vốn hay gửi AI. Chỉ xây nếu thao tác lặp lại này được quan sát; không phụ thuộc UTM hoặc Firebase.

## 8. NOW / NEXT / LATER — thứ tự, không phải lịch ra mắt

| Giai đoạn | Gói công việc và người chịu trách nhiệm cần chỉ định | Tiêu chí xong | Phụ thuộc / quyền / chi phí | Điều kiện dừng |
| --- | --- | --- | --- | --- |
| **NOW — hoàn thiện hai luồng chính** | Chủ sản phẩm duyệt định vị/Work–Lab; frontend tích hợp homepage và thay đổi Ghép ảnh/KOL đang làm | Bốn link cũ hoạt động; Work và Lab tách rõ; ghép một bộ ảnh hỗn hợp rồi mở JPEG tải xuống; nhập fixture KOL, đối chiếu nguồn, xuất/nhập backup; thông báo dữ liệu và lỗi đúng; bàn phím/mobile qua checklist mục 3; chạy lại tests hiện có và ghi kết quả thật | Checkout và trình duyệt thử; fixture không nhạy cảm; không cần cloud để nghiệm thu luồng local. Người L.ASY duyệt tiêu chí, không yêu cầu mua nền tảng | Còn lỗi dữ liệu/đầu ra hoặc hồi quy bảo mật thì chưa đánh dấu dùng được |
| **NOW — lập baseline** | Chủ sản phẩm/người thực hiện công việc ghi các tác vụ thật bằng bảng ghi đơn giản | Có bản ghi cách làm hiện tại, đầu vào/đầu ra, bước lỗi và lý do dùng/không dùng; tách từng tool, ghi rõ chưa có mẫu khi chưa quan sát | Thời gian người thử, quyền dùng dữ liệu; không cần tracking bên thứ ba | Không có công việc thực tế để quan sát: thu hẹp tuyên bố, không điền số giả |
| **NEXT — sửa theo quan sát** | Frontend sửa trở ngại lặp lại của hai Work tools, chủ sản phẩm chọn một việc ưu tiên mỗi vòng | Lặp lại cùng loại tác vụ sau sửa; so đầu ra và lỗi với baseline; lỗi chưa sửa có đường tránh được mô tả | Bằng chứng NOW; không mặc định tăng tính năng là cải thiện | Không dùng đầu ra hoặc không có lợi ích quan sát được: quay về sửa luồng gốc |
| **NEXT — staging cloud KOL, riêng với phát hành** | Người quản trị Firebase và người kiểm thử hoàn tất biên bản staging | Đúng project/domain; Auth thực chạy; user A/B cô lập; guest/sync/delete/logout được kiểm tra; local vẫn dùng khi cloud lỗi; có backup và hướng dẫn cấu hình | Quyền project/OAuth/domain và các cổng bảo mật; kiểm tra billing trước dịch vụ có phí; không sửa production nhân danh staging | Thiếu quyền, App Check/rules chưa xác minh, chi phí chưa được duyệt: giữ cloud/AI ở trạng thái chưa sẵn sàng |
| **NEXT — thử nhu cầu UTM** | Chủ sản phẩm quan sát người tạo link; frontend làm mẫu local nếu có vấn đề thật | Một link thực được tạo/kiểm tra bởi người có trách nhiệm; test URL mục 7.1 đạt; quyết định tiếp tục hay bỏ được ghi rõ | Quy ước tên; không cần quyền analytics để tạo URL, cần quyền nếu kiểm tra báo cáo đích | Sheet/quy trình có sẵn đáp ứng tốt hoặc không có nhu cầu lặp lại |
| **LATER — kinh tế chiến dịch / độ bền** | Người nghiệp vụ chốt mô hình trước; frontend mới triển khai. Chỉ cải thiện Lab theo ngân sách thời gian còn lại | Calculator đạt đối chiếu sheet; nếu bật cloud/AI có kiểm soát vận hành và cách tắt; Lab không gây hiểu nhầm giao dịch | Dữ liệu/công thức được duyệt; quyền và chi phí cloud nếu dùng; không có điều kiện thì giữ backlog | Không định nghĩa được chi phí/đơn hoặc đầu ra không giúp quyết định: không xây |

**Cổng production riêng:** kiểm thử local không chứng minh staging, staging không phải production. Việc push nhánh có workflow deploy có thể phát hành; chủ sở hữu phải phê duyệt môi trường và đường triển khai trước. Tài liệu này không cho phép deploy production.

**Kỷ luật chi phí cloud — đề xuất:** giữ static/local cho các luồng không cần đồng bộ, không bật AI mặc định. Khi bật dịch vụ có phí, kiểm tra loại budget, quota, giới hạn request và cách tắt. Firebase nói rõ alerts-only budget không tự dừng dịch vụ; tài liệu hiện tại có spend caps cho một số dịch vụ, không phải trần tự động cho mọi chi phí dự án.[4] Không quảng bá “Firebase miễn phí” hoặc coi email cảnh báo là giới hạn tiền tuyệt đối.

## 9. Đo giá trị thật, baseline trước

**Chưa có dữ liệu sử dụng đã được xác minh trong phạm vi tài liệu này.** Không biến số lượng tests, lần mở trang, snapshot hoặc click CTA thành bằng chứng người dùng đạt việc.

**Đề xuất bắt đầu không cần analytics:** ghi một hàng cho mỗi tác vụ tự nguyện, chỉ gồm ngày, tool/phiên bản, loại tác vụ, cách làm trước, kết quả có dùng tiếp không, lỗi/bước làm lại, nhận xét ngắn và thời gian bắt đầu/kết thúc nếu người tham gia đồng ý. Không thu tên creator, ảnh gốc, HTML Kalodata, tọa độ hoặc thông tin định danh trong bảng đo; cần minh họa lỗi thì dùng bản đã làm sạch có phép. Cho phép không tham gia và xóa ghi chép theo thỏa thuận của người tham gia.

| Điều cần biết | Baseline phải thu trước | So sánh sau sửa | Quyết định sản phẩm |
| --- | --- | --- | --- |
| Ghép ảnh có hoàn thành việc? | Cách ghép hiện tại; ảnh xuất có phải chỉnh lại; nơi gửi cuối | JPEG thực được dùng; thứ tự/độ đọc được; lỗi và số lần làm lại | Sửa đầu ra/thứ tự trước preset mới |
| KOL có giúp ra quyết định có căn cứ? | Quy trình đọc nguồn; trường phải kiểm tra thủ công; cách lưu quyết định | Tóm tắt còn thiếu gì; số trường phải sửa theo nguồn; backup phục hồi; người phụ trách có dùng bản xuất | Sửa parser/minh bạch dữ liệu trước AI |
| Trang chủ có dễ hiểu? | Người thử tìm công cụ thế nào, nhầm gì | Chọn đúng Work/Lab và nêu đúng giới hạn mà không được nhắc | Sửa tên/đoạn giới thiệu; chưa thêm navigation |
| Có dùng lặp lại khi việc tái diễn? | Số cơ hội thực sự có cùng công việc, không phải số ngày trôi qua | Có tự mở lại không, vì sao chọn cách cũ | Giữ công cụ có việc thật; không tối ưu retention cho việc vốn hiếm |
| Cloud có đáng vận hành? | Nhu cầu đổi thiết bị/khôi phục thực tế; backup thủ công đã đủ chưa | Sync thành công/lỗi thực, chi phí thực và thời gian hỗ trợ | Giữ local-only nếu cloud không tạo giá trị |

Sau mỗi vòng quan sát, chủ sản phẩm ghi **giữ / sửa / dừng**, kèm bằng chứng và điều chưa biết. Chỉ tính tỷ lệ/thời gian khi đã có tử số, mẫu số và phạm vi đủ rõ; báo cả số mẫu và trường hợp bỏ dở. Nếu về sau thêm event, chỉ ghi mốc tác vụ tối thiểu như mở công cụ, bắt đầu xử lý, xuất thành công/lỗi — không coi click tải là xác nhận người dùng đã dùng kết quả, không gắn payload kinh doanh vào event.

## 10. Dừng làm và kiểm soát phạm vi

1. Dừng gọi cả WishPlan là bộ vận hành L.ASY hoặc biến mọi tiện ích cá nhân thành tài sản của một thương hiệu.
2. Dừng mở rộng số thẻ/công cụ để làm homepage có vẻ nhiều chức năng; không có hơn hai ứng viên tương lai trong lộ trình này.
3. Dừng hứa “tiết kiệm X%”, “tăng ROI”, “real-time”, “AI research”, “miễn phí tuyệt đối” khi chưa có bằng chứng đúng phạm vi.
4. Dừng làm đăng nhập toàn site, dashboard KPI giả, marketplace template, CRM, chat, PWA/offline toàn site hoặc một backend mới chỉ để hợp nhất giao diện.
5. Dừng bật lại extraction bằng console/bookmarklet, MQTT công cộng hoặc multiplayer để đổi lấy demo hấp dẫn.
6. Dừng đầu tư đơn/tiền thật cho Grab demo; không yêu cầu thẻ, nạp ví hoặc làm người thử tin có tài xế thật.
7. Dừng sửa branding bằng replace toàn repo; bảo toàn đường dẫn, khóa lưu trữ và tham chiếu nghiệp vụ L.ASY.
8. Dừng đưa cloud/AI chưa nghiệm thu thành tính năng chính; cấu hình staging không phải thành công production.
9. Dừng thêm Lab trong khi đầu ra Work còn lỗi; chỉ bảo trì an toàn, tính rõ ràng và khả năng thoát/về trang chủ.
10. Dừng lấy lịch nghỉ được hardcode hoặc kết quả gieo quẻ làm thông tin chính thức; nguồn thẩm quyền và giải trí phải tách riêng.

### Hồ sơ đối chiếu mã nội bộ

Các ký hiệu C1–C6 là mốc đọc mã, không phải nguồn ngoài hoặc kết quả thực thi. Tên hàm ổn định hơn số dòng vì các file đang được sửa song song.

| Mốc | Tệp / điểm kiểm tra | Phát hiện dùng trong chiến lược |
| --- | --- | --- |
| C1 | `index.html`, `README.md`, `.github/workflows/pages.yml`; `git rev-parse HEAD`, `git status --short` | Có bốn đường dẫn công cụ; checkout bẩn và luồng deploy cần kiểm soát riêng. README là mô tả, không đủ để xác nhận claim lịch nghỉ/production |
| C2 | `ghepanh/index.html`: `handleFiles`, `loadImage`, `renderImages`, handler download; các thay đổi `renderThumbnails`, `moveImage`, `removeImage` được đọc khi viết | Xử lý ảnh local bằng object URL/Canvas, giới hạn đầu vào/đầu ra, JPEG; thao tác thumbnail đang tích hợp |
| C3 | `checkkol/index.html`: `parseKalodataHtml`, `buildDynamicChecklist`, `buildMsSummaryText`, `downloadSelectedExport`, `exportHistoryJson`, `importHistoryJson`, `renderComparisonView`, `copyKalodataConsoleScript` | Luồng nhập thủ công, checklist L.ASY, tóm tắt/lịch sử/so sánh/bản xuất; extraction tự động bị vô hiệu hóa |
| C4 | `checkkol/cloud.js`: `initFirebase`, `historyStorageKey`, `authSubmit`, `cloudPushAll`, `cloudPull`, `cloudDeleteSnapshots`, `runAiDeepCaseAnalysis` | Có mã auth/sync/AI có điều kiện; AI dùng dữ liệu cung cấp, không live research; chưa xác nhận vận hành ngoài bằng đọc mã |
| C5 | `tetlasy/index.html`: `loadLocalState`, `saveLocalState`, cảnh Three.js; chế độ solo và tài nguyên CDN | Trải nghiệm 3D, tiến độ local, phạm vi giải trí |
| C6 | `grab/app.js`: `viewCheckout`, `getRoute`, `reverseGeocode`, `viewTrack`, helper `store` | Luồng UI/giao dịch mô phỏng, localStorage, gọi Nominatim/OSRM; không có bằng chứng đặt đơn/thanh toán thật |

## 11. Sổ nguồn và cách tái kiểm tra

Đã lấy nội dung đầy đủ trực tiếp từ năm trang chính chủ ngày 24/11/2026 bằng HTTP, không dùng snippet tìm kiếm. Sổ JSON và bản trích nội dung phục vụ kiểm tra nằm ở scratch `C:/Users/Admin/AppData/Local/hermes/cache/scratch/wishplan-strategy/` (`ledger.json`, `source-1.txt` đến `source-5.txt`); scratch không phải nơi lưu trữ lâu dài. Danh sách Sources dưới đây được tạo từ ledger; bảng này giữ ánh xạ và giới hạn suy luận ngay trong tài liệu để vẫn đọc được khi scratch được dọn.

| ID | Cơ quan / loại nguồn sơ cấp | Điều đã kiểm tra | Cách sử dụng / không suy rộng |
| --- | --- | --- | --- |
| 1 | GOV.UK Service Manual, hướng dẫn nghiên cứu nhu cầu | Ý kiến không đến từ người dùng phải được coi là giả định cần nghiên cứu | Căn cứ cho baseline/phỏng vấn quan sát; không chứng minh nhu cầu WishPlan |
| 2 | W3C WAI, quick reference WCAG 2.2 | Keyboard/focus, contrast, reflow và target size | Chuyển thành checklist nghiệm thu; không chứng nhận đạt WCAG toàn site |
| 3 | MDN, tài liệu API browser | localStorage tồn tại qua phiên, giới hạn chế độ riêng tư và lỗi quyền lưu | Hướng dẫn backup/phạm vi local; không bảo đảm dữ liệu không mất |
| 4 | Firebase, hướng dẫn billing | Alerts-only không dừng dịch vụ; spend caps có phạm vi dịch vụ cụ thể | Cổng kiểm soát chi phí; không tính giá tiền hoặc khẳng định project đang ở plan nào |
| 5 | Google Analytics Help, hướng dẫn campaign URL | Ba tham số UTM cốt lõi và quy ước đặt tên | Giải thích thiết kế utility tùy chọn; không hứa attribution/đo đơn hàng |


## Sources

[1] https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs — GOV.UK — Learning about users and their needs
[2] https://www.w3.org/WAI/WCAG22/quickref — W3C — How to Meet WCAG 2.2
[3] https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage — MDN — Window localStorage
[4] https://firebase.google.com/docs/projects/billing/avoid-surprise-bills — Firebase — Avoid surprise bills
[5] https://support.google.com/analytics/answer/10917952 — Google Analytics — URL builders
