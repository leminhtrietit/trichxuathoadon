"""
desktop_app.py - Khởi chạy ứng dụng Trích xuất hóa đơn dưới dạng Desktop App độc lập
Sử dụng PyWebView (Microsoft Edge WebView2) tạo cửa sổ ứng dụng Windows chuẩn

Tác giả / Bản quyền: Lê Minh Triết (MinhTrietEras)
Website: https://leminhtriet.com
Bản quyền © 2026 MinhTrietEras. All rights reserved.
"""

import os
import sys
import threading
import time
import socket
import logging

# Đảm bảo mã hóa UTF-8 cho Windows console
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Tắt bớt log không cần thiết của werkzeug trong môi trường desktop
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

import webview
from app import app
import config

def find_available_port(start_port=5000):
    """Tìm cổng TCP còn trống trên 127.0.0.1 để tránh xung đột cổng"""
    for p in range(start_port, start_port + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', p)) != 0:
                return p
    return start_port

def start_flask_server(port):
    """Khởi động máy chủ Flask trong luồng daemon ngầm"""
    try:
        app.run(
            host=config.HOST,
            port=port,
            debug=False,
            use_reloader=False,
            threaded=True
        )
    except Exception as e:
        print(f"Lỗi khởi động Flask: {e}")

def main():
    # 1. Chọn cổng khả dụng và khởi động Flask Server riêng cho phiên làm việc
    active_port = find_available_port(config.PORT)
    flask_thread = threading.Thread(target=start_flask_server, args=(active_port,), daemon=True)
    flask_thread.start()

    target_url = f"http://{config.HOST}:{active_port}"

    # Chờ tối đa 5 giây cho tới khi server phản hồi HTTP thực tế
    import urllib.request
    for _ in range(50):
        try:
            with urllib.request.urlopen(f"{target_url}/api/status", timeout=0.5) as res:
                if res.status == 200:
                    break
        except Exception:
            time.sleep(0.1)

    # 2. Tạo cửa sổ Desktop chuẩn bằng PyWebView
    window = webview.create_window(
        title='Trích xuất hóa đơn - MinhTrietEras',
        url=target_url,
        width=1320,
        height=860,
        min_size=(1024, 680),
        resizable=True,
        text_select=True,
        confirm_close=False
    )

    # 3. Khởi chạy vòng lặp sự kiện Desktop GUI (chặn cho tới khi người dùng đóng cửa sổ)
    webview.start()

    # 4. Khi đóng cửa sổ, tiến trình chính kết thúc, luồng Flask daemon tự động thoát
    sys.exit(0)

if __name__ == '__main__':
    main()
