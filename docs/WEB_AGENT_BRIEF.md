# Yêu cầu cho agent phụ trách website: nhận góp ý từ app Windows

Chủ dự án giao phần website cho agent khác; agent trong repository Trích xuất hóa đơn chỉ phụ trách app Windows. Không cần agent Windows tiếp tục sửa/deploy website.

## Nhiệm vụ

Làm phần nhận và quản lý góp ý trên website Next.js `leminhtriet.com`, dự án tại `C:\Users\minht\.gemini\antigravity\scratch\liquid-glass-portal`. App Windows v2.0.8 đã có chức năng gửi, đồng ý kết nối Internet từng lần, giữ bản nháp khi lỗi và thử lại chủ động bằng cùng request UUID. Hãy triển khai API tương thích hợp đồng dưới đây để không phải sửa/đóng gói app lại.

## Hợp đồng API bắt buộc

Endpoint chính xác: `POST https://leminhtriet.com/api/app-feedback`.

- Nhận `Content-Type: application/json`; nhận POST trực tiếp tại HTTPS endpoint, không redirect sang đường dẫn/domain khác. App chặn mọi redirect.
- Không yêu cầu người gửi đăng nhập website, cookie hoặc API key. Không nhúng khóa quản trị/service-role vào exe. Chống spam/giới hạn gửi phải thực hiện phía server.
- Payload thực tế (ví dụ):

```json
{
  "request_id": "d168d240-e454-45ee-b388-8a3b979eab99",
  "app_id": "trich-xuat-hoa-don",
  "app_version": "2.0.8",
  "message": "Tôi muốn cải thiện chức năng tìm hóa đơn",
  "email": "",
  "consent": true,
  "consent_version": "feedback-v1"
}
```

- `request_id`: UUID v4 do app tạo; dùng làm khóa idempotency. Cùng UUID và cùng nội dung gửi lại phải trả thành công mà không tạo thêm bản ghi. Cùng UUID với nội dung khác trả HTTP 409. Xử lý đúng cả khi nhiều request đến đồng thời.
- `app_id`: chỉ nhận `trich-xuat-hoa-don`. `app_version`: phiên bản app, ví dụ `2.0.8`; không khóa cứng chỉ một bản, phải tiếp tục nhận các phiên bản sau tương thích.
- `message`: Unicode, trim, 10–4.000 ký tự; `email`: tùy chọn, app gửi chuỗi rỗng nếu không cung cấp, tối đa 254 ký tự và kiểm tra định dạng nếu có.
- Bắt buộc `consent === true` và `consent_version === "feedback-v1"`; từ chối nếu thiếu/sai. Chỉ nhận các trường trên; không nhận hóa đơn/file/Excel/path bổ sung. Giới hạn body thực đọc 16 KB, không chỉ tin Content-Length.
- Sau khi dữ liệu đã được lưu bền vững, trả HTTP 201 (lần đầu) hoặc 200 (lần gửi lại) với JSON <=16 KB:

```json
{
  "success": true,
  "id": "d168d240-e454-45ee-b388-8a3b979eab99",
  "replayed": false
}
```

`id` phải bằng chính `request_id` nhận vào; đây là điều kiện app xác nhận thành công. Nếu DB dùng mã nội bộ khác, vẫn trả request UUID trong `id`. Lần lặp lại đặt `replayed:true`. Không trả nội dung người gửi/email/ghi chú quản trị trong API công khai. Không báo thành công trước khi lưu DB xong.

Lỗi trả `{"success":false,"error":"Thông báo ngắn"}` với 400 (dữ liệu), 409 (UUID khác nội dung), 413 (quá lớn), 415 (sai content type), 429 (giới hạn), 503 (chưa cấu hình/tạm không lưu được). Có thể dùng Retry-After cho 429. App xử lý riêng 409/429; các lỗi khác giữ bản nháp và báo website chưa nhận được. Phản hồi nên nhanh; app có connect/read timeout 5/10 giây và UI chờ xác nhận tối đa 25 giây, không tự retry.

## Quản trị và lưu trữ

Chủ dự án chọn nhận tại trang quản trị, không nhận qua email; không cần SMTP.

- Thêm mục “Góp ý ứng dụng” trong quản trị; chỉ admin đã được server xác thực mới đọc/cập nhật. Không tin role/user-id do client tự gửi. Dùng cơ chế phiên/quyền hiện có của website.
- Hiển thị nội dung, email nếu có, phiên bản app, thời gian nhận; lọc/phân trang, trạng thái Mới/Đang xử lý/Đã xử lý/Đã đóng và ghi chú nội bộ. Render nội dung người gửi thành text, không HTML.
- Lưu request UUID, hash payload để phát hiện conflict, app_id/version, message/email, consent_version, thời gian nhận và trạng thái/ghi chú. Mục quản trị và bảng dữ liệu không được đọc công khai.
- Giới hạn gửi ở server/DB hoạt động trên nhiều instance. Có thể kế thừa mẫu 5 góp ý mới/giờ theo HMAC địa chỉ kết nối và 500/giờ toàn app; cấu hình theo thực tế, không lưu raw IP không cần thiết. Nếu chạy Cloudflare chỉ tin địa chỉ do Cloudflare cung cấp, không tin forwarded header tùy ý. Bổ sung chống spam tại edge nếu cần.
- Công khai dữ liệu thực nhận và mục đích; xác định quy trình lưu/xóa góp ý và xử lý yêu cầu người gửi. App đã thông báo website có thông tin kết nối/chống spam; không được tự mở rộng thu thập sang hóa đơn/file máy người dùng.
- Request đến từ Python/Flask trên máy người dùng, không phải browser gọi chéo origin. Không cần mở wildcard CORS hay thêm bí mật vào app.

## Mã tham khảo đã có — chưa triển khai live

Lượt làm việc trước đã tạo commit tính năng web `ee1a171` (11 file) trên repository `leminhtrietit/leminhtriet`, nhánh `codex/app-feedback`; các commit sau cập nhật tài liệu. Có route public/admin, trang quản trị và migration `supabase/migrations/20261007120000_add_app_feedback.sql`. Agent web có thể đọc/kế thừa hoặc thay thế, miễn giữ hợp đồng API trên.

Nhánh này dựa trên `codex/lms-authoring-performance`, chứa nhiều thay đổi khác so với main. Không merge/deploy toàn nhánh chỉ để thêm góp ý. Chọn baseline sản xuất đã xác minh và áp dụng riêng các thay đổi phù hợp; giữ nguyên công việc khác chưa commit trong checkout. Đọc AGENTS.md/README của website và docs/APP_FEEDBACK.md trước khi làm.

Nếu dùng nguyên mã tham khảo Supabase: cần chạy migration mới, cấu hình server `APP_FEEDBACK_ENABLED=true` và Secret `APP_FEEDBACK_RATE_SECRET` ngẫu nhiên >=32 ký tự, cùng cấu hình Supabase/service-role hiện có. Các tên biến này là chi tiết mẫu web; app Windows không phụ thuộc lựa chọn DB hoặc tên biến môi trường của website. Chưa áp dụng migration, cấu hình secret/flag hoặc deploy production trong lượt làm việc Windows.

## Tiêu chí bàn giao

1. Kiểm thử payload/consent thiếu/sai, giới hạn body thực đọc, server không có cấu hình, DB lỗi, rate limit và lỗi HTML/XSS.
2. Kiểm thử UUID lặp lại cùng payload chỉ lưu một dòng, UUID khác payload 409 và tranh chấp gửi đồng thời.
3. Admin thật xem/cập nhật trạng thái/ghi chú được; chưa đăng nhập hoặc không-admin bị chặn, API public không đọc được dữ liệu.
4. Endpoint HTTPS đúng URL không redirect, phản hồi xác nhận đúng UUID; kiểm thử bằng nội dung tổng hợp được phép, không dùng hóa đơn thật.
5. Cập nhật README website với migration/cấu hình/test/deploy thực tế, gửi lại URL endpoint đã hoạt động và kết quả kiểm tra cho chủ dự án. Chưa deploy thì ghi rõ chưa deploy; không đánh dấu đã tích hợp live chỉ vì build thành công.

Phía app đã kiểm tra: 29 test backend và 6 bộ UI trên nguồn/exe v2.0.8 đạt; luồng gửi dùng boundary/mock để không gửi dữ liệu ra production. Chưa có kiểm thử nhận live. Không tự liên hệ/gửi thông điệp cho agent Windows hoặc agent khác nếu chủ dự án chưa cho phép.

Cập nhật phía Windows v2.0.8: mặc định không tự kiểm tra cập nhật qua Internet; tùy chọn tự kiểm tra mặc định tắt. Không thay schema/endpoint góp ý; agent web phải nhận app_version mới theo hợp đồng.
