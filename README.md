# Trích Xuất Hóa Đơn (Invoice Extractor)

<div align="center">

<img src="static/images/app-logo.png" alt="Logo Trích xuất hóa đơn" width="160">

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

**Trích xuất hóa đơn** là ứng dụng cục bộ giúp xử lý, bóc tách và phân tích hóa đơn điện tử **XML** và **PDF**, có parser cho các cấu trúc TT78/TT32. Giao diện và xử lý hóa đơn dùng được offline; chức năng kiểm tra cập nhật có thể kết nối mạng. Chưa kiểm thử đầy đủ mọi mẫu hóa đơn của mọi nhà cung cấp.

Dữ liệu được lưu vào file Excel gồm **3 Sheet**, kèm bảng tổng hợp theo nhà cung cấp và kỳ kê khai thuế, cùng bộ lọc trên giao diện ứng dụng.

## Thực trạng dự án — v2.0.2, cập nhật 07/10/2026

**Quy tắc dành cho các agent:** đọc mục này và [AGENTS.md](AGENTS.md) trước khi làm việc. Sau mỗi đợt thay đổi đáng kể, cập nhật README ngay trong cùng đợt làm việc: phần đã hoàn thành, lỗi còn tồn đọng, kết quả kiểm thử và bản đóng gói. README là nơi tra cứu thực trạng hiện tại; báo cáo chi tiết không thay thế việc cập nhật README.

### Đã hoàn thành

- **v2.0.2 sửa lỗi quét:** loại bỏ truy cập `upload-actions`/`save-count-badge` đã bị gỡ khỏi HTML, gây `Cannot read properties of null (reading classList)` và chặn mở popup. Luồng quét/upload/lưu đã chạy lại trên trình duyệt với dữ liệu tạm. Popup lấy tổng thanh toán từ `thanh_toan`, đếm mặt hàng trở về 0 khi bỏ toàn bộ preview.

- Logo ứng dụng riêng theo ý tưởng “hóa đơn → bảng dữ liệu”, xanh chàm/xanh ngọc, nền trong suốt, không có chữ. Master PNG: `static/images/app-logo.png`; icon Windows đa kích thước: `static/images/app-icon.ico` (16, 24, 32, 48, 64, 128, 256 px). Dùng cho favicon, sidebar, cửa sổ giới thiệu, icon `.exe` và cửa sổ/taskbar Desktop. Logo tác giả ở “powered by” vẫn là `static/images/logo.png`. Xem [thiết kế và prompt](docs/APP_LOGO.md).

- Màn hình chờ chỉ hiển thị tên app lớn phía trên, phiên bản bên dưới và dòng “powered by” kèm logo phía dưới; không có card, thanh chuyển động hay nội dung phụ. Nền xanh tím nhẹ được giữ lại. Desktop hiển thị màn hình chờ trước khi nạp Flask/parser/Excel; giao diện web bỏ lớp chờ sau khi các yêu cầu dữ liệu ban đầu kết thúc, có cơ chế thoát sau 15 giây nếu bị treo.
- Bỏ đọc Excel lúc import app nếu file đã tồn tại; đọc tổng hợp bằng streaming và cache theo thay đổi file. Các yêu cầu đọc đồng thời dùng chung kết quả; sửa file bên ngoài hoặc lưu/xóa dữ liệu làm cache cập nhật lại.
- Dùng cổng do hệ điều hành cấp cho Desktop, bỏ vòng lặp chờ bằng API thống kê. Tái sử dụng bộ định dạng số ở frontend.
- Đóng gói Tailwind CSS và Font Awesome tại máy, không tải CDN cho giao diện; dùng font hệ thống.
- Bản `.exe` lưu cấu hình và workbook mặc định vào `%LOCALAPPDATA%\MinhTrietEras\TrichXuatHoaDon\data`; đường dẫn Excel riêng vẫn do người dùng chọn. Chạy từ mã nguồn dùng thư mục `data` của dự án.
- Chặn ghi đè workbook hiện có nhưng không đọc được; thông báo lỗi đọc Excel trên giao diện. Quét thư mục chỉ đánh dấu đã lưu khi lưu thành công.
- Loại thư viện tùy chọn không dùng khỏi bản đóng gói; bản mới nằm ở **`dist/v2.0.2/TrichXuatHoaDon.exe`**. ZIP mới: `dist/TrichXuatHoaDon-v2.0.2-Windows.zip`. Các file `.exe`/ZIP v2.0.0 và v2.0.1 vẫn là bản cũ; mở đúng bản v2.0.2 để dùng bản sửa lỗi; chưa có bước chuyển dữ liệu tự động từ bản cũ.

### Hiệu năng đã đo

Workbook tự sinh, mỗi hóa đơn có 5 dòng hàng hóa; mỗi cấu hình đo một lượt trên máy hiện tại. Đây là thời gian đọc tổng hợp Excel, chưa phải thời gian mở toàn bộ app.

| Hóa đơn / dòng hàng hóa | Trước tối ưu | Sau tối ưu, lần đầu | Đọc lại khi file không đổi |
|---|---:|---:|---:|
| 1.000 / 5.000 | 2,716 giây | 0,722 giây | 0,055 giây |
| 10.000 / 50.000 | 20,111 giây | 7,745 giây | 0,091 giây |

Bản `.exe` cũ khoảng **46,2 MB**, bản v2.0.2 khoảng **27,2 MB**. Chạy lại số đo bằng `python benchmarks/benchmark_summary.py`; kết quả xuất vào `build/benchmark-results.json`. Script cố định mốc trước tối ưu ở commit `5c90279`, giữ nguyên mốc so sánh sau khi commit các thay đổi mới.

### Lỗi và giới hạn chưa sửa

P1 là các mục nên sửa sớm. P2 là các cải tiến tiếp theo. Danh sách này phản ánh các vấn đề còn mở, không phải những tính năng đã hoàn thành.

| Ưu tiên | Vấn đề còn tồn đọng | Bằng chứng / bước tiếp theo |
|---|---|---|
| P1 | Parser XML có thể bỏ qua thuế dòng đã khai báo. | `find('TThue') or find('VATAmount')` dùng truthiness của Element; thử thuế 25 cho ra 100. Chuyển sang kiểm tra `is not None`, thêm fixture. |
| P1 | Dữ liệu hóa đơn được chèn trực tiếp vào `innerHTML`. | Đã tái hiện thực thi cờ JavaScript vô hại qua tên người bán. Escape dữ liệu hoặc dùng `textContent` ở bảng, modal, toast. |
| P1 | Ghi Excel chưa có khóa giữa các tiến trình và chưa thay file nguyên tử. | Nguy cơ mất cập nhật khi nhiều phiên lưu đồng thời hoặc file ghi dở khi bị ngắt; chưa tái hiện mất dữ liệu. Thêm khóa theo đường dẫn và ghi qua file tạm. |
| P1 | ZIP chưa giới hạn tổng byte giải nén và số entry. | Giới hạn HTTP upload 200 MB không giới hạn dung lượng sau giải nén. Kiểm tra kích thước và giới hạn byte đọc thực tế. |
| P1 | Các bảng vẫn dựng toàn bộ dòng, kể cả tab đang ẩn. | Cần phân trang/render theo vùng nhìn thấy và debounce tìm kiếm; chưa benchmark DOM với dữ liệu lớn. |
| P1 | Bộ test cũ có thể thay đổi dữ liệu/cấu hình thật. | `test_init_and_clear.py` chưa cô lập workbook của app; `test_e2e.py` dùng Downloads và đổi theme thật. Cô lập trước khi chạy. |
| P2 | Quét âm thầm bỏ file dưới 500 byte hoặc trên 15 MB. | Đã tái hiện `total_files=1`, kết quả rỗng, `error_count=0`. Trả lý do bỏ qua và cấu hình giới hạn. |
| P2 | Quét XML/PDF dài chưa có tiến độ hoặc hủy. | Parse tuần tự trong một yêu cầu. Chuyển thành tác vụ theo lô, có tiến độ/hủy. |
| P2 | Khóa chống trùng chưa gồm mẫu số. | Hiện dùng ký hiệu + số hóa đơn + MST. Xác nhận quy tắc và chuyển khóa tương thích workbook cũ. |

Ưu tiên tiếp theo: sửa thuế XML và escape giao diện, bảo vệ ghi Excel, giới hạn ZIP, rồi phân trang bảng và tiến độ quét. Xem bằng chứng chi tiết trong [PERFORMANCE_AUDIT.md](PERFORMANCE_AUDIT.md).

### Phạm vi đã kiểm thử và tình trạng bản đóng gói

- **9/9 test mới đạt:** `python -m unittest test_startup_performance -v`. Các test dùng thư mục tạm, kiểm tra cache, đọc đồng thời, sửa file bên ngoài, save/clear, chống trùng/replace, bảo toàn file hỏng, workbook thiếu dimension metadata, API và tài nguyên màn hình chờ.
- Kiểm tra UI bổ sung `tests/scan_ui_regression.cjs` trên Edge headless đạt: quét mới, tổng tiền đúng, lưu, quét trùng/ghi đè, upload, xóa preview, thư mục trống; không có lỗi JavaScript. Máy chủ fixture `tests/ui_fixture_server.py` cô lập toàn bộ file/cấu hình trong thư mục tạm; script UI xác minh workbook nằm trong fixture trước khi thao tác.
- Kiểm tra cú pháp Python/JavaScript và `git diff --check` đạt.
- Edge headless đã mở giao diện với tài nguyên bên ngoài bị chặn, chuyển tab, đổi theme và xác nhận lớp chờ biến mất; không có lỗi JavaScript. Ảnh màn hình chờ được lưu tại [docs/startup-preview.png](docs/startup-preview.png); ảnh kiểm tra bổ sung ở `build/screens/`.
- Bản điều chỉnh màn hình chờ đã được xem ở 1320×860 và 1024×680; nội dung hiển thị đúng ba phần: tên app, v2.0.2, “powered by” kèm logo. Logo không có nền/card/viền bao quanh. Phiên bản của màn hình chờ lấy từ `config.APP_VERSION` ở cả Desktop và Web.
- Logo mới đã được xác minh alpha trong suốt và đủ 7 kích thước ICO. Kiểm tra cửa sổ WebView2 ẩn đã nạp icon mới thực tế ở 32×32 px; icon `.exe` dùng cùng tài nguyên. Đã kiểm tra tài nguyên PE của `.exe` có đủ 7 kích thước; bản đóng gói mới đã phục vụ đúng PNG/ICO qua HTTP trong smoke test.
- PyWebView/WebView2 thật với cửa sổ ẩn và dữ liệu tạm đã chuyển từ màn hình chờ vào giao diện rồi đóng thành công.
- PyInstaller đã đóng gói **v2.0.2** thành công. Đã chạy trực tiếp file `.exe` với thư mục dữ liệu tạm: API báo đúng phiên bản, tài nguyên giao diện trả HTTP 200, đường dẫn Excel nằm trong thư mục cô lập. Bản xuất lại cũng đã xác nhận HTML màn hình chờ có “powered by”, không còn card/thanh chờ. Bản `.exe` v2.0.2 cũng đã chạy trực tiếp bộ UI hồi quy quét/lưu/ghi đè/upload/xóa preview/thư mục trống và đạt. Đây là kiểm tra khởi động/backend/tài nguyên và các luồng UI nêu trên; chưa kiểm thử toàn bộ thao tác giao diện hoặc mọi mẫu PDF/XML trên bản đóng gói, chưa đo thời gian khởi động toàn app.
- Bản bàn giao gồm `dist/v2.0.2/TrichXuatHoaDon.exe` và `dist/TrichXuatHoaDon-v2.0.2-Windows.zip`, kèm ghi chú [RELEASE_NOTES_v2.0.2.md](RELEASE_NOTES_v2.0.2.md). Nhánh bàn giao mã nguồn: `main` tại `origin` (`leminhtrietit/trichxuathoadon`). Chưa xuất bản GitHub Release v2.0.2; binary/ZIP không đưa vào Git.
- Màn hình chờ xuất hiện khi cửa sổ WebView được tạo. Bản `--onefile` vẫn giải nén trước thời điểm đó; chưa có splash ở bootloader.

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
  * Mỗi dòng tương ứng một hóa đơn với thông tin bên bán, bên mua, số tiền, ngày lập và tên thư mục NCC.
  * Kèm AutoFilter phục vụ lọc dữ liệu nhanh trong Excel.
* **Sheet 3: `ChiTietHangHoa`**:
  * Bóc tách chi tiết từng dòng hàng hóa/dịch vụ: Tên hàng, ĐVT, Số lượng, Đơn giá, Thành tiền, Thuế suất %, Tiền thuế.

### 4. Cơ Chế Chống Trùng Lặp Thông Minh
* Khóa hiện tại: `[Ký Hiệu] + [Số Hóa Đơn] + [Mã Số Thuế Bên Bán]`. Mẫu số chưa tham gia khóa; xem mục lỗi còn tồn đọng.
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

### Màn hình khởi động và giao diện offline

Ứng dụng Desktop hiển thị logo MinhTrietEras trong lúc nạp máy chủ và dữ liệu. Giao diện dùng CSS và icon đóng gói sẵn, không tải CDN khi mở app. Khi chạy bản `.exe`, cấu hình và Excel mặc định được lưu tại `%LOCALAPPDATA%\MinhTrietEras\TrichXuatHoaDon\data`; file Excel do người dùng chọn vẫn ở vị trí đã chọn.

Sau khi thay đổi các class giao diện, biên dịch lại CSS trước khi đóng gói:

```powershell
npx --yes tailwindcss@3.4.17 -c tailwind.config.cjs -i static/css/tailwind.input.css -o static/css/tailwind.css --minify
python -m unittest test_startup_performance -v
```

Kiểm tra UI cần Node.js tìm được package `playwright` và Microsoft Edge. Chạy `python tests/ui_fixture_server.py` ở terminal thứ nhất, rồi `node tests/scan_ui_regression.cjs` ở terminal thứ hai. Trong Codex có thể dùng package Playwright của runtime bundled qua `NODE_PATH`; không chạy kiểm tra này trên máy chủ ứng dụng chứa dữ liệu thật.

Chạy `build_exe.bat` để tạo `dist\v2.0.2\TrichXuatHoaDon.exe`. Node.js chỉ cần khi biên dịch CSS hoặc chạy kiểm tra UI; người sử dụng `.exe` không cần Node.js hoặc Python. Các kiểm tra mới dùng thư mục tạm để không thay đổi dữ liệu và cấu hình thật.

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
