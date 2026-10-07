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

import re
import json
import zipfile
import subprocess
import webbrowser
import urllib.request
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
    read_excel_invoice_details,
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

from terms import TERMS_VERSION, TERMS_SECTIONS

SETTINGS_FILE = os.path.join(config.DATA_DIR, 'app_settings.json')

def load_user_settings():
    """Đọc cấu hình người dùng (theme, đường dẫn excel) đã lưu"""
    default_settings = {
        'theme': 'rose',
        'excel_path': config.DEFAULT_EXCEL_PATH,
        'setup_completed': False,
        'sidebar_collapsed': False
    }
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                saved = json.load(f)
                if isinstance(saved, dict):
                    default_settings.update(saved)
        except Exception:
            pass
    return default_settings

def save_user_settings(settings):
    """Thay cấu hình nguyên tử; không báo thành công khi không ghi được."""
    import tempfile
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=os.path.dirname(SETTINGS_FILE),
                                         prefix='settings-', suffix='.tmp', delete=False) as file:
            temporary_path = file.name
            json.dump(settings, file, ensure_ascii=False, indent=2)
        os.replace(temporary_path, SETTINGS_FILE)
        return True
    except Exception:
        return False
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.remove(temporary_path)


def setup_required(settings):
    return not (settings.get('setup_completed') is True and settings.get('accepted_terms_version') == TERMS_VERSION)

_initial_settings = load_user_settings()
current_excel_path = _initial_settings.get('excel_path', config.DEFAULT_EXCEL_PATH)
if not setup_required(_initial_settings) and not os.path.exists(current_excel_path):
    ensure_excel_file(current_excel_path).close()

@app.after_request
def add_tracking_headers(response):
    """Gắn metadata bản quyền, tác giả và tracking ID vào mọi HTTP Response (chuẩn ASCII header an toàn)"""
    response.headers['X-Author'] = 'Le Minh Triet (MinhTrietEras)'
    response.headers['X-Organization'] = 'MinhTrietEras'
    response.headers['X-Website'] = 'https://leminhtriet.com'
    response.headers['X-App-Name'] = 'Trich Xuat Hoa Don'
    response.headers['X-App-Version'] = str(config.APP_VERSION)
    response.headers['X-Tracking-ID'] = str(config.TRACKING_ID)
    response.headers['X-Powered-By'] = 'MinhTrietEras (https://leminhtriet.com)'
    return response

@app.route('/')
def index():
    return render_template('index.html', app_version=config.APP_VERSION, terms_version=TERMS_VERSION, terms_sections=TERMS_SECTIONS)

@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    from urllib.parse import urlsplit
    from feedback import send_feedback, FeedbackError
    # A third-party website must not turn the local desktop app into an outbound relay.
    origin = request.headers.get('Origin')
    host = urlsplit(request.host_url)
    if request.remote_addr not in ('127.0.0.1', '::1') or host.hostname not in ('127.0.0.1', 'localhost', '::1'):
        return jsonify({'success': False, 'error': 'Yêu cầu không được phép.'}), 403
    if (origin and origin != request.host_url.rstrip('/')) or request.headers.get('Sec-Fetch-Site') == 'cross-site':
        return jsonify({'success': False, 'error': 'Yêu cầu không được phép.'}), 403
    if setup_required(load_user_settings()):
        return jsonify({'success': False, 'error': 'Hãy hoàn tất thiết lập ứng dụng trước khi gửi góp ý.'}), 403
    if not request.is_json:
        return jsonify({'success': False, 'error': 'Dữ liệu góp ý không hợp lệ.'}), 415
    if (request.content_length or 0) > 16384 or len(request.get_data(cache=True)) > 16384:
        return jsonify({'success': False, 'error': 'Nội dung quá lớn.'}), 413
    try:
        return jsonify(send_feedback(request.get_json(silent=True)))
    except FeedbackError as error:
        return jsonify({'success': False, 'error': str(error)}), error.status


@app.route('/api/status', methods=['GET'])
def get_status():
    """Lấy trạng thái, thống kê file Excel hiện tại và metadata bản quyền hệ thống"""
    global current_excel_path
    summary = read_excel_summary(current_excel_path)
    user_settings = load_user_settings()
    return jsonify({
        'excel_path': current_excel_path,
        'excel_exists': os.path.exists(current_excel_path),
        'theme': user_settings.get('theme', 'rose'),
        'stats': summary.get('stats', {}),
        'file_size_kb': summary.get('file_size_kb', 0),
        'metadata': {
            'author': config.AUTHOR,
            'organization': config.ORGANIZATION,
            'website': config.WEBSITE,
            'app_name': config.APP_NAME,
            'version': config.APP_VERSION,
            'copyright': config.COPYRIGHT,
            'tracking_id': config.TRACKING_ID
        }
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

    valid_invoices = [r for r in results if r.get('success')]
    duplicate_count = len([r for r in valid_invoices if r.get('already_in_excel')])
    new_count = len([r for r in valid_invoices if not r.get('already_in_excel')])

    return jsonify({
        'success': True,
        'invoices': results,
        'total': len(results),
        'valid_count': len(valid_invoices),
        'error_count': error_count,
        'duplicate_count': duplicate_count,
        'new_count': new_count
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

    valid_invoices = [inv for inv in invoices if inv.get('success')]
    duplicate_count = len([inv for inv in valid_invoices if inv.get('already_in_excel')])
    new_count = len([inv for inv in valid_invoices if not inv.get('already_in_excel')])

    save_info = None
    if auto_save and invoices:
        if valid_invoices:
            save_info = save_invoices_to_excel(valid_invoices, current_excel_path, overwrite=overwrite)
            # Cập nhật trạng thái sau khi lưu
            if save_info.get('success'):
                for inv in valid_invoices:
                    inv['already_in_excel'] = True

    summary = read_excel_summary(current_excel_path)

    return jsonify({
        'success': True,
        'folder_path': folder_path,
        'total_files': scan_res.get('total_files', 0),
        'valid_count': scan_res.get('valid_count', 0),
        'error_count': scan_res.get('error_count', 0),
        'duplicate_count': duplicate_count,
        'new_count': new_count,
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

@app.route('/api/invoice-details', methods=['GET'])
def get_invoice_details():
    result = read_excel_invoice_details(current_excel_path, request.args.get('stt'))
    return jsonify(result), 200 if result.get('success') else 400

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
        settings = load_user_settings()
        settings['excel_path'] = current_excel_path
        save_user_settings(settings)
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
        settings = load_user_settings()
        settings['excel_path'] = current_excel_path
        save_user_settings(settings)
        summary = read_excel_summary(current_excel_path)
        res['stats'] = summary.get('stats', {})
        res['excel_path'] = current_excel_path
        res['file_size_kb'] = summary.get('file_size_kb', 0)
        return jsonify(res)
    else:
        return jsonify(res), 500

@app.route('/api/onboarding', methods=['GET', 'POST'])
def onboarding():
    global current_excel_path
    settings = load_user_settings()
    if request.method == 'GET':
        return jsonify({'success': True, 'required': setup_required(settings), 'terms_version': TERMS_VERSION,
                        'settings': settings})
    data = request.get_json() or {}
    if data.get('accepted_terms') is not True or data.get('terms_version') != TERMS_VERSION:
        return jsonify({'success': False, 'error': 'Vui lòng chấp nhận phiên bản điều khoản hiện tại.'}), 400
    theme = data.get('theme')
    if theme not in ['rose', 'purple', 'blue', 'green', 'amber', 'teal', 'red', 'slate']:
        return jsonify({'success': False, 'error': 'Vui lòng chọn màu giao diện hợp lệ.'}), 400
    path = str(data.get('excel_path') or '').strip()
    if not path or not os.path.isabs(path) or not path.lower().endswith('.xlsx'):
        return jsonify({'success': False, 'error': 'Chọn đường dẫn đầy đủ đến file Excel .xlsx.'}), 400
    path = os.path.normpath(path)
    try:
        if os.path.exists(path):
            summary = read_excel_summary(path)
            if summary.get('error'):
                raise ValueError('File Excel hiện có không đọc được; hãy chọn file khác. File cũ được giữ nguyên.')
            # Không chuyển sang workbook khác không có sheet dữ liệu của ứng dụng.
            import openpyxl
            workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
            try:
                if 'TongHopHoaDon' not in workbook.sheetnames:
                    raise ValueError('File đã có không phải sổ hóa đơn của ứng dụng. Hãy chọn tên file mới.')
            finally:
                workbook.close()
        else:
            ensure_excel_file(path).close()
        from datetime import datetime, timezone
        settings.update({'excel_path': path, 'theme': theme, 'setup_completed': True,
                         'accepted_terms_version': TERMS_VERSION,
                         'accepted_terms_at': datetime.now(timezone.utc).isoformat()})
        if not save_user_settings(settings):
            return jsonify({'success': False, 'error': 'Không lưu được cấu hình. Kiểm tra quyền ghi và thử lại.'}), 500
        current_excel_path = path
        return jsonify({'success': True, 'excel_path': path, 'settings': settings})
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 400

@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    """Lấy và cập nhật cấu hình người dùng (theme Material 3, excel_path)"""
    global current_excel_path
    if request.method == 'POST':
        data = request.get_json() or {}
        settings = load_user_settings()
        if 'theme' in data:
            theme_val = str(data['theme']).strip().lower()
            valid_themes = ['rose', 'purple', 'blue', 'green', 'amber', 'teal', 'red', 'slate']
            if theme_val in valid_themes:
                settings['theme'] = theme_val
        if 'excel_path' in data:
            new_p = str(data['excel_path']).strip()
            if new_p:
                settings['excel_path'] = new_p
                current_excel_path = new_p
        if 'sidebar_collapsed' in data and isinstance(data['sidebar_collapsed'], bool):
            settings['sidebar_collapsed'] = data['sidebar_collapsed']
        if not save_user_settings(settings):
            return jsonify({'success': False, 'error': 'Không lưu được cấu hình'}), 500
        return jsonify({'success': True, 'settings': settings})
    else:
        return jsonify({'success': True, 'settings': load_user_settings()})

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

def compare_versions(v1, v2):
    """
    So sánh hai chuỗi phiên bản dạng semver (ví dụ '2.0.0' và '2.1.0' hoặc 'v2.0.0').
    Trả về:
       1 nếu v1 > v2
      -1 nếu v1 < v2
       0 nếu v1 == v2
    """
    def parse_part(v):
        parts = re.findall(r'\d+', str(v))
        return [int(x) for x in parts] if parts else [0]
    p1 = parse_part(v1)
    p2 = parse_part(v2)
    max_len = max(len(p1), len(p2))
    p1 += [0] * (max_len - len(p1))
    p2 += [0] * (max_len - len(p2))
    if p1 > p2:
        return 1
    elif p1 < p2:
        return -1
    return 0

@app.route('/api/check-update', methods=['GET'])
def check_update_api():
    """
    Kiểm tra phiên bản mới nhất từ GitHub Releases công khai
    """
    current_version = config.APP_VERSION
    repo_url = "https://api.github.com/repos/leminhtrietit/trichxuathoadon/releases/latest"
    try:
        req = urllib.request.Request(
            repo_url,
            headers={
                'User-Agent': f'TrichXuatHoaDon-App/{current_version} (MinhTrietEras https://leminhtriet.com)'
            }
        )
        with urllib.request.urlopen(req, timeout=6) as response:
            if response.status == 200:
                raw_data = response.read().decode('utf-8')
                data = json.loads(raw_data)
                latest_tag = data.get('tag_name', '').strip()
                clean_tag = latest_tag.lstrip('v').strip()
                release_name = data.get('name', '') or latest_tag
                release_body = data.get('body', '')
                html_url = data.get('html_url', '')
                assets = data.get('assets', [])

                exe_download_url = None
                zip_download_url = None
                for a in assets:
                    name_lower = a.get('name', '').lower()
                    if name_lower.endswith('.exe'):
                        exe_download_url = a.get('browser_download_url')
                    elif name_lower.endswith('.zip'):
                        zip_download_url = a.get('browser_download_url')

                has_update = compare_versions(clean_tag, current_version) > 0

                return jsonify({
                    'success': True,
                    'current_version': current_version,
                    'latest_version': clean_tag,
                    'tag_name': latest_tag,
                    'has_update': has_update,
                    'release_name': release_name,
                    'release_notes': release_body,
                    'release_url': html_url,
                    'download_url': exe_download_url or zip_download_url or html_url,
                    'exe_download_url': exe_download_url,
                    'zip_download_url': zip_download_url,
                    'published_at': data.get('published_at', '')
                })
            else:
                return jsonify({
                    'success': False,
                    'error': f'Phản hồi từ GitHub mã {response.status}',
                    'current_version': current_version
                }), 502
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Không thể kiểm tra cập nhật: {str(e)}',
            'current_version': current_version
        }), 500

@app.route('/api/open-external-url', methods=['POST'])
def open_external_url_api():
    """
    Mở một URL bằng trình duyệt web mặc định của hệ điều hành Windows
    """
    data = request.get_json() or {}
    url = data.get('url', '').strip()
    if url and (url.startswith('http://') or url.startswith('https://')):
        try:
            webbrowser.open(url)
            return jsonify({'success': True, 'opened_url': url})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    return jsonify({'success': False, 'error': 'Đường dẫn không hợp lệ'}), 400

if __name__ == '__main__':
    print("==================================================")
    print("  TRICH XUAT HOA DON DIEN TU SANG EXCEL")
    print(f"  Dia chi truy cap: http://{config.HOST}:{config.PORT}")
    print(f"  File Excel luu tru: {current_excel_path}")
    print("==================================================")
    app.run(host=config.HOST, port=config.PORT, debug=False)
