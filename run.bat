@echo off
chcp 65001 > nul
title Hệ Thống Trích Xuất Hóa Đơn Điện Tử XML Sang Excel

echo ================================================================
echo   HỆ THỐNG TRÍCH XUẤT HÓA ĐƠN ĐIỆN TỬ XML SANG FILE EXCEL
echo   Khởi chạy máy chủ cục bộ (Local Server)
echo ================================================================
echo.

:: Kiểm tra Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [LỖI] Máy tính chưa cài đặt Python hoặc chưa thêm Python vào biến môi trường PATH!
    echo Vui lòng cài đặt Python từ https://www.python.org/
    pause
    exit /b
)

:: Kiểm tra và cài đặt thư viện cần thiết
echo [1/3] Đang kiểm tra thư viện...
python -m pip install -r requirements.txt --quiet --no-warn-script-location

echo [2/3] Đang khởi động trình duyệt...
timeout /t 2 /nobreak > nul
start http://127.0.0.1:5000

echo [3/3] Đang chạy Web App tại http://127.0.0.1:5000 ...
echo (Nhấn Ctrl+C để dừng máy chủ khi không sử dụng)
echo.
python app.py

pause
