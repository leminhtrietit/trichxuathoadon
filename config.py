"""
config.py - Cấu hình hệ thống Trích xuất hóa đơn
Tác giả / Bản quyền: Lê Minh Triết (MinhTrietEras)
Website: https://leminhtriet.com
Bản quyền © 2026 MinhTrietEras. All rights reserved.
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# PyInstaller giải nén mã nguồn vào thư mục tạm; dữ liệu phải ở nơi bền vững.
if getattr(sys, 'frozen', False):
    DATA_DIR = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')),
                            'MinhTrietEras', 'TrichXuatHoaDon', 'data')
else:
    DATA_DIR = os.path.join(BASE_DIR, 'data')
os.makedirs(DATA_DIR, exist_ok=True)

# File Excel mặc định
DEFAULT_EXCEL_PATH = os.path.join(DATA_DIR, 'danh_sach_hoa_don.xlsx')

# Đường dẫn file mẫu ban đầu
SAMPLE_XML_PATH = r"C:\Users\minht\Downloads\348826-T01-2026.xml"

# Thông tin Tác giả & Tracking Bản Quyền
APP_NAME = "Trích xuất hóa đơn"
APP_VERSION = "2.0.5"
AUTHOR = "Lê Minh Triết"
ORGANIZATION = "MinhTrietEras"
WEBSITE = "https://leminhtriet.com"
COPYRIGHT = "Copyright © 2026 Lê Minh Triết - MinhTrietEras. All rights reserved."
TRACKING_ID = "MTE-TXHD-2026-VN"

# Cổng chạy Web app
PORT = 5000
HOST = '127.0.0.1'
