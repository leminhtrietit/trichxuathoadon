# Trích Xuất Hóa Đơn v2.0.1

Ngày đóng gói: 07/10/2026.

- Thêm màn hình chờ logo MinhTrietEras trong lúc nạp ứng dụng và dữ liệu.
- Tối ưu đọc tổng hợp Excel bằng streaming và cache theo thay đổi file.
- Đóng gói CSS/icon cục bộ để giao diện dùng được offline.
- Lưu cấu hình và Excel mặc định của bản Windows tại `%LOCALAPPDATA%\MinhTrietEras\TrichXuatHoaDon\data`.
- Giữ nguyên file Excel hiện có nếu không đọc được, thay vì ghi đè bằng file trắng.
- Giảm các thư viện không sử dụng trong bản đóng gói.

## Sử dụng

Giải nén `TrichXuatHoaDon-v2.0.1-Windows.zip`, chạy `TrichXuatHoaDon.exe`. Bản Desktop dùng Windows và Microsoft Edge WebView2; không cần Python hoặc Node.js.

Nếu chưa thấy dữ liệu cũ, vào Cài Đặt chọn lại workbook đã sử dụng. Bản này không tự chuyển dữ liệu từ thư mục tạm của bản cũ.

## Những vấn đề còn mở

Các lỗi parser thuế XML, chèn dữ liệu vào HTML, ghi Excel đồng thời và giới hạn giải nén ZIP vẫn còn mở. Xem danh sách ưu tiên và phạm vi kiểm thử trong `README.md` và `PERFORMANCE_AUDIT.md`.

Màn hình chờ xuất hiện khi cửa sổ WebView được tạo; giai đoạn giải nén `--onefile` vẫn diễn ra trước đó.

## Kiểm tra bản xuất

9/9 test hồi quy đạt. File `.exe` đã chạy smoke test với dữ liệu tạm: API báo đúng v2.0.1, tài nguyên giao diện được phục vụ và dữ liệu mặc định nằm trong thư mục cô lập. Chưa kiểm thử đầy đủ mọi thao tác giao diện/mẫu hóa đơn trên bản đóng gói.

Đây là bản xuất cục bộ, chưa xuất bản GitHub Release v2.0.1.
