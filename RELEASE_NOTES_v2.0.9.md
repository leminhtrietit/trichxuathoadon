# v2.0.9 — Tối ưu bóc tách thuế sản phẩm & Tinh giản giao diện

Ngày: 07/10/2026.

- **Sửa bóc tách thuế từng dòng sản phẩm:**
  + Cải tiến regex và logic đọc bảng kê hàng hóa trong file PDF khi in cột thuế suất ở giữa dòng kèm tiền thuế và tổng cộng sau thuế; xử lý chuẩn xác thành tiền chưa thuế, thuế suất % và tiền thuế từng dòng.
  + Tự động kế thừa thuế suất tổng quát (`header_rate`: KCT, 10%, 8%, 5%) cho các hóa đơn có bảng kê không in cột thuế từng dòng (VCCorp, VNG, LadiPage).
  + Nâng cấp `invoice_tax.py` nhận diện linh hoạt các biến thể thuế suất và làm tròn tiền VND theo chuẩn kế toán.
- **Tinh giản Popup Chi Tiết Hóa Đơn:**
  + Bỏ khối đơn vị mua hàng (tên, MST, địa chỉ, hình thức thanh toán) và khối nguồn thông tin bổ sung phụ dưới bảng theo yêu cầu.
  + Tập trung hoàn toàn vào thanh tóm tắt số HĐ/bên bán 1 dòng, Bảng danh sách mặt hàng & tiền, và Khối tổng cộng tiền/thuế.
- **Tinh gọn Popup Góp Ý & Báo Lỗi:**
  + Loại bỏ toàn bộ các câu mô tả kỹ thuật rườm rà (thông tin máy chủ, checkbox kết nối Internet, cảnh báo độ dài ký tự).
  + Giao diện form chuẩn Material Design 3 gồm trường nội dung góp ý, email liên hệ, nút Sao chép, Hủy và Gửi góp ý.
- **Đặt tên file thực thi kèm phiên bản & Nhúng Windows PE Metadata:**
  + Tiêu đề cửa sổ Desktop & giao diện Windows giữ nguyên tên tiêu chuẩn: `Trích xuất hóa đơn - MinhTrietEras`.
  + Tệp thực thi nhúng trực tiếp thông tin bản quyền Windows PE Metadata (`file_version_info.txt`): CompanyName `MinhTrietEras`, ProductName `Trích Xuất Hóa Đơn`, FileVersion `2.0.9.0`, Copyright `Copyright © 2026 Lê Minh Triết - MinhTrietEras`.
  + Tên file thực thi biên dịch đóng gói: `dist/v2.0.9/TrichXuatHoaDon-v2.0.9.exe` (26.707.137 bytes, SHA-256: `97b98af075805268d757eda462f834f03bda32590442e77cca315e91dffa2e01`).
  + Gói phân phối ZIP: `dist/TrichXuatHoaDon-v2.0.9-Windows.zip` (26.149.588 bytes, SHA-256: `27fc93857e030d24025b1c597704ecc08221b455041ac035cc7a739c4c5e77d9`).
- **Kiểm thử:** 29/29 bài test backend và kiểm thử giao diện thực tế Playwright trên Edge headless đạt 100%.

