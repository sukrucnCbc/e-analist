# Ak Tuhafiye · Trendyol Büyüme Paneli

> Sürüm: **v0.1 — dark-knight** · ayrıntılar için [CHANGELOG.md](CHANGELOG.md)

Trendyol satıcı paneli dışa aktarımlarından e-ticaret metriklerini (AOV, UPT, CVR, katkı payı, iade, ROAS/ACoS/TACoS, CLV, RPR, OOS, lead time) hesaplayan ve 8 sekmeli interaktif bir HTML panel üreten analiz projesi.

## Yapı

```
analysis/analyze.py      Ham Excel'leri okur → dashboard/data.json (yalnızca toplulaştırılmış veri)
dashboard/src/           Panelin HTML/CSS/JS kaynakları
dashboard/build.py       src + data.json → dashboard/dist/ak-tuhafiye-buyume-paneli.html
data/raw/                Ham Trendyol raporları (git'e GİRMEZ, .gitignore)
```

## Çalıştırma

```bash
pip install -r requirements.txt
# Trendyol raporlarını data/raw/ içine koyun (aşağıdaki listeye bakın)
python analysis/analyze.py
python dashboard/build.py
# dashboard/dist/ak-tuhafiye-buyume-paneli.html dosyasını tarayıcıda açın
```

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

Reklam paneli toplamları (gösterim, tıklama, harcama, getiri) şimdilik `analysis/analyze.py` içinde `ads_total` altında elle girilmiştir.

## Veri gizliliği

`tum-siparisler` dosyaları müşteri adı, adres ve telefon içerir; Trendyol bu veriyi yalnızca sözleşmesel yükümlülükler için paylaşır. Bu dosyalar `.gitignore` ile depoya alınmaz. `data.json` ve üretilen HTML yalnızca toplulaştırılmış (kişisel olmayan) veri içerir, ancak ticari bilgidir — depoyu **private** tutun.

## Varsayımlar

- Ürün maliyeti raporlarda yok: panelde %30 / %40 / %50 senaryolarıyla seçilir.
- KDV %10 varsayılan (tuhafiye); panelden %20 seçilebilir.
- Kargo baremi (2026): <200 ₺ → 40,99 ₺ · 200–349,99 ₺ → 78,99 ₺ · 350 ₺+ → desiye göre (~93,05 ₺). Barem kupon/indirim sonrası tutara göre uygulanır (veride doğrulandı).
- Platform hizmet bedeli: 6,99 ₺ (Bugün Kargoda) / 10,99 ₺ + KDV.
