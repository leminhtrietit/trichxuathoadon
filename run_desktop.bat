@echo off
chcp 65001 > nul
title Trích Xuất Hóa Đơn - Desktop App

:: Kiểm tra Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [LỖI] Máy tính chưa cài đặt Python!
    echo Vui lòng cài đặt Python hoặc sử dụng file .exe độc lập.
    pause
    exit /b
)

:: Khởi chạy Desktop App (Cửa sổ riêng)
python desktop_app.py
