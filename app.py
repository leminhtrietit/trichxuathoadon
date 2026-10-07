"""
Trích xuất hóa đơn - Web App trích xuất hóa đơn điện tử XML & PDF sang Excel
Tác giả / Bản quyền: Lê Minh Triết (MinhTrietEras)
Website: https://leminhtriet.com
Bản quyền © 2026 MinhTrietEras. All rights reserved.

Hỗ trợ:
  - Bóc tách hóa đơn XML và PDF (chuẩn TT78/ND123, TT32)
  - Quét hàng loạt trực tiếp từ thư mục trên máy (phân nhóm theo nhà cung cấp)
  - Bảng tổng quan Pivot & Bộ lọc đa chiều tương tác
  - Kiểm tra trùng lặp thông minh: Ghi đè (Replace) hoặc Bỏ qua (Skip)
  - Quản lý cấu hình file lưu trữ và xóa dữ liệu an toàn
"""

import os
import sys

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

import zipfile
import subprocess
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
import config
from parser import (
    parse_xml_invoice,
    parse_pdf_invoice,
    parse_invoice_file,
    scan_folder_for_invoices
)
from excel_manager import (
    ensure_excel_file,
    save_invoices_to_excel,
    read_excel_summary,
    get_existing_invoice_keys,
    init_blank_excel_file,
    clear_excel_data
)

if getattr(sys, 'frozen', False):
    base_dir = sys._MEIPASS
    app = Flask(__name__,
                template_folder=os.path.join(base_dir, 'templates'),
                static_folder=os.path.join(base_dir, 'static'))
else:
    app = Flask(__name__)

app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200MB cho phép upload nhiều file

current_excel_path = config.DEFAULT_EXCEL_PATH
ensure_excel_file(current_excel_path)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status', methods=['GET'])
def get_status():
    """Lấy trạng thái và thống kê file Excel hiện tại"""
    global current_excel_path
    summary = read_excel_summary(current_excel_path)
    return jsonify({
        'excel_path': current_excel_path,
        'excel_exists': os.path.exists(current_excel_path),
        'stats': summary.get('stats', {}),
        'file_size_kb': summary.get('file_size_kb', 0)
    })

@app.route('/api/upload', methods=['POST'])
def upload_files():
    """
    Tiếp nhận danh sách file XML, PDF hoặc file ZIP chứa XML/PDF tải lên
    """
    global current_excel_path
    if 'files' not in request.files:
        return jsonify({'success': False, 'error': 'Không có file nào được gửi lên'}), 400

    uploaded_files = request.files.getlist('files')
    if not uploaded_files or uploaded_files[0].filename == '':
        return jsonify({'success': False, 'error': 'Vui lòng chọn ít nhất một file XML hoặc PDF'}), 400

    existing_keys = get_existing_invoice_keys(current_excel_path)
    results = []
    error_count = 0

    for file_storage in uploaded_files:
        filename = file_storage.filename
        lower_name = filename.lower()

        # 1. File ZIP
        if lower_name.endswith('.zip'):
            try:
                with zipfile.ZipFile(file_storage.stream) as z:
                    for zip_info in z.infolist():
                        zip_lower = zip_info.filename.lower()
                        if (zip_lower.endswith('.xml') or zip_lower.endswith('.pdf')) and not zip_info.is_dir():
                            if '__MACOSX' in zip_info.filename or zip_info.filename.startswith('.'):
                                continue
                            with z.open(zip_info) as sub_file:
                                file_content = sub_file.read()
                                base_sub_name = os.path.basename(zip_info.filename)
                                if zip_lower.endswith('.xml'):
                                    parsed = parse_xml_invoice(file_content, filename=base_sub_name)
                                else:
                                    parsed = parse_pdf_invoice(file_content, filename=base_sub_name)

                                if parsed.get('success'):
                                    parsed['already_in_excel'] = parsed.get('invoice_key') in existing_keys
                                    results.append(parsed)
                                else:
                                    error_count += 1
                                    results.append(parsed)
            except Exception as e:
                error_count += 1
                results.append({
                    'success': False,
                    'filename': filename,
                    'error': f'Lỗi khi giải nén file zip: {str(e)}'
                })

        # 2. File XML
        elif lower_name.endswith('.xml'):
            try:
                xml_content = file_storage.read()
                parsed = parse_xml_invoice(xml_content, filename=filename)
                if parsed.get('success'):
                    parsed['already_in_excel'] = parsed.get('invoice_key') in existing_keys
                    results.append(parsed)
                else:
                    error_count += 1
                    results.append(parsed)
            except Exception as e:
                error_count += 1
                results.append({
                    'success': False,
                    'filename': filename,
                    'error': f'Lỗi đọc file XML: {str(e)}'
                })

        # 3. File PDF
        elif lower_name.endswith('.pdf'):
            try:
                pdf_content = file_storage.stream
                parsed = parse_pdf_invoice(pdf_content, filename=filename)
                if parsed.get('success'):
                    parsed['already_in_excel'] = parsed.get('invoice_key') in existing_keys
                    results.append(parsed)
                else:
                    error_count += 1
                    results.append(parsed)
            except Exception as e:
                error_count += 1
                results.append({
                    'success': False,
                    'filename': filename,
                    'error': f'Lỗi đọc file PDF: {str(e)}'
                })

    return jsonify({
        'success': True,
        'invoices': results,
        'total': len(results),
        'valid_count': len([r for r in results if r.get('success')]),
        'error_count': error_count
    })

@app.route('/api/scan-folder', methods=['POST'])
def scan_folder_api():
    """
    Quét trực tiếp một thư mục trên máy tính cá nhân để tìm và bóc tách toàn bộ file XML / PDF.
    Tự động kiểm tra trùng lặp và ghi vào file Excel nếu người dùng yêu cầu.
    """
    global current_excel_path
    data = request.get_json() or {}
    folder_path = data.get('folder_path', '').strip()
    recursive = bool(data.get('recursive', False))
    auto_save = bool(data.get('auto_save', True))
    overwrite = bool(data.get('overwrite', False))

    if not folder_path:
        return jsonify({'success': False, 'error': 'Vui lòng nhập hoặc chọn đường dẫn thư mục'}), 400

    if not os.path.exists(folder_path):
        return jsonify({'success': False, 'error': f'Thư mục không tồn tại: {folder_path}'}), 404

    scan_res = scan_folder_for_invoices(folder_path, recursive=recursive)
    if not scan_res.get('success'):
        return jsonify(scan_res), 400

    existing_keys = get_existing_invoice_keys(current_excel_path)
    invoices = scan_res.get('invoices', [])

    # Đánh dấu hóa đơn đã có trong Excel
    for inv in invoices:
        if inv.get('success'):
            inv['already_in_excel'] = inv.get('invoice_key') in existing_keys

    save_info = None
    if auto_save and invoices:
        valid_invoices = [inv for inv in invoices if inv.get('success')]
        if valid_invoices:
            save_info = save_invoices_to_excel(valid_invoices, current_excel_path, overwrite=overwrite)
            # Cập nhật trạng thái sau khi lưu
            for inv in valid_invoices:
                inv['already_in_excel'] = True

    summary = read_excel_summary(current_excel_path)

    return jsonify({
        'success': True,
        'folder_path': folder_path,
        'total_files': scan_res.get('total_files', 0),
        'valid_count': scan_res.get('valid_count', 0),
        'error_count': scan_res.get('error_count', 0),
        'supplier_folders': scan_res.get('supplier_folders', []),
        'invoices': invoices,
        'save_info': save_info,
        'stats': summary.get('stats', {}),
        'excel_path': current_excel_path
    })

@app.route('/api/select-folder-dialog', methods=['POST'])
def select_folder_dialog():
    """
    Mở hộp thoại chọn thư mục gốc của Windows (Native Folder Dialog)
    """
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        
        folder_selected = filedialog.askdirectory(
            title="Chọn Thư Mục Chứa Hóa Đơn XML / PDF Cần Trích Xuất"
        )
        root.destroy()

        if folder_selected:
            # Chuẩn hóa đường dẫn Windows
            folder_selected = os.path.normpath(folder_selected)
            return jsonify({
                'success': True,
                'folder_path': folder_selected
            })
        else:
            return jsonify({
                'success': False,
                'cancelled': True,
                'message': 'Đã hủy chọn thư mục'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Không thể mở hộp thoại chọn thư mục: {str(e)}'
        }), 500

@app.route('/api/load-sample', methods=['POST'])
def load_sample():
    """Tải và trích xuất hóa đơn mẫu có sẵn để kiểm tra tức thì"""
    global current_excel_path
    sample_path = config.SAMPLE_XML_PATH
    if not os.path.exists(sample_path):
        return jsonify({
            'success': False,
            'error': f'Không tìm thấy file mẫu tại đường dẫn: {sample_path}'
        }), 404

    existing_keys = get_existing_invoice_keys(current_excel_path)
    parsed = parse_invoice_file(sample_path)
    if parsed.get('success'):
        parsed['already_in_excel'] = parsed.get('invoice_key') in existing_keys
        return jsonify({
            'success': True,
            'invoices': [parsed],
            'total': 1,
            'valid_count': 1,
            'error_count': 0
        })
    return jsonify({'success': False, 'error': parsed.get('error')}), 500

@app.route('/api/save-to-excel', methods=['POST'])
def save_to_excel_api():
    """Lưu danh sách hóa đơn đã chọn vào file Excel"""
    global current_excel_path
    data = request.get_json() or {}
    invoices = data.get('invoices', [])
    overwrite = bool(data.get('overwrite', False))

    if not invoices:
        return jsonify({'success': False, 'error': 'Không có dữ liệu hóa đơn để lưu'}), 400

    res = save_invoices_to_excel(invoices, current_excel_path, overwrite=overwrite)
    
    summary = read_excel_summary(current_excel_path)
    res['stats'] = summary.get('stats', {})
    res['excel_path'] = current_excel_path

    return jsonify(res)

@app.route('/api/excel-data', methods=['GET'])
def get_excel_data():
    """Lấy danh sách các hóa đơn đã có trong file Excel để hiển thị quản lý"""
    global current_excel_path
    summary = read_excel_summary(current_excel_path)
    return jsonify(summary)

@app.route('/api/download-excel', methods=['GET'])
def download_excel():
    """Tải file Excel về máy qua trình duyệt"""
    global current_excel_path
    if not os.path.exists(current_excel_path):
        ensure_excel_file(current_excel_path)
    return send_file(
        current_excel_path,
        as_attachment=True,
        download_name=os.path.basename(current_excel_path),
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

@app.route('/api/open-excel', methods=['POST'])
def open_excel_locally():
    """Mở trực tiếp file Excel trên máy Windows"""
    global current_excel_path
    ensure_excel_file(current_excel_path)
    try:
        os.startfile(current_excel_path)
        return jsonify({'success': True, 'message': 'Đã mở file Excel thành công'})
    except Exception as e:
        return jsonify({'success': False, 'error': f'Không thể mở file Excel: {str(e)}'}), 500

@app.route('/api/open-folder', methods=['POST'])
def open_folder_locally():
    """Mở thư mục chứa file Excel trong Windows File Explorer"""
    global current_excel_path
    ensure_excel_file(current_excel_path)
    try:
        norm_path = os.path.normpath(current_excel_path)
        subprocess.Popen(f'explorer /select,"{norm_path}"')
        return jsonify({'success': True, 'message': 'Đã mở thư mục chứa file Excel'})
    except Exception as e:
        return jsonify({'success': False, 'error': f'Không thể mở thư mục: {str(e)}'}), 500

@app.route('/api/update-config', methods=['POST'])
def update_config():
    """Đổi đường dẫn hoặc tên file Excel lưu trữ"""
    global current_excel_path
    data = request.get_json() or {}
    new_path = data.get('excel_path', '').strip()

    if not new_path:
        return jsonify({'success': False, 'error': 'Đường dẫn không được để trống'}), 400

    if not new_path.lower().endswith('.xlsx'):
        new_path += '.xlsx'

    try:
        ensure_excel_file(new_path)
        current_excel_path = new_path
        summary = read_excel_summary(current_excel_path)
        return jsonify({
            'success': True,
            'excel_path': current_excel_path,
            'stats': summary.get('stats', {})
        })
    except Exception as e:
        return jsonify({'success': False, 'error': f'Đường dẫn không hợp lệ: {str(e)}'}), 400

@app.route('/api/select-excel-save-dialog', methods=['POST'])
def select_excel_save_dialog():
    """
    Mở hộp thoại Save As của Windows để người dùng trực quan chọn vị trí và đặt tên file Excel lưu trữ mới
    """
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)

        filepath_selected = filedialog.asksaveasfilename(
            title="Chọn Nơi Lưu Trữ Hoặc Tạo File Excel Mới",
            defaultextension=".xlsx",
            filetypes=[("Excel Workbook", "*.xlsx"), ("All Files", "*.*")],
            initialfile="danh_sach_hoa_don.xlsx"
        )
        root.destroy()

        if filepath_selected:
            filepath_selected = os.path.normpath(filepath_selected)
            return jsonify({
                'success': True,
                'filepath': filepath_selected
            })
        else:
            return jsonify({
                'success': False,
                'cancelled': True,
                'message': 'Đã hủy thao tác chọn file'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Không thể mở hộp thoại chọn file: {str(e)}'
        }), 500

@app.route('/api/init-excel-file', methods=['POST'])
def init_excel_file_api():
    """
    Khởi tạo file Excel lưu trữ mới trắng tinh với chuẩn 3 Sheet (TongQuan, TongHopHoaDon, ChiTietHangHoa)
    và chuyển hệ thống sang sử dụng file này
    """
    global current_excel_path
    data = request.get_json() or {}
    new_path = data.get('excel_path', '').strip() or current_excel_path

    if not new_path.lower().endswith('.xlsx'):
        new_path += '.xlsx'

    res = init_blank_excel_file(new_path)
    if res.get('success'):
        current_excel_path = new_path
        summary = read_excel_summary(current_excel_path)
        res['stats'] = summary.get('stats', {})
        res['excel_path'] = current_excel_path
        res['file_size_kb'] = summary.get('file_size_kb', 0)
        return jsonify(res)
    else:
        return jsonify(res), 500

@app.route('/api/clear-data', methods=['POST'])
def clear_data_api():
    """
    Xóa sạch toàn bộ dữ liệu hóa đơn trong file Excel hiện tại với ràng buộc xác thực chuỗi nghiêm ngặt
    """
    global current_excel_path
    data = request.get_json() or {}
    confirmation = str(data.get('confirmation', '')).strip()

    REQUIRED_CONFIRMATION = "XÓA TOÀN BỘ DỮ LIỆU"
    if confirmation != REQUIRED_CONFIRMATION:
        return jsonify({
            'success': False,
            'error': f"Chuỗi xác nhận không chính xác! Bạn phải nhập đúng chính xác từng ký tự: '{REQUIRED_CONFIRMATION}'"
        }), 400

    res = clear_excel_data(current_excel_path)
    if res.get('success'):
        summary = read_excel_summary(current_excel_path)
        res['stats'] = summary.get('stats', {})
        res['excel_path'] = current_excel_path
        res['file_size_kb'] = summary.get('file_size_kb', 0)
        return jsonify(res)
    else:
        return jsonify(res), 500

if __name__ == '__main__':
    print("==================================================")
    print("  TRICH XUAT HOA DON DIEN TU SANG EXCEL")
    print(f"  Dia chi truy cap: http://{config.HOST}:{config.PORT}")
    print(f"  File Excel luu tru: {current_excel_path}")
    print("==================================================")
    app.run(host=config.HOST, port=config.PORT, debug=False)
