# Ak Tuhafiye · Trendyol Büyüme Paneli

> Sürüm: **v0.3 — matrix** · ayrıntılar için [CHANGELOG.md](CHANGELOG.md)

Trendyol satıcı paneli dışa aktarımlarından e-ticaret metriklerini (AOV, UPT, CVR, katkı payı, iade, ROAS/ACoS/TACoS, CLV, RPR, OOS, lead time) hesaplayan ve 9 sekmeli interaktif bir HTML panel üreten analiz projesi.

## Yapı

```
guncelle.py              Tek komutla güncelleme (yükle → analiz → panel)
panel.py                 Paneli yerel sunucuyla açar: Raporlar sekmesinden içe aktarma + senkronizasyon
ingest/ingest.py         Excel → Supabase (kişisel veri atılır)
analysis/db_source.py    Supabase → analiz tabloları
analysis/doluluk.py      Hangi ay için hangi raporun Supabase'de olduğu (Raporlar sekmesi)
analysis/analyze.py      Metrikler → dashboard/data.json (yalnızca toplulaştırılmış veri)
dashboard/src/           Panelin HTML/CSS/JS kaynakları
dashboard/build.py       src + data.json → dashboard/dist/ak-tuhafiye-buyume-paneli.html
data/raw/                Ham Trendyol raporları (git'e GİRMEZ, .gitignore)
```

## Çalıştırma

```bash
pip install -r requirements.txt
python guncelle.py            # Supabase'den oku → analiz → panel
python guncelle.py --yukle    # yeni Excel'leri (data/raw) önce Supabase'e yükle
python guncelle.py --excel    # veritabanı olmadan, doğrudan Excel'den
# Çıktı: dashboard/dist/ak-tuhafiye-buyume-paneli.html
```

### Raporlar sekmesi: eksik raporları panelden tamamlama

```bash
python panel.py               # tarayıcıda http://127.0.0.1:8765/#raporlar açılır
```

1. Takvimde kırmızı/sarı bir kutuya tıklayın (ya da **Rapor içe aktar**). Rapor türü ve ay hazır seçili gelir.
2. Trendyol'dan indirdiğiniz Excel'i seçip **Yükle**. Dosya seçilen rapor türüyle okunarak kontrol edilir ve `data/raw` içine standart adla kaydedilir.
3. **Senkronize et**: `data/raw` → Supabase → analiz → panel. Bitince sayfa yenilenir ve kutular güncel doluluğu gösterir.

AI asistan butonu (sağ alt) şimdilik yalnızca arayüzdür. Küre yerine kendi karakter görselinizi kullanmak için `dashboard/src/asistan.png` dosyasını ekleyip `python dashboard/build.py` çalıştırın.

Sunucu yalnızca bu bilgisayardan (127.0.0.1) erişilebilir. Panel HTML dosyası doğrudan açıldığında takvim görünür ama içe aktarma butonları kapalıdır.

## Beklenen ham dosyalar (`data/raw/`)

Dosya adında ay adı (nisan, mayıs, haziran, temmuz, ağustos, eylül) ve rapor türü geçmelidir:

| Rapor | Dosya adında geçen ifade | Kaynak |
|---|---|---|
| Satış raporu (ürün/marka/kategori) | `satış-raporu` | Raporlar → Satış |
| Tüm siparişler | `tum-siparisler` | Siparişler → Excel'e aktar |
| Sipariş dağılım raporu | `sipariş-dağılım-raporu` | Raporlar → Sipariş Dağılımı |
| Operasyon raporu | `operasyon` | Raporlar → Operasyon |
| Mağaza raporu | `magaza` | Raporlar → Mağaza |
| Ürün reklamları raporu | `Reklam` | Reklam → Ürün Reklamları |

Reklam paneli toplamları (gösterim, tıklama, harcama, getiri) `ingest/ingest.py` içindeki `AD_TOTALS` listesinden `ad_totals` tablosuna yazılır; yeni dönemde orayı güncelleyin.

## Veritabanı (Supabase)

Geliştirme, test ve canlı ortam aynı Supabase projesini kullanır. Şema: `supabase/migrations/20260924000000_init.sql`.

**Bir kerelik kurulum**
1. supabase.com'da proje açın (bölge: Frankfurt / eu-central-1 önerilir).
2. SQL Editor → `supabase/migrations/20260924000000_init.sql` içeriğini yapıştırıp çalıştırın.
3. `.env.example` dosyasını `.env` olarak kopyalayın; `DATABASE_URL` ve `HASH_SALT` değerlerini girin.
4. Authentication → Sign In / Providers → "Allow new users to sign up" kapatın (sadece siz giriş yapacaksınız).

**Veri yükleme**
```bash
python ingest/ingest.py          # data/raw içindeki raporları veritabanına yazar (tekrar çalıştırmak güvenli: upsert)
python ingest/ingest.py --csv out/   # veritabanına yazmadan kontrol
```

Yükleme sırasında ad, adres, telefon, e-posta ve vergi bilgileri **atılır**; müşteri `HASH_SALT` ile üretilen geri çözülemez bir kodla temsil edilir.

**Gizli bilgiler:** Veritabanı adresi, şifre ve anahtarlar yalnızca `.env` dosyasındadır; `.env` `.gitignore` ile GitHub'a gitmez. Canlıya alırken aynı değerler barındırma servisinin (Vercel/Netlify) "Environment Variables" ayarına girilir. Tüm tablolarda RLS açıktır: anon anahtarla hiçbir veri okunamaz.

## Veri gizliliği

`tum-siparisler` dosyaları müşteri adı, adres ve telefon içerir; Trendyol bu veriyi yalnızca sözleşmesel yükümlülükler için paylaşır. Bu dosyalar `.gitignore` ile depoya alınmaz. `data.json` ve üretilen HTML yalnızca toplulaştırılmış (kişisel olmayan) veri içerir, ancak ticari bilgidir — depoyu **private** tutun.

## Varsayımlar

- Ürün maliyeti raporlarda yok: panelde %30 / %40 / %50 senaryolarıyla seçilir.
- KDV %10 varsayılan (tuhafiye); panelden %20 seçilebilir.
- Kargo baremi (2026): <200 ₺ → 40,99 ₺ · 200–349,99 ₺ → 78,99 ₺ · 350 ₺+ → desiye göre (~93,05 ₺). Barem kupon/indirim sonrası tutara göre uygulanır (veride doğrulandı).
- Platform hizmet bedeli: 6,99 ₺ (Bugün Kargoda) / 10,99 ₺ + KDV.
