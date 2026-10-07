@echo off
chcp 65001 > nul
title Dừng Hệ Thống Trích Xuất Hóa Đơn

echo ================================================================
echo   Đang dừng máy chủ Trích Xuất Hóa Đơn...
echo ================================================================

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [✓] Đã dừng toàn bộ tiến trình máy chủ thành công.
timeout /t 2 > nul
exit
