# Trích xuất hóa đơn v2.0.3

Ngày đóng gói: 07/10/2026.

## Giao diện

- Sidebar: Trích xuất hóa đơn, Tổng quan, Danh sách hóa đơn, Chi tiết hóa đơn; Cài đặt ở cuối.
- Chọn màu gọn trong mục “Giao diện”, 8 nút nhỏ thay các thẻ lớn.
- Bấm hóa đơn đã lưu hoặc nhấn Enter/Space để xem thông tin và sản phẩm. API GET chỉ đọc workbook; không sửa ghi chép Excel.
- Chi tiết hóa đơn hiển thị sản phẩm đã lưu và preview, giữ ký hiệu/số hóa đơn/các khoản tiền; bỏ cột Người bán và Mã hàng trên UI. Excel vẫn giữ đầy đủ các cột cũ.
- Các trường không được Excel lưu không thể phục hồi từ workbook. Popup ghi rõ giới hạn, không khẳng định chữ ký hợp lệ khi chưa xác minh.

## Kiểm tra

12 test backend và hai bộ UI hồi quy đã đạt trên dữ liệu tạm. Khi xem hóa đơn, workbook giữ nguyên SHA-256 và không có yêu cầu ghi/xóa/khởi tạo Excel. Đã biên dịch lại Tailwind CSS. Cả hai bộ UI cũng đạt khi chạy trực tiếp backend của `.exe` v2.0.3 với dữ liệu tạm; các tài nguyên giao diện và phiên bản đã được xác minh. Chưa kiểm thử mọi mẫu hóa đơn hoặc toàn bộ thao tác.

## Bản xuất

`dist/v2.0.3/TrichXuatHoaDon.exe`, `dist/TrichXuatHoaDon-v2.0.3-Windows.zip`. Giữ các bản cũ. Chưa xuất bản GitHub Release v2.0.3. Xem README để biết mức kiểm tra bản đóng gói và vấn đề còn tồn đọng.
