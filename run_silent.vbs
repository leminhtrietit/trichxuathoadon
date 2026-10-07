Set WshShell = CreateObject("WScript.Shell")
' Khởi chạy Flask Server ở chế độ ngầm (không hiện cửa sổ đen CMD)
WshShell.Run "pythonw app.py", 0, False

' Chờ máy chủ khởi động 1.5 giây
WScript.Sleep 1500

' Tự động mở trình duyệt web mặc định
WshShell.Run "http://127.0.0.1:5000", 1, False
