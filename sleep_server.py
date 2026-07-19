#!/usr/bin/env python3
import json
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

DIR = Path(__file__).parent
FRONTEND_DIR = DIR / 'frontend'
HTML_FILE = FRONTEND_DIR / 'sleep_agenda.html'
DATA_DIR = DIR / 'data'
DATA_FILE   = DATA_DIR / 'sleep_data.json'
HABITS_FILE     = DATA_DIR / 'habits.json'
CATEGORIES_FILE = DATA_DIR / 'categories.json'
PORT = 8742


def ensure_data_files():
    """Create data/ and the three empty files if they are missing.

    `data/` is excluded from the repository (personal data), so a fresh clone has no
    trace of it: without this initialisation the first save would fail, since
    `write_bytes` does not create the parent directory.
    An existing file is never touched — least of all overwritten.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for f in (DATA_FILE, HABITS_FILE, CATEGORIES_FILE):
        if not f.exists():
            f.write_bytes(b'[]')

STATIC_TYPES = {'.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8'}


class Handler(BaseHTTPRequestHandler):
    def _serve_static(self):
        """Serve frontend/css/*.css and frontend/js/*.js. Returns True if handled."""
        parts = self.path.lstrip('/').split('/')
        if len(parts) != 2 or parts[0] not in ('css', 'js'):
            return False
        target = (FRONTEND_DIR / parts[0] / parts[1]).resolve()
        # Refuse anything that escapes the frontend directory (e.g. ../../etc/passwd)
        if not target.is_file() or FRONTEND_DIR.resolve() not in target.parents:
            return False
        ctype = STATIC_TYPES.get(target.suffix)
        if ctype is None:
            return False
        self._respond(200, ctype, target.read_bytes())
        return True

    def do_GET(self):
        if self.path in ('/', '/summary', '/entry', '/history', '/habits', '/statistics', '/options'):
            self._respond(200, 'text/html; charset=utf-8', HTML_FILE.read_bytes())
        elif self._serve_static():
            pass
        elif self.path == '/api/entries':
            data = DATA_FILE.read_bytes() if DATA_FILE.exists() else b'[]'
            self._respond(200, 'application/json', data)
        elif self.path == '/api/habits':
            data = HABITS_FILE.read_bytes() if HABITS_FILE.exists() else b'[]'
            self._respond(200, 'application/json', data)
        elif self.path == '/api/categories':
            data = CATEGORIES_FILE.read_bytes() if CATEGORIES_FILE.exists() else b'[]'
            self._respond(200, 'application/json', data)
        else:
            self.send_error(404)

    def do_POST(self):
        # The folder may have gone since startup: recreating it costs less than a
        # lost write.
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if self.path == '/api/entries':
            n = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(n)
            json.loads(body)
            DATA_FILE.write_bytes(body)
            self._respond(200, 'application/json', b'{"ok":true}')
        elif self.path == '/api/habits':
            n = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(n)
            json.loads(body)
            HABITS_FILE.write_bytes(body)
            self._respond(200, 'application/json', b'{"ok":true}')
        elif self.path == '/api/categories':
            n = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(n)
            json.loads(body)
            CATEGORIES_FILE.write_bytes(body)
            self._respond(200, 'application/json', b'{"ok":true}')
        else:
            self.send_error(404)

    def _respond(self, code, ctype, body):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # quiet


if __name__ == '__main__':
    ensure_data_files()
    server = HTTPServer(('127.0.0.1', PORT), Handler)
    url = f'http://localhost:{PORT}'
    print(f'Sleep Diary → {url}')
    print('Ctrl+C to stop')
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
