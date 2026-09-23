"""
Trendyol Excel raporlarını kişisel verilerden arındırıp Supabase (PostgreSQL) veritabanına yükler.

Kullanım:
    python ingest/ingest.py                 # data/raw içindeki tüm raporları yükler
    python ingest/ingest.py --csv out/      # veritabanı yerine CSV üretir (kontrol için)

Gerekli ortam değişkenleri (.env dosyasında, GitHub'a GİTMEZ):
    DATABASE_URL  Supabase > Project Settings > Database > Connection string (URI)
    HASH_SALT     Rastgele uzun bir metin. Müşteri kodunu geri çözülemez yapar. Değiştirmeyin.
"""
import argparse, glob, hashlib, json, os, re, sys, unicodedata, warnings
import pandas as pd

warnings.filterwarnings('ignore')
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, '.env'))
except ImportError:
    pass

RAW = os.environ.get('RAW_DIR', os.path.join(ROOT, 'data', 'raw'))
TR = str.maketrans('ıİşŞğĞüÜöÖçÇ', 'iIsSgGuUoOcC')
MONTHS = {'ocak': 1, 'subat': 2, 'mart': 3, 'nisan': 4, 'mayis': 5, 'haziran': 6, 'temmuz': 7, 'agustos': 8, 'eylul': 9, 'ekim': 10, 'kasim': 11, 'aralik': 12}
PII_COLS = ['Alıcı', 'Teslimat Adresi', 'Fatura Adresi', 'Alıcı - Fatura Adresi', 'E-Posta', 'Müşteri Telefon No',
            'Vergi Kimlik Numarası', 'Vergi Dairesi', 'Şirket İsmi', 'Kargo Kodu', 'Fatura No', 'Teslimat Numarası']


def norm(f):
    f = unicodedata.normalize('NFC', os.path.basename(f)).translate(TR).lower()
    return (f.replace('may_s', 'mayis').replace('a_ustos', 'agustos').replace('eyl_l', 'eylul')
             .replace('sat__', 'satis').replace('sipari_-da__l_m', 'siparis-dagilim'))


def report_type(f):
    n = norm(f)
    for key, t in [('tum-siparisler', 'orders'), ('satis-raporu', 'sales'), ('siparis-dagilim', 'distribution'),
                   ('magaza', 'store'), ('operasyon', 'ops'), ('reklam', 'ads')]:
        if key in n:
            return t
    return None


def period_of(f, year=2026):
    n = norm(f)
    for k, v in MONTHS.items():
        if re.search(rf'(^|[-_ ]){k}([-_ ]|$)', n) or n.startswith(k):
            return pd.Timestamp(year, v, 1).date()
    return None


def num(s):
    """'1.154' / '2,17' / '+ 47' / 1154 → float"""
    if pd.isna(s):
        return None
    if isinstance(s, (int, float)):
        return float(s)
    s = str(s).replace('+', '').strip()
    if s in ('', '-'):
        return None
    if ',' in s:
        s = s.replace('.', '').replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return None


def dt(s, fmt='%d.%m.%Y %H:%M'):
    return pd.to_datetime(s, format=fmt, errors='coerce')


# ---------------- parsers ----------------
def parse_sales(f):
    per = period_of(f)
    d = pd.read_excel(f, sheet_name='urun-bazlı-satış-raporu')
    reason_cols = list(d.columns[23:44])
    prod = pd.DataFrame({'barcode': d['Barkod'].astype(str), 'model_code': d['Model Kodu'], 'name': d['Ürün Adı'], 'category': d['Kategori'],
                         'brand': d['Marka'], 'color': d['Renk'], 'size': d['Beden'], 'current_price': d['Güncel Satış Fiyatı'].map(num),
                         'current_stock': d['Güncel Stok'], '_p': per})
    sales = pd.DataFrame({'period': per, 'barcode': d['Barkod'].astype(str), 'gross_order_qty': d['Brüt Sipariş Adedi'], 'gross_sales_qty': d['Brüt Satış Adedi'],
                          'cancel_qty': d['İptal Adedi'], 'return_qty': d['İade Adedi'], 'net_sales_qty': d['Net Satış Adedi'], 'gross_revenue': d['Brüt Ciro'],
                          'discount': d['İndirim Tutarı'], 'net_revenue': d['Net Ciro'], 'commission': d['Toplam Komisyon Tutarı'].map(num),
                          'commission_rate': d['Ortalama Komisyon Oranı'].map(num), 'avg_price': d['Ortalama Satış Fiyatı'], 'stock': d['Güncel Stok'],
                          'reasons': d[reason_cols].apply(lambda r: json.dumps({k: int(v) for k, v in r.items() if v}, ensure_ascii=False), axis=1)})
    return {'products': prod, 'sales_monthly': sales}


def parse_orders(f):
    salt = os.environ.get('HASH_SALT')
    if not salt:
        sys.exit('HASH_SALT tanımlı değil (.env). Müşteri kodu üretilemez.')
    d = pd.read_excel(f, header=1, dtype=str).drop_duplicates()
    key = (d['Alıcı'].fillna('').str.lower().str.strip().str.replace(r'\s+', ' ', regex=True) + '|' + d['İl'].fillna('').str.lower() + '|' + d['İlçe'].fillna('').str.lower())
    d['customer_hash'] = key.map(lambda k: hashlib.sha256((salt + k).encode()).hexdigest()[:24])
    d = d.drop(columns=[c for c in PII_COLS if c in d.columns])  # kişisel veri burada atılır
    for c in ['Adet', 'Birim Fiyatı', 'Satış Tutarı', 'İndirim Tutarı', 'Trendyol İndirim Tutarı', 'Faturalanacak Tutar', 'Faturalanan Kargo Tutarı', 'Komisyon Oranı', 'Kargodan alınan desi']:
        d[c] = d[c].map(num)
    d['comm'] = d['Faturalanacak Tutar'] * d['Komisyon Oranı'] / 100
    g = d.groupby('Paket No')
    orders = pd.DataFrame({
        'package_no': g.size().index, 'order_no': g['Sipariş Numarası'].first().values,
        'order_at': dt(g['Sipariş Tarihi'].first()).values, 'deadline_at': dt(g['Termin Süresinin Bittiği Tarih'].first()).values,
        'shipped_at': dt(g['Kargoya Teslim Tarihi'].first()).values, 'delivered_at': dt(g['Teslim Tarihi'].first()).values,
        'carrier': g['Kargo Firması'].first().values, 'status': g['Sipariş Statüsü'].first().values, 'city': g['İl'].first().values,
        'district': g['İlçe'].first().values, 'customer_hash': g['customer_hash'].first().values, 'customer_nth': g['Müşteri Sipariş Adedi'].first().values,
        'age_band': g['Yaş'].first().values, 'gender': g['Cinsiyet'].first().values, 'gross': g['Satış Tutarı'].sum().values,
        'discount': g['İndirim Tutarı'].sum().values, 'ty_discount': g['Trendyol İndirim Tutarı'].sum().values, 'net': g['Faturalanacak Tutar'].sum().values,
        'cargo_fee': g['Faturalanan Kargo Tutarı'].first().values, 'desi': g['Kargodan alınan desi'].first().values, 'commission': g['comm'].sum().values,
        'fast_delivery': g['Müşteriye “Yarın Kapında” gösterildi'].first().values if 'Müşteriye “Yarın Kapında” gösterildi' in d else None})
    lines = d.groupby(['Paket No', 'Barkod']).agg(qty=('Adet', 'sum'), unit_price=('Birim Fiyatı', 'first'), gross=('Satış Tutarı', 'sum'),
                                                   discount=('İndirim Tutarı', 'sum'), ty_discount=('Trendyol İndirim Tutarı', 'sum'),
                                                   net=('Faturalanacak Tutar', 'sum'), commission_rate=('Komisyon Oranı', 'first')).reset_index()
    lines = lines.rename(columns={'Paket No': 'package_no', 'Barkod': 'barcode'})
    lines['qty'] = lines['qty'].astype('Int64')
    return {'orders': orders, 'order_lines': lines}


def parse_distribution(f):
    per = period_of(f)
    rows = []
    for s, df in pd.read_excel(f, sheet_name=None).items():
        cols = list(df.columns)
        two = len(cols) == 6
        for _, r in df.iterrows():
            rows.append({'period': per, 'dimension': s, 'bucket': str(r[cols[0]]), 'bucket2': str(r[cols[1]]) if two else '',
                         'orders': int(r['Sipariş Adedi']), 'customers': int(r['Müşteri Adedi'])})
    return {'distribution': pd.DataFrame(rows).drop_duplicates(['period', 'dimension', 'bucket', 'bucket2'])}


def parse_store(f):
    d = pd.read_excel(f)
    m = {'Mağaza Görüntülenme Sayısı': 'store_views', 'Toplam Takipçi Sayısı': 'followers_total', 'Toplam Takipçi Sayısı - Kazanılan': 'followers_gained',
         'Toplam Takipçi Sayısı - Kaybedilen': 'followers_lost', 'Tekil Ziyaretçi Sayısı': 'visitors', 'Yeni Gelen Tekil Ziyaretçi Sayısı': 'new_visitors',
         'Ziyaretçinin Takipçiye Dönüş Oranı': 'follow_rate', 'Ziyaretçinin Müşteriye Dönüş Oranı': 'customer_rate', 'Mağazanın Brüt Sipariş Adedi': 'store_orders',
         'Toplam Brüt Sipariş Adedi': 'total_orders', 'Mağazanın Brüt Satış Adedi': 'store_units', 'Toplam Brüt Satış Adedi': 'total_units',
         'Mağazanın Satışa Dönüş Oranı': 'store_conversion', 'Mağazanın Brüt Cirosu': 'store_revenue', 'Toplam Brüt Ciro': 'total_revenue',
         'Mağaza Müşteri Sayısı': 'store_customers', 'Toplam Müşteri Sayısı': 'total_customers'}
    out = pd.DataFrame({'day': pd.to_datetime(d['Tarih'], format='%d-%m-%Y %H:%M').dt.date})
    for k, v in m.items():
        out[v] = d[k].map(num)
    return {'store_daily': out}


def parse_ops(f):
    d = pd.read_excel(f).set_index('Kalite Metriklerim')
    ay = {'Oca': 1, 'Şub': 2, 'Mar': 3, 'Nis': 4, 'May': 5, 'Haz': 6, 'Tem': 7, 'Ağu': 8, 'Eyl': 9, 'Eki': 10, 'Kas': 11, 'Ara': 12}
    rows = []
    for c in d.columns[1:]:
        a, y = c.split()
        for metric, v in d[c].items():
            rows.append({'period': pd.Timestamp(int(y), ay[a], 1).date(), 'metric': metric, 'value': num(v)})
    return {'ops_monthly': pd.DataFrame(rows)}


def parse_ads(f):
    d = pd.read_excel(f)
    out = pd.DataFrame({'name': d['Reklam Adı'], 'status': d['Reklam Statüsü'], 'started_at': pd.to_datetime(d['Başlangıç Tarihi'], errors='coerce'),
                        'product_count': d['Ürün Adedi'], 'product_ids': d['Ürün ContentId Listesi'].astype(str),
                        'total_budget': d['Toplam Bütçe'].map(num), 'daily_budget': d['Günlük Bütçe'].map(num), 'spent': d['Harcanan Bütçe'].map(num),
                        'cpc': d['Gerçekleşen TBM'].map(num), 'clicks': d['Tıklanma'].map(num), 'impressions': d['Görüntülenme'].map(num),
                        'direct_sales': d['Doğrudan Satış Adedi'].map(num), 'indirect_sales': d['Dolaylı Satış Adedi'].map(num),
                        'direct_revenue': d['Doğrudan Reklam Cirosu'].map(num), 'indirect_revenue': d['Dolaylı Reklam Cirosu'].map(num),
                        'roas': d['Harcama Getirisi'].map(num)})
    return {'ad_campaigns': out}


PARSERS = {'sales': parse_sales, 'orders': parse_orders, 'distribution': parse_distribution, 'store': parse_store, 'ops': parse_ops, 'ads': parse_ads}
PKEYS = {'products': ['barcode'], 'sales_monthly': ['period', 'barcode'], 'orders': ['package_no'], 'order_lines': ['package_no', 'barcode'],
         'distribution': ['period', 'dimension', 'bucket', 'bucket2'], 'store_daily': ['day'], 'ops_monthly': ['period', 'metric'], 'ad_campaigns': ['name']}
ORDER = ['products', 'sales_monthly', 'orders', 'order_lines', 'distribution', 'store_daily', 'ops_monthly', 'ad_campaigns']

# Reklam paneli toplamları (ekran görüntüsünden, 1 Nis – 23 Eyl 2026)
AD_TOTALS = [{'period_from': '2026-04-01', 'period_to': '2026-09-23', 'source': 'panel', 'impressions': 4912762, 'clicks': 141168, 'sales': 11007, 'revenue': 1387840.27, 'spend': 140693.95, 'roas': 9.86},
             {'period_from': '2026-06-24', 'period_to': '2026-06-28', 'source': 'meta', 'impressions': 19707, 'clicks': 792, 'sales': 31, 'revenue': 6901.50, 'spend': 1498.27, 'roas': 4.61}]


def collect():
    tables, uploads = {}, []
    for f in sorted(glob.glob(os.path.join(RAW, '*.xlsx'))):
        t = report_type(f)
        if not t:
            print('  atlandı (tanınmadı):', os.path.basename(f)); continue
        res = PARSERS[t](f)
        n = sum(len(v) for v in res.values())
        uploads.append({'file_name': os.path.basename(f), 'report_type': t, 'period': str(period_of(f) or ''), 'row_count': n})
        for k, v in res.items():
            tables.setdefault(k, []).append(v)
        print(f'  {t:13s} {n:6d} satır  {os.path.basename(f)}')
    out = {}
    for k, parts in tables.items():
        df = pd.concat(parts)
        if k == 'orders' or k == 'order_lines':
            pass  # aynı paket iki aylık dosyada da olabilir; birincil anahtarla tekilleştirilir
        if '_p' in df:
            df = df.sort_values('_p', kind='stable')
        # products: en son ay kazanır (dosyalar ada göre sıralı değil, stok/price için sonuncuyu tut)
        out[k] = intify(df.drop_duplicates(PKEYS[k], keep='last').drop(columns=['_p'], errors='ignore'))
    out['ad_totals'] = pd.DataFrame(AD_TOTALS)
    out['uploads'] = pd.DataFrame(uploads)
    return out


def intify(df):
    for c in df.columns:
        if df[c].dtype.kind == 'f':
            v = df[c].dropna()
            if len(v) and (v == v.round()).all() and not c.endswith(('price', 'revenue', 'discount', 'gross', 'net', 'fee', 'budget', 'spent', 'cpc', 'roas', 'rate', 'commission', 'value', 'desi', 'spend')):
                df[c] = df[c].astype('Int64')
    return df


def clean(df):
    df = df.astype(object).where(pd.notna(df), None)
    return df


def to_db(tables):
    try:
        import psycopg
    except ImportError:
        sys.exit('psycopg kurulu değil: pip install "psycopg[binary]"')
    url = os.environ.get('DATABASE_URL')
    if not url:
        sys.exit('DATABASE_URL tanımlı değil (.env).')
    with psycopg.connect(url) as con, con.cursor() as cur:
        for name in ORDER + ['ad_totals']:
            if name not in tables:
                continue
            df = clean(tables[name]); cols = list(df.columns)
            pk = PKEYS.get(name, ['period_from', 'period_to', 'source'])
            upd = [c for c in cols if c not in pk]
            sql = (f'insert into {name} ({",".join(cols)}) values ({",".join(["%s"] * len(cols))}) '
                   f'on conflict ({",".join(pk)}) do ' + (f'update set {",".join(f"{c}=excluded.{c}" for c in upd)}' if upd else 'nothing'))
            cur.executemany(sql, df.values.tolist())
            print(f'  {name:14s} {len(df):6d} satır yazıldı')
        up = clean(tables['uploads'])
        cur.executemany('insert into uploads (file_name, report_type, period, row_count) values (%s,%s,%s,%s)', up[['file_name', 'report_type', 'period', 'row_count']].values.tolist())
        con.commit()


def to_csv(tables, folder):
    os.makedirs(folder, exist_ok=True)
    for k, df in tables.items():
        df.to_csv(os.path.join(folder, f'{k}.csv'), index=False)
    print('CSV yazıldı:', folder)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--csv', help='veritabanı yerine bu klasöre CSV yaz')
    a = ap.parse_args()
    print('Raporlar okunuyor:', RAW)
    t = collect()
    to_csv(t, a.csv) if a.csv else to_db(t)
