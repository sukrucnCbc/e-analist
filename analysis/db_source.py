"""
Supabase (PostgreSQL) veritabanından analiz için gereken tabloları okur ve
analyze.py'nin beklediği biçime (Trendyol Excel sütun adlarıyla) çevirir.

Bağlantı: .env içindeki DATABASE_URL.
psycopg yoksa (ör. test ortamı) DB_CLI=psql ile psql komut satırı kullanılır.
"""
import io, json, os, subprocess
import numpy as np
import pandas as pd

MONTH_KEY = {4: 'nisan', 5: 'mayis', 6: 'haziran', 7: 'temmuz', 8: 'a_ustos', 9: 'eyl_l'}
TR_MON = {1: 'Oca', 2: 'Şub', 3: 'Mar', 4: 'Nis', 5: 'May', 6: 'Haz', 7: 'Tem', 8: 'Ağu', 9: 'Eyl', 10: 'Eki', 11: 'Kas', 12: 'Ara'}
REASONS = ['Müşterinin İptal Ettiği', "Trendyol'un İptal Ettiği", 'Benim İptal Ettiğim', 'Modelini Beğenmedim', 'Kusurlu Ürün Gönderildi', 'Yanlış Ürün Gönderildi',
           'Vazgeçtim', 'Diğer', 'Bedeni/Ebatı Küçük Geldi', 'Bedeni/Ebatı Büyük Geldi', 'Ürün ile Görsel & İçerik Bilgisi Uyuşmuyor', 'Yanlış Sipariş Verdim',
           'Kalitesini Beğenmedim', 'Teslim Edilemeyen Gönderi', 'Gönderi Sevk Edilemedi', 'Tazmin', 'Taşıma Sürecinde İade Edildi', 'Oluşmayan Gönderi Kodu',
           'Tedarik Edilemedi', 'Kargo Teslimatı Gecikmesi', 'Müşteri Onayı Tamamlanmayan Gönderi']
DIM_COL = {'Yaş': 'Yaş Aralığı', 'Cinsiyet': 'Cinsiyet', 'Gün ve Saat': ['Gün', 'Saat Aralığı'], 'İl ve İlçe': ['İl', 'İlçe'],
           'Yeni & Mevcut Müşteri': 'Müşteri Tipi', 'Tutar Bazlı': 'Sipariş Tutar Aralığı', 'Adet Bazlı': 'Sipariş Başına Ürün Adedi', 'Trendyol Plus': 'Trendyol Plus'}


def _query_factory():
    os.environ.setdefault('PGTZ', 'UTC')  # ingest ile aynı saat dilimi: tarihler olduğu gibi geri okunur
    url = os.environ.get('DATABASE_URL')
    if not url:
        raise SystemExit('DATABASE_URL tanımlı değil (.env). Excel ile çalışmak için: SOURCE=excel')
    if os.environ.get('DB_CLI') != 'psql':
        try:
            import psycopg
            con = psycopg.connect(url)

            def q(sql):
                with con.cursor() as cur:
                    cur.execute(sql)
                    return pd.DataFrame(cur.fetchall(), columns=[d.name for d in cur.description])
            return q
        except ImportError:
            pass

    def q(sql):  # psql yedek yolu
        r = subprocess.run(['psql', url, '-q', '-c', f'\\copy ({sql}) to stdout csv header'], capture_output=True, text=True, check=True)
        return pd.read_csv(io.StringIO(r.stdout), dtype=str, keep_default_na=False, na_values=[''])
    return q


def _num(df, cols):
    for c in cols:
        df[c] = pd.to_numeric(df[c], errors='coerce')
    return df


def load():
    q = _query_factory()

    # ---------- satış (ürün bazlı aylık) ----------
    s = q('select s.*, p.name, p.model_code, p.category, p.color, p.current_price from sales_monthly s join products p using (barcode) order by s.period, s.barcode')
    s = _num(s, ['gross_order_qty', 'gross_sales_qty', 'cancel_qty', 'return_qty', 'net_sales_qty', 'gross_revenue', 'discount', 'net_revenue',
                 'commission', 'commission_rate', 'avg_price', 'stock', 'current_price'])
    s['period'] = pd.to_datetime(s['period'])
    S = pd.DataFrame({'Barkod': s['barcode'], 'Ürün Adı': s['name'], 'Model Kodu': s['model_code'], 'Kategori': s['category'], 'Renk': s['color'],
                      'Brüt Sipariş Adedi': s['gross_order_qty'], 'Brüt Satış Adedi': s['gross_sales_qty'], 'İptal Adedi': s['cancel_qty'],
                      'İade Adedi': s['return_qty'], 'Net Satış Adedi': s['net_sales_qty'], 'Brüt Ciro': s['gross_revenue'], 'İndirim Tutarı': s['discount'],
                      'Net Ciro': s['net_revenue'], 'Toplam Komisyon Tutarı': s['commission'], 'Ortalama Komisyon Oranı': s['commission_rate'],
                      'Ortalama Satış Fiyatı': s['avg_price'], 'Güncel Satış Fiyatı': s['current_price'], 'Güncel Stok': s['stock'],
                      'm': s['period'].dt.month.map(MONTH_KEY)})
    rs = s['reasons'].map(lambda x: x if isinstance(x, dict) else (json.loads(x) if isinstance(x, str) and x else {}))
    for r in REASONS:
        S[r] = rs.map(lambda d: d.get(r, 0)).astype(float)
    S = S[S['m'].notna()].reset_index(drop=True)
    # kategori raporu = ürün satırlarının kategori toplamı
    K = S.groupby(['Kategori', 'm'], as_index=False)[['Brüt Satış Adedi', 'İptal Adedi', 'İade Adedi', 'Net Satış Adedi', 'Brüt Ciro', 'İndirim Tutarı',
                                                      'Net Ciro', 'Toplam Komisyon Tutarı']].sum()

    # ---------- siparişler ----------
    o = q('select l.package_no, l.barcode, l.qty, l.unit_price, l.gross, l.discount, l.ty_discount, l.net, l.commission_rate, '
          'o.order_no, to_char(o.order_at, \'DD.MM.YYYY HH24:MI\') order_at, to_char(o.shipped_at, \'DD.MM.YYYY HH24:MI\') shipped_at, to_char(o.delivered_at, \'DD.MM.YYYY HH24:MI\') delivered_at, o.carrier, o.status, o.city, o.district, o.customer_hash, o.customer_nth, '
          'o.age_band, o.gender, o.cargo_fee from order_lines l join orders o using (package_no) order by o.order_at, l.package_no, l.barcode')
    o = _num(o, ['qty', 'unit_price', 'gross', 'discount', 'ty_discount', 'net', 'commission_rate', 'cargo_fee'])
    fmt = lambda c: o[c]
    O = pd.DataFrame({'Paket No': o['package_no'].astype(str), 'Barkod': o['barcode'], 'Adet': o['qty'], 'Birim Fiyatı': o['unit_price'],
                      'Satış Tutarı': o['gross'], 'İndirim Tutarı': o['discount'], 'Trendyol İndirim Tutarı': o['ty_discount'], 'Faturalanacak Tutar': o['net'],
                      'Komisyon Oranı': o['commission_rate'], 'Sipariş Numarası': o['order_no'], 'Sipariş Tarihi': fmt('order_at'),
                      'Kargoya Teslim Tarihi': fmt('shipped_at'), 'Teslim Tarihi': fmt('delivered_at'), 'Kargo Firması': o['carrier'],
                      'Sipariş Statüsü': o['status'], 'İl': o['city'], 'İlçe': o['district'], 'cust': o['customer_hash'],
                      'Müşteri Sipariş Adedi': o['customer_nth'], 'Yaş': o['age_band'], 'Cinsiyet': o['gender'], 'Faturalanan Kargo Tutarı': o['cargo_fee'],
                      'Stok Kodu': o['barcode']})
    O['src'] = pd.to_datetime(O['Sipariş Tarihi'], format='%d.%m.%Y %H:%M').dt.month.map(MONTH_KEY)
    O = O[O['src'].notna()].reset_index(drop=True)

    # ---------- sipariş dağılımı ----------
    d = q('select period, dimension, bucket, bucket2, orders, customers from distribution order by period, dimension')
    d = _num(d, ['orders', 'customers'])
    d['m'] = pd.to_datetime(d['period']).dt.month.map(MONTH_KEY)
    dist = {}
    for (m, dim), g in d.groupby(['m', 'dimension']):
        col = DIM_COL.get(dim, dim)
        f = pd.DataFrame({'Sipariş Adedi': g['orders'].values, 'Müşteri Adedi': g['customers'].values})
        if isinstance(col, list):
            f.insert(0, col[0], g['bucket'].values); f.insert(1, col[1], g['bucket2'].values)
        else:
            f.insert(0, col, g['bucket'].values)
        f['Sipariş Dağılım%'] = f['Sipariş Adedi'] / max(f['Sipariş Adedi'].sum(), 1) * 100
        f['Müşteri Dağılım%'] = f['Müşteri Adedi'] / max(f['Müşteri Adedi'].sum(), 1) * 100
        dist.setdefault(m, {})[dim] = f

    # ---------- operasyon ----------
    op = q('select period, metric, value from ops_monthly')
    op = _num(op, ['value']); op['period'] = pd.to_datetime(op['period'])
    piv = op.pivot_table(index='metric', columns='period', values='value', aggfunc='first').sort_index(axis=1, ascending=False)
    piv.columns = [f'{TR_MON[c.month]} {c.year}' for c in piv.columns]
    piv.insert(0, 'Bu yılki performans', np.nan)
    piv.index.name = 'Kalite Metriklerim'
    ops = piv

    # ---------- mağaza ----------
    st = q('select * from store_daily order by day desc')
    names = {'store_views': 'Mağaza Görüntülenme Sayısı', 'followers_total': 'Toplam Takipçi Sayısı', 'followers_gained': 'Toplam Takipçi Sayısı - Kazanılan',
             'followers_lost': 'Toplam Takipçi Sayısı - Kaybedilen', 'visitors': 'Tekil Ziyaretçi Sayısı', 'new_visitors': 'Yeni Gelen Tekil Ziyaretçi Sayısı',
             'follow_rate': 'Ziyaretçinin Takipçiye Dönüş Oranı', 'customer_rate': 'Ziyaretçinin Müşteriye Dönüş Oranı', 'store_orders': 'Mağazanın Brüt Sipariş Adedi',
             'total_orders': 'Toplam Brüt Sipariş Adedi', 'store_units': 'Mağazanın Brüt Satış Adedi', 'total_units': 'Toplam Brüt Satış Adedi',
             'store_conversion': 'Mağazanın Satışa Dönüş Oranı', 'store_revenue': 'Mağazanın Brüt Cirosu', 'total_revenue': 'Toplam Brüt Ciro',
             'store_customers': 'Mağaza Müşteri Sayısı', 'total_customers': 'Toplam Müşteri Sayısı'}
    store = pd.DataFrame({'Tarih': pd.to_datetime(st['day']).dt.strftime('%d-%m-%Y 00:00')})
    for k, v in names.items():
        store[v] = pd.to_numeric(st[k], errors='coerce')
    store['Mağaza Ciro Oranı'] = store['Mağazanın Brüt Cirosu'] / store['Toplam Brüt Ciro'] * 100
    store['Mağaza Sipariş Oranı'] = store['Mağazanın Brüt Sipariş Adedi'] / store['Toplam Brüt Sipariş Adedi'] * 100
    store['Mağaza Müşteri Oranı'] = store['Mağaza Müşteri Sayısı'] / store['Toplam Müşteri Sayısı'] * 100

    # ---------- reklam ----------
    a = q('select * from ad_campaigns order by started_at desc nulls last')
    a = _num(a, ['product_count', 'total_budget', 'daily_budget', 'spent', 'cpc', 'clicks', 'impressions', 'direct_sales', 'indirect_sales',
                 'direct_revenue', 'indirect_revenue', 'roas'])
    ads = pd.DataFrame({'Reklam Adı': a['name'], 'Reklam Statüsü': a['status'], 'Başlangıç Tarihi': a['started_at'], 'Bitiş Tarihi': '-',
                        'Ürün Adedi': a['product_count'], 'Ürün ContentId Listesi': a['product_ids'], 'Toplam Bütçe': a['total_budget'],
                        'Günlük Bütçe': a['daily_budget'], 'Kalan Bütçe': a['total_budget'] - a['spent'], 'Harcanan Bütçe': a['spent'],
                        'TBM Teklifi': np.nan, 'Gerçekleşen TBM': a['cpc'], 'Tıklanma': a['clicks'], 'Görüntülenme': a['impressions'],
                        'Doğrudan Satış Adedi': a['direct_sales'], 'Dolaylı Satış Adedi': a['indirect_sales'],
                        'Toplam Satış Adedi': a['direct_sales'].fillna(0) + a['indirect_sales'].fillna(0), 'Doğrudan Reklam Cirosu': a['direct_revenue'],
                        'Dolaylı Reklam Cirosu': a['indirect_revenue'], 'Toplam Reklam Cirosu': a['direct_revenue'].fillna(0) + a['indirect_revenue'].fillna(0),
                        'Harcama Getirisi': a['roas']})
    t = q('select * from ad_totals')
    t = _num(t, ['impressions', 'clicks', 'sales', 'revenue', 'spend', 'roas'])
    pan = t[t['source'] == 'panel'].iloc[0]
    meta = t[t['source'] == 'meta']
    ads_total = dict(impr=int(pan.impressions), clicks=int(pan.clicks), sales=int(pan.sales), rev=float(pan.revenue), spend=float(pan.spend), roas=float(pan.roas), visits=96)
    if len(meta):
        m0 = meta.iloc[0]
        ads_total['meta'] = dict(spend=float(m0.spend), impr=int(m0.impressions), clicks=int(m0.clicks), sales=int(m0.sales), rev=float(m0.revenue), roas=float(m0.roas))
    return S, K, O, dist, ops, store, ads, ads_total
