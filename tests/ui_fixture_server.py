"""Máy chủ kiểm thử giao diện: tất cả hóa đơn/cấu hình/Excel trong thư mục tạm."""
import json
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import config
from test_startup_performance import SAMPLE_XML
from werkzeug.serving import make_server


def main():
    (ROOT / 'build').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='scan-ui-', dir=ROOT / 'build') as tmp:
        temporary = Path(tmp).resolve()
        assert temporary.is_relative_to(ROOT / 'build')
        config.DATA_DIR = str(temporary)
        config.DEFAULT_EXCEL_PATH = str(temporary / 'workbook.xlsx')
        folder = temporary / 'invoices'
        folder.mkdir()
        invoice = folder / 'invoice.xml'
        invoice.write_text(SAMPLE_XML, encoding='utf-8')
        empty = temporary / 'empty'
        empty.mkdir()
        config.SAMPLE_XML_PATH = str(invoice)
        import app
        server = make_server('127.0.0.1', 0, app.app, threaded=True)
        info = {'url': f'http://127.0.0.1:{server.server_port}',
                'folder': str(folder), 'empty': str(empty), 'version': config.APP_VERSION}
        (ROOT / 'build/scan-regression-info.json').write_text(json.dumps(info), encoding='utf-8')
        print(json.dumps(info), flush=True)
        try:
            server.serve_forever()
        finally:
            server.server_close()


if __name__ == '__main__':
    main()
