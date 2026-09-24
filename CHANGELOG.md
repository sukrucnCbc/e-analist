# Sürüm Geçmişi

Her sürüm bir kült film adıyla anılır.

## v0.3 — matrix (2026-09-24)
- **Raporlar sekmesi**: yıl bazlı rapor doluluk takvimi. Her ay × rapor türü bir kutu; renk koyu yeşil (tam) → sarı (kısmi) → kırmızı (yok)
- Doluluk Supabase'den hesaplanır (`analysis/doluluk.py`); mağaza ve sipariş raporlarında gün bazında kısmi doluluk
- `python panel.py`: paneli yerel sunucuyla açar; panelden rapor içe aktarma (dosya türü ayrıştırıcıyla doğrulanır) ve tek tuşla Supabase senkronizasyonu
- Aynı ay ve türde yeni rapor yüklenince eskisi silinmez, `data/raw/_arsiv` klasörüne taşınır
- **AI asistan (arayüz, test)**: her sayfada sağ altta süzülen küre butonu; tıklayınca 4 hazır içgörü seçeneği (satış, reklam, stok & ürün, kupon kampanya kurgusu) ve soru kutusu açılır. Arka uç henüz bağlı değil, her istek "test aşamasında" yanıtı alır
- Dosya adında yıl desteği (`ekim-2026-satis-raporu-….xlsx`); yıl yoksa eskisi gibi 2026 varsayılır

## v0.2 — morpheus (2026-09-24)
- Panel verisi artık Supabase veritabanından okunuyor (`analysis/db_source.py`); Excel modu yedek olarak duruyor (`SOURCE=excel`)
- Tek komutla güncelleme: `python guncelle.py` (Supabase → analiz → panel), `--yukle` ile önce yeni Excel'leri yükler
- Reklam paneli toplamları koddan çıkarıldı, `ad_totals` tablosundan okunuyor
- Sipariş dağılım oranları satır sırasına değil kova adına göre hesaplanıyor (veritabanından okunurken sıra garanti değil)
- Tarih saklama: ingest ve analiz aynı saat dilimini (PGTZ=UTC) kullanır; Trendyol saatleri olduğu gibi korunur
- Bilinen fark: ürünün kategori/model kodu tüm aylar için en güncel değerle anılır (Excel modunda ay bazlı); toplam ciro ve paket sayıları birebir aynı

## v0.1 — dark-knight (2026-09-24)
- Trendyol raporlarından (satış, tüm siparişler, sipariş dağılım, mağaza, operasyon, ürün reklamları) analiz hattı: `analysis/analyze.py`
- 8 sekmeli büyüme paneli: Genel Özet, Satış & Büyüme, Kârlılık, Sepet Analizi, Müşteri & Dönüşüm, Ürün Analizi, Ürün Segmentleri, Kupon Stratejisi
- 14 temel metrik, her KPI'da ⓘ açıklaması
- Ürün maliyeti (%30/%40/%50), KDV ve hizmet bedeli senaryoları
- Barem kargo farkındalıklı kupon simülatörü, kupon takvimi (Eyl 2026 – May 2027)
- Hero / Core / Yükselen / Long Tail ürün segmentasyonu, market basket analizi ve 12 set önerisi
