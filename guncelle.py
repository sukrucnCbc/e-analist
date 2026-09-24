"""
Tek komutla paneli güncel veriyle yeniden üretir.

    python guncelle.py           # Supabase'den oku → analiz → panel
    python guncelle.py --yukle   # önce data/raw içindeki yeni Excel'leri Supabase'e yükle, sonra aynısı
    python guncelle.py --excel   # veritabanı olmadan, doğrudan data/raw Excel'lerinden
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable


def run(*args, env=None):
    print('\n>>', ' '.join(args))
    subprocess.run([PY, *args], cwd=ROOT, check=True, env={**os.environ, **(env or {})})


if __name__ == '__main__':
    a = sys.argv[1:]
    if '--yukle' in a:
        run('ingest/ingest.py')
    run('analysis/analyze.py', env={'SOURCE': 'excel' if '--excel' in a else 'db'})
    run('dashboard/build.py')
    print('\nHazır: dashboard/dist/ak-tuhafiye-buyume-paneli.html')
