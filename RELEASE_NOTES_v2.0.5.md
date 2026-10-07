# Trích xuất hóa đơn v2.0.5

Ngày đóng gói: 07/10/2026.

## Sửa thuế và thu gọn popup

- XML giữ tiền thuế khai báo, kể cả 0/số âm; không nhầm trường tiền thuế với thuế suất. Thiếu tiền thuế thì tính từ thành tiền và thuế suất khi đủ dữ liệu, gồm thuế suất thập phân.
- PDF bỏ gán cứng 8% và thuế dòng 0. Tính từ thuế suất đọc được; chỉ dùng thuế suất chung khi đối chiếu tổng khớp hoặc tiền thuế tổng cho một dòng khớp toàn bộ tiền hàng. Thiếu dữ liệu hiện “Chưa xác định”.
- Danh sách hóa đơn mở thông tin khi bấm từng dòng. Popup bỏ các khối “Thông tin sản phẩm 1, 2…” và tính chất/mã hàng phụ lặp lại; giữ bảng sản phẩm và thuế.
- Xem Excel cũ chỉ tính bổ sung ô trống trong kết quả đọc, không ghi workbook hoặc tự thay số đã lưu. Hóa đơn đã lưu sai từ bản trước cần quét/tải lại file gốc rồi tự chọn ghi đè.

## Kiểm tra

23 test backend và 4 bộ UI trên dữ liệu/cấu hình tạm đạt. Thuế XML thử với dữ liệu thật qua API, các nhánh PDF mới thử với văn bản layout giả lập; chưa kiểm thử mọi mẫu PDF/XML. Hash workbook giữ nguyên sau xem. Cả 4 bộ UI cũng đạt khi chạy trực tiếp backend `.exe` v2.0.5 với dữ liệu tạm; phiên bản/tài nguyên được kiểm tra. Bản cuối 27.207.843 byte.

## Bản xuất

`dist/v2.0.5/TrichXuatHoaDon.exe`, `dist/TrichXuatHoaDon-v2.0.5-Windows.zip`. Các bản cũ được giữ lại. Chưa xuất bản GitHub Release v2.0.5.
