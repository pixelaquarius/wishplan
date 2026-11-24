---
trigger: model_decision
---

# Quy tắc tự động lọc từ bóp tương tác & rà soát nội dung trước khi xuất bản

Áp dụng tự động trong pipeline và khi chỉnh sửa qua Box Chat AI / Timeline trước khi render bản cuối:

1. **Từ ngữ buôn bán, chèo kéo & giá cả (Chống bóp traffic tự nhiên)**: Tự động phát hiện, cắt bỏ các câu chèo kéo mua bán cuối clip hoặc thay thế bằng từ ngữ chia sẻ trải nghiệm trung tính đối với các từ như `"buôn bán"`, `"bán hàng"`, `"mua ngay"`, `"đi mua"`, `"giá rẻ"`, `"giá cả"`, `"bao nhiêu tiền"`, `"chốt đơn"`, `"cứ chốt"`, `"giỏ hàng"`.
2. **Cam kết tuyệt đối & Số liệu phóng đại**: Gắn cờ và làm mềm mọi câu hứa chắc chắn 100% doanh thu, đơn hàng, lợi nhuận, `"bao lời"`, `"chắc chắn viral"`, `"không rủi ro"`.
3. **Chính sách nền tảng & Từ ngữ phản cảm**: Loại bỏ câu điều hướng giao dịch ngoài nền tảng (`"inbox Zalo"`, `"chuyển khoản ngoài"`), mẹo lách luật, hoặc câu mở đầu phản cảm (`"điên khùng"`...).
4. **Danh sách theo dõi**: Đọc từ `.agents/skills/content-claims-check/references/watchlist.md` và tự động làm sạch trong quá trình dựng video.
