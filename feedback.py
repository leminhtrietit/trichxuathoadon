"""Gửi góp ý theo yêu cầu rõ ràng của người dùng; endpoint cố định, không kèm file."""
import json
import re
import uuid
import config

FEEDBACK_ENDPOINT = 'https://leminhtriet.com/api/app-feedback'
FEEDBACK_CONSENT_VERSION = 'feedback-v1'

class FeedbackError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def feedback_payload(data):
    if not isinstance(data, dict) or set(data) - {'message', 'email', 'consent', 'consent_version', 'request_id'}:
        raise FeedbackError('Dữ liệu góp ý không hợp lệ.')
    if data.get('consent') is not True or data.get('consent_version') != FEEDBACK_CONSENT_VERSION:
        raise FeedbackError('Hãy cho phép kết nối Internet trước khi gửi góp ý.')
    message = data.get('message')
    email = data.get('email', '')
    if not isinstance(message, str) or not 10 <= len(message.strip()) <= 4000 or '\x00' in message:
        raise FeedbackError('Nội dung cần có từ 10 đến 4.000 ký tự.')
    if not isinstance(email, str) or len(email.strip()) > 254 or (email.strip() and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email.strip())):
        raise FeedbackError('Email không hợp lệ.')
    try:
        request_id = uuid.UUID(data.get('request_id', ''))
        if request_id.version != 4 or str(request_id) != data['request_id'].lower():
            raise ValueError()
    except (ValueError, TypeError, AttributeError, KeyError):
        raise FeedbackError('Mã gửi góp ý không hợp lệ.')
    return {'request_id': str(request_id), 'app_id': 'trich-xuat-hoa-don', 'app_version': config.APP_VERSION,
            'message': message.strip(), 'email': email.strip(), 'consent': True,
            'consent_version': FEEDBACK_CONSENT_VERSION}


def send_feedback(data):
    payload = feedback_payload(data)  # Validate consent BEFORE creating any network client.
    import requests
    try:
        with requests.Session() as session:
            session.trust_env = False
            with session.post(FEEDBACK_ENDPOINT, json=payload, timeout=(5, 10), allow_redirects=False, stream=True,
                              headers={'Accept': 'application/json', 'User-Agent': 'TrichXuatHoaDon/' + config.APP_VERSION}) as response:
                if response.status_code not in (200, 201):
                    if response.status_code == 429:
                        raise FeedbackError('Bạn gửi quá nhiều góp ý. Vui lòng thử lại sau.', 429)
                    if response.status_code == 409:
                        raise FeedbackError('Mã gửi bị trùng với nội dung khác. Hãy chỉnh nội dung rồi gửi lại.', 409)
                    raise FeedbackError('Website chưa thể nhận góp ý. Nội dung được giữ để bạn thử lại sau.', 503)
                chunks = []
                size = 0
                for chunk in response.iter_content(chunk_size=4096):
                    size += len(chunk)
                    if size > 16384:
                        raise FeedbackError('Phản hồi website không hợp lệ; chưa xác nhận gửi thành công.', 502)
                    chunks.append(chunk)
                result = json.loads(b''.join(chunks))
                if result.get('success') is not True or result.get('id') != payload['request_id']:
                    raise FeedbackError('Website chưa xác nhận lưu góp ý.', 502)
                return {'success': True, 'id': result['id']}
    except FeedbackError:
        raise
    except requests.RequestException:
        raise FeedbackError('Không thể kết nối website. Hãy kiểm tra Internet rồi chủ động thử lại.', 503)
    except (ValueError, TypeError, AttributeError):
        raise FeedbackError('Phản hồi website không hợp lệ; chưa xác nhận gửi thành công.', 502)
