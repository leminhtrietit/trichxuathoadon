# Hướng dẫn làm việc trong dự án

- Đọc `README.md`, đặc biệt mục **Thực trạng dự án**, trước khi chỉnh sửa. Đọc `PERFORMANCE_AUDIT.md` khi xử lý các vấn đề đã ghi nhận.
- Theo yêu cầu của chủ dự án, luôn cập nhật `README.md` sau mỗi đợt thay đổi đáng kể, trước khi trả kết quả: ngày cập nhật, hành vi đã thay đổi, lỗi đã sửa/còn tồn đọng, kiểm thử thực sự đã chạy và giới hạn chưa xác minh, đường dẫn và tình trạng bản đóng gói nếu có.
- Giữ README phản ánh mã nguồn hiện tại. Không đánh dấu vấn đề đã sửa hoặc bản phát hành đã kiểm thử khi chưa có bằng chứng. Khi sửa lỗi, cập nhật hoặc bỏ mục tồn đọng tương ứng; đồng bộ mô tả tính năng để không mâu thuẫn với thực trạng.
- Báo cáo chuyên biệt có thể lưu bằng chứng chi tiết nhưng README phải chứa tóm tắt đủ để agent tiếp theo tiếp tục công việc. Không ghi dữ liệu hóa đơn, thông tin khách hàng hoặc bí mật vào tài liệu.
- Dùng thư mục tạm và cấu hình cô lập để kiểm thử thao tác lưu/xóa/khởi tạo Excel. Bộ `test_init_and_clear.py` và `test_e2e.py` hiện chưa an toàn để chạy trên dữ liệu thật; cô lập chúng trước khi sử dụng. Bộ `test_startup_performance.py` đã dùng thư mục tạm.
- Sau khi thay đổi class giao diện, biên dịch lại `static/css/tailwind.css` theo lệnh trong README. Nếu giao bản `.exe` mới, đóng gói lại để bản đó chứa các thay đổi cuối cùng và ghi rõ mức kiểm thử.
