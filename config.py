"""
config.py - Cấu hình hệ thống Trích xuất hóa đơn
Tác giả / Bản quyền: Lê Minh Triết (MinhTrietEras)
Website: https://leminhtriet.com
Bản quyền © 2026 MinhTrietEras. All rights reserved.
"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
os.makedirs(DATA_DIR, exist_ok=True)

# File Excel mặc định
DEFAULT_EXCEL_PATH = os.path.join(DATA_DIR, 'danh_sach_hoa_don.xlsx')

# Đường dẫn file mẫu ban đầu
SAMPLE_XML_PATH = r"C:\Users\minht\Downloads\348826-T01-2026.xml"

# Cổng chạy Web app
PORT = 5000
HOST = '127.0.0.1'
