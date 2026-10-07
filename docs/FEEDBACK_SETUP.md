# Tích hợp góp ý — leminhtriet.com

**Phân công mới nhất 07/10/2026:** phần Windows do agent này phụ trách; phần website do chủ dự án giao agent khác. Bản [WEB_AGENT_BRIEF.md](WEB_AGENT_BRIEF.md) là yêu cầu bàn giao tự chứa, gồm hợp đồng API bắt buộc và tiêu chí nhận. Nội dung bên dưới ghi lại mã tham khảo/tình trạng trước khi đổi phân công; không phải chỉ thị tiếp tục triển khai web trong chat Windows.

Thực trạng 07/10/2026, v2.0.7: mã nguồn gửi đã có trong app. Dự án Next.js `liquid-glass-portal` đã có API, migration Supabase và quản trị; push tại nhánh `codex/app-feedback` (commit `ee1a171`) của `leminhtrietit/leminhtriet`. **Chưa chạy migration DB thật/chưa cấu hình flag/secret/chưa deploy website và chưa gửi live.**

Luồng: người dùng đồng ý từng lần + bấm Gửi → Flask cục bộ → HTTPS `https://leminhtriet.com/api/app-feedback` → Supabase → `/admin/app-feedback` có đăng nhập admin. Không cần CORS cho cổng localhost hoặc SMTP. Gửi từ browser chỉ đến Flask cục bộ, endpoint website cố định do server app giữ, không cho chọn URL tùy ý.

## Những trường được gửi

```json
{
  "request_id": "d168d240-e454-45ee-b388-8a3b979eab99",
  "app_id": "trich-xuat-hoa-don",
  "app_version": "2.0.7",
  "message": "Nội dung góp ý",
  "email": "",
  "consent": true,
  "consent_version": "feedback-v1"
}
```

Không tự đính kèm hóa đơn/XML/PDF/Excel/đường dẫn/cookie. Người gửi cần tránh nhập nội dung nhạy cảm vào lời góp ý. Mã UUID giúp retry chủ động không lưu trùng; backend chỉ báo thành công khi response xác nhận đúng mã đã gửi. Không tự queue, không tự retry; lỗi giữ draft trong bộ nhớ phiên. Không coi ô đồng ý là cấp quyền Internet toàn Windows; updater có mạng riêng như trước.

## Việc cần triển khai ở website

1. Duyệt code và migration `supabase/migrations/20261007120000_add_app_feedback.sql`, backup/quy trình DB rồi áp dụng SQL qua migration của website. SQL tạo bảng mới/RPC; RLS không cho anon/authenticated đọc/gọi RPC. Service-role server đã có dùng cho route, không nhúng vào app hay NEXT_PUBLIC.
2. Server cần Secret `APP_FEEDBACK_RATE_SECRET` ngẫu nhiên >=32 ký tự và flag `APP_FEEDBACK_ENABLED=true`. Không commit/ghi secret vào tài liệu. Thiếu/tắt trả 503. Supabase URL/anon key và server service role hiện có vẫn cần đúng để xác thực/lưu thật.
3. Nhánh góp ý dựa trên nhánh LMS hiện tại và có nhiều thay đổi khác so với `origin/main`; trước rollout chỉ góp ý cần chọn baseline sản xuất đã xác minh và áp dụng riêng commit tính năng `ee1a171` (11 file). Không deploy toàn nhánh nếu các thay đổi khác chưa được duyệt. Duyệt checkout website trước deploy: hiện có công việc khác chưa commit; build tổng thể bao gồm các file đó. `npm run cf:build` đã thành công nhưng không tự deploy.
4. Sau khi được phép deploy, gửi một nội dung tổng hợp đã được cho phép, kiểm tra admin thấy đúng dòng, retry cùng UUID không tăng số dòng, trạng thái/ghi chú lưu được và không-admin bị chặn. Không tự gửi dữ liệu hóa đơn để thử.

Website giới hạn payload 16 KB, message 10–4.000 ký tự/email <=254. SQL counter giao dịch 5 góp ý mới/giờ theo HMAC IP và 500/giờ chung; chỉ tin địa chỉ incoming Cloudflare. Mã HMAC đổi theo giờ, bucket rate cũ >48h dọn khi có submission mới. Nội dung/email góp ý không có tự hết hạn: chủ website cần rà soát/xóa theo quy trình hỗ trợ và yêu cầu người gửi. Hạ tầng có thể có log kết nối riêng. Chưa kiểm tra tranh chấp nhiều kết nối DB thật hoặc browser đăng nhập admin thật; chưa xác nhận vận hành production.

Chi tiết triển khai, contract/error và giới hạn kiểm thử nằm ở `docs/APP_FEEDBACK.md` của repository website. App v2.0.7 đã cập nhật TERMS_OF_USE/terms.py (2026-10-07.1). Không cần cung cấp khóa SMTP hoặc mật khẩu quản trị cho app.
