# v2.0.8 — Cập nhật theo lựa chọn của người dùng

Ngày: 07/10/2026.

- Bỏ tự kiểm tra GitHub sau mở app. Mặc định và cấu hình cũ chưa có lựa chọn chỉ kiểm tra khi bấm nút.
- Trong Cài đặt có “Tự kiểm tra cập nhật khi mở app”, mặc định tắt; người dùng bật mới kiểm tra ở lần mở app tiếp theo. Không tự tải/cài cập nhật. Lựa chọn lưu tại máy, giữ qua đổi theme/sidebar; API chỉ chấp nhận boolean, lưu lỗi không báo thành công và checkbox quay lại trạng thái cũ.
- Điều khoản phiên bản 2026-10-07.2 cập nhật đúng hành vi mạng; xem/chấp nhận lại một lần, giữ workbook/path/theme.
- Góp ý vẫn chỉ gửi sau đồng ý + click, không tự đính kèm dữ liệu hóa đơn; endpoint/schema không đổi, app_version là 2.0.8. Phần website giao agent khác theo docs/WEB_AGENT_BRIEF.md; nhận live vẫn chưa được xác minh.
- Kiểm thử và bản xuất cuối xem README. Không đo lưu lượng mạng toàn Windows/WebView, chỉ kiểm chứng luồng yêu cầu của ứng dụng và UI.
