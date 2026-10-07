# Trích Xuất Hóa Đơn v2.0.2

Ngày đóng gói: 07/10/2026.

## Sửa lỗi quét và xem kết quả

- Sửa `Cannot read properties of null (reading 'classList')` sau khi quét/tải hóa đơn. Hàm cập nhật badge còn truy cập `upload-actions` và `save-count-badge`, trong khi giao diện đã bỏ các phần tử này. Các tham chiếu cũ đã được loại bỏ; popup kết quả mở bình thường.
- Sửa tổng thanh toán trong popup: đọc `thanh_toan` từ dữ liệu parser thay vì trường `tong_tien` không tồn tại.
- Đếm mặt hàng trở về 0 khi bỏ toàn bộ hóa đơn khỏi preview.
- Giữ màn hình chờ tối giản và logo ứng dụng đã thiết kế ở v2.0.1. Phiên bản hiển thị lấy từ cấu hình chung.

## Kiểm tra

- 9/9 kiểm tra Python đạt.
- Đã tái hiện lỗi cũ trên Edge headless bằng quét XML mẫu qua API thật.
- Sau sửa, kiểm tra trình duyệt với dữ liệu/Excel/cấu hình tạm đạt: quét hóa đơn mới, đúng tổng thanh toán, lưu Excel, quét hóa đơn trùng và ghi đè không tăng số dòng, upload XML, bỏ hóa đơn khỏi preview và quét thư mục trống.

- Bản `.exe` v2.0.2 đã chạy trực tiếp cùng bộ UI hồi quy và đạt; API báo đúng v2.0.2, dữ liệu mặc định được cô lập trong thư mục tạm.

## Bản xuất

Chạy `dist/v2.0.2/TrichXuatHoaDon.exe` hoặc giải nén `dist/TrichXuatHoaDon-v2.0.2-Windows.zip`. Các bản v2.0.0/v2.0.1 được giữ lại; hãy mở đúng bản v2.0.2 để có bản sửa lỗi.

Xem các vấn đề khác còn mở trong README và PERFORMANCE_AUDIT.md. Chưa xuất bản GitHub Release v2.0.2.
