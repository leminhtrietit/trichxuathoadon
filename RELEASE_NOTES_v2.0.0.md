## 🚀 Trích Xuất Hóa Đơn v2.0.0 - Bản Phát Hành Desktop App Chính Thức

Hệ thống trích xuất hóa đơn điện tử XML & PDF sang Excel chuyên nghiệp, phân tích Pivot đa chiều theo Nhà cung cấp và Kỳ kê khai, tích hợp giao diện hiện đại **Material Design 3 (Google Material You)**.

---

### ✨ Các Tính Năng Nổi Bật

1. **Ứng Dụng Desktop Windows Độc Lập**:
   - Chạy trực tiếp dưới dạng cửa sổ phần mềm Windows (`TrichXuatHoaDon.exe`) thông qua PyWebView.
   - Hoạt động độc lập 100%, người dùng cuối **không cần cài đặt Python hay bất kỳ thư viện nào**.

2. **Phương Thức Trích Xuất Tinh Gọn (Bố cục ngang & Popup)**:
   - Hai cách trích xuất được thiết kế thành 2 thẻ nằm ngang tinh tế:
     - **Quét theo thư mục**: Hộp thoại chọn thư mục gốc Windows native, quét đệ quy các thư mục con theo Nhà cung cấp.
     - **Tải lên tệp trực tiếp**: Kéo thả hàng loạt file XML, PDF hoặc file nén ZIP.

3. **Báo Cáo Đối Chiếu & Kiểm Tra Trùng Lặp Thông Minh**:
   - Sau khi bóc tách, ứng dụng hiển thị Popup báo cáo kết quả chi tiết:
     - Thống kê 4 KPI: Tổng bóc tách, Hóa đơn Mới, Hóa đơn Trùng lặp, File lỗi.
     - Cảnh báo trùng lặp thông minh đối chiếu theo `Mã số thuế bên bán` + `Ký hiệu mẫu` + `Số hóa đơn`.
     - 3 Hướng xử lý: **Chỉ thêm hóa đơn mới (Bỏ qua trùng)**, **Cập nhật / Ghi đè**, hoặc **Thêm tất cả**.
     - Bảng xem trước danh sách hóa đơn kèm nút con mắt 👁️ xem thể hiện hóa đơn chi tiết.
     - Dữ liệu chỉ được ghi vào file Excel khi người dùng bấm nút xác nhận.

4. **Bộ Màu Chủ Đề Material Design 3 (Google M3)**:
   - Tinh chỉnh 8 bộ màu chuẩn Material You:
     - 🟣 **Tím Thạch Anh (Amethyst)** - Chuẩn gốc Google Baseline
     - 🔵 **Xanh Dương (Ocean Blue)** - Chuyên nghiệp & Tin cậy
     - 🟢 **Xanh Lục Bảo (Forest Emerald)** - Tươi mới & Sinh thái
     - 🌸 **Hồng Thạch Anh (Rose Quartz)** - Thanh lịch & Hiện đại
     - 🟠 **Hổ Phách Hoàng Kim (Sunset Amber)** - Năng động & Ấm cúng
     - 🌊 **Lam Ngọc Biển Sâu (Ocean Teal)** - Dịu mát & Chiều sâu
     - 🔴 **Đỏ Ruby & Đất Nung (Ruby Carmine)** - Sắc sảo & Quyết đoán
     - ⚫ **Than Đen Tối Giản (Charcoal Slate)** - Tối giản & Tập trung
   - Nút đổi nhanh ngay trên Header và phòng trưng bày chi tiết trong Tab Cài Đặt.
   - Ghi nhớ thiết lập vĩnh viễn (Dual persistence: localStorage & backend `settings.json`).

5. **Phân Tích Pivot Đa Chiều & AutoFilter Trên Excel**:
   - Sheet 1 `TongQuan`: Bảng tổng hợp theo từng Nhà cung cấp kèm đường dẫn thư mục, Bảng tổng hợp theo Kỳ kê khai (tháng/năm).
   - Tự động thiết lập AutoFilter trên vùng tiêu đề giúp lọc trực tiếp trên Excel.
   - Sheet 2 `TongHopHoaDon`: Danh sách hóa đơn chi tiết.
   - Sheet 3 `ChiTietHangHoa`: Toàn bộ từng dòng mặt hàng / dịch vụ.

6. **Định Danh Bản Quyền & Tracking**:
   - Tác giả: **Lê Minh Triết**
   - Đơn vị: **MinhTrietEras**
   - Website: [https://leminhtriet.com](https://leminhtriet.com)
   - Mã Tracking: `MTE-TXHD-2026-VN`
   - Nhúng metadata vào thuộc tính Workbook Excel, HTTP Response Headers, HTML SEO tags và Modal bản quyền.

---

### 📦 Tải Về & Cài Đặt

- **Tải file chạy trực tiếp**: Tải tệp `TrichXuatHoaDon.exe` bên dưới về máy tính Windows (Windows 10 / 11).
- **Cách sử dụng**: Nhấp đúp vào `TrichXuatHoaDon.exe` để mở ứng dụng và sử dụng ngay lập tức.
