# v2.0.6 — Popup hóa đơn và mục góp ý

Ngày: 07/10/2026.

- Tiêu đề popup: “Chi tiết hóa đơn”. Bỏ nút in và toàn bộ phần chữ ký, cả trường Người ký trong thông tin bổ sung. Không thay parser hay ghi chép Excel.
- Dấu ? phía trên Cài đặt mở Góp ý; dùng được khi sidebar thu gọn. Có nội dung, email tùy chọn, ô đồng ý kết nối Internet và sao chép bản nháp. Hộp giữ focus, Escape đóng và trở về nút mở; đồng ý được reset mỗi lần mở.
- Chưa triển khai gửi: nút Gửi bị khóa kể cả khi tích đồng ý, thông báo rõ API chưa cấu hình; không có request mạng cho góp ý. Bản nháp giữ trong bộ nhớ của phiên ứng dụng, không lưu vào Excel/cấu hình. Kiểm tra cập nhật vẫn có mạng như trước.
- Nơi nhận dự kiến do chủ dự án chọn: trang quản trị leminhtriet.com. Hướng dẫn hợp đồng API/backend/quản trị và bước tiếp theo ở docs/FEEDBACK_SETUP.md; endpoint trong đó là đề xuất, chưa tồn tại được xác minh.

Kiểm thử và bản đóng gói: xem mục thực trạng trong README.md.
