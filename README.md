# Trích Xuất Hóa Đơn (Invoice Extractor)

<div align="center">

![Trích xuất hóa đơn Logo](static/images/logo.png)

**Ứng dụng trích xuất hóa đơn điện tử thông minh XML & PDF sang Excel chuyên nghiệp**

[![Bản quyền](https://img.shields.io/badge/B%E1%BA%A3n%20quy%E1%BB%81n-MinhTrietEras-pink.svg)](https://leminhtriet.com)
[![Website](https://img.shields.io/badge/Website-leminhtriet.com-rose.svg)](https://leminhtriet.com)
[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

*Phát triển và bảo hộ bản quyền bởi **Lê Minh Triết (MinhTrietEras)***  
🌐 Website chính thức: [https://leminhtriet.com](https://leminhtriet.com)

</div>

---

## 🌟 Giới Thiệu

**Trích xuất hóa đơn** là ứng dụng cục bộ (chạy Offline trên máy tính, bảo mật tuyệt đối dữ liệu nội bộ) giúp tự động hóa quá trình xử lý, bóc tách và phân tích các hóa đơn điện tử định dạng **XML** và **PDF** theo chuẩn Thông tư 78/2021/TT-BTC và Nghị định 123/2020/NĐ-CP (hỗ trợ đầy đủ các nhà mạng VNPT, Viettel, MISA, BKAV, FPT, CMC, CyberBill...).

Dữ liệu được lưu trữ tự động vào file Excel chuẩn kế toán gồm **3 Sheet thông minh**, tích hợp báo cáo **Pivot Table** đa chiều theo nhà cung cấp và kỳ kê khai thuế.

---

## ✨ Tính Năng Nổi Bật

### 1. Quét Hàng Loạt Theo Thư Mục Nhà Cung Cấp
* Chọn trực tiếp thư mục chứa hóa đơn bằng hộp thoại Windows Native Dialog.
* Tự động nhận diện cấu trúc hóa đơn phân theo từng thư mục con của từng Nhà Cung Cấp (NCC).
* Hỗ trợ quét đệ quy mọi cấp thư mục con.

### 2. Bóc Tách Đa Định Dạng: XML & PDF
* **File XML**: Đọc trực tiếp cấu trúc cây dữ liệu hóa đơn điện tử TT78, TT32.
* **File PDF**: Tự động giải nén file XML đính kèm (Embedded Attachment) hoặc bóc tách dữ liệu thông minh từ văn bản PDF.
* Hỗ trợ tải trực tiếp tệp nén `.zip` chứa nhiều hóa đơn.

### 3. Cấu Trúc Lưu Trữ Chuẩn Kế Toán (3 Sheet Excel)
* **Sheet 1: `TongQuan` (Báo cáo Pivot & Tổng hợp)**:
  * Bảng tổng hợp số lượng, doanh số chưa thuế, tiền thuế GTGT và tổng thanh toán theo từng Nhà Cung Cấp.
  * Bảng tổng hợp theo Tháng / Kỳ kê khai thuế.
  * Bộ lọc tương tác (Slicers) trực tiếp trên Web App.
* **Sheet 2: `TongHopHoaDon`**:
  * Mỗi dòng tương ứng một hóa đơn đầy đủ thông tin bên bán, bên mua, số tiền, ngày lập, trạng thái chữ ký số và tên thư mục NCC.
  * Kèm AutoFilter phục vụ lọc dữ liệu nhanh trong Excel.
* **Sheet 3: `ChiTietHangHoa`**:
  * Bóc tách chi tiết từng dòng hàng hóa/dịch vụ: Tên hàng, ĐVT, Số lượng, Đơn giá, Thành tiền, Thuế suất %, Tiền thuế.

### 4. Cơ Chế Chống Trùng Lặp Thông Minh
* Khóa định danh duy nhất: `[Mã Số Thuế Bên Bán] + [Mẫu Số & Ký Hiệu] + [Số Hóa Đơn]`.
* Lựa chọn:
  * **Ghi đè (Replace)**: Tự động cập nhật thông tin mới nhất mà **không làm tăng thêm dòng** trong Excel.
  * **Bỏ qua (Skip)**: Giữ nguyên dữ liệu cũ, chỉ nạp hóa đơn mới.

### 5. An Toàn Dữ Liệu & Thao Tác Nhanh
* **Khởi Tạo File Mới**: Modal trực quan cho phép tự do chỉ định vị trí và đặt tên file `.xlsx` mới bất kỳ lúc nào.
* **Xóa Dữ Liệu An Toàn**: Ràng buộc bảo mật bắt buộc người dùng nhập chính xác chuỗi `XÓA TOÀN BỘ DỮ LIỆU` để phòng tránh xóa nhầm.

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Yêu cầu hệ thống:
* Hệ điều hành: Windows 10 / 11 (hoặc macOS, Linux).
* Python 3.9 trở lên.

### Cách 1: Khởi chạy 1-Click trên Windows (Đơn giản nhất)
Nhấp đúp (Double-click) vào tệp:
```cmd
run.bat
```
Script sẽ tự động:
1. Kiểm tra Python và cài đặt các thư viện cần thiết.
2. Tự động mở trình duyệt web tại `http://localhost:5000`.

### Cách 2: Khởi chạy bằng lệnh
```bash
# 1. Cài đặt các thư viện phụ thuộc
pip install -r requirements.txt

# 2. Khởi chạy máy chủ Flask
python app.py
```
Mở trình duyệt truy cập: **`http://localhost:5000`**

---

## 📁 Cấu Trúc Thư Mục

```
trichxuathoadon/
├── app.py                     # Máy chủ Flask xử lý API & điều hướng
├── parser.py                  # Module bóc tách dữ liệu hóa đơn XML & PDF
├── excel_manager.py           # Module quản trị dữ liệu Excel chuẩn 3 Sheet
├── config.py                  # Cấu hình cổng mạng và đường dẫn mặc định
├── requirements.txt           # Danh mục thư viện phụ thuộc
├── run.bat                    # Script khởi chạy 1-click trên Windows
├── LICENSE                    # Giấy phép bản quyền phần mềm (MIT License)
├── README.md                  # Tài liệu hướng dẫn sử dụng chi tiết
├── data/                      # Thư mục lưu trữ file Excel mặc định
├── templates/
│   └── index.html             # Giao diện Web App chuẩn hiện đại (Tailwind CSS)
└── static/
    ├── css/style.css          # Tùy biến giao diện & định dạng in ấn
    ├── js/app.js              # Toàn bộ logic frontend & kết nối API
    └── images/logo.png        # Logo nhận diện thương hiệu MinhTrietEras
```

---

## ⚖️ Bản Quyền & Tác Giả (Copyright & License)

Phần mềm được phát triển và sở hữu bởi:
* **Tác giả:** Lê Minh Triết (**MinhTrietEras**)
* **Trang web:** [https://leminhtriet.com](https://leminhtriet.com)
* **Giấy phép:** Được phát hành theo giấy phép [MIT License](LICENSE).

Mọi thông tin liên hệ, phản hồi hoặc yêu cầu tùy biến tính năng doanh nghiệp, vui lòng truy cập website: [https://leminhtriet.com](https://leminhtriet.com).
