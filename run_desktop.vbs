Set WshShell = CreateObject("WScript.Shell")
' Khởi chạy ứng dụng Desktop trực tiếp bằng pythonw (không hiện màn hình đen CMD)
WshShell.Run "pythonw desktop_app.py", 0, False
