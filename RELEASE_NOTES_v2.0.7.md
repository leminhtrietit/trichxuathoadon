# v2.0.7 — Nối góp ý với website Next.js

Ngày: 07/10/2026.

- Nút Gửi bật khi nội dung 10–4.000 ký tự, email tùy chọn hợp lệ và người dùng tích đồng ý. Không gửi khi mở/tích ô; chỉ kết nối khi bấm Gửi. Mở lại reset đồng ý; chưa gửi/lỗi giữ draft trong bộ nhớ phiên, không tự retry. Retry chủ động dùng cùng UUID; nhận xác nhận thành công mới xóa draft.
- Flask POST `/api/feedback` kiểm tra setup, Origin/loopback host, kiểu/độ dài/UUID/consent; thêm app_id và phiên bản từ server. Gọi HTTPS endpoint cố định, không proxy môi trường/cookie/file/redirect; giới hạn timeout/phản hồi và xác nhận đúng UUID. Không gửi dữ liệu hóa đơn/Excel/path hoặc khóa server.
- Điều khoản phiên bản `2026-10-07.1` bổ sung góp ý tùy chọn và dữ liệu kết nối; bản cũ hỏi chấp nhận lại một lần, giữ workbook/theme/path.
- Website `liquid-glass-portal` đã có mã nguồn API nhận, migration Supabase và trang quản trị chỉ admin `/admin/app-feedback`, trạng thái/ghi chú/phân trang. Nhánh website `codex/app-feedback`, commit `ee1a171`. **Chưa deploy/migration/secret/flag ở production**; gửi thật chưa được kiểm chứng và có thể trả lỗi tới khi website triển khai xong.
- 26 test backend, 5 bộ UI nguồn/exe đạt; website 6 test SQL/API/service/client, TypeScript/ESLint/build Cloudflare đạt. UI gửi dùng mock, không gửi góp ý thật. Xem README và docs/FEEDBACK_SETUP.md để tiếp tục triển khai.

Phân công cập nhật 07/10/2026: chỉ tiếp tục phía Windows; agent khác phụ trách website theo docs/WEB_AGENT_BRIEF.md. Lượt bàn giao này chỉ cập nhật tài liệu/ZIP, exe giữ nguyên.
