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
- **Cập nhật nhận diện phiên bản:**
  + Tiêu đề cửa sổ Desktop: `Trích Xuất Hóa Đơn v2.0.9 - MinhTrietEras`.
  + Gắn badge `v2.0.9` tại thanh Sidebar góc trên cùng bên trái.
  + File thực thi: `dist/v2.0.9/TrichXuatHoaDon.exe` và `dist/TrichXuatHoaDon-v2.0.9-Windows.zip`.
- **Kiểm thử:** 29/29 bài test backend và kiểm thử giao diện thực tế Playwright trên Edge headless đạt 100%.
