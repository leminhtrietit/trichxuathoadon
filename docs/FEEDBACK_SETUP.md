# Tích hợp góp ý vào leminhtriet.com

Trạng thái 07/10/2026 — v2.0.6: mới có giao diện bản nháp trên ứng dụng; chưa có route gửi, chưa cấu hình endpoint và chưa gửi dữ liệu. Chủ dự án chọn nhận trong trang quản trị leminhtriet.com. Chưa biết framework/backend hoặc có quyền truy cập mã nguồn website; không suy đoán endpoint đang tồn tại từ trang công khai.

## Kiến trúc đề xuất

Ứng dụng → Flask cục bộ → HTTPS API của website → cơ sở dữ liệu → trang quản trị có đăng nhập.

Đường dẫn đề xuất, CHƯA triển khai: `POST https://leminhtriet.com/api/app-feedback`.

Payload chỉ gồm:

```json
{
  "app_id": "trich-xuat-hoa-don",
  "app_version": "2.0.6",
  "message": "Nội dung góp ý",
  "email": "",
  "consent_version": "feedback-v1"
}
```

Website xác thực kiểu dữ liệu; message trim dài 10–4000 ký tự, email tùy chọn tối đa 254 ký tự và đúng định dạng. Giới hạn tổng request nhỏ (ví dụ 16 KB), chỉ nhận app_id hợp lệ. Thành công trả HTTP 201 với `{ "success": true, "id": "..." }` sau khi đã lưu; lỗi dùng 400/413/429/5xx. Giới hạn tần suất tại server và chống spam phù hợp; không coi khóa API được nhúng trong exe là bí mật.

Bảng đề xuất: id, app_id, app_version, message, email_nullable, consent_version, received_at_utc, status (new/reading/resolved), internal_note. Chỉ tài khoản quản trị được đọc/thay trạng thái; endpoint công khai chỉ cho tạo. Hiển thị message dưới dạng text đã escape, không render HTML người gửi. Định nghĩa thời hạn lưu/xóa và công khai nếu server ghi IP/log mạng. Không cần cấu hình SMTP vì nhận qua trang quản trị.

## Luồng ứng dụng khi API sẵn sàng

- Xem trước nơi nhận và những trường sẽ gửi; người dùng chủ động tích cho phép rồi bấm Gửi. Khi mở lại hộp, ô đồng ý trở về chưa tích. Không gộp vào điều khoản bắt buộc để sử dụng chức năng hóa đơn.
- Flask cục bộ gửi HTTPS với timeout và kiểm tra chứng chỉ; chỉ chấp nhận endpoint chính thức cấu hình sẵn, không nhận URL tùy ý từ trình duyệt. Không gửi cookie/đăng nhập, XML/PDF/Excel, đường dẫn máy hoặc thông tin hóa đơn tự động. Người dùng cần tránh đưa dữ liệu nhạy cảm vào lời góp ý.
- Không tự gửi nền, không tự gửi lại hoặc tạo hàng đợi ngầm. Lỗi mạng giữ nội dung để người dùng quyết định thử lại; chỉ báo thành công khi server xác nhận lưu. Dùng request id/idempotency khi triển khai để tránh lưu trùng nếu mất phản hồi.
- Python gọi server nên không cần mở CORS cho các cổng localhost thay đổi. CORS cũng không phải cơ chế chống spam hay xác thực API.
- Đây là đồng ý trong ứng dụng cho lần gửi; không phải hộp cấp quyền mạng toàn hệ thống Windows. Tính năng kiểm tra cập nhật hiện có kết nối mạng riêng.
- Cập nhật điều khoản/phiên bản điều khoản và chính sách website theo hành vi thật trước khi bật gửi. Kiểm thử đồng ý/không đồng ý, timeout, lỗi server, rate limit, trùng request, chống chèn HTML và xác minh không gửi file.

## Việc cần có để hoàn tất

Mã nguồn hoặc stack backend website và trang quản trị hiện có; migration bảng góp ý, route nhận POST và màn hình quản trị; triển khai HTTPS API, sau đó nối sender trong app. Nếu website tĩnh, cần backend/serverless và kho lưu riêng. Chưa triển khai phần website trong repository ứng dụng này.

Tham khảo: [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html), [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).
