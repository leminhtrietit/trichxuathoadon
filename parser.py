"""
parser.py - Module trích xuất thông tin hóa đơn điện tử từ file XML và PDF
Tác giả / Bản quyền: Lê Minh Triết (MinhTrietEras)
Website: https://leminhtriet.com
Bản quyền © 2026 MinhTrietEras. All rights reserved.

Hỗ trợ:
  - Chuẩn Thông tư 78/2021/TT-BTC & Nghị định 123/2020/NĐ-CP
  - Chuẩn Thông tư 32 và các nhà cung cấp VNPT, Viettel, MISA, BKAV, FPT, CMC...
  - Đọc file XML trực tiếp
  - Đọc file PDF (trích xuất file XML đính kèm bên trong PDF hoặc bóc tách văn bản PDF)
  - Quét thư mục hàng loạt phân nhóm theo thư mục nhà cung cấp
"""

import os
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
import pypdf
from invoice_tax import calculate_line_tax, normalize_tax_label

def strip_namespace(tag):
    """Bỏ namespace trong tag XML, ví dụ {http://...}HDon -> HDon"""
    if '}' in tag:
        return tag.split('}', 1)[1]
    return tag

def clean_element_tree(element):
    """Đệ quy loại bỏ namespace khỏi toàn bộ cây XML để dễ tìm kiếm"""
    element.tag = strip_namespace(element.tag)
    for child in list(element):
        clean_element_tree(child)
    return element

def safe_text(elem, path=None, default=''):
    """Lấy nội dung text an toàn từ element hoặc path"""
    if elem is None:
        return default
    if path:
        child = elem.find(path)
        if child is not None and child.text is not None:
            return child.text.strip()
        return default
    if elem.text is not None:
        return elem.text.strip()
    return default

def safe_float(val, default=0.0):
    """Chuyển chuỗi số sang float an toàn"""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip().replace(' ', '')
    # Xử lý dấu chấm ngăn cách nghìn như 300.000 hoặc 300,000
    if '.' in val_str and ',' not in val_str:
        parts = val_str.split('.')
        if len(parts) > 1 and all(len(p) == 3 for p in parts[1:]):
            val_str = ''.join(parts)
    elif ',' in val_str and '.' in val_str:
        if val_str.rfind(',') > val_str.rfind('.'):
            val_str = val_str.replace('.', '').replace(',', '.')
        else:
            val_str = val_str.replace(',', '')
    elif ',' in val_str:
        parts = val_str.split(',')
        if len(parts) > 1 and all(len(p) == 3 for p in parts[1:]):
            val_str = ''.join(parts)
        else:
            val_str = val_str.replace(',', '.')
    try:
        return float(val_str)
    except (ValueError, TypeError):
        return default

def safe_int(val, default=0):
    """Chuyển chuỗi sang số nguyên an toàn"""
    if val is None:
        return default
    if isinstance(val, int):
        return val
    try:
        return int(safe_float(val, default))
    except (ValueError, TypeError):
        return default

def parse_xml_invoice(xml_source, filename=''):
    """
    Trích xuất toàn bộ dữ liệu hóa đơn từ chuỗi XML hoặc file path.
    """
    try:
        if isinstance(xml_source, (bytes, str)):
            if isinstance(xml_source, str) and (xml_source.endswith('.xml') or '\n' not in xml_source and len(xml_source) < 500 and not xml_source.strip().startswith('<')):
                tree = ET.parse(xml_source)
                root = tree.getroot()
            else:
                if isinstance(xml_source, str):
                    xml_bytes = xml_source.encode('utf-8')
                else:
                    xml_bytes = xml_source
                root = ET.fromstring(xml_bytes)
        else:
            root = xml_source
    except Exception as e:
        return {
            'success': False,
            'error': f'Không thể đọc cấu trúc XML: {str(e)}',
            'filename': filename,
            'file_type': 'XML'
        }

    root = clean_element_tree(root)

    dlhdon = root.find('.//DLHDon')
    if dlhdon is None:
        dlhdon = root

    ttchung = dlhdon.find('.//TTChung')
    if ttchung is None:
        ttchung = dlhdon.find('.//GeneralInvoiceInfo') or dlhdon

    ten_hoa_don = safe_text(ttchung, 'THDon') or safe_text(ttchung, 'InvoiceName') or 'Hóa đơn GTGT'
    phien_ban = safe_text(ttchung, 'PBan') or safe_text(ttchung, 'InvoiceVersion') or '2.1.0'
    mau_so = safe_text(ttchung, 'KHMSHDon') or safe_text(ttchung, 'InvoiceForm') or ''
    ky_hieu = safe_text(ttchung, 'KHHDon') or safe_text(ttchung, 'InvoiceSeries') or ''
    so_hd = safe_text(ttchung, 'SHDon') or safe_text(ttchung, 'InvoiceNumber') or ''
    
    if so_hd:
        so_hd = str(so_hd).strip()
    
    ngay_lap = safe_text(ttchung, 'NLap') or safe_text(ttchung, 'InvoiceDate') or ''
    hinh_thuc_tt = safe_text(ttchung, 'HTTToan') or safe_text(ttchung, 'PaymentMethod') or ''
    dong_tien = safe_text(ttchung, 'DVTTe') or safe_text(ttchung, 'Currency') or 'VND'
    ty_gia = safe_float(safe_text(ttchung, 'TGia') or '1')
    mst_tcgp = safe_text(ttchung, 'MSTTCGP') or ''

    mccqt_elem = root.find('.//MCCQT')
    mccqt = mccqt_elem.text.strip() if (mccqt_elem is not None and mccqt_elem.text) else ''

    ndhdon = dlhdon.find('.//NDHDon')
    if ndhdon is None:
        ndhdon = dlhdon

    nban = ndhdon.find('NBan') or ndhdon.find('.//Seller')
    seller = {
        'ten': safe_text(nban, 'Ten') or safe_text(nban, 'SellerName') or safe_text(nban, 'Name'),
        'mst': safe_text(nban, 'MST') or safe_text(nban, 'SellerTaxCode') or safe_text(nban, 'TaxCode'),
        'dia_chi': safe_text(nban, 'DChi') or safe_text(nban, 'SellerAddress') or safe_text(nban, 'Address'),
        'sdt': safe_text(nban, 'SDThoai') or safe_text(nban, 'SellerPhoneNumber') or safe_text(nban, 'PhoneNumber'),
        'email': safe_text(nban, 'DCTDTu') or safe_text(nban, 'SellerEmail') or safe_text(nban, 'Email'),
        'stk': safe_text(nban, 'STKNHang') or safe_text(nban, 'SellerBankAccount') or '',
        'ngan_hang': safe_text(nban, 'TNHang') or safe_text(nban, 'SellerBankName') or '',
        'ma_cua_hang': safe_text(nban, 'MCHang') or '',
        'ten_cua_hang': safe_text(nban, 'TCHang') or '',
    }

    nmua = ndhdon.find('NMua') or ndhdon.find('.//Buyer')
    buyer = {
        'ten': safe_text(nmua, 'Ten') or safe_text(nmua, 'BuyerLegalName') or safe_text(nmua, 'BuyerName') or safe_text(nmua, 'Name'),
        'mst': safe_text(nmua, 'MST') or safe_text(nmua, 'BuyerTaxCode') or safe_text(nmua, 'TaxCode'),
        'dia_chi': safe_text(nmua, 'DChi') or safe_text(nmua, 'BuyerAddress') or safe_text(nmua, 'Address'),
        'sdt': safe_text(nmua, 'SDThoai') or safe_text(nmua, 'BuyerPhoneNumber') or '',
        'email': safe_text(nmua, 'DCTDTu') or safe_text(nmua, 'BuyerEmail') or '',
        'ho_ten_nguoi_mua': safe_text(nmua, 'HTen') or safe_text(nmua, 'BuyerDisplayName') or '',
        'stk': safe_text(nmua, 'STKNHang') or safe_text(nmua, 'BuyerBankAccount') or '',
        'ngan_hang': safe_text(nmua, 'TNHang') or safe_text(nmua, 'BuyerBankName') or '',
    }

    items = []
    dshhdvu = ndhdon.find('DSHHDVu') or ndhdon.find('.//InvoiceDetails') or ndhdon
    hhdvu_list = []
    if dshhdvu is not None:
        hhdvu_list = dshhdvu.findall('HHDVu')
        if not hhdvu_list:
            hhdvu_list = dshhdvu.findall('.//Item')
        if not hhdvu_list:
            hhdvu_list = dshhdvu.findall('.//Product')

    for idx, item_elem in enumerate(hhdvu_list, start=1):
        stt = safe_text(item_elem, 'STT') or str(idx)
        tchat = safe_text(item_elem, 'TChat') or '1'
        ma_hang = safe_text(item_elem, 'MHHDVu') or safe_text(item_elem, 'ProductCode') or safe_text(item_elem, 'ItemCode') or ''
        ten_hang = safe_text(item_elem, 'THHDVu') or safe_text(item_elem, 'ProductName') or safe_text(item_elem, 'ItemName') or ''
        dvt = safe_text(item_elem, 'DVTinh') or safe_text(item_elem, 'UnitName') or safe_text(item_elem, 'Unit') or ''
        so_luong = safe_float(safe_text(item_elem, 'SLuong') or safe_text(item_elem, 'Quantity'))
        don_gia = safe_float(safe_text(item_elem, 'DGia') or safe_text(item_elem, 'UnitPrice'))
        thanh_tien = safe_float(safe_text(item_elem, 'ThTien') or safe_text(item_elem, 'Amount') or safe_text(item_elem, 'Total'))
        thue_suat = safe_text(item_elem, 'TSuat') or safe_text(item_elem, 'TaxRate') or safe_text(item_elem, 'VATRate') or ''

        # Ưu tiên số tiền thuế khai báo, kể cả 0 hoặc số âm; không dùng truthiness của Element.
        tien_thue_dong = None
        for tag in ('TThue', 'VATAmount', 'TaxAmount'):
            text = safe_text(item_elem, tag)
            if text:
                tien_thue_dong = safe_float(text, default=None)
                if tien_thue_dong is not None:
                    break
        if tien_thue_dong is None:
            for ttin in item_elem.findall('.//TTin'):
                label = normalize_tax_label(safe_text(ttin, 'TTruong'))
                if label in ('tthue', 'tienthue', 'tienthuegtgt', 'vatamount', 'taxamount'):
                    tien_thue_dong = safe_float(safe_text(ttin, 'DLieu'), default=None)
                    if tien_thue_dong is not None:
                        break
        if tien_thue_dong is None:
            tien_thue_dong = calculate_line_tax(thanh_tien, thue_suat)

        items.append({
            'stt': stt,
            'tinh_chat': tchat,
            'ma_hang': ma_hang,
            'ten_hang': ten_hang,
            'dvt': dvt,
            'so_luong': so_luong,
            'don_gia': don_gia,
            'thanh_tien': thanh_tien,
            'thue_suat': thue_suat,
            'tien_thue': tien_thue_dong,
            'tong_tien_dong': thanh_tien + tien_thue_dong if tien_thue_dong is not None else None
        })

    ttoan = ndhdon.find('TToan') or ndhdon.find('.//Payment')
    tong_tien_chua_thue = safe_float(safe_text(ttoan, 'TgTCThue') or safe_text(ttoan, 'TotalAmountWithoutVAT'))
    tong_tien_thue = safe_float(safe_text(ttoan, 'TgTThue') or safe_text(ttoan, 'TotalVATAmount'))
    tong_tien_thanh_toan = safe_float(safe_text(ttoan, 'TgTTTBSo') or safe_text(ttoan, 'TotalAmountWithVAT') or safe_text(ttoan, 'TotalAmount'))
    tong_tien_chu = safe_text(ttoan, 'TgTTTBChu') or safe_text(ttoan, 'TotalAmountInWords') or ''

    danh_sach_thue_suat = []
    if ttoan is not None:
        for lt_suat in ttoan.findall('.//LTSuat'):
            danh_sach_thue_suat.append({
                'thue_suat': safe_text(lt_suat, 'TSuat'),
                'thanh_tien': safe_float(safe_text(lt_suat, 'ThTien')),
                'tien_thue': safe_float(safe_text(lt_suat, 'TThue'))
            })

    if tong_tien_thanh_toan == 0 and items:
        tong_tien_chua_thue = sum(it['thanh_tien'] for it in items)
        tong_tien_thue = sum(it['tien_thue'] or 0 for it in items)
        tong_tien_thanh_toan = tong_tien_chua_thue + tong_tien_thue

    ngay_ky = ''
    nguoi_ky = ''
    signing_time_elem = root.find('.//SigningTime')
    if signing_time_elem is not None and signing_time_elem.text:
        ngay_ky = signing_time_elem.text.strip()
    
    subject_elem = root.find('.//X509SubjectName')
    if subject_elem is not None and subject_elem.text:
        nguoi_ky = subject_elem.text.strip()

    invoice_key = f"{ky_hieu}_{so_hd}_{seller['mst']}".strip('_')

    return {
        'success': True,
        'filename': filename,
        'file_type': 'XML',
        'invoice_key': invoice_key,
        'thong_tin_chung': {
            'ten_hoa_don': ten_hoa_don,
            'phien_ban': phien_ban,
            'mau_so': mau_so,
            'ky_hieu': ky_hieu,
            'so_hd': so_hd,
            'ngay_lap': ngay_lap,
            'hinh_thuc_tt': hinh_thuc_tt,
            'dong_tien': dong_tien,
            'ty_gia': ty_gia,
            'ma_cqt': mccqt,
            'mst_tcgp': mst_tcgp,
            'ngay_ky': ngay_ky,
            'nguoi_ky': nguoi_ky
        },
        'nguoi_ban': seller,
        'nguoi_mua': buyer,
        'hang_hoa': items,
        'thanh_toan': {
            'tong_tien_chua_thue': tong_tien_chua_thue,
            'tong_tien_thue': tong_tien_thue,
            'tong_tien_thanh_toan': tong_tien_thanh_toan,
            'tong_tien_chu': tong_tien_chu,
            'chi_tiet_thue': danh_sach_thue_suat
        }
    }

def normalize_pdf_text(text):
    if not text:
        return ""
    text = text.replace('\xa0', ' ').replace('\xad', '-').replace('\u2010', '-').replace('\u2013', '-').replace('\u2014', '-')
    # Chuẩn hóa khoảng trắng quanh dấu chấm trong số tiền: "3 . 360 . 000" -> "3.360.000"
    for _ in range(5):
        text = re.sub(r'(\d)\s*\.\s*(\d)', r'\1.\2', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()

def extract_layout_text_from_pdf(pdf_source):
    """
    Trích xuất văn bản từ PDF theo đúng tọa độ trực quan (Visual layout-aware extraction)
    Giúp ghép các cột, các dòng của bảng và các khối dữ liệu chuẩn xác như mắt người đọc.
    """
    try:
        reader = pypdf.PdfReader(pdf_source)
    except Exception:
        return ""

    pages_text = []
    # Quét tối đa 6 trang đầu
    for page in reader.pages[:6]:
        parts = []
        def visitor(text, cm, tm, font_dict, font_size):
            if text and text.strip():
                parts.append((tm[4], tm[5], text.strip()))
                
        try:
            page.extract_text(visitor_text=visitor)
        except Exception:
            # Fallback nếu visitor_text lỗi
            raw_p = page.extract_text() or ''
            pages_text.append(raw_p)
            continue

        parts.sort(key=lambda item: (-item[1], item[0]))
        
        lines = []
        curr_y = None
        curr_line = []
        for x, y, t in parts:
            if curr_y is None or abs(y - curr_y) > 4.5:
                if curr_line:
                    curr_line.sort(key=lambda it: it[0])
                    lines.append(' '.join([it[1] for it in curr_line]))
                curr_y = y
                curr_line = [(x, t)]
            else:
                curr_line.append((x, t))
        if curr_line:
            curr_line.sort(key=lambda it: it[0])
            lines.append(' '.join([it[1] for it in curr_line]))
        pages_text.append('\n'.join(lines))
        
    raw_full = '\n'.join(pages_text)
    return normalize_pdf_text(raw_full)

def clean_label_prefix(val):
    if not val:
        return ""
    val = re.sub(r'^(?:Tên\s*đơn\s*vị|Company\'?s?\s*name|Đơn\s*vị\s*bán\s*hàng|Seller|Buyer|Người\s*bán|Người\s*mua|Họ\s*tên\s*người\s*mua\s*hàng)\s*[:.)-]?\s*', '', val, flags=re.IGNORECASE).strip()
    val = re.sub(r'\s*(?:Tên\s*đơn\s*vị|Mã\s*số\s*thuế|Địa\s*chỉ|Hình\s*thức).*$', '', val, flags=re.IGNORECASE).strip()
    return val

def parse_pdf_invoice(pdf_source, filename=''):
    """
    Trích xuất hóa đơn từ file PDF:
    1. Kiểm tra xem file PDF có nhúng file XML hóa đơn gốc bên trong không.
       Nếu có, giải nén và đọc trực tiếp từ XML (đạt độ chính xác 100%).
    2. Nếu không có file đính kèm, sử dụng bộ bóc tách tọa độ trực quan (Visual layout-aware)
       kết hợp đa mẫu biểu (M-Invoice, MISA, FAST, Thái Sơn, Taxi GSM,...).
    """
    try:
        reader = pypdf.PdfReader(pdf_source)

        # 1. Kiểm tra XML đính kèm trong PDF (embedded attachments)
        try:
            if hasattr(reader, 'attachments') and reader.attachments:
                for att_name, att_data in reader.attachments.items():
                    if att_name.lower().endswith('.xml'):
                        xml_bytes = att_data[0].get_data() if isinstance(att_data, list) else att_data.get_data()
                        parsed_xml = parse_xml_invoice(xml_bytes, filename=f"{filename} (Embedded: {att_name})")
                        if parsed_xml.get('success'):
                            parsed_xml['file_type'] = 'PDF (XML đính kèm)'
                            return parsed_xml
        except Exception:
            pass

        # 2. Bóc tách theo layout trực quan
        # Reset stream pointer nếu là file storage
        if hasattr(pdf_source, 'seek'):
            pdf_source.seek(0)

        full_text = extract_layout_text_from_pdf(pdf_source)
        if not full_text.strip():
            return {
                'success': False,
                'filename': filename,
                'file_type': 'PDF',
                'error': 'File PDF dạng ảnh quét (scan), không có lớp văn bản'
            }

        lower_txt = full_text.lower()
        if not any(k in lower_txt for k in ['hóa đơn', 'hoa don', 'invoice', 'ký hiệu', 'mã số thuế', 'vat']):
            return {
                'success': False,
                'filename': filename,
                'file_type': 'PDF',
                'error': 'Tệp không phải hóa đơn điện tử (bỏ qua)'
            }

        lines = [line.strip() for line in full_text.split('\n') if line.strip()]

        # 3. Ký hiệu hóa đơn
        ky_hieu = ''
        kh_m = re.search(r'Ký\s*hiệu\s*(?:\([^)]*\))?\s*:\s*([A-Za-z0-9\s]{3,12})', full_text, re.IGNORECASE)
        if kh_m:
            raw_kh = kh_m.group(1).replace(' ', '').strip()
            m_valid_kh = re.match(r'([12]?[A-Z]\d{2}[A-Z]{3})', raw_kh)
            if m_valid_kh:
                ky_hieu = m_valid_kh.group(1)
        if not ky_hieu:
            kh_m2 = re.search(r'\b([12][A-Z]\d{2}[A-Z]{3}|[A-Z]\d{2}[A-Z]{3})\b', full_text)
            if kh_m2:
                ky_hieu = kh_m2.group(1).strip()
        if not ky_hieu and filename:
            fn_m = re.search(r'([12][A-Z]\d{2}[A-Z]{3}|[A-Z]\d{2}[A-Z]{3})', filename)
            if fn_m:
                ky_hieu = fn_m.group(1)

        # 4. Số hóa đơn
        so_hd = ''
        for l in lines:
            m_so = re.search(r'^Số\s*(?:\([^)]*\))?\s*:\s*(\d+)', l, re.IGNORECASE)
            if m_so:
                so_hd = m_so.group(1).lstrip('0') or '0'
                break
            m_so2 = re.search(r'Số\s*(?:\([^)]*\))?\s*:\s*0*([1-9]\d{0,7})\b', l, re.IGNORECASE)
            if m_so2:
                so_hd = m_so2.group(1)
                break
                
        if not so_hd and filename:
            fn_so = re.search(r'(?:_|^)(\d{1,8})(?:_|\.pdf)', filename)
            if fn_so:
                so_hd = fn_so.group(1).lstrip('0') or '0'

        # 5. Ngày lập
        ngay_lap = ''
        ngay_m = re.search(r'Ngày\s*(?:\([^)]*\))?\s*(\d{1,2})\s*tháng\s*(?:\([^)]*\))?\s*(\d{1,2})\s*năm\s*(?:\([^)]*\))?\s*(\d{4})', full_text, re.IGNORECASE)
        if ngay_m:
            ngay_lap = f"{ngay_m.group(3)}-{ngay_m.group(2).zfill(2)}-{ngay_m.group(1).zfill(2)}"
        else:
            ngay_m2 = re.search(r'Ngày\s*(?:\([^)]*\))?\s*:\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})', full_text, re.IGNORECASE)
            if ngay_m2:
                ngay_lap = f"{ngay_m2.group(3)}-{ngay_m2.group(2).zfill(2)}-{ngay_m2.group(1).zfill(2)}"
            else:
                ngay_m3 = re.search(r'\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b', full_text)
                if ngay_m3:
                    ngay_lap = f"{ngay_m3.group(3)}-{ngay_m3.group(2).zfill(2)}-{ngay_m3.group(1).zfill(2)}"

        # 6. Mã CQT
        ma_cqt = ''
        cqt_m = re.search(r'(?:Mã\s*của\s*cơ\s*quan\s*thuế|Mã\s*cơ\s*quan\s*thuế\s*cấp|Mã\s*(?:của\s*)?CQT)\s*:\s*([A-Za-z0-9\- \n]{10,50})', full_text, re.IGNORECASE)
        if cqt_m:
            raw_cqt = cqt_m.group(1).replace(' ', '').replace('\n', '').strip()
            raw_cqt = re.sub(r'HÓA.*$', '', raw_cqt, flags=re.IGNORECASE)
            m_cqt_clean = re.match(r'([A-Za-z0-9\-]{10,40})', raw_cqt)
            if m_cqt_clean:
                ma_cqt = m_cqt_clean.group(1).rstrip('Hh')

        # 7. Phân tích Người Bán và Người Mua
        full_text_repaired = re.sub(r'(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)', r'\1\2\3\4\5\6\7\8\9\10', full_text)
        software_msts = {'0101243150', '0101300842', '0100727825'}
        
        seller_name = ''
        seller_mst = ''
        seller_addr = ''
        buyer_name = ''
        buyer_mst = ''
        buyer_addr = ''

        company_patterns = re.findall(r'((?:CÔNG\s+TY|CHI\s+NHÁNH|DOANH\s+NGHIỆP|TỔNG\s+CÔNG\s+TY|TRUNG\s+TÂM|VIỆN)[^\n\r,;:]{4,100})', full_text_repaired, re.IGNORECASE)
        clean_companies = []
        for comp in company_patterns:
            c_clean = clean_label_prefix(comp)
            if any(sw in c_clean.lower() for sw in ['phần mềm misa', 'công nghệ thái sơn', 'phần mềm quản lý doanh nghiệp fast']):
                continue
            if c_clean and c_clean not in clean_companies:
                clean_companies.append(c_clean)

        if len(clean_companies) >= 2:
            seller_name = clean_companies[0]
            buyer_name = clean_companies[1]
        elif len(clean_companies) == 1:
            seller_name = clean_companies[0]

        m_buyer_line = re.search(r'Tên\s*đơn\s*vị\s*(?:\([^)]*\))?\s*:\s*([^\n\r]+)', full_text_repaired, re.IGNORECASE)
        if m_buyer_line:
            b_val = clean_label_prefix(m_buyer_line.group(1))
            if b_val and len(b_val) > 4:
                buyer_name = b_val

        # Tìm MST Người Bán và Người Mua
        mst_matches = []
        for l in lines:
            if re.search(r'Điện\s*thoại|Tel|Hotline', l, re.IGNORECASE):
                continue
            m_tax = re.search(r'(?:Mã\s*số\s*thuế|Tax\s*code|MST)(?:\s*\([^)]*\))?\s*:\s*([0-9\-]{10,14})', l, re.IGNORECASE)
            if m_tax:
                mst_matches.append(m_tax.group(1).strip())
            else:
                m_tax_box = re.search(r'(?:Mã\s*số\s*thuế|Tax\s*code|MST)(?:\s*\([^)]*\))?\s*:\s*([0-9\s]{19,25})', l, re.IGNORECASE)
                if m_tax_box:
                    joined_digits = m_tax_box.group(1).replace(' ', '').strip()
                    if len(joined_digits) in (10, 13, 14):
                        mst_matches.append(joined_digits)

        mst_matches = [m for m in mst_matches if m.replace('-', '') not in software_msts]

        if len(mst_matches) >= 2:
            seller_mst = mst_matches[0]
            buyer_mst = mst_matches[1]
        elif len(mst_matches) == 1:
            seller_mst = mst_matches[0]

        if not buyer_mst:
            all_msts = re.findall(r'\b(0110648435|\d{10}(?:-\d{3})?)\b', full_text_repaired)
            for m in all_msts:
                if m != seller_mst and m.replace('-', '') not in software_msts:
                    buyer_mst = m
                    break

        m_saddr = re.search(r'(?:Đơn\s*vị\s*bán|Người\s*bán)[\s\S]{1,150}?Địa\s*chỉ(?:\s*\([^)]*\))?\s*:\s*([^\n\r]+)', full_text_repaired, re.IGNORECASE)
        if m_saddr:
            seller_addr = clean_label_prefix(m_saddr.group(1))

        m_baddr = re.search(r'(?:Người\s*mua|Tên\s*đơn\s*vị)[\s\S]{1,150}?Địa\s*chỉ(?:\s*\([^)]*\))?\s*:\s*([^\n\r]+)', full_text_repaired, re.IGNORECASE)
        if m_baddr:
            buyer_addr = clean_label_prefix(m_baddr.group(1))

        # 8. Tiền thanh toán
        tong_tien_chua_thue = 0.0
        tong_tien_thue = 0.0
        tong_tien_thanh_toan = 0.0
        tong_tien_chu = ''

        chu_m = re.search(r'(?:Số\s*tiền\s*viết\s*bằng\s*chữ|Amount\s*in\s*words|Bằng\s*chữ)(?:\s*\([^)]*\))?\s*:\s*([^\n\r.]+)', full_text_repaired, re.IGNORECASE)
        if chu_m:
            raw_chu = chu_m.group(1).strip()
            if not re.search(r'(tra cứu|tracking|website|http)', raw_chu, re.IGNORECASE):
                tong_tien_chu = raw_chu.capitalize()

        m_tong = re.search(r'(?:Tổng\s*cộng\s*tiền\s*thanh\s*toán|Total\s*payment|Tổng\s*tiền\s*thanh\s*toán|Total\s*of\s*payment)(?:\s*\([^)]*\))?\s*:\s*([0-9.,]+)', full_text_repaired, re.IGNORECASE)
        if not m_tong:
            m_tong = re.search(r'([0-9.,]{4,15})\s*(?:Tổng\s*cộng\s*tiền\s*thanh\s*toán|Tổng\s*tiền\s*thanh\s*toán)', full_text_repaired, re.IGNORECASE)
        if not m_tong:
            m_tong = re.search(r'Tổng\s*cộng\s*tiền\s*thanh\s*\n?\s*toán\s*\n?\s*:\s*([0-9.,]+)', full_text_repaired, re.IGNORECASE)
        if not m_tong:
            m_tong = re.search(r'Tổng\s*cộng\s*tiền\s*thanh\s*([0-9.,]{4,15})\s*\n?\s*toán', full_text_repaired, re.IGNORECASE)
        if m_tong:
            val_str = m_tong.group(1).replace(' ', '').replace('.', '').replace(',', '.')
            try:
                tong_tien_thanh_toan = float(val_str)
            except ValueError:
                pass

        m_chua = re.search(r'(?:Tổng\s*tiền\s*chưa\s*thuế\s*GTGT|Tổng\s*tiền\s*hàng|Cộng\s*tiền\s*hàng|Total\s*amount)(?:\s*\([^)]*\))?\s*:\s*([0-9.,]+)', full_text_repaired, re.IGNORECASE)
        if not m_chua:
            m_chua = re.search(r'([0-9.,]{4,15})\s*(?:Tổng\s*tiền\s*chưa\s*thuế|Cộng\s*tiền\s*hàng)', full_text_repaired, re.IGNORECASE)
        if m_chua:
            val_str = m_chua.group(1).replace(' ', '').replace('.', '').replace(',', '.')
            try:
                tong_tien_chua_thue = float(val_str)
            except ValueError:
                pass

        m_thue = re.search(r'(?:Tổng\s*tiền\s*thuế\s*GTGT|Tiền\s*thuế\s*GTGT|VAT\s*amount)(?:\s*\([^)]*\))?\s*:\s*([0-9.,]+)', full_text_repaired, re.IGNORECASE)
        if not m_thue:
            m_thue = re.search(r'([0-9.,]{1,15})\s*(?:Tổng\s*tiền\s*thuế|Tiền\s*thuế\s*GTGT)', full_text_repaired, re.IGNORECASE)
        if m_thue:
            val_str = m_thue.group(1).replace(' ', '').replace('.', '').replace(',', '.')
            try:
                tong_tien_thue = float(val_str)
            except ValueError:
                pass

        if tong_tien_chua_thue == 0 and tong_tien_thanh_toan > 0:
            tong_tien_chua_thue = max(0.0, tong_tien_thanh_toan - tong_tien_thue)
        if tong_tien_thanh_toan == 0 and tong_tien_chua_thue > 0:
            tong_tien_thanh_toan = tong_tien_chua_thue + tong_tien_thue

        rates = re.findall(r'(?:Thuế\s*suất(?:\s*(?:GTGT|VAT))?|VAT\s*rate|Tax\s*rate)\s*:?\s*(\d+(?:[.,]\d+)?)\s*%', full_text_repaired, re.IGNORECASE)
        unique_rates = set(rate.replace(',', '.') for rate in rates)
        header_rate = next(iter(unique_rates)) + '%' if len(unique_rates) == 1 else ''

        # 9. Bóc tách mặt hàng (Line items)
        items = []
        seen_items = set()
        for l in lines:
            m_item = re.search(r'^(\d{1,2})\s+([^\d\n\r]{2,80})\s+(.+)$', l)
            if m_item:
                stt = int(m_item.group(1))
                raw_name = m_item.group(2).strip()
                rest = m_item.group(3).strip()
                if re.match(r'^(?:Tên\s*hàng|STT|Description|\d+\s*=\s*\d+)', raw_name, re.IGNORECASE):
                    continue
                item_key = f"{stt}_{raw_name}"
                if item_key in seen_items:
                    continue
                seen_items.add(item_key)

                line_rate_match = re.search(r'(\d+(?:[.,]\d+)?)\s*%\s*$', rest)
                line_rate = line_rate_match.group(1) + '%' if line_rate_match else ''
                if line_rate_match:
                    rest = rest[:line_rate_match.start()].rstrip()
                nums = re.findall(r'([0-9]{1,3}(?:\.[0-9]{3})+(?:,[0-9]+)?|\d+)', rest)
                m_dvt = re.match(r'^([A-Za-zÀ-ỹ]+)\s+', rest)
                dvt = m_dvt.group(1) if m_dvt else ''
                
                valid_floats = []
                for n_str in nums:
                    clean_n = n_str.replace('.', '').replace(',', '.')
                    try:
                        valid_floats.append(float(clean_n))
                    except ValueError:
                        pass
                        
                so_luong = 1.0
                don_gia = 0.0
                thanh_tien = 0.0
                if valid_floats:
                    thanh_tien = valid_floats[-1]
                    if len(valid_floats) >= 3:
                        so_luong = valid_floats[0]
                        don_gia = valid_floats[1]
                    elif len(valid_floats) == 2:
                        don_gia = valid_floats[0]
                        thanh_tien = valid_floats[1]
                    elif len(valid_floats) == 1:
                        don_gia = valid_floats[0]
                        thanh_tien = valid_floats[0]

                line_tax = calculate_line_tax(thanh_tien, line_rate)
                items.append({
                    'stt': str(stt),
                    'tinh_chat': '1',
                    'ma_hang': '',
                    'ten_hang': raw_name,
                    'dvt': dvt or 'Gói',
                    'so_luong': so_luong,
                    'don_gia': don_gia,
                    'thanh_tien': thanh_tien,
                    'thue_suat': line_rate,
                    'tien_thue': line_tax,
                    'tong_tien_dong': thanh_tien + line_tax if line_tax is not None else None
                })

        # Chỉ dùng thuế suất chung khi tiền hàng và tổng thuế đối chiếu khớp.
        if items and header_rate and m_thue is not None:
            taxes = [calculate_line_tax(item['thanh_tien'], item['thue_suat'] or header_rate) for item in items]
            if all(tax is not None for tax in taxes) and abs(sum(taxes) - tong_tien_thue) < 0.011 and abs(sum(item['thanh_tien'] for item in items) - tong_tien_chua_thue) < 0.011:
                for item, tax in zip(items, taxes):
                    if item['tien_thue'] is None:
                        item.update(thue_suat=header_rate, tien_thue=tax, tong_tien_dong=item['thanh_tien'] + tax)
        # Một dòng khớp toàn bộ tiền hàng thì tiền thuế tổng chính là thuế dòng đó.
        if len(items) == 1 and items[0]['tien_thue'] is None and m_thue is not None and abs(items[0]['thanh_tien'] - tong_tien_chua_thue) < 0.011:
            items[0].update(tien_thue=tong_tien_thue, tong_tien_dong=items[0]['thanh_tien'] + tong_tien_thue)

        if not items and tong_tien_thanh_toan > 0:
            # Fallback 1 dòng tổng quát nếu không tách được chi tiết
            items.append({
                'stt': '1',
                'tinh_chat': '1',
                'ma_hang': '',
                'ten_hang': 'Hàng hóa / Dịch vụ theo hóa đơn',
                'dvt': 'Lần',
                'so_luong': 1.0,
                'don_gia': tong_tien_chua_thue or tong_tien_thanh_toan,
                'thanh_tien': tong_tien_chua_thue or tong_tien_thanh_toan,
                'thue_suat': '',
                'tien_thue': tong_tien_thue if m_thue is not None else None,
                'tong_tien_dong': tong_tien_thanh_toan
            })

        # Kiểm tra tính hợp lệ tối thiểu của hóa đơn
        if not (so_hd or ky_hieu) or not seller_mst:
            return {
                'success': False,
                'filename': filename,
                'file_type': 'PDF',
                'error': 'Tệp PDF không chứa số hóa đơn hoặc mã số thuế hợp lệ (bỏ qua)'
            }

        invoice_key = f"{ky_hieu}_{so_hd}_{seller_mst}".strip('_')

        return {
            'success': True,
            'filename': filename,
            'file_type': 'PDF',
            'invoice_key': invoice_key,
            'thong_tin_chung': {
                'ten_hoa_don': 'Hóa đơn giá trị gia tăng (PDF)',
                'phien_ban': '2.0',
                'mau_so': ky_hieu[:1] if ky_hieu else '1',
                'ky_hieu': ky_hieu,
                'so_hd': so_hd,
                'ngay_lap': ngay_lap,
                'hinh_thuc_tt': 'TM/CK',
                'dong_tien': 'VND',
                'ty_gia': 1.0,
                'ma_cqt': ma_cqt,
                'mst_tcgp': '',
                'ngay_ky': ngay_lap,
                'nguoi_ky': seller_name
            },
            'nguoi_ban': {
                'ten': seller_name,
                'mst': seller_mst,
                'dia_chi': seller_addr,
                'sdt': '',
                'email': '',
                'stk': '',
                'ngan_hang': '',
                'ma_cua_hang': '',
                'ten_cua_hang': ''
            },
            'nguoi_mua': {
                'ten': buyer_name or 'Khách hàng',
                'mst': buyer_mst,
                'dia_chi': buyer_addr,
                'sdt': '',
                'email': '',
                'ho_ten_nguoi_mua': buyer_name,
                'stk': '',
                'ngan_hang': ''
            },
            'hang_hoa': items,
            'thanh_toan': {
                'tong_tien_chua_thue': tong_tien_chua_thue,
                'tong_tien_thue': tong_tien_thue,
                'tong_tien_thanh_toan': tong_tien_thanh_toan,
                'tong_tien_chu': tong_tien_chu,
                'chi_tiet_thue': []
            }
        }
    except Exception as e:
        return {
            'success': False,
            'filename': filename,
            'file_type': 'PDF',
            'error': f'Lỗi phân tích file PDF: {str(e)}'
        }

def parse_invoice_file(file_path):
    """Bóc tách bất kỳ file hóa đơn nào (XML hoặc PDF) dựa trên phần mở rộng"""
    filename = os.path.basename(file_path)
    lower = filename.lower()
    if lower.endswith('.xml'):
        return parse_xml_invoice(file_path, filename=filename)
    elif lower.endswith('.pdf'):
        return parse_pdf_invoice(file_path, filename=filename)
    else:
        return {
            'success': False,
            'filename': filename,
            'error': 'Định dạng file không được hỗ trợ (chỉ nhận .xml và .pdf)'
        }

def scan_folder_for_invoices(folder_path, recursive=False):
    """
    Quét toàn bộ thư mục tìm các file .xml và .pdf,
    bóc tách thông tin hóa đơn từ tất cả các file tìm thấy.
    """
    if not os.path.exists(folder_path):
        return {
            'success': False,
            'error': f'Thư mục không tồn tại: {folder_path}',
            'invoices': [],
            'total_files': 0
        }

    valid_extensions = ('.xml', '.pdf')
    target_files = []

    if recursive:
        for root, _, files in os.walk(folder_path):
            for f in files:
                if f.lower().endswith(valid_extensions):
                    target_files.append(os.path.join(root, f))
    else:
        for f in os.listdir(folder_path):
            full_p = os.path.join(folder_path, f)
            if os.path.isfile(full_p) and f.lower().endswith(valid_extensions):
                target_files.append(full_p)

    folder_norm = os.path.normpath(folder_path)
    folders_stats = {}
    results = []
    for fp in target_files:
        try:
            sz = os.path.getsize(fp)
            if sz < 500 or sz > 15 * 1024 * 1024:
                continue
        except Exception:
            pass

        # Xác định tên thư mục nhà cung cấp
        file_dir = os.path.dirname(os.path.normpath(fp))
        rel_dir = os.path.relpath(file_dir, folder_norm)
        if rel_dir == '.' or not rel_dir:
            supplier_folder = 'Thư mục gốc'
        else:
            supplier_folder = rel_dir.split(os.sep)[0]

        folders_stats[supplier_folder] = folders_stats.get(supplier_folder, 0) + 1

        parsed = parse_invoice_file(fp)
        parsed['supplier_folder'] = supplier_folder
        parsed['file_path'] = fp
        results.append(parsed)

    return {
        'success': True,
        'folder_path': folder_path,
        'total_files': len(target_files),
        'supplier_folders': [{'name': k, 'count': v} for k, v in sorted(folders_stats.items(), key=lambda x: x[1], reverse=True)],
        'invoices': results,
        'valid_count': len([r for r in results if r.get('success')]),
        'error_count': len([r for r in results if not r.get('success')])
    }
