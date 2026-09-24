"""
Rapor doluluk haritası: hangi ay için hangi Trendyol raporunun Supabase'de olduğunu hesaplar.

Her rapor türü bir ay için 0–1 arası doluluk alır:
    sales, distribution, ops  → o aya ait satır varsa 1
    orders                    → siparişlerin ulaştığı son gün / aydaki beklenen gün sayısı
    store                     → verisi olan gün sayısı / aydaki beklenen gün sayısı
Beklenen gün: geçmiş aylarda ayın tamamı, içinde bulunulan ayda dünkü güne kadar.
Ürün reklamları raporu aylık değil (anlık kampanya listesi); ayrıca son yükleme tarihiyle verilir.

    python analysis/doluluk.py      # JSON olarak yazdırır
"""
import calendar, datetime as dt, json, os

TYPES = [  # (anahtar, etiket, Trendyol'da nereden alınır)
    ('sales', 'Satış raporu', 'Raporlar → Satış Raporu'),
    ('orders', 'Tüm siparişler', 'Siparişler → Excel\'e aktar'),
    ('distribution', 'Sipariş dağılım', 'Raporlar → Sipariş Dağılımı'),
    ('store', 'Mağaza raporu', 'Raporlar → Mağaza'),
    ('ops', 'Operasyon raporu', 'Raporlar → Operasyon'),
]
SQL = {
    'sales': "select to_char(period, 'YYYY-MM'), count(*), 0 from sales_monthly group by 1",
    'orders': "select to_char(order_at, 'YYYY-MM'), count(*), max(extract(day from order_at))::int from orders where order_at is not null group by 1",
    'distribution': "select to_char(period, 'YYYY-MM'), count(*), 0 from distribution group by 1",
    'store': "select to_char(day, 'YYYY-MM'), count(distinct day), 0 from store_daily group by 1",
    'ops': "select to_char(period, 'YYYY-MM'), count(*), 0 from ops_monthly where value is not null group by 1",
}


def _expected_days(ym, today):
    y, m = map(int, ym.split('-'))
    start = dt.date(y, m, 1)
    if start > today:
        return 0
    days = calendar.monthrange(y, m)[1]
    return days if dt.date(y, m, days) < today else (today - start).days


def compute(con, today=None):
    today = today or dt.date.today()
    raw = {}
    with con.cursor() as cur:
        for k, sql in SQL.items():
            cur.execute(sql)
            raw[k] = {ym: (n, d) for ym, n, d in cur.fetchall() if ym}
        cur.execute("select max(uploaded_at) from uploads where report_type = 'ads'")
        ads_at = cur.fetchone()[0]
        cur.execute('select count(*) from ad_campaigns')
        ads_n = cur.fetchone()[0]
        cur.execute('select max(uploaded_at) from uploads')
        last_sync = cur.fetchone()[0]

    months = {}
    for k, rows in raw.items():
        for ym, (n, d) in rows.items():
            exp = _expected_days(ym, today)
            if k == 'orders':
                v = min(1.0, d / exp) if exp else 1.0
            elif k == 'store':
                v = min(1.0, n / exp) if exp else 1.0
            else:
                v = 1.0
            months.setdefault(ym, {})[k] = {'v': round(v, 3), 'n': int(n), **({'d': int(d)} if k == 'orders' else {})}

    years = sorted({int(ym[:4]) for ym in months} | {today.year})
    return {'today': today.isoformat(), 'years': years, 'months': months,
            'types': [{'key': k, 'label': l, 'where': w} for k, l, w in TYPES],
            'ads': {'campaigns': int(ads_n), 'last_upload': ads_at.isoformat() if ads_at else None},
            'last_sync': last_sync.isoformat() if last_sync else None}


def connect():
    import psycopg
    try:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))
    except ImportError:
        pass
    os.environ.setdefault('PGTZ', 'UTC')
    url = os.environ.get('DATABASE_URL')
    if not url:
        raise SystemExit('DATABASE_URL tanımlı değil (.env).')
    return psycopg.connect(url, connect_timeout=15)


if __name__ == '__main__':
    with connect() as c:
        print(json.dumps(compute(c), ensure_ascii=False, indent=1))
