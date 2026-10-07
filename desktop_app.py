"""Ứng dụng Desktop — Lê Minh Triết / MinhTrietEras."""

import base64
import json
import logging
from pathlib import Path
import sys
import threading


def startup_html():
    """Màn hình chờ độc lập, không cần mạng hay máy chủ Flask."""
    root = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
    logo = base64.b64encode((root / 'static/images/logo.png').read_bytes()).decode('ascii')
    app_logo = base64.b64encode((root / 'static/images/app-logo.png').read_bytes()).decode('ascii')
    css = (root / 'static/css/startup.css').read_text(encoding='utf-8')
    markup = (root / 'templates/startup.html').read_text(encoding='utf-8')
    from config import APP_VERSION
    markup = markup.replace('{{ app_version }}', APP_VERSION)
    markup = markup.replace('/static/images/app-logo.png', f'data:image/png;base64,{app_logo}')
    markup = markup.replace('/static/images/logo.png', f'data:image/png;base64,{logo}')
    return f'<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>{css}</style></head><body>{markup}</body></html>'


def start_application(window, server_state):
    """Nạp thư viện nặng sau khi cửa sổ đã hiển thị logo."""
    try:
        from werkzeug.serving import make_server
        from app import app
        server = make_server('127.0.0.1', 0, app, threaded=True)
        with server_state['lock']:
            if server_state['closed']:
                server.server_close()
                return
            server_state['server'] = server
            threading.Thread(target=server.serve_forever, daemon=True).start()
        window.load_url(f'http://127.0.0.1:{server.server_port}')
    except Exception as exc:
        logging.exception('Không thể khởi động ứng dụng')
        message = json.dumps(f'Không thể khởi động ứng dụng: {exc}', ensure_ascii=False)
        try:
            window.evaluate_js('alert(' + message + ');')
        except Exception:
            logging.exception('Không thể hiển thị thông báo khởi động')


def main():
    if sys.platform == 'win32':
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('MinhTrietEras.TrichXuatHoaDon')
    import webview

    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    server_state = {'server': None, 'closed': False, 'lock': threading.Lock()}
    window = webview.create_window(
        title='Trích xuất hóa đơn - MinhTrietEras',
        html=startup_html(), width=1320, height=860,
        min_size=(1024, 680), resizable=True, text_select=True,
        confirm_close=False, background_color='#f6f7fc',
    )
    started = threading.Event()

    def on_loaded():
        if not started.is_set():
            started.set()
            threading.Thread(target=start_application, args=(window, server_state), daemon=True).start()

    def on_closed():
        with server_state['lock']:
            server_state['closed'] = True
            server = server_state['server']
        if server:
            server.shutdown()
            server.server_close()

    window.events.loaded += on_loaded
    window.events.closed += on_closed
    root = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
    webview.start(icon=str(root / 'static/images/app-icon.ico'))


if __name__ == '__main__':
    main()
