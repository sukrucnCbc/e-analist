import pandas as pd, numpy as np, glob, json, re, itertools, warnings, os, unicodedata
warnings.filterwarnings('ignore')
U = os.environ.get('RAW_DIR', os.path.join(os.path.dirname(__file__), '..', 'data', 'raw')) + '/'
OUT = os.environ.get('OUT', os.path.join(os.path.dirname(__file__), '..', 'dashboard', 'data.json'))
TR = str.maketrans('ıİşŞğĞüÜöÖçÇ', 'iIsSgGuUoOcC')
def norm(f):
    f = unicodedata.normalize('NFC', os.path.basename(f)).translate(TR).lower()
    return f.replace('may_s', 'mayis').replace('a_ustos', 'agustos').replace('eyl_l', 'eylul').replace('sat__', 'satis').replace('sipari_-da__l_m', 'siparis-dagilim')
def files(*keys):
    return sorted(f for f in glob.glob(U + '*.xlsx') if any(k in norm(f) for k in keys))
MONTHS = ['nisan', 'mayis', 'haziran', 'temmuz', 'a_ustos', 'eyl_l']
MLAB = {'nisan': 'Nis', 'mayis': 'May', 'haziran': 'Haz', 'temmuz': 'Tem', 'a_ustos': 'Ağu', 'eyl_l': 'Eyl'}
NMAP = {'nisan': 'nisan', 'mayis': 'mayis', 'haziran': 'haziran', 'temmuz': 'temmuz', 'agustos': 'a_ustos', 'eylul': 'eyl_l'}
def mkey(f):
    n = norm(f)
    for k, v in NMAP.items():
        if n.startswith(k) or ('-' + k + '-') in n or ('_' + k) in n or (k + '-') in n: return v
out = {}
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
except ImportError:
    pass
SOURCE = os.environ.get('SOURCE', 'db' if os.environ.get('DATABASE_URL') else 'excel')
print('Veri kaynağı:', 'Supabase veritabanı' if SOURCE == 'db' else 'Excel (data/raw)')
if SOURCE == 'db':
    import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from db_source import load as _db_load, REASONS as _REASONS
    _S, _K, _O, _DIST, _OPS, _STORE, _ADS, _ADS_TOTAL = _db_load()

# ---------------- SALES REPORTS ----------------
if SOURCE == 'db':
    S, K = _S, _K
    reason_cols = list(_REASONS)
else:
    sales = []
    cat_rows = []
    for f in files('satis-raporu'):
        m = mkey(f)
        d = pd.read_excel(f, sheet_name='urun-bazlı-satış-raporu')
        for c in ['Toplam Komisyon Tutarı', 'Güncel Satış Fiyatı', 'Ortalama Komisyon Oranı']:
            d[c] = pd.to_numeric(d[c], errors='coerce')
        d['m'] = m
        sales.append(d)
        k = pd.read_excel(f, sheet_name='kategori-bazlı-satış-raporu')
        for c in ['Toplam Komisyon Tutarı']: k[c] = pd.to_numeric(k[c], errors='coerce')
        k['m'] = m
        cat_rows.append(k)
    S = pd.concat(sales)
    K = pd.concat(cat_rows)
    reason_cols = list(S.columns[23:44])

# barcode master (latest info)
master = S.sort_values('m', key=lambda s: s.map({m: i for i, m in enumerate(MONTHS)})).groupby('Barkod').last()
bar2model = master['Model Kodu'].to_dict()
bar2cat = master['Kategori'].to_dict()

# ---------------- ORDERS ----------------
if SOURCE == 'db':
    O = _O
else:
    _o = []
    for f in files('tum-siparisler'):
        _d = pd.read_excel(f, header=1, dtype=str); _d['src'] = mkey(f); _o.append(_d)
    O = pd.concat(_o)
    O = O.drop_duplicates(subset=[c for c in O.columns if c != 'src'])  # aylar arası mükerrer satırlar
num = ['Adet', 'Birim Fiyatı', 'Satış Tutarı', 'İndirim Tutarı', 'Trendyol İndirim Tutarı', 'Faturalanacak Tutar', 'Faturalanan Kargo Tutarı', 'Komisyon Oranı']
for c in num: O[c] = pd.to_numeric(O[c], errors='coerce')
O['m'] = O['src'].map(lambda s: 'mayis' if s == 'mayis' else s)
O['dt'] = pd.to_datetime(O['Sipariş Tarihi'], format='%d.%m.%Y %H:%M')
O['ship'] = pd.to_datetime(O['Kargoya Teslim Tarihi'], format='%d.%m.%Y %H:%M', errors='coerce')
O['deliv'] = pd.to_datetime(O['Teslim Tarihi'], format='%d.%m.%Y %H:%M', errors='coerce')
O['model'] = O['Barkod'].map(bar2model).fillna(O['Stok Kodu'])
O['cat'] = O['Barkod'].map(bar2cat).fillna('Diğer')
O['comm'] = O['Faturalanacak Tutar'] * O['Komisyon Oranı'] / 100
if 'cust' not in O: O['cust'] = (O['Alıcı'].str.lower().str.strip().str.replace(r'\s+', ' ', regex=True) + '|' + O['İl'].str.lower() + '|' + O['İlçe'].str.lower())
O['returned'] = O['Sipariş Statüsü'].eq('İade edildi')

def cargo_rule(x):
    return 40.99 if x < 200 else (78.99 if x < 350 else 93.05)

P = O.groupby('Paket No').agg(order=('Sipariş Numarası', 'first'), m=('m', 'first'), dt=('dt', 'first'), ship=('ship', 'first'), deliv=('deliv', 'first'),
                              gross=('Satış Tutarı', 'sum'), net=('Faturalanacak Tutar', 'sum'), disc=('İndirim Tutarı', 'sum'), tydisc=('Trendyol İndirim Tutarı', 'sum'),
                              units=('Adet', 'sum'), lines=('Barkod', 'nunique'), models=('model', 'nunique'), cats=('cat', 'nunique'),
                              cargo=('Faturalanan Kargo Tutarı', 'first'), comm=('comm', 'sum'), cust=('cust', 'first'), firm=('Kargo Firması', 'first'),
                              nth=('Müşteri Sipariş Adedi', 'first'), city=('İl', 'first'), returned=('returned', 'max'),
                              age=('Yaş', 'first'), gender=('Cinsiyet', 'first'))
P['cargo_known'] = P['cargo'].notna()
P['cargo_f'] = P['cargo'].fillna(P['net'].map(cargo_rule))
P['h_to_ship'] = (P['ship'] - P['dt']).dt.total_seconds() / 3600
P['d_to_deliv'] = (P['deliv'] - P['ship']).dt.total_seconds() / 86400
P['d_total'] = (P['deliv'] - P['dt']).dt.total_seconds() / 86400

# ---------------- MONTHLY KPI ----------------
ops = _OPS if SOURCE == 'db' else pd.read_excel(files('operasyon')[0]).set_index('Kalite Metriklerim')
opmap = {'nisan': 'Nis 2026', 'mayis': 'May 2026', 'haziran': 'Haz 2026', 'temmuz': 'Tem 2026', 'a_ustos': 'Ağu 2026', 'eyl_l': 'Eyl 2026'}

if SOURCE == 'db':
    dist = _DIST
else:
    dist = {}
    for f in files('siparis-dagilim'):
        m = mkey(f)
        x = pd.ExcelFile(f)
        dist[m] = {s: pd.read_excel(f, sheet_name=s) for s in x.sheet_names}

monthly = []
for m in MONTHS:
    s = S[S.m == m]
    row = dict(m=MLAB[m], key=m,
               gross_units=int(s['Brüt Satış Adedi'].sum()), cancel=int(s['İptal Adedi'].sum()), ret=int(s['İade Adedi'].sum()),
               net_units=int(s['Net Satış Adedi'].sum()), gross_rev=float(s['Brüt Ciro'].sum()), disc=float(s['İndirim Tutarı'].sum()),
               net_rev=float(s['Net Ciro'].sum()), comm=float(s['Toplam Komisyon Tutarı'].sum()),
               skus_sold=int((s['Brüt Satış Adedi'] > 0).sum()))
    row['cancel_rate'] = row['cancel'] / row['gross_units'] * 100
    row['ret_rate'] = row['ret'] / row['gross_units'] * 100
    row['comm_rate'] = row['comm'] / row['net_rev'] * 100
    p = P[P.m == m]
    if len(p):
        row.update(orders=int(p.order.nunique()), pkgs=len(p), aov=float(p.net.sum() / len(p)), aov_gross=float(p.gross.sum() / len(p)),
                   upt=float(p.units.sum() / len(p)), lines_per=float(p.lines.mean()), cargo_avg=float(p.cargo_f.mean()),
                   cargo_share=float(p.cargo_f.sum() / p.net.sum() * 100), customers=int(p.cust.nunique()),
                   multi_item=float((p.lines > 1).mean() * 100), h_to_ship=float(p.h_to_ship.median()), d_to_deliv=float(p.d_to_deliv.median()),
                   repeat_share=float((p.nth != '1.Sipariş').mean() * 100), order_rev=float(p.net.sum()))
    dd = dist.get(m)
    if dd is not None:
        nm = dd['Yeni & Mevcut Müşteri']
        row['new_share'] = float(nm[nm.iloc[:, 0].astype(str).str.startswith('Yeni')]['Sipariş Adedi'].sum() / nm['Sipariş Adedi'].sum() * 100)
        row['dist_orders'] = int(nm['Sipariş Adedi'].sum())
        pl = dd['Trendyol Plus']
        row['plus_share'] = float(pl[pl.iloc[:, 0].astype(str).str.contains('Plus')]['Sipariş Adedi'].sum() / pl['Sipariş Adedi'].sum() * 100)
        ab = dd['Adet Bazlı']
        row['single_item_share'] = float(ab[ab.iloc[:, 0].astype(str) == '1']['Sipariş Adedi'].sum() / ab['Sipariş Adedi'].sum() * 100)
        tb = dd['Tutar Bazlı']
        row['under250_share'] = float(tb[tb.iloc[:, 0].astype(str).str.startswith('0 TRY')]['Sipariş Adedi'].sum() / tb['Sipariş Adedi'].sum() * 100)
    col = opmap[m]
    row['op_units'] = float(ops.loc['Satılan Ürün Adedi', col])
    row['op_ret'] = float(ops.loc['İade Oranı', col])
    row['op_defect'] = float(ops.loc['Kusurlu & Yanlış & Eksik İade Oranı', col])
    row['op_ship_h'] = float(ops.loc['Kargoya Teslim Süresi', col])
    row['op_deliv_h'] = float(ops.loc['Müşteriye Teslim Süresi', col])
    row['op_ontime'] = float(ops.loc['Kargoya Zamanında Teslim Oranı', col])
    row['op_fast'] = float(ops.loc['Hızlı Teslimatla Oluşan Gönderi Oranı', col])
    monthly.append(row)
out['monthly'] = monthly

# full ops history
out['ops_hist'] = {'cols': list(ops.columns[1:])[::-1], 'rows': {i: [float(v) for v in ops.loc[i, ops.columns[1:]].values[::-1]] for i in ops.index}}

# ---------------- CATEGORY ----------------
cat = K.groupby('Kategori').agg(gross_units=('Brüt Satış Adedi', 'sum'), cancel=('İptal Adedi', 'sum'), ret=('İade Adedi', 'sum'), net_units=('Net Satış Adedi', 'sum'),
                                gross_rev=('Brüt Ciro', 'sum'), disc=('İndirim Tutarı', 'sum'), net_rev=('Net Ciro', 'sum'), comm=('Toplam Komisyon Tutarı', 'sum')).sort_values('net_rev', ascending=False)
cat['ret_rate'] = cat.ret / cat.gross_units * 100
cat['asp'] = cat.net_rev / cat.net_units
cat['comm_rate'] = cat.comm / cat.net_rev * 100
cat['share'] = cat.net_rev / cat.net_rev.sum() * 100
catm = K.pivot_table(index='Kategori', columns='m', values='Net Ciro', aggfunc='sum').reindex(columns=MONTHS).fillna(0)
# order-level per category: basket attach, cargo burden
OL = O.copy()
pk_cat = OL.groupby(['Paket No', 'cat']).agg(v=('Faturalanacak Tutar', 'sum')).reset_index()
pk_ncat = OL.groupby('Paket No')['cat'].nunique()
pk_tot = P['net']
cat_orders = []
for c in cat.index:
    pk = pk_cat[pk_cat.cat == c]['Paket No'].unique()
    if len(pk) == 0:
        cat_orders.append((0, 0, 0, 0)); continue
    pp = P.loc[pk]
    cat_orders.append((len(pk), float(pp.net.mean()), float((pk_ncat.loc[pk] > 1).mean() * 100), float((pp.net < 200).mean() * 100)))
cat['pkgs'] = [x[0] for x in cat_orders]
cat['aov_with'] = [x[1] for x in cat_orders]
cat['cross_cat'] = [x[2] for x in cat_orders]
cat['under200'] = [x[3] for x in cat_orders]
out['cats'] = [dict(name=i, **{k: (float(v) if not isinstance(v, str) else v) for k, v in r.items()}, trend=[float(catm.loc[i, m]) for m in MONTHS]) for i, r in cat.iterrows()]

# return reasons & cancel reasons
rr = S[reason_cols].sum().sort_values(ascending=False)
out['reasons'] = {k: int(v) for k, v in rr.items() if v > 0}

# ---------------- PRODUCTS (model level) ----------------
S['Güncel Stok'] = pd.to_numeric(S['Güncel Stok'], errors='coerce')
latest = S[S.m == 'eyl_l'].set_index('Barkod')
mod = S.groupby('Model Kodu').agg(cat=('Kategori', 'first'), gross_units=('Brüt Satış Adedi', 'sum'), net_units=('Net Satış Adedi', 'sum'), ret=('İade Adedi', 'sum'), cancel=('İptal Adedi', 'sum'),
                                  net_rev=('Net Ciro', 'sum'), gross_rev=('Brüt Ciro', 'sum'), disc=('İndirim Tutarı', 'sum'), comm=('Toplam Komisyon Tutarı', 'sum'), variants=('Barkod', 'nunique'))
mm = S.pivot_table(index='Model Kodu', columns='m', values='Net Ciro', aggfunc='sum').reindex(columns=MONTHS).fillna(0)
mu = S.pivot_table(index='Model Kodu', columns='m', values='Net Satış Adedi', aggfunc='sum').reindex(columns=MONTHS).fillna(0)
mod['asp'] = mod.net_rev / mod.net_units.replace(0, np.nan)
mod['ret_rate'] = mod.ret / mod.gross_units.replace(0, np.nan) * 100
mod['comm_rate'] = mod.comm / mod.net_rev.replace(0, np.nan) * 100
# stock & price from latest
lt = S[S.m == 'eyl_l'].copy()
lt['Güncel Satış Fiyatı'] = pd.to_numeric(lt['Güncel Satış Fiyatı'], errors='coerce')
st = lt.groupby('Model Kodu').agg(stock=('Güncel Stok', 'sum'), price=('Güncel Satış Fiyatı', 'median'), oos_var=('Güncel Stok', lambda s: int((s == 0).sum())), var_now=('Barkod', 'nunique'))
mod = mod.join(st)
# name: shortest informative
nm = S.groupby('Model Kodu')['Ürün Adı'].agg(lambda s: s.dropna().value_counts().index[0] if s.notna().any() else '')
def short(n):
    n = re.split(r' – |\||-Hediye| -Hediye', n)[0] if len(n) > 60 else n
    return n[:70]
mod['name'] = nm.map(short)
# growth: last 3 full months (Haz-Ağu) vs first (Nis-May) normalized; plus Eyl runrate
mod['h1'] = (mm['nisan'] + mm['mayis']) / 2
mod['h2'] = (mm['temmuz'] + mm['a_ustos']) / 2
mod['eyl'] = mm['eyl_l']
mod['growth'] = np.where(mod.h1 > 0, (mod.h2 / mod.h1 - 1) * 100, np.where(mod.h2 > 0, 999, 0))
mod['months_active'] = (mm > 0).sum(axis=1)
mod['cv'] = mm[MONTHS[:5]].std(axis=1) / mm[MONTHS[:5]].mean(axis=1).replace(0, np.nan)
mod['daily_units'] = mu['eyl_l'] / 22
mod['cover_days'] = mod.stock / mod.daily_units.replace(0, np.nan)
# basket attach per model from orders
mo = O.groupby(['Paket No', 'model']).size().reset_index()[['Paket No', 'model']]
multi = P[P.models > 1].index
att = mo.groupby('model').apply(lambda g: pd.Series({'pk': len(g), 'multi': g['Paket No'].isin(multi).mean() * 100}))
mod = mod.join(att)
modpk = mo.merge(P[['net', 'units']], left_on='Paket No', right_index=True).groupby('model').agg(aov_with=('net', 'mean'))
mod = mod.join(modpk)
# unit economics per model: avg units per order line & cargo burden (share of cargo attributed by revenue share)
O2 = O.merge(P[['cargo_f', 'net']].rename(columns={'net': 'pnet'}), left_on='Paket No', right_index=True)
O2['cargo_alloc'] = O2['cargo_f'] * O2['Faturalanacak Tutar'] / O2['pnet'].replace(0, np.nan)
cb = O2.groupby('model').agg(cargo_alloc=('cargo_alloc', 'sum'), orev=('Faturalanacak Tutar', 'sum'), ocomm=('comm', 'sum'), solo=('Paket No', lambda s: (P.loc[s.unique(), 'models'] == 1).mean() * 100))
mod = mod.join(cb)
mod['cargo_pct'] = mod.cargo_alloc / mod.orev * 100
mod['comm_pct_o'] = mod.ocomm / mod.orev * 100
mod = mod[mod.net_rev > 0].sort_values('net_rev', ascending=False)
mod['cum'] = mod.net_rev.cumsum() / mod.net_rev.sum() * 100
mod['rev_share'] = mod.net_rev / mod.net_rev.sum() * 100

# Segmentation
def seg(r):
    if r.cum <= 50.5 or r.rev_share >= 4: return 'Hero'
    if r.cum <= 80: return 'Rising' if r.growth >= 40 and r.months_active >= 3 else 'Core'
    if r.growth >= 60 and r.h2 >= 1500 : return 'Rising'
    return 'Long Tail'
mod['seg'] = mod.apply(seg, axis=1)
mod = mod.reset_index().rename(columns={'Model Kodu': 'code'})
cols = ['code', 'name', 'cat', 'seg', 'net_rev', 'rev_share', 'cum', 'net_units', 'gross_units', 'asp', 'price', 'ret_rate', 'comm_rate', 'growth', 'months_active', 'stock', 'oos_var', 'var_now', 'variants', 'cover_days', 'daily_units', 'pk', 'multi', 'aov_with', 'cargo_pct', 'solo', 'disc', 'cv', 'eyl']
prods = mod[cols].replace([np.inf, -np.inf], np.nan)
out['products'] = json.loads(prods.round(2).to_json(orient='records', force_ascii=False))
out['prod_trend'] = {r['Model Kodu']: [float(x) for x in r[MONTHS].values] for _, r in mm.reset_index().iterrows() if r['Model Kodu'] in set(mod.code[:40])}
segsum = mod.groupby('seg').agg(n=('code', 'count'), rev=('net_rev', 'sum'), units=('net_units', 'sum'), ret=('ret_rate', 'mean'), growth=('growth', 'median'), asp=('asp', 'median'), multi=('multi', 'mean'), cargo=('cargo_pct', 'mean'))
segsum['share'] = segsum.rev / segsum.rev.sum() * 100
out['segsum'] = json.loads(segsum.round(2).to_json(orient='index', force_ascii=False))

# OOS
lt2 = lt.copy()
out['oos'] = dict(skus_now=int(len(lt2)), oos_now=int((lt2['Güncel Stok'] == 0).sum()),
                  oos_selling=int(((lt2['Güncel Stok'] == 0) & (lt2['Brüt Satış Adedi'] > 0)).sum()),
                  low_cover=int(((lt2['Güncel Stok'] / (lt2['Net Satış Adedi'] / 22).replace(0, np.nan)) < 21).sum()))
# SKU level OOS across months: barcodes that sold in prior months but not present/zero in later
bm = S.pivot_table(index='Barkod', columns='m', values='Brüt Satış Adedi', aggfunc='sum').reindex(columns=MONTHS)
out['oos']['sku_months'] = {MLAB[m]: int(bm[m].notna().sum()) for m in MONTHS}
lowc = lt2.assign(cover=lt2['Güncel Stok'] / (lt2['Net Satış Adedi'] / 22).replace(0, np.nan))
lowc = lowc[(lowc.cover < 30) & (lowc['Net Satış Adedi'] >= 5)].sort_values('cover')
out['oos']['low_list'] = [dict(name=short(r['Ürün Adı'])[:60], color=str(r['Renk']) if pd.notna(r['Renk']) else '', stock=int(r['Güncel Stok']), daily=round(r['Net Satış Adedi'] / 22, 1), cover=round(r.cover, 1)) for _, r in lowc.head(15).iterrows()]

# ---------------- CUSTOMERS ----------------
cust = P.groupby('cust').agg(n=('order', 'nunique'), rev=('net', 'sum'), first=('dt', 'min'), last=('dt', 'max'))
out['cust'] = dict(customers=int(len(cust)), repeaters=int((cust.n > 1).sum()), rpr=float((cust.n > 1).mean() * 100),
                   orders_per=float(cust.n.mean()), rev_per=float(cust.rev.mean()),
                   rev_rep_share=float(cust[cust.n > 1].rev.sum() / cust.rev.sum() * 100),
                   aov_rep=float(P[P.cust.isin(cust[cust.n > 1].index)].net.mean()), aov_one=float(P[P.cust.isin(cust[cust.n == 1].index)].net.mean()),
                   dist_n={str(k): int(v) for k, v in cust.n.clip(upper=5).value_counts().sort_index().items()},
                   nth={k: int(v) for k, v in P.nth.value_counts().items()})
rep = cust[cust.n > 1]
gaps = []
for c, g in P[P.cust.isin(rep.index)].sort_values('dt').groupby('cust'):
    d = g.dt.diff().dt.days.dropna(); gaps += list(d[d > 0])
gaps = np.array(gaps)
out['cust']['gap_median'] = float(np.median(gaps)); out['cust']['gap_p25'] = float(np.percentile(gaps, 25)); out['cust']['gap_p75'] = float(np.percentile(gaps, 75))
out['cust']['gap_hist'] = [int(((gaps >= a) & (gaps < b)).sum()) for a, b in [(0, 7), (7, 14), (14, 30), (30, 60), (60, 90), (90, 200)]]
# cohort: first month -> returned later
P['fm'] = P.cust.map(cust['first']).dt.month
coh = {}
for fm in [4, 5, 6, 7]:
    cs = cust[cust['first'].dt.month == fm].index
    pp = P[P.cust.isin(cs)]
    coh[fm] = [float(pp[pp.dt.dt.month == mm_].cust.nunique() / len(cs) * 100) for mm_ in range(fm, 9)]
out['cohort'] = coh

# demographics aggregated across months from dist reports
def agg_sheet(s, keycols):
    frames = []
    for m, dd in dist.items():
        x = dd[s].copy(); x['m'] = m; frames.append(x)
    x = pd.concat(frames)
    return x.groupby(keycols)['Sipariş Adedi'].sum()
out['age'] = {k: int(v) for k, v in agg_sheet('Yaş', 'Yaş Aralığı').items()}
out['gender'] = {k: int(v) for k, v in agg_sheet('Cinsiyet', 'Cinsiyet').items()}
dh = agg_sheet('Gün ve Saat', ['Gün', 'Saat Aralığı'])
out['dayhour'] = {f'{a}|{b}': int(v) for (a, b), v in dh.items()}
city = P.groupby('city').agg(o=('order', 'count'), rev=('net', 'sum'), aov=('net', 'mean')).sort_values('o', ascending=False)
out['city'] = [dict(c=i, o=int(r.o), rev=float(r.rev), aov=float(r.aov)) for i, r in city.head(12).iterrows()]
out['city_total'] = int(len(P))
tb = agg_sheet('Tutar Bazlı', 'Sipariş Tutar Aralığı'); out['amount_bins'] = {k: int(v) for k, v in tb.items()}
ab = agg_sheet('Adet Bazlı', 'Sipariş Başına Ürün Adedi'); out['qty_bins'] = {str(k): int(v) for k, v in ab.items()}
pl = agg_sheet('Trendyol Plus', 'Trendyol Plus'); out['plus'] = {k: int(v) for k, v in pl.items()}
# weekday from orders
P['wd'] = P.dt.dt.dayofweek; P['hr'] = P.dt.dt.hour; P['dom'] = P.dt.dt.day
out['wd'] = [dict(o=int((P.wd == i).sum()), aov=float(P[P.wd == i].net.mean())) for i in range(7)]
out['dom'] = [int((P.dom == i).sum()) for i in range(1, 32)]
out['daily'] = {str(k.date()): [int(v), float(r)] for (k, v), r in zip(P.groupby(P.dt.dt.normalize()).size().items(), P.groupby(P.dt.dt.normalize()).net.sum().values)}

# ---------------- BASKET / AOV / CARGO ----------------
bins = [0, 100, 150, 200, 250, 300, 350, 400, 500, 750, 100000]
lab = ['<100', '100-149', '150-199', '200-249', '250-299', '300-349', '350-399', '400-499', '500-749', '750+']
P['bin'] = pd.cut(P.net, bins, labels=lab, right=False)
bb = P.groupby('bin').agg(n=('order', 'count'), cargo=('cargo_f', 'mean'), net=('net', 'mean'), comm=('comm', 'mean'), units=('units', 'mean'))
bb['cargo_pct'] = bb.cargo / bb.net * 100
bb['comm_pct'] = bb.comm / bb.net * 100
out['aov_bins'] = [dict(b=str(i), **{k: float(v) for k, v in r.items()}) for i, r in bb.iterrows()]
# near-threshold: 185-199.99 and 200-230
out['cliff'] = dict(n_180_200=int(((P.net >= 180) & (P.net < 200)).sum()), n_200_230=int(((P.net >= 200) & (P.net < 230)).sum()),
                    n_330_350=int(((P.net >= 330) & (P.net < 350)).sum()), n_350_380=int(((P.net >= 350) & (P.net < 380)).sum()),
                    share_under200=float((P.net < 200).mean() * 100), pk=int(len(P)), cargo_total=float(P.cargo_f.sum()), rev_total=float(P.net.sum()),
                    comm_total=float(P.comm.sum()), cargo_known_share=float(P.cargo_known.mean() * 100))
# histogram of net per 10 TL up to 600
h = np.histogram(P.net.clip(upper=599), bins=np.arange(0, 610, 10))
out['net_hist'] = [int(x) for x in h[0]]
out['upt_dist'] = {str(k): int(v) for k, v in P.units.clip(upper=8).value_counts().sort_index().items()}
out['lines_dist'] = {str(k): int(v) for k, v in P.lines.clip(upper=5).value_counts().sort_index().items()}
out['models_dist'] = {str(k): int(v) for k, v in P.models.clip(upper=5).value_counts().sort_index().items()}

# pair analysis at model level
pm = O.groupby('Paket No')['model'].apply(lambda s: sorted(set(s)))
N = len(pm)
from collections import Counter
single = Counter(); pair = Counter()
for items in pm:
    for i in items: single[i] += 1
    for a, b in itertools.combinations(items, 2): pair[(a, b)] += 1
name = dict(zip(mod.code, mod.name)); catof = dict(zip(mod.code, mod.cat)); segof = dict(zip(mod.code, mod.seg)); aspof = dict(zip(mod.code, mod.asp))
rows = []
for (a, b), c in pair.items():
    if c < 12: continue
    sa, sb = single[a] / N, single[b] / N
    sup = c / N
    rows.append(dict(a=a, b=b, an=name.get(a, a), bn=name.get(b, b), ac=catof.get(a, ''), bc=catof.get(b, ''), aseg=segof.get(a, ''), bseg=segof.get(b, ''), n=c, sup=sup * 100, conf_ab=c / single[a] * 100, conf_ba=c / single[b] * 100, lift=sup / (sa * sb),
                     pa=aspof.get(a, 0), pb=aspof.get(b, 0)))
pairs = pd.DataFrame(rows).sort_values('n', ascending=False)
out['pairs'] = json.loads(pairs.head(60).round(3).to_json(orient='records', force_ascii=False))
out['pairs_lift'] = json.loads(pairs[pairs.n >= 15].sort_values('lift', ascending=False).head(30).round(3).to_json(orient='records', force_ascii=False))
# category pairs
pc = O.groupby('Paket No')['cat'].apply(lambda s: sorted(set(s)))
cs = Counter(); cp = Counter()
for items in pc:
    for i in items: cs[i] += 1
    for a, b in itertools.combinations(items, 2): cp[(a, b)] += 1
out['cat_pairs'] = [dict(a=a, b=b, n=c, conf_ab=c / cs[a] * 100, conf_ba=c / cs[b] * 100, lift=(c / N) / ((cs[a] / N) * (cs[b] / N))) for (a, b), c in cp.most_common(20)]
out['cat_single'] = dict(cs)
# same-model multi-color share
bc = O.groupby(['Paket No', 'model'])['Barkod'].nunique()
out['multicolor'] = dict(pk_same_model_multi=int((bc > 1).groupby(level=0).any().sum()), pk=N)
mc = (bc[bc > 1]).reset_index().groupby('model').size().sort_values(ascending=False).head(10)
out['multicolor_models'] = [dict(code=k, name=name.get(k, k), n=int(v), share=float(v / single[k] * 100)) for k, v in mc.items()]
# qty per line (multi-unit same SKU)
out['qty_line'] = {str(k): int(v) for k, v in O.Adet.clip(upper=6).value_counts().sort_index().items()}
# top multi-unit SKUs
mq = O.groupby('model').agg(avgq=('Adet', 'mean'), lines=('Adet', 'size')).query('lines>=100').sort_values('avgq', ascending=False).head(10)
out['multiunit'] = [dict(code=k, name=name.get(k, k), avgq=float(r.avgq), lines=int(r.lines)) for k, r in mq.iterrows()]

# ---------------- FULFILLMENT ----------------
f = P.dropna(subset=['h_to_ship'])
out['fulfil'] = dict(h_ship_med=float(f.h_to_ship.median()), h_ship_p90=float(f.h_to_ship.quantile(.9)), d_deliv_med=float(P.d_to_deliv.median()), d_total_med=float(P.d_total.median()),
                     d_total_p90=float(P.d_total.quantile(.9)), same_day=float((f.h_to_ship < 24).mean() * 100))
out['carrier'] = [dict(c=k.replace(' Marketplace', ''), n=int(len(g)), h=float(g.h_to_ship.median()), d=float(g.d_to_deliv.median()), cargo=float(g.cargo_f.mean()), ret=float(g.returned.mean() * 100)) for k, g in P.groupby('firm')]
# return rate vs total delivery days
P['dbin'] = pd.cut(P.d_total, [0, 2, 3, 4, 5, 7, 30], labels=['≤2', '2-3', '3-4', '4-5', '5-7', '7+'])
out['ret_by_days'] = [dict(b=str(k), n=int(len(g)), ret=float(g.returned.mean() * 100)) for k, g in P.groupby('dbin')]
# order hour -> ship
out['store'] = json.loads((_STORE if SOURCE == 'db' else pd.read_excel(files('magaza')[0])).to_json(orient='records', force_ascii=False))

# ---------------- ADS ----------------
ads = _ADS.copy() if SOURCE == 'db' else pd.read_excel(files('reklam')[0])
def tn(x):
    if isinstance(x, (int, float)): return float(x)
    x = str(x).strip()
    if x in ('-', 'nan'): return np.nan
    return float(x.replace('.', '').replace(',', '.'))
for c in ads.columns[6:]: ads[c] = ads[c].map(tn)
out['ads_products'] = json.loads(ads.to_json(orient='records', force_ascii=False))
out['ads_total'] = _ADS_TOTAL if SOURCE == 'db' else dict(impr=4912762, clicks=141168, sales=11007, rev=1387840.27, spend=140693.95, roas=9.86, visits=96,
                        meta=dict(spend=1498.27, impr=19707, clicks=792, sales=31, rev=6901.50, roas=4.61))


# ---------- extras ----------
COL = r'^(Pembe|Kırmızı|Beyaz|Siyah|Krem|Ekru|Bordo|Bebe Mavi|Mavi|Sarı|Haki|Lacivert|Yeşil|Mor|Lila|Gri|Turuncu|Fuşya|Altın|Gümüş|Kahverengi|Vizon|Pudra|Somon|Turkuaz)[\s,-]+'
FIX = {'1CMFIYONK50ADET': 'Fiyonk Saten Kurdele 10 mm · 50 Adet', '5623-5METRE': 'Likralı Dantel 18 cm · 5 m', 'PAMUKBIYE2CM': 'Pamuk Koton Biye 2 cm · 25 m',
       'SK1': 'Saten Kurdele 1 cm · 10 m', 'SK3': 'Saten Kurdele 3 cm · 10 m', 'SK4': 'Saten Kurdele 4 cm · 10 m', 'SK6': 'Saten Kurdele 6 cm · 10 m', 'SK2': 'Saten Kurdele 2 cm · 10 m',
       'KOPANAKI1013-10MT': 'Pamuk Kopanaki No:1013 1.6 cm · 10 m', 'KOPANAKI8383-10MT': 'Pamuk Kopanaki No:8383 0.8 cm · 10 m', 'KOPANAKI1461-10MT': 'Pamuk Kopanaki No:1461 2.5 cm · 10 m',
       '405 PAMUK KOPANAKİ DANTEL': 'Pamuk Kopanaki No:405 · 10 m', '4071A PAMUK KOPANAKİ DANTEL': 'Pamuk Kopanaki No:4071A · 10 m',
       'V3S': 'Omuz Vatkası 3 cm · Siyah', 'V3B': 'Omuz Vatkası 3 cm · Beyaz', 'V2S': 'Omuz Vatkası 2 cm · Siyah', 'V2B': 'Omuz Vatkası 2 cm · Beyaz', 'V1S': 'Omuz Vatkası 1 cm · Siyah', 'V1B': 'Omuz Vatkası 1 cm · Beyaz',
       'VVB': 'Omuz Vatkası 1.5 cm · Beyaz', 'V25B': 'Omuz Vatkası 2.5 cm · Beyaz', 'INCILIFIYONK-20ADET': 'Yapışkanlı İncili Keten Fiyonk · 20 Adet',
       'dynyhy33987ilmmkaa9828aaka': 'Güpür Kopanaki Çıtır Erkoç Kenar · 1 m', 'A031-10METRE': 'Sakallı Dantel Şerit 15 cm · 3 m', 'A008-10METRE': 'Sakallı Dantel Şerit 6 cm · 3 m',
       '5575-5METRE': 'Likralı Dantel 3 cm · 5 m', 'LY210B': 'Yassı Paça-Bel Lastiği 1 cm · Beyaz 10 m', 'LY210S': 'Yassı Paça-Bel Lastiği 1 cm · Siyah 10 m',
       'LP210B': 'Paça-Bel Lastiği 2 cm · Beyaz 10 m', 'LB20B': 'Oluklu Bebe Lastiği · Beyaz 20 m', 'LB20S': 'Oluklu Bebe Lastiği · Siyah 20 m', 'EKOSEBIYE2CM': 'Ekose Koton Biye 2 cm · 25 m',
       '1023KREM': 'Pamuk Kopanaki No:1023 1.7 cm · 5 m', 'MEKSIKA': 'Güpür Tül Bant 5 cm', 'KOLBER9MT': 'Kolber Ara Dantel Güpür 2 cm · 9 m', '1CMKADIFEKURDELE10MT': 'Kadife Kurdele 1 cm · 10 m',
       'KOP250K': 'Pamuk Kopanaki Krem · 25 m Paket', '1043-1MT': 'Çiçek Desenli Güpür Şerit 11 cm · 1 m', 'ARM-AR1608': 'Çift Katlı Güpür Kurdele 5 cm · 10 m', 'MONOFIL30MT': 'Simli Monofil İp · 30 m',
       'BALIKSIRTI2CM10MTHAM': 'Balıksırtı Dokuma Şerit 2 cm · 10 m', 'BALIKSIRTI1CM10MTHAM': 'Balıksırtı Dokuma Şerit 1 cm · 10 m', 'CHARMSET6ADET': 'Panda Anahtarlık Seti · 6\'lı',
       'Dynyhyp90876663354': 'Güpür Tekli Ponpon · 12 m', '8B0100e': 'Güpür Ekru Bant · 9 m', 'LYU50B': 'Yuvarlak Bel Lastiği · Beyaz 50 m'}
def clean(code, n):
    if code in FIX: return FIX[code]
    n = re.sub(COL, '', str(n)).strip()
    n = re.split(r'[,|(]| - |– ', n)[0].strip()
    return n[:48]
nmap = {p['code']: clean(p['code'], p['name']) for p in out['products']}
for p in out['products']: p['name'] = nmap[p['code']]
for lst in ('pairs', 'pairs_lift'):
    for r in out[lst]: r['an'] = nmap.get(r['a'], clean(r['a'], r['an'])); r['bn'] = nmap.get(r['b'], clean(r['b'], r['bn']))
for r in out['multicolor_models'] + out['multiunit']: r['name'] = nmap.get(r['code'], clean(r['code'], r['name']))
out['prod_trend'] = {nmap.get(k, k): v for k, v in out['prod_trend'].items()}
# category cargo share
cc = O2.groupby('cat').agg(cargo=('cargo_alloc', 'sum'), rev=('Faturalanacak Tutar', 'sum'), comm=('comm', 'sum'))
for c in out['cats']:
    if c['name'] in cc.index:
        c['cargo_pct'] = float(cc.loc[c['name'], 'cargo'] / cc.loc[c['name'], 'rev'] * 100)
        c['comm_pct_o'] = float(cc.loc[c['name'], 'comm'] / cc.loc[c['name'], 'rev'] * 100)
# net hist per month average (5 months)
out['hist_months'] = 5
# lost revenue from OOS hero colours
lt3 = S[S.m == 'eyl_l']
oos = lt3[(lt3['Güncel Stok'] == 0)]
out['oos']['lost_daily'] = float((oos['Net Satış Adedi'] / 22 * oos['Ortalama Satış Fiyatı']).sum())
out['oos']['items'] = [dict(name=clean(r['Model Kodu'], r['Ürün Adı']), color=str(r['Renk']) if pd.notna(r['Renk']) else '', daily=round(r['Net Satış Adedi'] / 22, 1), asp=float(r['Ortalama Satış Fiyatı'])) for _, r in oos.iterrows()]
# summary totals
out['tot'] = dict(gross_rev=float(S['Brüt Ciro'].sum()), net_rev=float(S['Net Ciro'].sum()), gross_units=int(S['Brüt Satış Adedi'].sum()), net_units=int(S['Net Satış Adedi'].sum()),
                  ret=int(S['İade Adedi'].sum()), cancel=int(S['İptal Adedi'].sum()), disc=float(S['İndirim Tutarı'].sum()), comm=float(S['Toplam Komisyon Tutarı'].sum()),
                  pk=int(len(P)), units_o=float(P.units.sum()), net_o=float(P.net.sum()), cargo_o=float(P.cargo_f.sum()), comm_o=float(P.comm.sum()), skus=int(S.Barkod.nunique()), models=int(S['Model Kodu'].nunique()))



# ---------- post-processing ----------
FIX2 = {'VRS': 'Reglan Omuz Vatkası · Siyah', 'VRB': 'Reglan Omuz Vatkası · Beyaz', 'VVS': 'Omuz Vatkası 1.5 cm · Siyah', 'V25S': 'Omuz Vatkası 2.5 cm · Siyah',
        '1023BEYAZ': 'Pamuk Kopanaki No:1023 · Beyaz 5 m', '1013KREM': 'Pamuk Kopanaki No:1013 · 5 m', 'BALIKSIRTI2CM10MTSIYAH': 'Balıksırtı Dokuma Şerit 2 cm · Siyah',
        '8B0100S': 'Güpür Siyah Bant · 9 m', '636 PAMUK KOPANAKİ DANTEL': 'Pamuk Kopanaki No:636 · 10 m'}
for p in out['products']:
    if p['code'] in FIX2: p['name'] = FIX2[p['code']]
for l in ('pairs', 'pairs_lift'):
    for r in out[l]:
        if r['a'] in FIX2: r['an'] = FIX2[r['a']]
        if r['b'] in FIX2: r['bn'] = FIX2[r['b']]
out['hist_tail_mean'] = float(P[P.net >= 590].net.mean())
out['aov_all'] = float(P.net.mean())
out['mon_orders'] = {m: [int((P.m == m).sum()), float(P[P.m == m].net.sum()), float(P[P.m == m].cargo_f.sum()), float(P[P.m == m].comm.sum())] for m in MONTHS[:5]}
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, default=float)
print('data.json yazıldı:', OUT, '| paket:', out['tot']['pk'], '| net ciro:', round(out['tot']['net_rev']))
