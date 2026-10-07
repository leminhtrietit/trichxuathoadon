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

## Thực trạng dự án — v2.0.6, cập nhật 07/10/2026

**Quy tắc dành cho các agent:** đọc mục này và [AGENTS.md](AGENTS.md) trước khi làm việc. Sau mỗi đợt thay đổi đáng kể, cập nhật README ngay trong cùng đợt làm việc: phần đã hoàn thành, lỗi còn tồn đọng, kết quả kiểm thử và bản đóng gói. README là nơi tra cứu thực trạng hiện tại; báo cáo chi tiết không thay thế việc cập nhật README.

### Đã hoàn thành

- **v2.0.6 popup hóa đơn:** tiêu đề “Chi tiết hóa đơn”, bỏ nút in và phần chữ ký dưới cùng/trường Người ký trong bổ sung; giữ thông tin hóa đơn, sản phẩm và tiền thuế. Loại cả tham chiếu JS đến DOM chữ ký để không phát sinh lỗi null. Không sửa parser hoặc cơ chế ghi Excel.
- **Góp ý:** dấu `?` phía trên Cài đặt mở hộp soạn nội dung/email tùy chọn và ô đồng ý gửi qua Internet. Dùng được khi sidebar thu gọn, giữ focus bàn phím, đóng bằng Escape, reset đồng ý mỗi lần mở. Có sao chép bản nháp; bản nháp chỉ ở bộ nhớ phiên, không ghi Excel/cấu hình. **Chưa gửi được:** chưa có API nhận được xác minh, nút Gửi luôn khóa và thông báo rõ. Mở/soạn góp ý không tạo request mạng; kiểm tra cập nhật vẫn có mạng như trước.
- **Tích hợp website còn chờ:** chủ dự án chọn nhận qua trang quản trị `leminhtriet.com`. Cần mã nguồn/stack backend website để tạo API HTTPS, lưu DB và mục quản trị có đăng nhập; không cần SMTP. [Hướng dẫn tích hợp](docs/FEEDBACK_SETUP.md) có hợp đồng payload đề xuất và cách đồng ý từng lần; chưa triển khai website hoặc sender, chưa đổi điều khoản vì chưa có hành vi gửi mới. Chưa kiểm thử gửi thật hay quản trị website.

- **v2.0.5 thuế từng dòng:** XML ưu tiên `TThue`/`VATAmount`/`TaxAmount` khai báo, kể cả 0/số âm; bỏ lỗi truthiness của Element ở tiền thuế. Phân biệt trường tiền thuế mở rộng `TTin` với thuế suất. Nếu thiếu số tiền thuế, tính từ thành tiền và thuế suất số (gồm thập phân dấu chấm/phẩy), làm tròn 2 chữ số bằng Decimal; hỗ trợ các ký hiệu KCT/KKKNT. Không có đủ dữ liệu thì để trống và UI hiển thị “Chưa xác định”, không giả định thuế bằng 0.
- **PDF văn bản:** bỏ gán cứng 8%/thuế từng dòng 0. Tính khi đọc được thuế suất cuối dòng; dùng thuế suất chung chỉ khi tổng tiền hàng và tổng thuế đối chiếu khớp; một mặt hàng khớp toàn bộ tiền hàng có thể nhận tiền thuế tổng đã khai báo. Không tự phân bổ tổng thuế cho nhiều dòng thiếu thuế suất. Các thử nghiệm PDF mới dùng văn bản layout giả lập, chưa xác nhận mọi mẫu PDF thực tế.
- **Xem hóa đơn:** đã kiểm tra bấm trực tiếp vào từng dòng trong Danh sách để mở đúng hóa đơn, không cần nút riêng. Popup bỏ các khối “Thông tin sản phẩm 1, 2…” và Mã hàng/Tính chất/Tổng dòng phụ lặp lại dưới bảng; thông tin sản phẩm và tiền thuế vẫn nằm trong bảng.
- **Excel cũ:** chỉ bù tiền thuế/tổng dòng bị bỏ trống trong kết quả xem khi đủ dữ liệu, không ghi workbook và không sửa các số đã lưu (kể cả 0). Nếu dữ liệu cũ đã ghi sai từ parser trước, hãy quét/tải lại hóa đơn gốc rồi tự chọn ghi đè để cập nhật; mở xem không tự sửa Excel.


- **v2.0.4 màn hình chờ:** tên app → logo ứng dụng → phiên bản; phía dưới vẫn “powered by” kèm logo tác giả, không thêm card. Desktop nhúng cả hai logo để hiện trước khi Flask khởi động.
- **Thiết lập lần đầu:** chọn file Excel kết quả (vị trí + tên `.xlsx`) và 1 trong 8 màu; màu được xem trước, chưa ghi cấu hình khi chưa chấp nhận. Bấm “Chấp nhận và bắt đầu” sau khi tích đồng ý điều khoản mới hoàn tất. API kiểm tra đồng ý rõ ràng, đúng phiên bản điều khoản, màu và đường dẫn đầy đủ. File mới được tạo tại vị trí chọn; file sổ hóa đơn đã có chỉ được đọc để kiểm tra, không xóa/khởi tạo lại. File hỏng hoặc workbook không có sheet hóa đơn bị từ chối. Không tự tạo workbook mặc định trước thiết lập lần đầu.
- **Ghi nhớ trên máy:** `app_settings.json` giữ `setup_completed`, `accepted_terms_version`, `accepted_terms_at` (UTC), nơi lưu, màu và `sidebar_collapsed`. Chỉ đánh dấu xong khi ghi cấu hình thành công; cấu hình thay qua file tạm/nguyên tử. Khi mở lại không hỏi lần nữa; đổi phiên bản điều khoản sẽ yêu cầu xem/chấp nhận lại. Người dùng từ bản cũ được điền sẵn đường dẫn/màu đã dùng, hỏi một lần và giữ workbook cũ.
- **Điều khoản:** [TERMS_OF_USE.md](TERMS_OF_USE.md) mô tả mục đích app, quyền sử dụng theo MIT hiện có, xử lý tại máy/kết nối cập nhật, trách nhiệm đối chiếu/sao lưu và giới hạn bảo đảm theo pháp luật áp dụng. Nội dung UI lấy chung từ `terms.py` qua `templates/terms.html`; khi sửa nội dung, tăng `TERMS_VERSION` và đồng bộ tài liệu Markdown. Có nút xem lại trong Cài đặt. Chấp nhận không được gửi về tác giả.
- **Sidebar:** nút biểu tượng menu ở header thu gọn/mở rộng; dạng gọn rộng 76 px giữ icon, tooltip và nhãn trợ năng. Trạng thái lưu trong cấu hình, hoạt động sau mở lại. Popup thiết lập/điều khoản giữ focus bàn phím và vô hiệu hóa phần nền; Escape không bỏ qua bước đồng ý.


- **v2.0.3 giao diện:** sidebar theo thứ tự **Trích xuất hóa đơn → Tổng quan → Danh sách hóa đơn → Chi tiết hóa đơn**; Cài đặt vẫn ở cuối. Phần “Giao diện” trong Cài đặt dùng 8 nút màu nhỏ, bỏ tiêu đề lớn, mô tả dài và mã màu.
- **Xem hóa đơn chỉ đọc:** bấm dòng hóa đơn đã lưu (hoặc Enter/Space) để mở thông tin chung, bên bán/mua, sản phẩm, thuế, thanh toán và file nguồn. API GET `/api/invoice-details` đọc hai sheet bằng `read_only=True`, không khởi tạo/lưu Excel. Những trường workbook không lưu (điện thoại/email/chữ ký/tiền tệ...) không được suy đoán; dữ liệu vừa quét hiển thị các trường parser có phù hợp với popup. v2.0.6 bỏ hoàn toàn phần chữ ký; app không xác minh chữ ký số.
- **Chi tiết hóa đơn:** sản phẩm theo từng hóa đơn đã lưu và hóa đơn đang xem trước, gộp theo khóa hiện có để không hiện hai lần. Giữ số HĐ, ký hiệu, sản phẩm, ĐVT/số lượng và các khoản tiền/thuế; bỏ hai cột Người bán và Mã hàng chỉ trên giao diện. Cấu trúc và quy trình ghi 3 sheet Excel giữ nguyên.
- Escape dữ liệu ở bảng hóa đơn đã lưu, bảng sản phẩm và dòng hàng hóa/mã CQT trong popup; các vùng frontend khác vẫn cần xử lý theo mục tồn đọng bên dưới.


- **v2.0.2 sửa lỗi quét:** loại bỏ truy cập `upload-actions`/`save-count-badge` đã bị gỡ khỏi HTML, gây `Cannot read properties of null (reading classList)` và chặn mở popup. Luồng quét/upload/lưu đã chạy lại trên trình duyệt với dữ liệu tạm. Popup lấy tổng thanh toán từ `thanh_toan`, đếm mặt hàng trở về 0 khi bỏ toàn bộ preview.

- Logo ứng dụng riêng theo ý tưởng “hóa đơn → bảng dữ liệu”, xanh chàm/xanh ngọc, nền trong suốt, không có chữ. Master PNG: `static/images/app-logo.png`; icon Windows đa kích thước: `static/images/app-icon.ico` (16, 24, 32, 48, 64, 128, 256 px). Dùng cho favicon, sidebar, cửa sổ giới thiệu, icon `.exe` và cửa sổ/taskbar Desktop. Logo tác giả ở “powered by” vẫn là `static/images/logo.png`. Xem [thiết kế và prompt](docs/APP_LOGO.md).

- Màn hình chờ hiển thị tên app lớn phía trên, logo ứng dụng và phiên bản bên dưới, cùng dòng “powered by” kèm logo tác giả phía dưới; không có card, thanh chuyển động hay nội dung phụ. Nền xanh tím nhẹ được giữ lại. Desktop hiển thị màn hình chờ trước khi nạp Flask/parser/Excel; giao diện web bỏ lớp chờ sau khi các yêu cầu dữ liệu ban đầu kết thúc, có cơ chế thoát sau 15 giây nếu bị treo.
- Bỏ đọc Excel lúc import app nếu file đã tồn tại; đọc tổng hợp bằng streaming và cache theo thay đổi file. Các yêu cầu đọc đồng thời dùng chung kết quả; sửa file bên ngoài hoặc lưu/xóa dữ liệu làm cache cập nhật lại.
- Dùng cổng do hệ điều hành cấp cho Desktop, bỏ vòng lặp chờ bằng API thống kê. Tái sử dụng bộ định dạng số ở frontend.
- Đóng gói Tailwind CSS và Font Awesome tại máy, không tải CDN cho giao diện; dùng font hệ thống.
- Bản `.exe` lưu cấu hình và workbook mặc định vào `%LOCALAPPDATA%\MinhTrietEras\TrichXuatHoaDon\data`; đường dẫn Excel riêng vẫn do người dùng chọn. Chạy từ mã nguồn dùng thư mục `data` của dự án.
- Chặn ghi đè workbook hiện có nhưng không đọc được; thông báo lỗi đọc Excel trên giao diện. Quét thư mục chỉ đánh dấu đã lưu khi lưu thành công.
- Loại thư viện tùy chọn không dùng khỏi bản đóng gói; bản mới nằm ở **`dist/v2.0.6/TrichXuatHoaDon.exe`**. ZIP mới: `dist/TrichXuatHoaDon-v2.0.6-Windows.zip`. Các file `.exe`/ZIP v2.0.0 đến v2.0.5 vẫn là bản cũ; mở đúng bản v2.0.6 để dùng bản sửa lỗi; chưa có bước chuyển dữ liệu tự động từ bản cũ.

### Hiệu năng đã đo

Workbook tự sinh, mỗi hóa đơn có 5 dòng hàng hóa; mỗi cấu hình đo một lượt trên máy hiện tại. Đây là thời gian đọc tổng hợp Excel, chưa phải thời gian mở toàn bộ app.

| Hóa đơn / dòng hàng hóa | Trước tối ưu | Sau tối ưu, lần đầu | Đọc lại khi file không đổi |
|---|---:|---:|---:|
| 1.000 / 5.000 | 2,716 giây | 0,722 giây | 0,055 giây |
| 10.000 / 50.000 | 20,111 giây | 7,745 giây | 0,091 giây |

Bản `.exe` cũ khoảng **46,2 MB**, bản v2.0.6 khoảng **27,2 MB**. Chạy lại số đo bằng `python benchmarks/benchmark_summary.py`; kết quả xuất vào `build/benchmark-results.json`. Script cố định mốc trước tối ưu ở commit `5c90279`, giữ nguyên mốc so sánh sau khi commit các thay đổi mới.

### Lỗi và giới hạn chưa sửa

P1 là các mục nên sửa sớm. P2 là các cải tiến tiếp theo. Danh sách này phản ánh các vấn đề còn mở, không phải những tính năng đã hoàn thành.

| Ưu tiên | Vấn đề còn tồn đọng | Bằng chứng / bước tiếp theo |
|---|---|---|
| P1 | Dữ liệu hóa đơn được chèn trực tiếp vào `innerHTML`. | Đã tái hiện thực thi cờ JavaScript vô hại qua tên người bán. Escape dữ liệu hoặc dùng `textContent` ở bảng, modal, toast. |
| P1 | Ghi Excel chưa có khóa giữa các tiến trình và chưa thay file nguyên tử. | Nguy cơ mất cập nhật khi nhiều phiên lưu đồng thời hoặc file ghi dở khi bị ngắt; chưa tái hiện mất dữ liệu. Thêm khóa theo đường dẫn và ghi qua file tạm. |
| P1 | ZIP chưa giới hạn tổng byte giải nén và số entry. | Giới hạn HTTP upload 200 MB không giới hạn dung lượng sau giải nén. Kiểm tra kích thước và giới hạn byte đọc thực tế. |
| P1 | Các bảng vẫn dựng toàn bộ dòng, kể cả tab đang ẩn. | Cần phân trang/render theo vùng nhìn thấy và debounce tìm kiếm; chưa benchmark DOM với dữ liệu lớn. |
| P1 | Bộ test cũ có thể thay đổi dữ liệu/cấu hình thật. | `test_init_and_clear.py` chưa cô lập workbook của app; `test_e2e.py` dùng Downloads và đổi theme thật. Cô lập trước khi chạy. |
| P2 | Quét âm thầm bỏ file dưới 500 byte hoặc trên 15 MB. | Đã tái hiện `total_files=1`, kết quả rỗng, `error_count=0`. Trả lý do bỏ qua và cấu hình giới hạn. |
| P2 | Quét XML/PDF dài chưa có tiến độ hoặc hủy. | Parse tuần tự trong một yêu cầu. Chuyển thành tác vụ theo lô, có tiến độ/hủy. |
| P2 | Khóa chống trùng chưa gồm mẫu số. | Hiện dùng ký hiệu + số hóa đơn + MST. Xác nhận quy tắc và chuyển khóa tương thích workbook cũ. |

Parser XML vẫn có vài nhánh `find(...) or ...` ngoài tiền thuế, bộ test hiện phát cảnh báo Deprecation; các nhánh đó chưa được chuẩn hóa trong v2.0.5.

Ưu tiên tiếp theo: escape các vùng giao diện còn lại, bảo vệ ghi Excel, giới hạn ZIP, rồi phân trang bảng và tiến độ quét. Xem bằng chứng chi tiết trong [PERFORMANCE_AUDIT.md](PERFORMANCE_AUDIT.md).

### Phạm vi đã kiểm thử và tình trạng bản đóng gói

- **v2.0.6:** 23 test backend đạt. Cả 5 bộ UI (`onboarding_ui`, `scan_ui_regression`, `invoice_view_ui`, `line_tax_ui`, `feedback_ui`) đạt trên mã nguồn và bản `.exe` cuối với dữ liệu tạm: popup đúng tiêu đề, không nút in/DOM chữ ký, xem không đổi SHA-256 workbook; dấu ? nằm trên Cài đặt, dùng được khi thu gọn, đóng/khôi phục focus, reset đồng ý và không tạo request gửi góp ý. Kiểm tra màn hình chờ đúng v2.0.6 và logo nạp đầy đủ. Chưa có kiểm thử gửi thật vì chưa triển khai API.
- **Bàn giao hiện tại:** `dist/v2.0.6/TrichXuatHoaDon.exe` (27.207.043 byte), `dist/TrichXuatHoaDon-v2.0.6-Windows.zip`; manifest có SHA-256 và commit nguồn. Xem [ghi chú v2.0.6](RELEASE_NOTES_v2.0.6.md), [ảnh hộp góp ý](docs/feedback-preview.png) và [tích hợp website](docs/FEEDBACK_SETUP.md). Mã nguồn bàn giao nhánh `main` trên origin; chưa xuất bản GitHub Release v2.0.6, binary/ZIP không đưa vào Git.

- v2.0.5: 6 test thuế mới đạt, gồm các alias tiền thuế khai báo, 0/âm, trường mở rộng, 8%/10%/1,5%/KCT/KKKNT/thiếu dữ liệu, làm tròn và đọc Excel chỉ bù ô trống. PDF thử với layout text giả lập: thuế suất dòng, thuế suất chung đối chiếu khớp, một dòng với tổng thuế và nhiều dòng thiếu dữ liệu. Bộ UI `tests/line_tax_ui.cjs` dùng upload/lưu API thật trên workbook tạm, bấm cả 4 dòng hóa đơn để kiểm tra thuế khai báo/tính được/chưa xác định, không có khối sản phẩm phụ. Cả 4 bộ UI trên mã nguồn đã đạt; SHA-256 workbook giữ nguyên khi chỉ xem.


- v2.0.4: 5 test backend mới kiểm tra đồng ý/phiên bản điều khoản/màu/đường dẫn, ghi nhớ, nhận cấu hình cũ không đổi workbook, từ chối file hỏng và không đánh dấu hoàn tất khi ghi cấu hình thất bại. UI `tests/onboarding_ui.cjs` trên dữ liệu tạm đạt: lần đầu chưa tạo Excel, màu preview chưa lưu, hủy chọn file, đường dẫn lỗi, đồng ý rồi lưu đúng nơi chọn, mở lại không hỏi, thu gọn/mở rộng/điều hướng sidebar và xem lại điều khoản. Ba bộ UI quét/xem/thiết lập đều đạt trên mã nguồn. Ảnh minh họa: [thiết lập lần đầu](docs/first-run-preview.png) và [màn hình chờ](docs/startup-preview.png).


- v2.0.3: kiểm tra UI `tests/invoice_view_ui.cjs` trên Edge headless đạt: tên/thứ tự sidebar, bấm dòng và mở bằng bàn phím, dữ liệu bên bán/mua/sản phẩm/tổng tiền, sản phẩm đã lưu sau tải lại trang, bỏ đúng 2 cột, chọn màu gọn tại 1320×860 và 1024×680. Hash SHA-256 workbook trước/sau xem giống nhau và không phát sinh yêu cầu ghi/xóa/khởi tạo Excel. Ba test backend mới kiểm tra chỉ đọc, tách sản phẩm đúng MST khi cùng số HĐ/ký hiệu, header đảo thứ tự, workbook thiếu/hỏng không bị tạo/ghi lại.


- **23/23 test đạt:** `python -m unittest test_startup_performance tests.test_invoice_details tests.test_onboarding tests.test_line_tax -v`. Các test dùng thư mục tạm, kiểm tra cache, đọc đồng thời, sửa file bên ngoài, save/clear, chống trùng/replace, bảo toàn file hỏng, workbook thiếu dimension metadata, API và tài nguyên màn hình chờ.
- Kiểm tra UI bổ sung `tests/scan_ui_regression.cjs` trên Edge headless đạt: quét mới, tổng tiền đúng, lưu, quét trùng/ghi đè, upload, xóa preview, thư mục trống; không có lỗi JavaScript. Máy chủ fixture `tests/ui_fixture_server.py` cô lập toàn bộ file/cấu hình trong thư mục tạm; script UI xác minh workbook nằm trong fixture trước khi thao tác.
- Kiểm tra cú pháp Python/JavaScript và `git diff --check` đạt.
- Edge headless đã mở giao diện với tài nguyên bên ngoài bị chặn, chuyển tab, đổi theme và xác nhận lớp chờ biến mất; không có lỗi JavaScript. Ảnh màn hình chờ được lưu tại [docs/startup-preview.png](docs/startup-preview.png); ảnh kiểm tra bổ sung ở `build/screens/`.
- Bản điều chỉnh màn hình chờ đã được xem ở 1320×860 và 1024×680; nội dung hiển thị đúng tên app, logo ứng dụng, v2.0.5, “powered by” kèm logo tác giả. Logo không có nền/card/viền bao quanh. Phiên bản của màn hình chờ lấy từ `config.APP_VERSION` ở cả Desktop và Web.
- Logo mới đã được xác minh alpha trong suốt và đủ 7 kích thước ICO. Kiểm tra cửa sổ WebView2 ẩn đã nạp icon mới thực tế ở 32×32 px; icon `.exe` dùng cùng tài nguyên. Đã kiểm tra tài nguyên PE của `.exe` có đủ 7 kích thước; bản đóng gói mới đã phục vụ đúng PNG/ICO qua HTTP trong smoke test.
- PyWebView/WebView2 thật với cửa sổ ẩn và dữ liệu tạm đã chuyển từ màn hình chờ vào giao diện rồi đóng thành công.
- PyInstaller đã đóng gói **v2.0.2** thành công. Đã chạy trực tiếp file `.exe` với thư mục dữ liệu tạm: API báo đúng phiên bản, tài nguyên giao diện trả HTTP 200, đường dẫn Excel nằm trong thư mục cô lập. Bản xuất lại cũng đã xác nhận HTML màn hình chờ có “powered by”, không còn card/thanh chờ. Bản `.exe` v2.0.2 cũng đã chạy trực tiếp bộ UI hồi quy quét/lưu/ghi đè/upload/xóa preview/thư mục trống và đạt. Đây là kiểm tra khởi động/backend/tài nguyên và các luồng UI nêu trên; chưa kiểm thử toàn bộ thao tác giao diện hoặc mọi mẫu PDF/XML trên bản đóng gói, chưa đo thời gian khởi động toàn app.
- PyInstaller v2.0.3 đã đóng gói thành công, `.exe` 27.195.682 byte. Đã chạy trực tiếp bản mới với `%LOCALAPPDATA%` tạm, xác minh phiên bản/tài nguyên giao diện/cấu hình cô lập, rồi chạy cả `scan_ui_regression.cjs` và `invoice_view_ui.cjs` trên backend của `.exe`: tất cả đạt; SHA-256 workbook giữ nguyên khi xem hóa đơn. Chưa kiểm thử mọi mẫu PDF/XML hoặc toàn bộ thao tác ứng dụng.
- PyInstaller v2.0.4 đã đóng gói thành công, `.exe` 27.204.728 byte. Đã chạy trực tiếp bản cuối với `%LOCALAPPDATA%` tạm: API đúng phiên bản, tài nguyên đầy đủ, cả ba bộ UI thiết lập/quét/xem đều đạt; có kiểm tra focus sau chấp nhận và vòng Tab trong popup. Bản đóng gói xác nhận lần đầu chưa tự tạo Excel, cấu hình và chấp nhận được nhớ, sidebar dùng được sau mở lại; workbook giữ nguyên SHA-256 khi chỉ xem. Chưa kiểm thử mọi mẫu hóa đơn, mọi thao tác hoặc đo thời gian khởi động toàn app.
- PyInstaller v2.0.5 đã đóng gói thành công, `.exe` 27.207.843 byte. Đã chạy trực tiếp bản cuối với dữ liệu tạm: phiên bản và tài nguyên đúng, cả 4 bộ UI thiết lập/quét/xem/thuế đều đạt. Bấm cả 4 dòng mở đúng hóa đơn; thuế khai báo 25 được giữ, thuế suất 1,5% cho 15 trên tiền hàng 1.000, thiếu dữ liệu hiển thị chưa xác định. Không có các khối “Thông tin sản phẩm”/“Tính chất” phụ; workbook giữ nguyên SHA-256 sau xem. Chưa kiểm thử các mẫu PDF thực tế bổ sung hoặc mọi thao tác của app.
- Bản bàn giao gồm `dist/v2.0.5/TrichXuatHoaDon.exe` và `dist/TrichXuatHoaDon-v2.0.5-Windows.zip`, kèm ghi chú [RELEASE_NOTES_v2.0.5.md](RELEASE_NOTES_v2.0.5.md). Nhánh bàn giao mã nguồn: `main` tại `origin` (`leminhtrietit/trichxuathoadon`). Chưa xuất bản GitHub Release v2.0.5; binary/ZIP không đưa vào Git.
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

Ứng dụng Desktop hiển thị logo app và logo tác giả trong lúc nạp máy chủ và dữ liệu. Lần đầu dùng, chọn nơi lưu Excel, màu và chấp nhận điều khoản; những lần sau bỏ qua bước này. Nút menu trên header cho phép thu gọn sidebar. Giao diện dùng CSS và icon đóng gói sẵn, không tải CDN khi mở app. Khi chạy bản `.exe`, cấu hình và Excel mặc định được lưu tại `%LOCALAPPDATA%\MinhTrietEras\TrichXuatHoaDon\data`; file Excel do người dùng chọn vẫn ở vị trí đã chọn.

Sau khi thay đổi các class giao diện, biên dịch lại CSS trước khi đóng gói:

```powershell
npx --yes tailwindcss@3.4.17 -c tailwind.config.cjs -i static/css/tailwind.input.css -o static/css/tailwind.css --minify
python -m unittest test_startup_performance tests.test_invoice_details tests.test_onboarding tests.test_line_tax -v
```

Kiểm tra UI cần Node.js tìm được package `playwright` và Microsoft Edge. Chạy `python tests/ui_fixture_server.py` ở terminal thứ nhất, rồi lần lượt `node tests/onboarding_ui.cjs`, `node tests/scan_ui_regression.cjs`, `node tests/invoice_view_ui.cjs` và `node tests/line_tax_ui.cjs` ở terminal thứ hai. Trong Codex có thể dùng package Playwright của runtime bundled qua `NODE_PATH`; không chạy kiểm tra này trên máy chủ ứng dụng chứa dữ liệu thật. Mỗi đợt chạy cả bộ cần khởi động một máy chủ fixture mới vì các kiểm tra có tạo dữ liệu tạm.

Chạy `build_exe.bat` để tạo `dist\v2.0.5\TrichXuatHoaDon.exe`. Node.js chỉ cần khi biên dịch CSS hoặc chạy kiểm tra UI; người sử dụng `.exe` không cần Node.js hoặc Python. Các kiểm tra mới dùng thư mục tạm để không thay đổi dữ liệu và cấu hình thật.

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
