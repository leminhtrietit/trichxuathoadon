"""Phép tính thuế từ dữ liệu hóa đơn, không suy đoán thuế suất áp dụng."""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re
import unicodedata


def normalize_tax_label(value):
    text = unicodedata.normalize('NFD', str(value)).replace('đ', 'd').replace('Đ', 'D')
    return re.sub(r'[^a-z0-9]', '', ''.join(char for char in text if not unicodedata.combining(char)).lower())


def calculate_line_tax(amount, rate):
    if amount is None:
        return None
    text = str(rate if rate is not None else '').strip()
    norm = normalize_tax_label(text)
    if norm in ('kct', 'kkknt', 'khongchiuthue', 'khongkekhaitinhnopthue', '0', '0%'):
        return 0.0

    # Tìm kiếm mẫu phần trăm: 8%, 10%, KHAC:8%, Khác: 8%
    match = re.search(r'(\d+(?:[.,]\d+)?)\s*%', text)
    if not match:
        match = re.search(r'(\d+(?:[.,]\d+)?)', text)
        if not match:
            return None
        raw_val = float(match.group(1).replace(',', '.'))
        if 0 < raw_val <= 0.2:
            percentage = Decimal(str(raw_val * 100))
        else:
            percentage = Decimal(str(raw_val))
    else:
        percentage = Decimal(match.group(1).replace(',', '.'))

    try:
        base = Decimal(str(amount))
        if not base.is_finite() or not 0 <= percentage <= 100:
            return None
        # Với số tiền nguyên (thường gặp trong hóa đơn VND), làm tròn thuế đến hàng đơn vị
        if base == base.to_integral():
            raw_tax = (base * percentage / Decimal(100)).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        else:
            raw_tax = (base * percentage / Decimal(100)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return float(raw_tax)
    except (InvalidOperation, ValueError, TypeError):
        return None
