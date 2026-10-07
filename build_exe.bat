@echo off
chcp 65001 > nul
title Đóng gói ứng dụng Desktop - TrichXuatHoaDon.exe

echo ================================================================
echo   ĐANG ĐÓNG GÓI ỨNG DỤNG THÀNH FILE .EXE ĐỘC LẬP (PYWEBVIEW)
echo   Vui lòng chờ 1-2 phút để PyInstaller nén toàn bộ hệ thống...
echo ================================================================
echo.

python -m PyInstaller ^
    --name "TrichXuatHoaDon" ^
    --onefile ^
    --noconsole ^
    --icon "logo.ico" ^
    --add-data "templates;templates" ^
    --add-data "static;static" ^
    --hidden-import "openpyxl" ^
    --hidden-import "pypdf" ^
    --hidden-import "webview" ^
    --hidden-import "clr" ^
    --hidden-import "pythonnet" ^
    --exclude-module "IPython" ^
    --exclude-module "pandas" ^
    --exclude-module "numpy" ^
    --exclude-module "matplotlib" ^
    --exclude-module "scipy" ^
    --clean ^
    --distpath "dist" ^
    desktop_app.py

if errorlevel 1 (
    echo.
    echo [LỖI] Quá trình đóng gói gặp sự cố!
    pause
    exit /b
)

echo.
echo ================================================================
echo   [THÀNH CÔNG] ĐÃ TẠO FILE: dist\TrichXuatHoaDon.exe
echo   File chạy độc lập hoàn toàn, không cần cài đặt Python.
echo ================================================================
pause
