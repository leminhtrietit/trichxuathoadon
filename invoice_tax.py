"""Phép tính thuế từ dữ liệu hóa đơn, không suy đoán thuế suất áp dụng."""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re
import unicodedata


def normalize_tax_label(value):
    text = unicodedata.normalize('NFD', str(value)).replace('đ', 'd').replace('Đ', 'D')
    return re.sub(r'[^a-z0-9]', '', ''.join(char for char in text if not unicodedata.combining(char)).lower())


def calculate_line_tax(amount, rate):
    text = str(rate if rate is not None else '').strip()
    if normalize_tax_label(text) in ('kct', 'kkknt', 'khongchiuthue', 'khongkekhaitinhnopthue'):
        return 0.0
    match = re.fullmatch(r'(\d+(?:[.,]\d+)?)\s*%?', text)
    if not match or amount is None:
        return None
    try:
        percentage = Decimal(match.group(1).replace(',', '.'))
        base = Decimal(str(amount))
        if not base.is_finite() or not 0 <= percentage <= 100:
            return None
        return float((base * percentage / Decimal(100)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
    except (InvalidOperation, ValueError, TypeError):
        return None
