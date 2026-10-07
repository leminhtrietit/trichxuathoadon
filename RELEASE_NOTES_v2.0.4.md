# Trích xuất hóa đơn v2.0.4

Ngày đóng gói: 07/10/2026.

## Thay đổi

- Màn hình chờ thêm logo app dưới tên; phiên bản và “powered by” kèm logo tác giả được giữ lại, không thêm card.
- Thiết lập lần đầu gồm nơi lưu file Excel kết quả và màu giao diện. Đọc điều khoản, tích đồng ý rồi bấm “Chấp nhận và bắt đầu”.
- Ghi nhớ thiết lập/phiên bản và thời điểm chấp nhận tại máy. Người dùng bản cũ được điền sẵn cấu hình và giữ workbook cũ. Chỉ hoàn tất khi ghi cấu hình thành công; không tự tạo Excel mặc định trước thiết lập.
- File Excel cũ chỉ đọc kiểm tra, không ghi đè; file hỏng hoặc file khác không có sheet sổ hóa đơn bị từ chối. Màu có thể xem trước trước khi lưu.
- Nút menu trên header thu gọn sidebar còn icon và tooltip; mở lại vẫn giữ trạng thái.
- Điều khoản trong TERMS_OF_USE.md, có thể xem lại trong Cài đặt. Nội dung không thu hẹp quyền theo LICENSE/MIT hiện có.

## Kiểm tra

17 test backend và ba bộ UI trên dữ liệu/cấu hình tạm đạt. Kiểm tra giữ nguyên workbook khi nhận cấu hình cũ, các lỗi đầu vào/lưu cấu hình, nhớ chấp nhận, đường dẫn output và sidebar. Màn hình chờ kiểm tra ở 1320×860 và 1024×680, cả hai logo được nhúng trong HTML Desktop. Đã biên dịch lại Tailwind CSS. Cả ba bộ UI cũng đạt trên backend của `.exe` v2.0.4 với `%LOCALAPPDATA%` tạm; có kiểm tra focus/Tab và workbook giữ nguyên khi xem. Bản cuối 27.204.728 byte.

## Bản xuất

`dist/v2.0.4/TrichXuatHoaDon.exe`, `dist/TrichXuatHoaDon-v2.0.4-Windows.zip`. Các bản cũ được giữ lại. Chưa xuất bản GitHub Release v2.0.4. Chưa kiểm thử mọi mẫu PDF/XML hay mọi thao tác ứng dụng.
