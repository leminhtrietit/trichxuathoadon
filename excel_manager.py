"""
excel_manager.py - Module quản lý tạo, đọc, ghi và cập nhật file Excel lưu trữ hóa đơn điện tử
Tác giả / Bản quyền: Lê Minh Triết (MinhTrietEras)
Website: https://leminhtriet.com
Bản quyền © 2026 MinhTrietEras. All rights reserved.

Cấu trúc chuẩn 3 Sheet:
  - Sheet 1: 'TongQuan' - Báo cáo tổng quan, Pivot tổng hợp theo từng Nhà Cung Cấp và theo Tháng có bộ lọc
  - Sheet 2: 'TongHopHoaDon' - Danh sách chi tiết từng hóa đơn kèm Thư mục NCC, có AutoFilter
  - Sheet 3: 'ChiTietHangHoa' - Chi tiết từng dòng hàng hóa, dịch vụ, có AutoFilter
  - Kiểm tra trùng lặp nghiêm ngặt: Replace (thay thế không tăng dòng) hoặc Skip (bỏ qua)
"""

import os
from copy import deepcopy
from threading import RLock
import openpyxl
from invoice_tax import calculate_line_tax
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime

def to_float(val, default=0.0):
    """Chuyển đổi giá trị sang float an toàn, không sợ lỗi chuỗi"""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).replace(',', '').strip())
    except (ValueError, TypeError):
        return default

def get_col_map(ws):
    """Lấy bản đồ tên cột -> số cột để chống lỗi lệch cột"""
    headers = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), ())
    return {str(value or '').strip(): c for c, value in enumerate(headers, start=1)}

# Màu sắc và kiểu dáng định dạng Excel chuyên nghiệp (Tone Hồng / Rose thanh lịch)
COLOR_TITLE = "831843"         # Đỏ vang đậm sang trọng
COLOR_HEADER_MAIN = "9D174D"   # Hồng mận quý phái
COLOR_HEADER_SUB = "BE185D"    # Hồng đậm
COLOR_KPI_BG = "FFF1F2"        # Hồng phấn nhạt cho thẻ KPI
COLOR_BORDER = "FECDD3"        # Viền hồng nhạt
COLOR_ZEBRA = "FFF5F7"         # Nền dòng so le

HEADER_FILL_TITLE = PatternFill(start_color=COLOR_TITLE, end_color=COLOR_TITLE, fill_type="solid")
HEADER_FILL_MAIN = PatternFill(start_color=COLOR_HEADER_MAIN, end_color=COLOR_HEADER_MAIN, fill_type="solid")
HEADER_FILL_SUB = PatternFill(start_color=COLOR_HEADER_SUB, end_color=COLOR_HEADER_SUB, fill_type="solid")
KPI_FILL = PatternFill(start_color=COLOR_KPI_BG, end_color=COLOR_KPI_BG, fill_type="solid")
TOTAL_FILL = PatternFill(start_color="FCE7F3", end_color="FCE7F3", fill_type="solid")

HEADER_FONT = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
TITLE_FONT = Font(name="Segoe UI", size=13, bold=True, color="FFFFFF")
SECTION_FONT = Font(name="Segoe UI", size=11, bold=True, color="831843")
KPI_TITLE_FONT = Font(name="Segoe UI", size=9, bold=True, color="9F1239")
KPI_VAL_FONT = Font(name="Segoe UI", size=13, bold=True, color="831843")
DATA_FONT = Font(name="Segoe UI", size=10)
BOLD_FONT = Font(name="Segoe UI", size=10, bold=True)

THIN_BORDER = Border(
    left=Side(style='thin', color='E2E8F0'),
    right=Side(style='thin', color='E2E8F0'),
    top=Side(style='thin', color='E2E8F0'),
    bottom=Side(style='thin', color='E2E8F0')
)

KPI_BORDER = Border(
    left=Side(style='medium', color=COLOR_BORDER),
    right=Side(style='medium', color=COLOR_BORDER),
    top=Side(style='medium', color=COLOR_BORDER),
    bottom=Side(style='medium', color=COLOR_BORDER)
)

TOTAL_BORDER = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='double', color='831843')
)

ALIGN_LEFT = Alignment(horizontal='left', vertical='center')
ALIGN_RIGHT = Alignment(horizontal='right', vertical='center')
ALIGN_CENTER = Alignment(horizontal='center', vertical='center')

SUMMARY_HEADERS = [
    ("STT", ALIGN_CENTER, "@"),
    ("Thư mục NCC", ALIGN_LEFT, "@"),
    ("Ngày lập HĐ", ALIGN_CENTER, "yyyy-mm-dd"),
    ("Mẫu số", ALIGN_CENTER, "@"),
    ("Ký hiệu HĐ", ALIGN_CENTER, "@"),
    ("Số HĐ", ALIGN_CENTER, "@"),
    ("Mã CQT", ALIGN_LEFT, "@"),
    ("Mã số thuế bán", ALIGN_CENTER, "@"),
    ("Tên người bán", ALIGN_LEFT, "@"),
    ("Địa chỉ người bán", ALIGN_LEFT, "@"),
    ("Mã số thuế mua", ALIGN_CENTER, "@"),
    ("Tên người mua", ALIGN_LEFT, "@"),
    ("Địa chỉ người mua", ALIGN_LEFT, "@"),
    ("Hình thức TT", ALIGN_CENTER, "@"),
    ("Tổng tiền chưa thuế", ALIGN_RIGHT, "#,##0"),
    ("Tiền thuế GTGT", ALIGN_RIGHT, "#,##0"),
    ("Tổng thanh toán", ALIGN_RIGHT, "#,##0"),
    ("Tổng tiền bằng chữ", ALIGN_LEFT, "@"),
    ("Số mặt hàng", ALIGN_CENTER, "#,##0"),
    ("Định dạng", ALIGN_CENTER, "@"),
    ("Tên file gốc", ALIGN_LEFT, "@"),
    ("Thời gian nhập", ALIGN_CENTER, "yyyy-mm-dd hh:mm")
]

DETAIL_HEADERS = [
    ("STT dòng", ALIGN_CENTER, "#,##0"),
    ("Thư mục NCC", ALIGN_LEFT, "@"),
    ("Ký hiệu HĐ", ALIGN_CENTER, "@"),
    ("Số HĐ", ALIGN_CENTER, "@"),
    ("Ngày lập HĐ", ALIGN_CENTER, "yyyy-mm-dd"),
    ("MST Người bán", ALIGN_CENTER, "@"),
    ("Tên Người bán", ALIGN_LEFT, "@"),
    ("STT HĐ", ALIGN_CENTER, "@"),
    ("Tính chất", ALIGN_CENTER, "@"),
    ("Mã hàng", ALIGN_LEFT, "@"),
    ("Tên hàng hóa, dịch vụ", ALIGN_LEFT, "@"),
    ("Đơn vị tính", ALIGN_CENTER, "@"),
    ("Số lượng", ALIGN_RIGHT, "#,##0.##"),
    ("Đơn giá", ALIGN_RIGHT, "#,##0.##"),
    ("Thành tiền chưa thuế", ALIGN_RIGHT, "#,##0"),
    ("Thuế suất", ALIGN_CENTER, "@"),
    ("Tiền thuế", ALIGN_RIGHT, "#,##0"),
    ("Tổng tiền dòng", ALIGN_RIGHT, "#,##0"),
    ("Tên file gốc", ALIGN_LEFT, "@")
]

def set_workbook_metadata(wb):
    """
    Thiết lập metadata bản quyền và tác giả cho file Excel để phục vụ tracking & bảo vệ quyền tác giả.
    Khi người dùng mở file properties hoặc kiểm tra tác giả trên Windows Explorer/Excel, sẽ thấy đầy đủ thông tin.
    """
    try:
        props = wb.properties
        props.creator = "Lê Minh Triết - MinhTrietEras"
        props.lastModifiedBy = "MinhTrietEras (https://leminhtriet.com)"
        props.title = "Sổ Lưu Trữ & Quản Lý Hóa Đơn Điện Tử - MinhTrietEras"
        props.subject = "Báo cáo hóa đơn GTGT trích xuất tự động"
        props.description = "Phần mềm Trích xuất hóa đơn tự động phát triển bởi Lê Minh Triết - MinhTrietEras. Website chính thức: https://leminhtriet.com. Mã tracking: MTE-TXHD-2026-VN."
        props.keywords = "MinhTrietEras; Lê Minh Triết; leminhtriet.com; Trích xuất hóa đơn; Hóa đơn điện tử; Tracking; MTE-TXHD-2026-VN"
        props.category = "Kế toán / Thuế / Quản lý Hóa Đơn"
        props.company = "MinhTrietEras"
    except Exception as e:
        print(f"Warning: Lỗi ghi metadata Excel: {e}")

def ensure_excel_file(filepath):
    """
    Kiểm tra và khởi tạo file Excel nếu chưa tồn tại với 3 sheets:
      1. TongQuan (Dashboard tổng quan theo Nhà Cung Cấp & Tháng)
      2. TongHopHoaDon (Tổng hợp danh sách hóa đơn)
      3. ChiTietHangHoa (Chi tiết từng dòng sản phẩm)
    """
    dirpath = os.path.dirname(filepath)
    if dirpath and not os.path.exists(dirpath):
        os.makedirs(dirpath, exist_ok=True)

    if os.path.exists(filepath):
        try:
            wb = openpyxl.load_workbook(filepath)
            # Đảm bảo đủ các sheet
            if "TongHopHoaDon" not in wb.sheetnames:
                ws = wb.create_sheet("TongHopHoaDon")
                _setup_sheet_headers(ws, SUMMARY_HEADERS, HEADER_FILL_MAIN)
            if "ChiTietHangHoa" not in wb.sheetnames:
                ws = wb.create_sheet("ChiTietHangHoa")
                _setup_sheet_headers(ws, DETAIL_HEADERS, HEADER_FILL_SUB)
            if "TongQuan" not in wb.sheetnames:
                wb.create_sheet("TongQuan", 0)
            set_workbook_metadata(wb)
            return wb
        except Exception as exc:
            raise ValueError(f'Không thể đọc file Excel hiện có; giữ nguyên file: {filepath}') from exc

    wb = openpyxl.Workbook()
    # Sheet 1: Tổng quan (Dashboard)
    ws_tq = wb.active
    ws_tq.title = "TongQuan"

    # Sheet 2: Tổng hợp hóa đơn
    ws_summary = wb.create_sheet("TongHopHoaDon")
    _setup_sheet_headers(ws_summary, SUMMARY_HEADERS, HEADER_FILL_MAIN)

    # Sheet 3: Chi tiết hàng hóa
    ws_detail = wb.create_sheet("ChiTietHangHoa")
    _setup_sheet_headers(ws_detail, DETAIL_HEADERS, HEADER_FILL_SUB)

    set_workbook_metadata(wb)
    wb.save(filepath)
    return wb

def _setup_sheet_headers(ws, headers_def, fill_color):
    """Thiết lập dòng tiêu đề với màu sắc và style chuẩn"""
    ws.views.sheetView[0].showGridLines = True
    ws.freeze_panes = 'A2'
    ws.row_dimensions[1].height = 28

    for col_idx, (col_name, align, _) in enumerate(headers_def, start=1):
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.fill = fill_color
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = THIN_BORDER

def auto_fit_columns(ws, max_len_cap=65):
    """Tự động co dãn độ rộng các cột sao cho hiển thị vừa vặn và đẹp mắt"""
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or '')
            if '\n' in val_str:
                val_str = max(val_str.split('\n'), key=len)
            max_len = max(max_len, len(val_str))
        adjusted_width = min(max(max_len + 4, 11), max_len_cap)
        ws.column_dimensions[col_letter].width = adjusted_width

def get_existing_invoice_keys(filepath):
    """
    Lấy danh sách các invoice key đã có trong file Excel.
    Invoice key = (KHHDon, SHDon, MST_Ban)
    """
    if not os.path.exists(filepath):
        return set()
    
    keys = set()
    try:
        wb = openpyxl.load_workbook(filepath, data_only=True)
        if "TongHopHoaDon" in wb.sheetnames:
            ws = wb["TongHopHoaDon"]
            # Ký hiệu ở cột 5, Số HĐ ở cột 6, MST Bán ở cột 8
            for row in range(2, ws.max_row + 1):
                kh = str(ws.cell(row=row, column=5).value or '').strip()
                so = str(ws.cell(row=row, column=6).value or '').strip()
                mst = str(ws.cell(row=row, column=8).value or '').strip()
                if kh or so:
                    key = f"{kh}_{so}_{mst}"
                    keys.add(key)
        wb.close()
    except Exception as e:
        print(f"Error reading existing keys: {e}")
    return keys

def refresh_tongquan_sheet(wb):
    """
    Tự động tính toán lại bảng phân tích Pivot và cập nhật Sheet 'TongQuan':
      - Khối thẻ KPI tổng quan (Tổng số HĐ, Tiền trước thuế, Thuế GTGT, Tổng thanh toán, Số NCC)
      - Bảng 1: Phân tích Pivot theo từng Nhà Cung Cấp (có AutoFilter để chọn lọc)
      - Bảng 2: Phân tích Pivot theo Tháng / Kỳ Kê Khai (có AutoFilter để chọn lọc)
    """
    if "TongHopHoaDon" not in wb.sheetnames:
        return

    ws_summary = wb["TongHopHoaDon"]
    if "TongQuan" in wb.sheetnames:
        ws_tq = wb["TongQuan"]
        ws_tq.delete_rows(1, ws_tq.max_row + 10)
    else:
        ws_tq = wb.create_sheet("TongQuan", 0)

    ws_tq.views.sheetView[0].showGridLines = True

    # 1. Thu thập dữ liệu từ TongHopHoaDon
    invoices = []
    suppliers_map = {}   # (mst, ten_ncc, folder) -> {count, tien_chua_thue, tien_thue, tong_tien, last_date}
    months_map = {}      # 'YYYY-MM' -> {count, tien_chua_thue, tien_thue, tong_tien}

    tot_chua_thue = 0.0
    tot_thue = 0.0
    tot_thanh_toan = 0.0

    col_map = get_col_map(ws_summary)
    c_folder = col_map.get('Thư mục NCC', 2)
    c_ngay = col_map.get('Ngày lập HĐ', 3)
    c_ky_hieu = col_map.get('Ký hiệu HĐ', 5)
    c_so_hd = col_map.get('Số HĐ', 6)
    c_mst = col_map.get('Mã số thuế bán', 8)
    c_ten = col_map.get('Tên người bán', 9)
    c_chua_thue = col_map.get('Tổng tiền chưa thuế', 15)
    c_thue = col_map.get('Tiền thuế GTGT', 16)
    c_tong = col_map.get('Tổng thanh toán', 17)

    for r in range(2, ws_summary.max_row + 1):
        so_hd = str(ws_summary.cell(row=r, column=c_so_hd).value or '').strip()
        if not so_hd or so_hd.lower() == 'none':
            continue

        folder = str(ws_summary.cell(row=r, column=c_folder).value or 'Thư mục gốc').strip()
        ngay_lap = str(ws_summary.cell(row=r, column=c_ngay).value or '').strip()
        kh = str(ws_summary.cell(row=r, column=c_ky_hieu).value or '').strip()
        mst_ban = str(ws_summary.cell(row=r, column=c_mst).value or '').strip()
        ten_ban = str(ws_summary.cell(row=r, column=c_ten).value or 'Không rõ').strip()

        tien_chua_thue = to_float(ws_summary.cell(row=r, column=c_chua_thue).value)
        tien_thue = to_float(ws_summary.cell(row=r, column=c_thue).value)
        tong_tien = to_float(ws_summary.cell(row=r, column=c_tong).value)

        tot_chua_thue += tien_chua_thue
        tot_thue += tien_thue
        tot_thanh_toan += tong_tien

        # Thống kê theo nhà cung cấp
        s_key = (mst_ban, ten_ban, folder)
        if s_key not in suppliers_map:
            suppliers_map[s_key] = {
                'count': 0, 'tien_chua_thue': 0.0, 'tien_thue': 0.0, 'tong_tien': 0.0, 'last_date': ngay_lap
            }
        suppliers_map[s_key]['count'] += 1
        suppliers_map[s_key]['tien_chua_thue'] += tien_chua_thue
        suppliers_map[s_key]['tien_thue'] += tien_thue
        suppliers_map[s_key]['tong_tien'] += tong_tien
        if ngay_lap > suppliers_map[s_key]['last_date']:
            suppliers_map[s_key]['last_date'] = ngay_lap

        # Thống kê theo kỳ tháng (YYYY-MM)
        month_str = ngay_lap[:7] if len(ngay_lap) >= 7 else 'Chưa rõ'
        if month_str not in months_map:
            months_map[month_str] = {
                'count': 0, 'tien_chua_thue': 0.0, 'tien_thue': 0.0, 'tong_tien': 0.0
            }
        months_map[month_str]['count'] += 1
        months_map[month_str]['tien_chua_thue'] += tien_chua_thue
        months_map[month_str]['tien_thue'] += tien_thue
        months_map[month_str]['tong_tien'] += tong_tien

        invoices.append(r)

    total_invoices_count = len(invoices)
    unique_suppliers_count = len(suppliers_map)

    # 2. VẼ GIAO DIỆN SHEET 'TongQuan'
    # 2.1 Tiêu đề lớn & Subtitle Tác giả / Tracking
    ws_tq.merge_cells('A1:J1')
    title_cell = ws_tq['A1']
    title_cell.value = "BÁO CÁO TỔNG QUAN HÓA ĐƠN ĐIỆN TỬ - MINHTRIETERAS (https://leminhtriet.com)"
    title_cell.font = TITLE_FONT
    title_cell.fill = HEADER_FILL_TITLE
    title_cell.alignment = Alignment(horizontal='center', vertical='center')
    ws_tq.row_dimensions[1].height = 36

    ws_tq.merge_cells('A2:J2')
    sub_cell = ws_tq['A2']
    sub_cell.value = "Hệ thống trích xuất & quản lý hóa đơn tự động | Bản quyền © 2026 Lê Minh Triết - MinhTrietEras | Website: https://leminhtriet.com | Tracking ID: MTE-TXHD-2026-VN"
    sub_cell.font = Font(name="Segoe UI", size=9, italic=True, bold=True, color="831843")
    sub_cell.fill = KPI_FILL
    sub_cell.alignment = Alignment(horizontal='center', vertical='center')
    ws_tq.row_dimensions[2].height = 20

    # 2.2 Thẻ KPI tổng hợp (Row 3-4)
    ws_tq.row_dimensions[3].height = 20
    ws_tq.row_dimensions[4].height = 28

    kpi_blocks = [
        ('A', 'B', 'TỔNG SỐ HÓA ĐƠN', total_invoices_count, "#,##0"),
        ('C', 'D', 'TỔNG TIỀN CHƯA THUẾ', tot_chua_thue, "#,##0"),
        ('E', 'F', 'TỔNG TIỀN THUẾ GTGT', tot_thue, "#,##0"),
        ('G', 'H', 'TỔNG THANH TOÁN (VND)', tot_thanh_toan, "#,##0"),
        ('I', 'J', 'SỐ NHÀ CUNG CẤP', unique_suppliers_count, "#,##0")
    ]

    for col1, col2, label, val, num_fmt in kpi_blocks:
        ws_tq.merge_cells(f'{col1}3:{col2}3')
        ws_tq.merge_cells(f'{col1}4:{col2}4')

        lbl_cell = ws_tq[f'{col1}3']
        lbl_cell.value = label
        lbl_cell.font = KPI_TITLE_FONT
        lbl_cell.fill = KPI_FILL
        lbl_cell.alignment = ALIGN_CENTER

        val_cell = ws_tq[f'{col1}4']
        val_cell.value = val
        val_cell.font = KPI_VAL_FONT
        val_cell.fill = KPI_FILL
        val_cell.alignment = ALIGN_CENTER
        val_cell.number_format = num_fmt

        # Kẻ viền cho thẻ KPI
        for col_l in [col1, col2]:
            ws_tq[f'{col_l}3'].border = KPI_BORDER
            ws_tq[f'{col_l}4'].border = KPI_BORDER

    # 2.3 BẢNG 1: PIVOT THEO NHÀ CUNG CẤP
    ws_tq.cell(row=6, column=1, value="1. BẢNG PHÂN TÍCH TỔNG HỢP THEO TỪNG NHÀ CUNG CẤP (PIVOT SUMMARY)").font = SECTION_FONT
    ws_tq.row_dimensions[6].height = 25

    t1_headers = [
        ("STT", ALIGN_CENTER),
        ("Mã Số Thuế NCC", ALIGN_CENTER),
        ("Tên Nhà Cung Cấp (Bên Bán)", ALIGN_LEFT),
        ("Thư Mục NCC", ALIGN_LEFT),
        ("Số Lượng HĐ", ALIGN_CENTER),
        ("Tiền Chưa Thuế (VND)", ALIGN_RIGHT),
        ("Thuế GTGT (VND)", ALIGN_RIGHT),
        ("Tổng Thanh Toán (VND)", ALIGN_RIGHT),
        ("Tỷ Trọng (%)", ALIGN_RIGHT),
        ("Ngày HĐ Gần Nhất", ALIGN_CENTER)
    ]

    ws_tq.row_dimensions[7].height = 26
    for c_idx, (h_name, h_align) in enumerate(t1_headers, start=1):
        cell = ws_tq.cell(row=7, column=c_idx, value=h_name)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL_MAIN
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.border = THIN_BORDER

    # Sắp xếp nhà cung cấp theo tổng tiền giảm dần
    sorted_suppliers = sorted(suppliers_map.items(), key=lambda x: x[1]['tong_tien'], reverse=True)

    curr_row = 8
    for idx, ((mst, ten_ncc, folder), s_data) in enumerate(sorted_suppliers, start=1):
        ratio = (s_data['tong_tien'] / tot_thanh_toan) if tot_thanh_toan > 0 else 0.0
        row_vals = [
            (idx, ALIGN_CENTER, "#,##0"),
            (mst, ALIGN_CENTER, "@"),
            (ten_ncc, ALIGN_LEFT, "@"),
            (folder, ALIGN_LEFT, "@"),
            (s_data['count'], ALIGN_CENTER, "#,##0"),
            (s_data['tien_chua_thue'], ALIGN_RIGHT, "#,##0"),
            (s_data['tien_thue'], ALIGN_RIGHT, "#,##0"),
            (s_data['tong_tien'], ALIGN_RIGHT, "#,##0"),
            (ratio, ALIGN_RIGHT, "0.0%"),
            (s_data['last_date'], ALIGN_CENTER, "yyyy-mm-dd")
        ]

        ws_tq.row_dimensions[curr_row].height = 22
        for c_idx, (val, align, num_fmt) in enumerate(row_vals, start=1):
            cell = ws_tq.cell(row=curr_row, column=c_idx, value=val)
            cell.font = DATA_FONT
            cell.alignment = align
            cell.number_format = num_fmt
            cell.border = THIN_BORDER
        curr_row += 1

    # Dòng Tổng Cộng Bảng 1
    total_row_1 = curr_row
    ws_tq.row_dimensions[total_row_1].height = 26
    ws_tq.cell(row=total_row_1, column=1, value="TỔNG").font = BOLD_FONT
    ws_tq.cell(row=total_row_1, column=1).alignment = ALIGN_CENTER
    ws_tq.cell(row=total_row_1, column=1).border = TOTAL_BORDER
    ws_tq.cell(row=total_row_1, column=1).fill = TOTAL_FILL

    ws_tq.merge_cells(f'B{total_row_1}:D{total_row_1}')
    total_lbl = ws_tq.cell(row=total_row_1, column=2, value=f"Tổng cộng ({len(sorted_suppliers)} Nhà cung cấp)")
    total_lbl.font = BOLD_FONT
    total_lbl.fill = TOTAL_FILL
    total_lbl.alignment = ALIGN_LEFT
    for c in range(2, 5):
        ws_tq.cell(row=total_row_1, column=c).border = TOTAL_BORDER
        ws_tq.cell(row=total_row_1, column=c).fill = TOTAL_FILL

    c_vals = [
        (5, total_invoices_count, "#,##0", ALIGN_CENTER),
        (6, tot_chua_thue, "#,##0", ALIGN_RIGHT),
        (7, tot_thue, "#,##0", ALIGN_RIGHT),
        (8, tot_thanh_toan, "#,##0", ALIGN_RIGHT),
        (9, 1.0, "0.0%", ALIGN_RIGHT),
        (10, "", "@", ALIGN_CENTER)
    ]
    for c_idx, val, num_fmt, align in c_vals:
        c_cell = ws_tq.cell(row=total_row_1, column=c_idx, value=val)
        c_cell.font = BOLD_FONT
        c_cell.number_format = num_fmt
        c_cell.alignment = align
        c_cell.border = TOTAL_BORDER
        c_cell.fill = TOTAL_FILL

    # Bật AutoFilter cho Bảng 1 (để người dùng có thể nhấp mũi tên lọc theo từng NCC)
    t1_end_row = total_row_1 - 1
    if t1_end_row >= 7:
        ws_tq.auto_filter.ref = f"A7:J{t1_end_row}"

    # 2.4 BẢNG 2: PIVOT THEO THÁNG / KỲ KÊ KHAI (bên dưới)
    curr_row += 3
    ws_tq.cell(row=curr_row, column=1, value="2. BẢNG PHÂN TÍCH TỔNG HỢP THEO KỲ KÊ KHAI (THÁNG / NĂM)").font = SECTION_FONT
    ws_tq.row_dimensions[curr_row].height = 25
    curr_row += 1

    t2_headers = [
        ("STT", ALIGN_CENTER),
        ("Kỳ Tháng (YYYY-MM)", ALIGN_CENTER),
        ("Số Lượng HĐ", ALIGN_CENTER),
        ("Tiền Chưa Thuế (VND)", ALIGN_RIGHT),
        ("Thuế GTGT (VND)", ALIGN_RIGHT),
        ("Tổng Thanh Toán (VND)", ALIGN_RIGHT),
        ("Tỷ Trọng (%)", ALIGN_RIGHT)
    ]

    t2_start_row = curr_row
    ws_tq.row_dimensions[t2_start_row].height = 26
    for c_idx, (h_name, h_align) in enumerate(t2_headers, start=1):
        cell = ws_tq.cell(row=t2_start_row, column=c_idx, value=h_name)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL_SUB
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.border = THIN_BORDER
    curr_row += 1

    sorted_months = sorted(months_map.items(), key=lambda x: x[0])
    for idx, (m_str, m_data) in enumerate(sorted_months, start=1):
        m_ratio = (m_data['tong_tien'] / tot_thanh_toan) if tot_thanh_toan > 0 else 0.0
        m_vals = [
            (idx, ALIGN_CENTER, "#,##0"),
            (m_str, ALIGN_CENTER, "@"),
            (m_data['count'], ALIGN_CENTER, "#,##0"),
            (m_data['tien_chua_thue'], ALIGN_RIGHT, "#,##0"),
            (m_data['tien_thue'], ALIGN_RIGHT, "#,##0"),
            (m_data['tong_tien'], ALIGN_RIGHT, "#,##0"),
            (m_ratio, ALIGN_RIGHT, "0.0%")
        ]

        ws_tq.row_dimensions[curr_row].height = 22
        for c_idx, (val, align, num_fmt) in enumerate(m_vals, start=1):
            cell = ws_tq.cell(row=curr_row, column=c_idx, value=val)
            cell.font = DATA_FONT
            cell.alignment = align
            cell.number_format = num_fmt
            cell.border = THIN_BORDER
        curr_row += 1

    # Dòng Tổng Cộng Bảng 2
    ws_tq.row_dimensions[curr_row].height = 26
    ws_tq.cell(row=curr_row, column=1, value="TỔNG").font = BOLD_FONT
    ws_tq.cell(row=curr_row, column=1).alignment = ALIGN_CENTER
    ws_tq.cell(row=curr_row, column=1).border = TOTAL_BORDER
    ws_tq.cell(row=curr_row, column=1).fill = TOTAL_FILL

    ws_tq.cell(row=curr_row, column=2, value="Toàn bộ các kỳ").font = BOLD_FONT
    ws_tq.cell(row=curr_row, column=2).alignment = ALIGN_LEFT
    ws_tq.cell(row=curr_row, column=2).border = TOTAL_BORDER
    ws_tq.cell(row=curr_row, column=2).fill = TOTAL_FILL

    m_tot_vals = [
        (3, total_invoices_count, "#,##0", ALIGN_CENTER),
        (4, tot_chua_thue, "#,##0", ALIGN_RIGHT),
        (5, tot_thue, "#,##0", ALIGN_RIGHT),
        (6, tot_thanh_toan, "#,##0", ALIGN_RIGHT),
        (7, 1.0, "0.0%", ALIGN_RIGHT)
    ]
    for c_idx, val, num_fmt, align in m_tot_vals:
        c_cell = ws_tq.cell(row=curr_row, column=c_idx, value=val)
        c_cell.font = BOLD_FONT
        c_cell.number_format = num_fmt
        c_cell.alignment = align
        c_cell.border = TOTAL_BORDER
        c_cell.fill = TOTAL_FILL

    auto_fit_columns(ws_tq)

def save_invoices_to_excel(invoices_list, filepath, overwrite=False):
    """
    Lưu danh sách hóa đơn vào file Excel:
    - invoices_list: Danh sách dict kết quả từ parser
    - filepath: Đường dẫn file Excel
    - overwrite:
        Nếu True: Replace/cập nhật hóa đơn cũ tại đúng vị trí, KHÔNG TĂNG THÊM DÒNG!
        Nếu False: Bỏ qua hóa đơn trùng, KHÔNG THÊM DÒNG!
    """
    try:
        wb = ensure_excel_file(filepath)
    except (OSError, ValueError) as exc:
        return {'success': False, 'error': str(exc), 'added': 0, 'updated': 0,
                'skipped': 0, 'errors': [str(exc)]}
    ws_summary = wb["TongHopHoaDon"]
    ws_detail = wb["ChiTietHangHoa"]

    added_count = 0
    updated_count = 0
    skipped_count = 0
    errors = []

    # Tạo bản đồ các dòng hiện có trong Summary: key -> row_idx
    # Ký hiệu ở cột 5, Số HĐ ở cột 6, MST Bán ở cột 8
    existing_summary_map = {}
    for r in range(2, ws_summary.max_row + 1):
        kh = str(ws_summary.cell(row=r, column=5).value or '').strip()
        so = str(ws_summary.cell(row=r, column=6).value or '').strip()
        mst = str(ws_summary.cell(row=r, column=8).value or '').strip()
        if kh or so:
            existing_summary_map[f"{kh}_{so}_{mst}"] = r

    keys_to_replace_in_detail = set()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for inv in invoices_list:
        if not inv.get('success'):
            errors.append(f"File {inv.get('filename')}: {inv.get('error')}")
            continue

        key = inv.get('invoice_key')
        is_existing = key in existing_summary_map

        if is_existing and not overwrite:
            skipped_count += 1
            continue

        tt = inv['thong_tin_chung']
        nb = inv['nguoi_ban']
        nm = inv['nguoi_mua']
        toan = inv['thanh_toan']
        items = inv.get('hang_hoa', [])
        filename = inv.get('filename', '')
        file_type = inv.get('file_type', 'XML')
        supplier_folder = inv.get('supplier_folder', 'Thư mục gốc')

        # Xác định hàng ghi trong Summary
        if is_existing and overwrite:
            target_row = existing_summary_map[key]
            stt = ws_summary.cell(row=target_row, column=1).value or target_row - 1
            updated_count += 1
            keys_to_replace_in_detail.add(key)
        else:
            target_row = ws_summary.max_row + 1
            stt = target_row - 1
            added_count += 1
            existing_summary_map[key] = target_row

        # Ghi Summary (Cột 2 là Thư mục NCC)
        row_values = [
            (stt, ALIGN_CENTER, "#,##0"),
            (supplier_folder, ALIGN_LEFT, "@"),
            (tt['ngay_lap'], ALIGN_CENTER, "yyyy-mm-dd"),
            (tt['mau_so'], ALIGN_CENTER, "@"),
            (tt['ky_hieu'], ALIGN_CENTER, "@"),
            (tt['so_hd'], ALIGN_CENTER, "@"),
            (tt['ma_cqt'], ALIGN_LEFT, "@"),
            (nb['mst'], ALIGN_CENTER, "@"),
            (nb['ten'], ALIGN_LEFT, "@"),
            (nb['dia_chi'], ALIGN_LEFT, "@"),
            (nm['mst'], ALIGN_CENTER, "@"),
            (nm['ten'], ALIGN_LEFT, "@"),
            (nm['dia_chi'], ALIGN_LEFT, "@"),
            (tt['hinh_thuc_tt'], ALIGN_CENTER, "@"),
            (toan['tong_tien_chua_thue'], ALIGN_RIGHT, "#,##0"),
            (toan['tong_tien_thue'], ALIGN_RIGHT, "#,##0"),
            (toan['tong_tien_thanh_toan'], ALIGN_RIGHT, "#,##0"),
            (toan['tong_tien_chu'], ALIGN_LEFT, "@"),
            (len(items), ALIGN_CENTER, "#,##0"),
            (file_type, ALIGN_CENTER, "@"),
            (filename, ALIGN_LEFT, "@"),
            (now_str, ALIGN_CENTER, "yyyy-mm-dd hh:mm")
        ]

        ws_summary.row_dimensions[target_row].height = 22
        for col_idx, (val, align, num_format) in enumerate(row_values, start=1):
            cell = ws_summary.cell(row=target_row, column=col_idx, value=val)
            cell.font = DATA_FONT
            cell.alignment = align
            cell.number_format = num_format
            cell.border = THIN_BORDER

    # Xử lý cập nhật Detail nếu có overwrite
    if keys_to_replace_in_detail:
        rows_to_keep = []
        for r in range(2, ws_detail.max_row + 1):
            kh = str(ws_detail.cell(row=r, column=3).value or '').strip()
            so = str(ws_detail.cell(row=r, column=4).value or '').strip()
            mst = str(ws_detail.cell(row=r, column=6).value or '').strip()
            dkey = f"{kh}_{so}_{mst}"
            if dkey not in keys_to_replace_in_detail:
                row_vals = [ws_detail.cell(row=r, column=c).value for c in range(1, len(DETAIL_HEADERS) + 1)]
                rows_to_keep.append(row_vals)
        
        ws_detail.delete_rows(2, ws_detail.max_row)
        for r_vals in rows_to_keep:
            ws_detail.append(r_vals)

    # Thêm chi tiết hàng hóa mới (hoặc được ghi đè)
    for inv in invoices_list:
        if not inv.get('success'):
            continue
        key = inv.get('invoice_key')
        if key in existing_summary_map:
            if (is_existing and not overwrite):
                continue
            
            tt = inv['thong_tin_chung']
            nb = inv['nguoi_ban']
            filename = inv.get('filename', '')
            supplier_folder = inv.get('supplier_folder', 'Thư mục gốc')

            for item in inv.get('hang_hoa', []):
                d_row = ws_detail.max_row + 1
                stt_dong = d_row - 1
                detail_row_values = [
                    (stt_dong, ALIGN_CENTER, "#,##0"),
                    (supplier_folder, ALIGN_LEFT, "@"),
                    (tt['ky_hieu'], ALIGN_CENTER, "@"),
                    (tt['so_hd'], ALIGN_CENTER, "@"),
                    (tt['ngay_lap'], ALIGN_CENTER, "yyyy-mm-dd"),
                    (nb['mst'], ALIGN_CENTER, "@"),
                    (nb['ten'], ALIGN_LEFT, "@"),
                    (item['stt'], ALIGN_CENTER, "@"),
                    (item['tinh_chat'], ALIGN_CENTER, "@"),
                    (item['ma_hang'], ALIGN_LEFT, "@"),
                    (item['ten_hang'], ALIGN_LEFT, "@"),
                    (item['dvt'], ALIGN_CENTER, "@"),
                    (item['so_luong'], ALIGN_RIGHT, "#,##0.##"),
                    (item['don_gia'], ALIGN_RIGHT, "#,##0.##"),
                    (item['thanh_tien'], ALIGN_RIGHT, "#,##0"),
                    (item['thue_suat'], ALIGN_CENTER, "@"),
                    (item['tien_thue'], ALIGN_RIGHT, "#,##0"),
                    (item['tong_tien_dong'], ALIGN_RIGHT, "#,##0"),
                    (filename, ALIGN_LEFT, "@")
                ]
                ws_detail.row_dimensions[d_row].height = 20
                for c_idx, (val, align, num_format) in enumerate(detail_row_values, start=1):
                    cell = ws_detail.cell(row=d_row, column=c_idx, value=val)
                    cell.font = DATA_FONT
                    cell.alignment = align
                    cell.number_format = num_format
                    cell.border = THIN_BORDER

    # Bật AutoFilter cho Sheet TongHopHoaDon và ChiTietHangHoa
    if ws_summary.max_row >= 2:
        ws_summary.auto_filter.ref = f"A1:{get_column_letter(len(SUMMARY_HEADERS))}{ws_summary.max_row}"
    if ws_detail.max_row >= 2:
        ws_detail.auto_filter.ref = f"A1:{get_column_letter(len(DETAIL_HEADERS))}{ws_detail.max_row}"

    auto_fit_columns(ws_summary)
    auto_fit_columns(ws_detail)

    # 3. Tự động tính toán & cập nhật Sheet 'TongQuan' (Pivot Dashboard)
    refresh_tongquan_sheet(wb)

    try:
        set_workbook_metadata(wb)
        wb.save(filepath)
        wb.close()
    except PermissionError:
        try:
            wb.close()
        except Exception:
            pass
        return {
            'success': False,
            'error': f'File Excel đang được mở trong ứng dụng khác! Vui lòng lưu và đóng file Excel "{os.path.basename(filepath)}" rồi thực hiện lại.',
            'permission_denied': True,
            'added': 0,
            'updated': 0,
            'skipped': 0,
            'errors': ['PermissionError: File Excel đang bị khóa do đang mở trong Microsoft Excel']
        }

    return {
        'success': True,
        'added': added_count,
        'updated': updated_count,
        'skipped': skipped_count,
        'errors': errors
    }

_summary_cache = {}
_summary_cache_lock = RLock()


def read_excel_summary(filepath):
    """Tái sử dụng kết quả khi file chưa đổi; chỉ giữ file đang đọc trong bộ nhớ."""
    with _summary_cache_lock:
        try:
            stat = os.stat(filepath)
            fingerprint = (os.path.abspath(filepath), stat.st_mtime_ns, stat.st_ctime_ns,
                           stat.st_size)
        except OSError:
            return _read_excel_summary(filepath)
        if fingerprint in _summary_cache:
            return deepcopy(_summary_cache[fingerprint])
        result = _read_excel_summary(filepath)
        _summary_cache.clear()
        if not result.get('error'):
            _summary_cache[fingerprint] = result
        return deepcopy(result)


def _read_excel_summary(filepath):
    """Đọc dữ liệu từ file Excel để hiển thị trên web app"""
    if not os.path.exists(filepath):
        return {
            'exists': False,
            'filepath': filepath,
            'rows': [],
            'stats': {'total_invoices': 0, 'total_amount': 0, 'total_vat': 0, 'unique_sellers': 0},
            'pivot_by_supplier': [],
            'pivot_by_month': []
        }

    wb = None
    try:
        wb = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
        if "TongHopHoaDon" not in wb.sheetnames:
            return {'exists': True, 'filepath': filepath, 'rows': [], 'stats': {'total_invoices': 0, 'total_amount': 0, 'total_vat': 0, 'unique_sellers': 0}}
        
        ws = wb["TongHopHoaDon"]
        rows = []
        total_amount = 0.0
        total_vat = 0.0
        suppliers_map = {}
        months_map = {}

        col_map = get_col_map(ws)
        c_stt = col_map.get('STT', 1)
        c_folder = col_map.get('Thư mục NCC', 2)
        c_ngay = col_map.get('Ngày lập HĐ', 3)
        c_mau_so = col_map.get('Mẫu số', 4)
        c_ky_hieu = col_map.get('Ký hiệu HĐ', 5)
        c_so_hd = col_map.get('Số HĐ', 6)
        c_cqt = col_map.get('Mã CQT', 7)
        c_nb_mst = col_map.get('Mã số thuế bán', 8)
        c_nb_ten = col_map.get('Tên người bán', 9)
        c_nb_dchi = col_map.get('Địa chỉ người bán', 10)
        c_nm_mst = col_map.get('Mã số thuế mua', 11)
        c_nm_ten = col_map.get('Tên người mua', 12)
        c_nm_dchi = col_map.get('Địa chỉ người mua', 13)
        c_httt = col_map.get('Hình thức TT', 14)
        c_chua_thue = col_map.get('Tổng tiền chưa thuế', 15)
        c_thue = col_map.get('Tiền thuế GTGT', 16)
        c_tong = col_map.get('Tổng thanh toán', 17)
        c_chu = col_map.get('Tổng tiền bằng chữ', 18)
        c_so_mon = col_map.get('Số mặt hàng', 19)
        c_loai = col_map.get('Định dạng', 20)
        c_fname = col_map.get('Tên file gốc', 21)
        c_time = col_map.get('Thời gian nhập', 22)

        for values in ws.iter_rows(min_row=2, max_col=max(col_map.values(), default=22), values_only=True):
            so_hd = str(values[c_so_hd - 1] or '').strip()
            if not so_hd or so_hd.lower() == 'none':
                continue
            
            stt = values[c_stt - 1]
            folder = str(values[c_folder - 1] or 'Thư mục gốc').strip()
            ngay_lap = str(values[c_ngay - 1] or '').strip()
            mau_so = str(values[c_mau_so - 1] or '').strip()
            ky_hieu = str(values[c_ky_hieu - 1] or '').strip()
            ma_cqt = str(values[c_cqt - 1] or '').strip()
            nb_mst = str(values[c_nb_mst - 1] or '').strip()
            nb_ten = str(values[c_nb_ten - 1] or '').strip()
            nb_dchi = str(values[c_nb_dchi - 1] or '').strip()
            nm_mst = str(values[c_nm_mst - 1] or '').strip()
            nm_ten = str(values[c_nm_ten - 1] or '').strip()
            nm_dchi = str(values[c_nm_dchi - 1] or '').strip()
            hinh_thuc_tt = str(values[c_httt - 1] or '').strip()
            
            tien_chua_thue = to_float(values[c_chua_thue - 1])
            tien_thue = to_float(values[c_thue - 1])
            tong_tien = to_float(values[c_tong - 1])
            tien_chu = str(values[c_chu - 1] or '')
            so_mat_hang = int(to_float(values[c_so_mon - 1]))
            file_type = str(values[c_loai - 1] or 'XML')
            filename = str(values[c_fname - 1] or '')
            thoi_gian_nhap = str(values[c_time - 1] or '')

            total_amount += tong_tien
            total_vat += tien_thue

            # Thống kê theo nhà cung cấp
            s_key = (nb_mst, nb_ten, folder)
            if s_key not in suppliers_map:
                suppliers_map[s_key] = {'mst': nb_mst, 'name': nb_ten, 'folder': folder, 'count': 0, 'total': 0.0, 'vat': 0.0}
            suppliers_map[s_key]['count'] += 1
            suppliers_map[s_key]['total'] += tong_tien
            suppliers_map[s_key]['vat'] += tien_thue

            # Thống kê theo tháng
            m_str = ngay_lap[:7] if len(ngay_lap) >= 7 else 'Chưa rõ'
            if m_str not in months_map:
                months_map[m_str] = {'month': m_str, 'count': 0, 'total': 0.0, 'vat': 0.0}
            months_map[m_str]['count'] += 1
            months_map[m_str]['total'] += tong_tien
            months_map[m_str]['vat'] += tien_thue

            rows.append({
                'stt': stt,
                'supplier_folder': folder,
                'ngay_lap': ngay_lap,
                'mau_so': mau_so,
                'ky_hieu': ky_hieu,
                'so_hd': so_hd,
                'ma_cqt': ma_cqt,
                'nb_mst': nb_mst,
                'nb_ten': nb_ten,
                'nb_dchi': nb_dchi,
                'nm_mst': nm_mst,
                'nm_ten': nm_ten,
                'nm_dchi': nm_dchi,
                'hinh_thuc_tt': hinh_thuc_tt,
                'tien_chua_thue': tien_chua_thue,
                'tien_thue': tien_thue,
                'tong_tien': tong_tien,
                'tien_chu': tien_chu,
                'so_mat_hang': so_mat_hang,
                'file_type': file_type,
                'filename': filename,
                'thoi_gian_nhap': thoi_gian_nhap,
                'invoice_key': f"{ky_hieu}_{so_hd}_{nb_mst}"
            })

        wb.close()
        file_size_kb = round(os.path.getsize(filepath) / 1024, 1)

        pivot_supplier = sorted(list(suppliers_map.values()), key=lambda x: x['total'], reverse=True)
        pivot_month = sorted(list(months_map.values()), key=lambda x: x['month'])

        return {
            'exists': True,
            'filepath': filepath,
            'file_size_kb': file_size_kb,
            'rows': rows,
            'stats': {
                'total_invoices': len(rows),
                'total_amount': total_amount,
                'total_vat': total_vat,
                'unique_sellers': len(suppliers_map)
            },
            'pivot_by_supplier': pivot_supplier,
            'pivot_by_month': pivot_month
        }
    except Exception as e:
        return {
            'exists': True,
            'filepath': filepath,
            'error': str(e),
            'rows': [],
            'stats': {'total_invoices': 0, 'total_amount': 0, 'total_vat': 0, 'unique_sellers': 0},
            'pivot_by_supplier': [],
            'pivot_by_month': []
        }

    finally:
        if wb is not None:
            wb.close()

def init_blank_excel_file(filepath):
    """
    Khởi tạo một file Excel hoàn toàn mới tại filepath (tạo thư mục nếu cần).
    File mới có 3 sheet chuẩn:
      - TongQuan (Dashboard Pivot trắng)
      - TongHopHoaDon (Header chuẩn)
      - ChiTietHangHoa (Header chuẩn)
    """
    dirpath = os.path.dirname(filepath)
    if dirpath and not os.path.exists(dirpath):
        os.makedirs(dirpath, exist_ok=True)

    try:
        wb = openpyxl.Workbook()
        ws_tq = wb.active
        ws_tq.title = "TongQuan"

        ws_summary = wb.create_sheet("TongHopHoaDon")
        _setup_sheet_headers(ws_summary, SUMMARY_HEADERS, HEADER_FILL_MAIN)

        ws_detail = wb.create_sheet("ChiTietHangHoa")
        _setup_sheet_headers(ws_detail, DETAIL_HEADERS, HEADER_FILL_SUB)

        refresh_tongquan_sheet(wb)

        set_workbook_metadata(wb)
        wb.save(filepath)
        wb.close()
        return {
            'success': True,
            'filepath': filepath,
            'message': 'Khởi tạo file Excel lưu trữ thành công!'
        }
    except PermissionError:
        return {
            'success': False,
            'error': 'File Excel đang được mở bởi ứng dụng khác (Excel). Vui lòng đóng file và thử lại.'
        }
    except Exception as e:
        return {'success': False, 'error': f'Lỗi khi khởi tạo file Excel: {str(e)}'}

def clear_excel_data(filepath):
    """
    Xóa toàn bộ các dòng dữ liệu (từ dòng 2 trở đi) trong các sheet 'TongHopHoaDon'
    và 'ChiTietHangHoa', đồng thời làm mới lại sheet 'TongQuan' về 0.
    Giữ nguyên tiêu đề và cấu trúc định dạng chuẩn mực của file Excel.
    """
    if not os.path.exists(filepath):
        return {'success': False, 'error': f'File Excel không tồn tại: {filepath}'}

    try:
        wb = openpyxl.load_workbook(filepath)

        # 1. Xóa dữ liệu TongHopHoaDon
        if "TongHopHoaDon" in wb.sheetnames:
            ws_summary = wb["TongHopHoaDon"]
            if ws_summary.max_row > 1:
                ws_summary.delete_rows(2, ws_summary.max_row - 1)
        else:
            ws_summary = wb.create_sheet("TongHopHoaDon")
            _setup_sheet_headers(ws_summary, SUMMARY_HEADERS, HEADER_FILL_MAIN)

        # 2. Xóa dữ liệu ChiTietHangHoa
        if "ChiTietHangHoa" in wb.sheetnames:
            ws_detail = wb["ChiTietHangHoa"]
            if ws_detail.max_row > 1:
                ws_detail.delete_rows(2, ws_detail.max_row - 1)
        else:
            ws_detail = wb.create_sheet("ChiTietHangHoa")
            _setup_sheet_headers(ws_detail, DETAIL_HEADERS, HEADER_FILL_SUB)

        # 3. Làm mới lại Sheet TongQuan
        refresh_tongquan_sheet(wb)

        set_workbook_metadata(wb)
        wb.save(filepath)
        wb.close()
        return {
            'success': True,
            'filepath': filepath,
            'message': 'Đã xóa toàn bộ dữ liệu hóa đơn thành công! File Excel đã được đưa về trạng thái trắng ban đầu.'
        }
    except PermissionError:
        return {
            'success': False,
            'error': 'File Excel đang được mở bởi Microsoft Excel hoặc phần mềm khác. Vui lòng đóng file Excel trước khi xóa dữ liệu.'
        }
    except Exception as e:
        return {'success': False, 'error': f'Lỗi khi xóa dữ liệu file Excel: {str(e)}'}



def read_excel_invoice_details(filepath, stt=None):
    """Chỉ đọc summary + dòng hàng hóa; không khởi tạo hoặc lưu workbook."""
    summary = read_excel_summary(filepath)
    if summary.get('error'):
        return {'success': False, 'error': summary['error']}
    rows = summary.get('rows', [])
    if stt is not None:
        rows = [r for r in rows if str(r['stt']) == str(stt)]
        if not rows:
            return {'success': False, 'error': 'Không tìm thấy hóa đơn trong Excel'}
    invoices = []
    for r in rows:
        invoices.append({
            'invoice_key': r['invoice_key'], 'already_in_excel': True,
            'filename': r['filename'], 'file_type': r['file_type'],
            'supplier_folder': r['supplier_folder'], 'thoi_gian_nhap': r['thoi_gian_nhap'],
            'source': 'excel',
            'thong_tin_chung': {k: r[k] for k in ('mau_so', 'ky_hieu', 'so_hd', 'ngay_lap', 'ma_cqt', 'hinh_thuc_tt')},
            'nguoi_ban': {'ten': r['nb_ten'], 'mst': r['nb_mst'], 'dia_chi': r['nb_dchi']},
            'nguoi_mua': {'ten': r['nm_ten'], 'mst': r['nm_mst'], 'dia_chi': r['nm_dchi']},
            'thanh_toan': {'tong_tien_chua_thue': r['tien_chua_thue'], 'tong_tien_thue': r['tien_thue'],
                          'tong_tien_thanh_toan': r['tong_tien'], 'tong_tien_chu': r['tien_chu']},
            'hang_hoa': []})
    if not invoices:
        return {'success': True, 'invoices': []}
    by_key = {inv['invoice_key']: inv for inv in invoices}
    wb = None
    try:
        wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
        if 'ChiTietHangHoa' in wb.sheetnames:
            ws = wb['ChiTietHangHoa']
            cols = get_col_map(ws)
            ws.reset_dimensions()
            names = [h[0] for h in DETAIL_HEADERS]
            fields = ('stt', 'tinh_chat', 'ma_hang', 'ten_hang', 'dvt', 'so_luong', 'don_gia',
                      'thanh_tien', 'thue_suat', 'tien_thue', 'tong_tien_dong')
            for values in ws.iter_rows(min_row=2, max_col=max(cols.values(), default=19), values_only=True):
                def value(name):
                    index = cols.get(name, names.index(name) + 1) - 1
                    return values[index] if index < len(values) else None
                key = '_'.join(str(value(name) or '').strip() for name in ('Ký hiệu HĐ', 'Số HĐ', 'MST Người bán'))
                if key in by_key:
                    item = dict(zip(fields, (value(name) for name in names[7:18])))
                    if item['tien_thue'] is None or item['tien_thue'] == '':
                        item['tien_thue'] = calculate_line_tax(to_float(item['thanh_tien']), item['thue_suat'])
                    if (item['tong_tien_dong'] is None or item['tong_tien_dong'] == '') and item['tien_thue'] is not None:
                        item['tong_tien_dong'] = to_float(item['thanh_tien']) + to_float(item['tien_thue'])
                    by_key[key]['hang_hoa'].append(item)
        return {'success': True, 'invoices': invoices}
    except Exception as exc:
        return {'success': False, 'error': f'Không thể đọc chi tiết Excel: {exc}'}
    finally:
        if wb is not None:
            wb.close()
