"""
Paneli yerel sunucuyla açar; "Raporlar" sekmesindeki içe aktarma ve senkronizasyon butonları bununla çalışır.

    python panel.py              # http://127.0.0.1:8765 adresini tarayıcıda açar
    python panel.py --port 9000

Uç noktalar (yalnızca bu bilgisayardan erişilebilir):
    GET  /                     panel HTML (dashboard/dist)
    GET  /api/coverage         Supabase'deki rapor doluluk haritası
    POST /api/upload           Excel raporunu data/raw içine kaydeder (?type=sales&period=2026-10)
    GET  /api/sync             senkronizasyon durumu
    POST /api/sync             data/raw → Supabase → analiz → panel
"""
import argparse, datetime as dt, glob, json, os, shutil, subprocess, sys, threading, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(ROOT, 'data', 'raw')
ARCHIVE = os.path.join(RAW, '_arsiv')
HTML = os.path.join(ROOT, 'dashboard', 'dist', 'ak-tuhafiye-buyume-paneli.html')
sys.path[:0] = [os.path.join(ROOT, 'analysis'), os.path.join(ROOT, 'ingest')]
import doluluk    # noqa: E402
import ingest     # noqa: E402

MAX_BYTES = 60 * 1024 * 1024
AYLAR = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik']
SLUG = {'sales': 'satis-raporu', 'orders': 'tum-siparisler', 'distribution': 'siparis-dagilim-raporu',
        'store': 'magaza-raporu', 'ops': 'operasyon-raporu', 'ads': 'urun-reklamlari-raporu'}
MONTHLY = {'sales', 'orders', 'distribution'}  # dosya adındaki aydan dönem alan raporlar

sync_state = {'running': False, 'ok': None, 'log': '', 'started': None, 'finished': None}
sync_lock = threading.Lock()
pending = []  # son senkrondan beri yüklenen dosyalar


def target_name(rtype, period):
    stamp = dt.datetime.now().strftime('%Y.%m.%d-%H.%M.%S')
    if rtype in MONTHLY:
        y, m = map(int, period.split('-'))
        return f'{AYLAR[m - 1]}-{y}-{SLUG[rtype]}-{stamp}.xlsx'
    return f'{SLUG[rtype]}-{stamp}.xlsx'


def archive_old(rtype, period):
    """Aynı tür ve dönemdeki eski dosyayı silmeden _arsiv klasörüne taşır (yeni dosya geçerli olsun diye)."""
    moved = []
    for f in glob.glob(os.path.join(RAW, '*.xlsx')):
        if ingest.report_type(f) != rtype:
            continue
        if rtype in MONTHLY and str(ingest.period_of(f))[:7] != period:
            continue
        if rtype not in MONTHLY and rtype != 'ads':
            continue  # mağaza/operasyon dosyaları tarih aralığı taşır, üst üste yüklenir
        os.makedirs(ARCHIVE, exist_ok=True)
        shutil.move(f, os.path.join(ARCHIVE, os.path.basename(f)))
        moved.append(os.path.basename(f))
    return moved


def run_sync():
    log = []

    def step(title, *args, env=None):
        log.append(f'>> {title}')
        sync_state['log'] = '\n'.join(log)
        r = subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace',
                           env={**os.environ, 'PYTHONIOENCODING': 'utf-8', **(env or {})})
        log.append((r.stdout + r.stderr).strip())
        sync_state['log'] = '\n'.join(log)
        if r.returncode:
            raise RuntimeError(f'{title} başarısız oldu')

    try:
        step('Raporlar Supabase\'e yükleniyor', 'ingest/ingest.py')
        step('Analiz', 'analysis/analyze.py', env={'SOURCE': 'db'})
        step('Panel üretiliyor', 'dashboard/build.py')
        sync_state['ok'] = True
        pending.clear()
    except Exception as e:
        sync_state['ok'] = False
        log.append(f'HATA: {e}')
    finally:
        sync_state.update(running=False, finished=dt.datetime.now().isoformat(timespec='seconds'), log='\n'.join(log))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send(self, code, body, ctype='application/json; charset=utf-8'):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def api_ok(self):
        # Başka sitelerin bu sunucuya istek atmasını engeller: özel başlık tarayıcıda ön-kontrol (CORS) gerektirir,
        # sunucu ön-kontrole izin vermediği için yalnızca panelin kendi sayfası bu başlıkla istek atabilir.
        if self.headers.get('X-Panel') != '1':
            self.send(403, {'error': 'yetkisiz istek'})
            return False
        return True

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ('/', '/index.html'):
            if not os.path.exists(HTML):
                return self.send(404, 'Panel henüz üretilmemiş: python guncelle.py'.encode(), 'text/plain; charset=utf-8')
            return self.send(200, open(HTML, 'rb').read(), 'text/html; charset=utf-8')
        if not path.startswith('/api/') or not self.api_ok():
            return self.send(404, {'error': 'bulunamadı'}) if not path.startswith('/api/') else None
        if path == '/api/coverage':
            try:
                with doluluk.connect() as con:
                    cov = doluluk.compute(con)
                return self.send(200, {**cov, 'pending': pending})
            except Exception as e:
                return self.send(502, {'error': f'Supabase\'e bağlanılamadı: {e}'})
        if path == '/api/sync':
            return self.send(200, {**sync_state, 'pending': pending})
        self.send(404, {'error': 'bulunamadı'})

    def do_POST(self):
        u = urlparse(self.path)
        if not self.api_ok():
            return
        if u.path == '/api/sync':
            with sync_lock:
                if sync_state['running']:
                    return self.send(409, {'error': 'Senkronizasyon zaten sürüyor'})
                sync_state.update(running=True, ok=None, log='', started=dt.datetime.now().isoformat(timespec='seconds'), finished=None)
            threading.Thread(target=run_sync, daemon=True).start()
            return self.send(202, sync_state)
        if u.path == '/api/upload':
            return self.upload(parse_qs(u.query))
        self.send(404, {'error': 'bulunamadı'})

    def upload(self, q):
        rtype = (q.get('type') or [''])[0]
        period = (q.get('period') or [''])[0]
        if rtype not in SLUG:
            return self.send(400, {'error': 'Rapor türü seçin'})
        if rtype in MONTHLY:
            try:
                y, m = map(int, period.split('-')); assert 2000 < y < 2100 and 1 <= m <= 12
            except Exception:
                return self.send(400, {'error': 'Bu rapor için ay seçin'})
        n = int(self.headers.get('Content-Length') or 0)
        if not n or n > MAX_BYTES:
            return self.send(400, {'error': 'Dosya boş ya da 60 MB\'tan büyük'})
        data = self.rfile.read(n)
        if not data.startswith(b'PK'):
            return self.send(400, {'error': 'Bu bir Excel (.xlsx) dosyası değil'})
        if sync_state['running']:
            return self.send(409, {'error': 'Senkronizasyon sürerken dosya eklenemez'})

        # Önce kontrol klasörüne yaz (ingest yalnızca data/raw/*.xlsx okur, alt klasörleri görmez),
        # ayrıştırıcıyı çalıştırıp dosyanın gerçekten seçilen rapor olduğunu doğrula, sonra data/raw'a taşı.
        name = target_name(rtype, period)
        check = os.path.join(RAW, '_kontrol', name)
        os.makedirs(os.path.dirname(check), exist_ok=True)
        open(check, 'wb').write(data)
        try:
            res = ingest.PARSERS[rtype](check)
            rows = sum(len(v) for v in res.values())
            if not rows:
                raise ValueError('dosyada satır yok')
        except (Exception, SystemExit) as e:
            os.remove(check)
            label = dict((k, l) for k, l, _ in doluluk.TYPES).get(rtype, 'Ürün reklamları raporu')
            msg = str(e) if isinstance(e, SystemExit) else f'Dosya "{label}" biçiminde okunamadı ({type(e).__name__}: {e}). Doğru rapor türünü seçtiğinizden emin olun.'
            return self.send(400, {'error': msg})
        moved = archive_old(rtype, period)
        os.replace(check, os.path.join(RAW, name))
        item = {'file': name, 'type': rtype, 'period': period if rtype in MONTHLY else None, 'rows': rows,
                'original': unquote(self.headers.get('X-Filename', '')), 'archived': moved}
        pending.append(item)
        self.send(200, item)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8765)
    ap.add_argument('--no-browser', action='store_true')
    a = ap.parse_args()
    srv = ThreadingHTTPServer(('127.0.0.1', a.port), Handler)
    url = f'http://127.0.0.1:{a.port}/#raporlar'
    print(f'Panel: {url}  (durdurmak için Ctrl+C)')
    if not a.no_browser:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
