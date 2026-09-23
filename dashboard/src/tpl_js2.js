// ================= GENEL ÖZET =================
const AOV = T.net_o / T.pk, UPT = T.units_o / T.pk;
const STORE_CVR = stAvg('Mağazanın Satışa Dönüş Oranı'), FOLLOW_CVR = stAvg('Ziyaretçinin Takipçiye Dönüş Oranı'), CUST_CVR = stAvg('Ziyaretçinin Müşteriye Dönüş Oranı');
const AD_CVR = ADS.sales / ADS.clicks * 100;
const RET = T.ret / T.gross_units * 100, CANC = T.cancel / T.gross_units * 100;
const REP_PER_CUST = D.cust.orders_per - 1;
const CLV_REV = AOV * (1 + REP_PER_CUST * 12 / 5);
const OOS = D.oos.oos_now / D.oos.skus_now * 100;
const CARGO_SHARE = T.cargo_o / T.net_o * 100;
const SEP_RUN = MON[5].net_rev / 22 * 30;
const MULTI_MODEL = 100 - D.models_dist['1'] / T.pk * 100;
const UNDER200 = D.cliff.share_under200;

function renderOzetKpis() {
  const cm = cmAll();
  const cmOrd = cm.cm / T.pk;
  const clvCm = CLV_REV * cm.pct / 100;
  const beROAS = 1 / Math.max(0.01, (cm.pct / 100 + TACOS)); // reklam öncesi katkı payına göre başa baş ROAS
  const k = [
    { code: 'AOV', l: 'Ortalama Sepet', v: TL(AOV, 1), n: `Kargo baremi: <200 ₺ → 40,99 ₺ · 200–349 → 78,99 ₺ · 350+ → 93,05 ₺`, s: 'warn', tip: 'aov' },
    { code: 'UPT', l: 'Paket Başına Ürün', v: nf(UPT, 2) + ' <small>adet</small>', n: `Sepetlerin %${nf(100 - MULTI_MODEL, 0)}'i tek model`, s: 'warn', tip: 'upt' },
    { code: 'CVR', l: 'Satışa Dönüşüm', v: P(STORE_CVR), n: `Mağaza sayfası · reklam tıkı→satış ${P(AD_CVR)}`, s: 'good', tip: 'cvr' },
    { code: 'ATC', l: 'Sepete Ekleme Oranı', v: '<small>veri yok</small>', n: 'Ürün/trafik raporu indirilince eklenecek', s: 'warn', tip: 'atc' },
    { code: 'CM', l: 'Katkı Payı', v: P(cm.pct), n: `${KTL(cm.cm)} · paket başı ${TL(cmOrd, 1)} (maliyet %${Math.round(S.c * 100)})`, s: cm.pct < 5 ? 'bad' : cm.pct < 12 ? 'warn' : 'good', tip: 'cm' },
    { code: 'RET', l: 'İade Oranı', v: P(RET), n: `İptal ${P(CANC)} · kusurlu/yanlış %0,13`, s: 'good', tip: 'ret' },
    { code: 'ROAS', l: 'Reklam Getirisi', v: nf(ADS.roas, 2) + '<small>x</small>', n: `Başa baş ROAS ≈ ${nf(beROAS, 1)}x (seçili senaryo)`, s: ADS.roas > beROAS ? 'good' : 'bad', tip: 'roas' },
    { code: 'ACoS', l: 'Reklam Satış Maliyeti', v: P(ADS.spend / ADS.rev * 100), n: `${TL(ADS.spend)} harcama / ${KTL(ADS.rev)} reklam cirosu`, s: 'good', tip: 'acos' },
    { code: 'TACoS', l: 'Toplam Reklam Maliyeti', v: P(TACOS * 100), n: 'Reklam / toplam net ciro · ölçeklenebilir', s: 'good', tip: 'tacos' },
    { code: 'CLV', l: 'Müşteri Değeri (12 ay)', v: TL(CLV_REV), n: `Ciro · katkı payı ≈ ${TL(clvCm)}`, s: 'warn', tip: 'clv' },
    { code: 'RPR', l: 'Tekrar Satın Alma', v: P(D.cust.rpr), n: `5 ayda · siparişlerin %${nf((1 - D.cust.nth['1.Sipariş'] / T.pk) * 100, 0)}'i 2.+ sipariş`, s: 'bad', tip: 'rpr' },
    { code: 'OOS', l: 'Stoksuz Kalma', v: P(OOS), n: `${D.oos.oos_now} barkod · ~${TL(D.oos.lost_daily)}/gün kayıp`, s: 'warn', tip: 'oos' },
    { code: 'LEAD', l: 'Kargoya Verme', v: nf(D.fulfil.h_ship_med, 1) + ' <small>saat</small>', n: `Teslim ${nf(D.fulfil.d_total_med, 1)} gün · zamanında %99,3`, s: 'good', tip: 'lead' },
    { code: 'CARGO', l: 'Kargo / Ciro', v: P(CARGO_SHARE), n: `Paket başı ${TL(T.cargo_o / T.pk, 1)} · %${nf(UNDER200, 0)} sepet <200 ₺`, s: 'bad', tip: 'waterfall' }
  ];
  $('#kpi-ozet').innerHTML = k.map(kpi).join('');
  $('#diag').innerHTML = `Ciro sağlıklı büyüyor (Eylül tempo ≈ ${KTL(SEP_RUN)}/ay, reklam getirisi ${nf(ADS.roas, 1)}x) ama <b>kârı kargo ve küçük sepet yiyor</b>: ciro­nun %${nf(CARGO_SHARE, 0)}'i kargoya gidiyor, sepetlerin %${nf(UNDER200, 0)}'i 200 ₺ altında, %${nf(100 - MULTI_MODEL, 0)}'i tek ürün modelinden oluşuyor ve müşterilerin yalnızca %${nf(D.cust.rpr, 1)}'i tekrar alıyor. %${Math.round(S.c * 100)} maliyet senaryosunda katkı payınız <b>%${nf(cm.pct, 1)}</b>; başa baş maliyet oranı <b>%${nf(breakEvenC() * 100, 0)}</b>. Strateji: önce sepeti 350 ₺ barem üstüne taşıyan setler ve kupon kurguları, sonra reklamı ölçeklemek.`;
  const kar = $('#kpi-kar'); if (kar && built.kar) renderKarKpis();
}

function buildOzet() {
  scenControls($('#scen-ozet')); syncScen(); renderOzetKpis();
  chart('c-trend', th => ({
    type: 'bar', data: {
      labels: MON.map(m => m.m), datasets: [
        { type: 'bar', label: 'Net ciro (B₺)', data: MON.map(m => m.net_rev / 1000), backgroundColor: MON.map((m, i) => i === 5 ? th.soft : th.accent), borderColor: th.accent, borderWidth: MON.map((m, i) => i === 5 ? 1.5 : 0), borderRadius: 4, yAxisID: 'y' },
        { type: 'line', label: 'Eylül 30 gün tahmini', data: MON.map((m, i) => i === 5 ? SEP_RUN / 1000 : (i === 4 ? m.net_rev / 1000 : null)), borderColor: th.accent, borderDash: [5, 4], pointRadius: 3, yAxisID: 'y', spanGaps: true },
        { type: 'line', label: 'Paket', data: MON.map(m => m.pkgs || null), borderColor: th.teal, backgroundColor: th.teal, pointRadius: 3, tension: .3, yAxisID: 'y2' }]
    },
    options: { scales: { y: axis(th, { beginAtZero: true, title: { display: true, text: 'B₺', color: th.muted } }), y2: axis(th, { position: 'right', beginAtZero: true, grid: { display: false } }), x: axis(th, { grid: { display: false } }) } }
  }));
  chart('c-where', th => {
    const c = cmAll(); const items = [['Ürün maliyeti', c.cogs, th.faint], ['Kargo', c.cargo, th.bad], ['Komisyon', c.comm, th.gold], ['KDV', c.vat, th.muted], ['Hizmet bedeli', c.fee, th.teal], ['Reklam', c.ads, th.rising], ['Katkı payı', c.cm, c.cm >= 0 ? th.good : th.bad]];
    return {
      type: 'bar', data: { labels: items.map(x => x[0]), datasets: [{ data: items.map(x => x[1] / c.net * 100), backgroundColor: items.map(x => x[2]), borderRadius: 4 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => ` ${nf(x.raw, 1)} kuruş / 1 ₺ · ${KTL(items[x.dataIndex][1])}` } } }, scales: { x: axis(th, { title: { display: true, text: '1 ₺ cironun kuruşu', color: th.muted } }), y: axis(th, { grid: { display: false } }) } }
    };
  });
  const top = D.products[0];
  const ins = [
    { t: 'kar', h: `Cironun %${nf(CARGO_SHARE, 1)}'i kargoya gidiyor`, p: `5 ayda ${KTL(T.cargo_o)} kargo ödendi, paket başı ${TL(T.cargo_o / T.pk, 1)}. Komisyon (%${nf(COMM_R * 100, 1)}) bile bunun altında. Ürün maliyetinden sonraki en büyük gider kalemi bu.`, w: 'Tüm siparişler dosyası, "Faturalanan Kargo Tutarı", 19.982 paket.' },
    { t: 'kar', h: '200 ₺ sınırı gizli bir tuzak', p: `Paket tutarı 200 ₺'yi geçtiği anda kargo 40,99 ₺'den 78,99 ₺'ye çıkıyor (+38 ₺). 200–249 ₺ sepetlerde kargo cironun %${nf(D.aov_bins[3].cargo_pct, 0)}'ü; 150–199 ₺ sepetlerde %${nf(D.aov_bins[2].cargo_pct, 0)}. Müşteri için "biraz daha büyük sepet" sizin için daha az kâr demek.`, w: 'Barem indirim/kupon SONRASI tutara göre uygulanıyor, veride doğrulandı.' },
    { t: 'ikisi', h: 'Sepetlerin %' + nf(UNDER200, 0) + '\'i 200 ₺ altında, %' + nf(100 - MULTI_MODEL, 0) + '\'i tek model', p: `Ortalama sepet ${TL(AOV, 0)}, UPT ${nf(UPT, 2)}. Adet yüksek görünse de çoğu aynı ürünün birkaç rengi ya da birkaç adedi. Farklı ürün ailelerini aynı sepete sokan çapraz satış neredeyse yok.`, w: 'Adet ve model dağılımı, Nis–Ağu.' },
    { t: 'ciro', h: `Tek ürün ailesi cironun %${nf(top.rev_share, 1)}'i`, p: `${top.name} tek başına ${KTL(top.net_rev)} ciro getirdi. İlk 5 model cironun %52'si. Bu ürünlerde stok, fiyat ya da yorum puanı sorunu tüm mağazayı sarsar.`, w: 'Ürün bazlı satış raporları, 117 model.' },
    { t: 'ciro', h: `Stoğu biten hero renkler günde ~${TL(D.oos.lost_daily)} kaybettiriyor`, p: `${D.oos.items.slice(0, 2).map(x => x.color + ' ' + x.name).join(' ve ')} stokta yok. Eylül'deki satış hızıyla bu, ayda ~${KTL(D.oos.lost_daily * 30)} ciro demek.`, w: 'Eylül satış raporu, güncel stok = 0.' },
    { t: 'ikisi', h: 'Tekrar alım çok zayıf, ama tekrar alan daha değerli', p: `Müşterilerin yalnızca %${nf(D.cust.rpr, 1)}'i 5 ayda ikinci kez aldı. Siparişlerin %94'ü yeni müşteriden. Oysa tekrar eden müşterinin sepeti ${TL(D.cust.aov_rep, 0)}, tek seferlik müşterininki ${TL(D.cust.aov_one, 0)} (+%${nf((D.cust.aov_rep / D.cust.aov_one - 1) * 100, 0)}).`, w: 'Alıcı + il + ilçe eşleşmesi, Trendyol "Yeni & Mevcut Müşteri" raporu.' },
    { t: 'ikisi', h: 'Reklam ucuz ve verimli; ölçek kararını maliyetiniz belirler', p: `ROAS ${nf(ADS.roas, 2)}x, TACoS %${nf(TACOS * 100, 1)}, tıklama başı ~${TL(ADS.spend / ADS.clicks, 2)}. Başa baş ROAS = 1 ÷ reklam öncesi katkı payı: %30 maliyette ≈ 6x (bugünkü reklam kârlı, ölçeklenebilir), %40 maliyette ≈ 14x (reklamla gelen sipariş tek başına zarar ediyor). Önce sepeti ve fiyatı düzeltip başa baş ROAS'ı düşürmek, sonra ölçeklemek gerekiyor.`, w: 'Reklam paneli, Ürün Reklamları raporu (ana reklam doğrudan ROAS 3,7x) ve Kârlılık sekmesi.' },
    { t: 'ciro', h: 'Haziran sezonu ciroyu %26 yükseltti', p: `Haziran net cirosu ${KTL(MON[2].net_rev)}, Nisan ${KTL(MON[0].net_rev)}. Kurdele Haziran'da ${KTL(D.cats[0].trend[2])}'ye çıktı (nikah şekeri, düğün, çeyiz dönemi). 2027 sezonu için Nisan'dan hazırlık gerekiyor.`, w: 'Kategori bazlı aylık satış.' },
    { t: 'kar', h: 'Operasyon güçlü, bu bir rekabet avantajı', p: `Kargoya verme medyanı ${nf(D.fulfil.h_ship_med, 1)} saat, siparişlerin %${nf(D.fulfil.same_day, 0)}'i 24 saatte kargoda, zamanında teslim %99,3, kusurlu/yanlış iade %0,13. "Bugün Kargoda" etiketiyle hizmet bedeli 10,99 ₺'den 6,99 ₺'ye iner.`, w: 'Operasyon raporu ve sipariş zaman damgaları.' },
    { t: 'ciro', h: 'Ay sonunda talep %25 düşüyor', p: 'Ayın 1–24. günleri günlük ortalama ~700 paket (5 ay toplamı), 25–30. günler ~520. Pazartesi en güçlü, Cumartesi %29 daha zayıf. Kupon ve reklam bu çukurları doldurmalı.', w: 'Sipariş tarihleri, Nis–Ağu.' },
    { t: 'ikisi', h: 'Müşteriler aynı üründen birden çok renk alıyor', p: `${nf(D.multicolor.pk_same_model_multi)} pakette aynı modelin birden fazla rengi var. Biye'de bu oran %35. Vatka beyaz+siyah birlikteliği (216 paket, lift 9) hazır bir set ürünü.`, w: 'Birliktelik (market basket) analizi.' },
    { t: 'ciro', h: 'Takipçi tabanı hızlı büyüyor', p: `17.729 takipçi, günde ~${nf(stAvg('Toplam Takipçi Sayısı - Kazanılan'), 0)} yeni. Mağaza ziyaretçisinin %${nf(FOLLOW_CVR, 0)}'i takipçiye, %${nf(CUST_CVR, 0)}'i müşteriye dönüyor. Takipçi kazan kuponu bu hızı katlayabilir.`, w: 'Mağaza raporu 16–22 Eylül.' }
  ];
  recs('#ins-ozet', ins);
  const rm = [
    ['0–30 gün · Kâr kaçağını kapat', ['Bebe Mavi ve Bordo fiyonk stoğunu hemen tamamla, ilk 10 barkoda 30 günlük emniyet stoğu koy.', 'Tüm siparişlerde "Bugün Kargoda" etiketini kullan (paket başı 4 ₺ tasarruf).', 'Vatka 2\'li, Biye ikilisi, Fiyonk 3 renk seti ve Kopanaki 3\'lü seti ayrı ürün olarak aç (Sepet sekmesi).', 'Takipçi Kazan kuponunu A/B testle başlat (0/15 ₺ ve 400/50 ₺).', '200–249 ₺ bandına düşen fiyatları gözden geçir.']],
    ['31–60 gün · Sepeti büyüt', ['Kurdele ve Dantel\'de 350 ₺ alt limitli Üründen Kazan kuponu (kargo tasarrufu kuponun bir kısmını karşılar).', 'Ay sonu (25–31) için "sepete ekleyenler" hedef kitle kuponu.', 'Yorum Yap Kazan (30 gün) ile ikinci siparişi tetikle.', 'Ürün sayfalarına çapraz satış görsellerini ve "Birlikte Al" alanını ekle.', 'Efsane Kasım için favorileyenlere kupon ve reklam bütçesini %50 artırma hazırlığı.']],
    ['61–90 gün · Ölçekle', ['Ana ürün reklamında günlük bütçeyi 350 ₺ → 500–600 ₺ (başa baş ROAS üstünde kaldıkça).', 'Yükselen segmentin (İncili fiyonk, Sakallı dantel, Likralı 3 cm) her birine ayrı ürün reklamı.', 'Yılbaşı hediye paketi kampanyası: Kurdele + Monofil + Fiyonk seti.', 'Long Tail\'de 6 ayda 20 adedin altında satan modelleri set içine alarak erit.', 'Sepet ekleme oranı raporunu indirip bu panele ekle.']]
  ];
  $('#roadmap').innerHTML = rm.map(([h, l]) => `<div class="card"><h3>${h}</h3><ul class="list" style="margin-top:8px">${l.map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('');
}
