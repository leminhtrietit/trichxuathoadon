# Kiểm tra hiệu năng và khởi động ứng dụng

Ngày kiểm tra: 07/10/2026. Phạm vi: mã nguồn Flask, PyWebView, đọc/ghi Excel, parser XML/PDF, giao diện và đóng gói Windows. Đây là kiểm tra mã nguồn kết hợp thử nghiệm có mục tiêu, chưa phải kiểm thử mọi mẫu hóa đơn của mọi nhà cung cấp.

## Những thay đổi đã hoàn thành

- Bổ sung v2.0.4: logo app được nhúng trong màn hình chờ; thiết lập lần đầu chọn output/màu và chấp nhận điều khoản, không tạo workbook trước lựa chọn. Sidebar thu gọn giữ icon và ghi nhớ. Cấu hình thay nguyên tử; cơ chế ghi Excel vẫn chưa có khóa/thay nguyên tử (mục tồn đọng). 17 test backend và ba bộ UI trên dữ liệu tạm đã đạt; cả ba bộ UI cũng đạt trên `.exe` v2.0.4, gồm thiết lập/đồng ý, ghi nhớ sidebar, quét/lưu và xem không thay đổi Excel.
- Bổ sung v2.0.3: thu gọn chọn màu/sidebar, thêm API chỉ đọc hóa đơn và sản phẩm đã lưu; không đọc sheet chi tiết trong khởi động mà chỉ khi người dùng mở xem. 12 test backend và hai bộ UI trên mã nguồn/bản `.exe` đều đạt; hash workbook giữ nguyên sau xem. Các bảng vẫn chưa phân trang.
- Bổ sung v2.0.2: đã tái hiện và sửa lỗi `null.classList` sau quét do tham chiếu tới thanh tác vụ HTML cũ; sửa trường tổng thanh toán trong popup và đếm mặt hàng về 0 khi preview trống. Kiểm tra UI với API thật và dữ liệu tạm đã đạt cho quét/lưu/ghi đè/upload/thư mục trống.

- Màn hình chờ tối giản theo yêu cầu mới: tên app lớn phía trên, phiên bản bên dưới, dòng “powered by” kèm logo ở phía dưới. Không có card, thanh chuyển động hoặc nội dung phụ; giữ nền xanh tím nhẹ. Màn hình Desktop tự chứa ảnh/CSS, hiển thị trước khi import Flask/parser/openpyxl; chuyển sang giao diện khi máy chủ sẵn sàng. Giao diện web giữ màn hình chờ đến khi các yêu cầu dữ liệu ban đầu kết thúc, có cơ chế bỏ lớp chờ sau 15 giây nếu yêu cầu bị treo. Không thêm thời gian chờ cố định.
- Dùng cổng do hệ điều hành cấp và bind ngay; bỏ dò cổng và vòng lặp đọc `/api/status` để chờ máy chủ.
- Bỏ việc mở workbook có sẵn ngay khi import app. Đọc tổng hợp bằng chế độ streaming, chỉ duyệt sheet tổng hợp; cache kết quả theo đường dẫn, kích thước và thời điểm thay đổi file. Cache có khóa cho các lượt đọc đồng thời, tự làm mới khi Excel được lưu hoặc sửa bên ngoài, và trả bản sao để tránh bên gọi sửa kết quả lưu trong cache.
- Tái sử dụng bộ định dạng số ở frontend.
- Biên dịch Tailwind thành CSS tĩnh; đưa Font Awesome vào gói ứng dụng; dùng font hệ thống để giao diện không phải tải tài nguyên CDN. Việc kiểm tra cập nhật vẫn có thể kết nối mạng. Phương pháp tạo CSS tĩnh theo [tài liệu Tailwind](https://v3.tailwindcss.com/docs/installation).
- Bản `.exe` dùng thư mục dữ liệu bền vững `%LOCALAPPDATA%\MinhTrietEras\TrichXuatHoaDon\data`, tránh lưu vào thư mục giải nén tạm `_MEIPASS`. Khi chọn workbook riêng trong Cài Đặt, ứng dụng vẫn dùng vị trí đó.
- Chặn việc tạo workbook trắng ghi đè lên file Excel hiện có nhưng không đọc được. Lưu trả lỗi thay vì thay file. Khi tải dữ liệu Excel gặp lỗi, giao diện hiện thông báo.
- Quét thư mục chỉ đánh dấu đã lưu sau khi thao tác lưu thành công.
- Loại các thư viện tùy chọn không dùng khỏi bản đóng gói: IPython, pandas, numpy, matplotlib, scipy. `build_exe.bat` xuất bản mới vào `dist`.

## Số đo trước và sau

Benchmark dùng workbook tổng hợp tự sinh, mỗi hóa đơn có 5 dòng hàng hóa. So sánh hàm đọc ở commit `5c90279` trước sửa với hàm hiện tại trên cùng file; đã đối chiếu toàn bộ dòng tổng hợp và thống kê để bảo đảm kết quả giống nhau. Mỗi cấu hình đo một lượt trên máy hiện tại; không coi đây là SLA hoặc thời gian mở toàn bộ app.

| Hóa đơn / dòng hàng hóa | Trước sửa | Sau sửa, đọc lần đầu | Sau sửa, file không đổi |
|---|---:|---:|---:|
| 1.000 / 5.000 | 2,716 giây | 0,722 giây | 0,055 giây |
| 10.000 / 50.000 | 20,111 giây | 7,745 giây | 0,091 giây |

Bản `.exe` cũ: 46.173.169 byte; bản v2.0.4: 27.204.728 byte, giảm khoảng 41%. Dung lượng này phụ thuộc môi trường đóng gói.

Chạy lại benchmark từ thư mục dự án: `python benchmarks/benchmark_summary.py`. Kết quả lưu ở `build/benchmark-results.json`.

## Các vấn đề còn cần sửa

P1: nên sửa sớm vì liên quan tính đúng đắn/dữ liệu hoặc thao tác lớn. P2: nên xử lý trong đợt cải tiến tiếp theo. Các mục dưới đây chưa được sửa trong đợt này.

| Ưu tiên | Vấn đề và bằng chứng | Hướng sửa |
|---|---|---|
| P1 | **Thuế dòng XML có thể sai.** `parser.py`, dòng lấy `vat_elem`, dùng `find('TThue') or find('VATAmount')`. Element chỉ chứa text được đánh giá là false, nên có thể bỏ qua giá trị thuế thật. Thử `<TThue>25</TThue>` cùng thành tiền 1.000, thuế suất 10% cho kết quả 100 thay vì 25. | Chọn element bằng kiểm tra `is not None`; rà soát mọi chuỗi `find(...) or ...`; bổ sung fixture cho thuế làm tròn và nhiều schema. |
| P1 | **Nội dung hóa đơn có thể được thực thi như HTML.** `static/js/app.js`, `renderExcelTable` và các bảng/modal, chèn tên người bán/tên hàng/tên file trực tiếp vào `innerHTML`. Thử tên người bán chứa thẻ ảnh với `onerror` đã chạy được một cờ JavaScript vô hại trong trình duyệt kiểm thử. | Dùng `textContent` cho dữ liệu, hoặc escape đúng cho text và thuộc tính; kiểm tra cả toast và modal. |
| P1 | **Ghi Excel chưa có khóa và thay file nguyên tử.** Các hàm lưu/khởi tạo/xóa gọi `wb.save(filepath)` trực tiếp; các yêu cầu Flask và nhiều phiên Desktop có thể cùng đọc rồi ghi một workbook. Phân tích mã cho thấy nguy cơ mất cập nhật hoặc file ghi dở khi bị ngắt; chưa tái hiện lỗi mất dữ liệu. | Khóa theo đường dẫn, có khóa giữa tiến trình; ghi file tạm cùng ổ rồi thay file nguyên tử; bổ sung bản sao phục hồi và thử lưu đồng thời. |
| P1 | **ZIP không giới hạn kích thước giải nén.** `/api/upload` chỉ giới hạn tổng HTTP upload 200 MB nhưng đọc toàn bộ từng entry bằng `sub_file.read()`, không giới hạn tổng byte giải nén/số entry. Chưa thử ZIP gây cạn bộ nhớ. | Kiểm tra kích thước từng entry và tổng giải nén trước khi đọc; giới hạn số file và lượng byte đọc thực tế. |
| P1 | **Bảng lớn vẫn render toàn bộ dòng.** `renderExcelTable` và bảng drill-down Pivot tạo DOM cho mọi hóa đơn, kể cả tab đang ẩn; tìm kiếm/lọc dựng lại bảng. Thời gian DOM với dữ liệu lớn chưa được benchmark riêng. | Phân trang hoặc render các dòng đang nhìn thấy; tải/render tab khi cần; debounce tìm kiếm, tổng hợp Pivot riêng. |
| P1 | **Bộ kiểm tra cũ có thể thay đổi dữ liệu thật.** `test_init_and_clear.py` tạo `self.test_excel` nhưng không gán nó làm workbook của app trước gọi API xóa; test API khởi tạo còn ghi lại cấu hình thật. `test_e2e.py` đổi theme thật và quét thư mục Downloads. Không chạy các bộ này trên dữ liệu người dùng. | Chuyển mọi test sang thư mục tạm; patch `current_excel_path`, `SETTINGS_FILE` và fixture mẫu; tránh phụ thuộc Downloads. Bộ kiểm tra mới đã làm theo cách này. |
| P2 | **Quét bỏ file mà không báo lý do.** `parser.py` bỏ qua file nhỏ hơn 500 byte hoặc lớn hơn 15 MB. Đã thử XML nhỏ: `total_files=1`, kết quả rỗng, `error_count=0`. | Trả danh sách file bị bỏ và lý do; cấu hình giới hạn thay vì ngưỡng cố định. |
| P2 | **Quét PDF/XML dài không có tiến độ hoặc hủy.** `scan_folder_for_invoices` parse tuần tự và API đợi toàn bộ kết quả. | Chạy thành tác vụ có tiến độ/hủy, xử lý theo lô; đo trước khi chọn số worker để tránh tăng bộ nhớ quá nhiều. |
| P2 | **Khóa chống trùng chưa gồm mẫu số như README mô tả.** Parser và Excel hiện dùng ký hiệu + số hóa đơn + MST. | Xác nhận quy tắc với dữ liệu thực; bổ sung mẫu số và cơ chế chuyển khóa tương thích workbook cũ. |

Thứ tự đề xuất: sửa thuế XML và escape dữ liệu giao diện; bảo vệ ghi Excel; giới hạn ZIP; phân trang bảng và thêm tiến độ quét.

## Xác minh và cách dùng bản mới

- 9/9 kiểm tra `python -m unittest test_startup_performance -v` đạt: cache, lượt đọc đồng thời, đổi file bên ngoài, save/clear, chống trùng/replace, file hỏng, workbook không có dimension metadata, API và tài nguyên màn hình chờ.
- Kiểm tra cú pháp Python, JavaScript và `git diff --check` đạt.
- Edge headless: chặn tài nguyên bên ngoài, mở giao diện, chờ lớp khởi động biến mất, chuyển tab và đổi theme; không có lỗi JavaScript. Đã xem ảnh màn hình chờ và giao diện để kiểm tra bố cục.
- PyWebView/WebView2 thật với cửa sổ kiểm thử ẩn và dữ liệu tạm: màn hình chờ chuyển được tới giao diện, dữ liệu tải xong và cửa sổ đóng được.
- PyInstaller đóng gói v2.0.2 thành công `dist/v2.0.2/TrichXuatHoaDon.exe`. Đã chạy trực tiếp bản đóng gói với dữ liệu tạm: API báo v2.0.2, tài nguyên HTML/CSS/JS/font trả HTTP 200 và workbook nằm trong thư mục cô lập. Bản `.exe` đã chạy trực tiếp UI hồi quy quét/lưu/ghi đè/upload/xóa preview/thư mục trống và đạt. Chưa đo thời gian khởi động hoặc kiểm thử toàn bộ các thao tác khác/mọi mẫu hóa đơn.

Mở **`dist/v2.0.4/TrichXuatHoaDon.exe`** để dùng bản mới. ZIP mới: `dist/TrichXuatHoaDon-v2.0.4-Windows.zip`. File `.exe` và ZIP v2.0.0 cũ ở thư mục gốc chưa được thay thế. Nếu workbook cũ không tự được chọn, chọn lại file đó trong Cài Đặt; không có bước chuyển dữ liệu tự động từ thư mục tạm của bản cũ.

Màn hình chờ hiện từ lúc cửa sổ WebView được tạo. Bản `--onefile` vẫn cần giải nén trước thời điểm này; muốn có logo ngay trong giai đoạn giải nén cần bổ sung splash ở bootloader hoặc chuyển sang bản `onedir`.

![Màn hình chờ](docs/startup-preview.png)
