// ================= MÜŞTERİ =================
function buildMusteri() {
  const vis = stAvg('Tekil Ziyaretçi Sayısı'), gain = stAvg('Toplam Takipçi Sayısı - Kazanılan'), lost = stAvg('Toplam Takipçi Sayısı - Kaybedilen');
  const storeShare = stAvg('Mağaza Ciro Oranı');
  const cm = cmAll();
  $('#kpi-mus').innerHTML = [
    { code: 'CUST', l: 'Tekil Müşteri (Nis–Ağu)', v: nf(D.cust.customers), n: `${nf(D.cust.repeaters)} müşteri 2+ sipariş`, tip: 'rpr' },
    { code: 'RPR', l: 'Tekrar Satın Alma', v: P(D.cust.rpr), n: 'E-ticaret sağlıklı bandı %20–30', s: 'bad', tip: 'rpr' },
    { code: 'CLV', l: '12 Aylık Müşteri Değeri', v: TL(CLV_REV), n: `Katkı ≈ ${TL(CLV_REV * cm.pct / 100)} · maliyet %${Math.round(S.c * 100)}`, s: 'warn', tip: 'clv' },
    { code: 'NEW', l: 'Yeni Müşteri Payı', v: P(MON.reduce((a, m) => a + m.new_share, 0) / MON.length), n: 'Trendyol dağılım raporu ort.', s: 'bad', tip: 'newold' },
    { code: 'CVR', l: 'Mağaza Satışa Dönüşüm', v: P(STORE_CVR), n: `Ziyaretçiden müşteriye %${nf(CUST_CVR, 1)}`, s: 'good', tip: 'cvr' },
    { code: 'FOL', l: 'Ziyaretçiden Takipçiye', v: P(FOLLOW_CVR), n: `Günde +${nf(gain, 0)} / −${nf(lost, 0)} takipçi`, s: 'good', tip: 'follow' },
    { code: 'ADCVR', l: 'Reklam Tıkından Satışa', v: P(AD_CVR), n: `CTR %${nf(ADS.clicks / ADS.impr * 100, 2)}`, s: 'good', tip: 'cvr' },
    { code: 'ATC', l: 'Sepete Ekleme Oranı', v: '<small>veri yok</small>', n: 'Ürün performans raporu gerekli', s: 'warn', tip: 'atc' },
    { code: 'GAP', l: 'Tekrar Alım Aralığı', v: nf(D.cust.gap_median, 0) + ' <small>gün (medyan)</small>', n: `%25: ${nf(D.cust.gap_p25, 0)} gün · %75: ${nf(D.cust.gap_p75, 0)} gün`, tip: 'gap' },
    { code: 'STORE', l: 'Mağaza Sayfası Ciro Payı', v: P(storeShare), n: 'Siparişlerin mağaza sayfasından gelen kısmı', tip: 'funnel' }
  ].map(kpi).join('');
  const fn = [['Tekil ziyaretçi', vis], ['Mağaza görüntülenme / 3', stAvg('Mağaza Görüntülenme Sayısı') / 3], ['Takipçiye dönen', vis * FOLLOW_CVR / 100], ['Müşteriye dönen', vis * CUST_CVR / 100]];
  chart('c-funnel', th => ({ type: 'bar', data: { labels: fn.map(f => f[0]), datasets: [{ data: fn.map(f => f[1]), backgroundColor: [th.tail, th.tail, th.teal, th.accent], borderRadius: 4 }] }, options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => ' ' + nf(x.raw, 0) + ' / gün' } } }, scales: { x: axis(th), y: axis(th, { grid: { display: false } }) } } }));
  const st = [...store].reverse();
  chart('c-follow', th => ({ type: 'bar', data: { labels: st.map(r => r['Tarih'].slice(0, 5)), datasets: [
    { label: 'Kazanılan takipçi', data: st.map(r => parseFloat(String(r['Toplam Takipçi Sayısı - Kazanılan']).replace('+', ''))), backgroundColor: th.teal, borderRadius: 4 },
    { type: 'line', label: 'Tekil ziyaretçi', data: st.map(r => r['Tekil Ziyaretçi Sayısı']), borderColor: th.accent, backgroundColor: th.accent, tension: .3 }] }, options: { scales: { y: axis(th, { beginAtZero: true }), x: axis(th, { grid: { display: false } }) } } }));
  chart('c-gap', th => ({ type: 'bar', data: { labels: ['0–6', '7–13', '14–29', '30–59', '60–89', '90+'], datasets: [{ data: D.cust.gap_hist, backgroundColor: [th.accent, th.accent, th.teal, th.teal, th.tail, th.tail], borderRadius: 4 }] }, options: { plugins: { legend: { display: false } }, scales: { y: axis(th), x: axis(th, { grid: { display: false }, title: { display: true, text: 'gün', color: th.muted } }) } } }));
  const mn = { 4: 'Nisan', 5: 'Mayıs', 6: 'Haziran', 7: 'Temmuz' };
  table('#tb-cohort', ['İlk alım', '+1 ay', '+2 ay', '+3 ay', '+4 ay'], Object.entries(D.cohort).map(([k, v]) => [mn[k], ...[1, 2, 3, 4].map(i => v[i] != null ? P(v[i], 1) : '–')]), [1, 2, 3, 4]);
  const ag = ['<18', '19-29', '30-39', '40-49', '50-59', '>60'];
  chart('c-age', th => ({ type: 'bar', data: { labels: ag, datasets: [{ data: ag.map(a => D.age[a]), backgroundColor: th.teal, borderRadius: 4 }] }, options: { plugins: { legend: { display: false } }, scales: { y: axis(th), x: axis(th, { grid: { display: false } }) } } }));
  chart('c-plus', th => ({ type: 'doughnut', data: { labels: ['Kadın', 'Erkek', 'Belirtilmemiş', 'Plus üyesi', 'Plus değil'], datasets: [
    { label: 'Cinsiyet', data: [D.gender['Kadın'], D.gender['Erkek'], D.gender['Belirtilmemiş'], 0, 0], backgroundColor: [th.accent, th.teal, th.tail, th.gold, th.faint], borderColor: th.surface },
    { label: 'Plus', data: [0, 0, 0, D.plus['Trendyol Plus Müşterileri'], D.plus['Diğer Müşteriler']], backgroundColor: [th.accent, th.teal, th.tail, th.gold, th.faint], borderColor: th.surface }] }, options: { cutout: '45%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 9, filter: (it) => true } } } } }));
  chart('c-new', th => ({ type: 'bar', data: { labels: MON.map(m => m.m), datasets: [{ label: 'Yeni %', data: MON.map(m => m.new_share), backgroundColor: th.tail, borderRadius: 3 }, { label: 'Mevcut %', data: MON.map(m => 100 - m.new_share), backgroundColor: th.accent, borderRadius: 3 }] }, options: { scales: { x: axis(th, { stacked: true, grid: { display: false } }), y: axis(th, { stacked: true, max: 100 }) } } }));
  recs('#rec-mus', [
    { t: 'ikisi', h: 'Yorum Yap Kazan\'ı sürekli açık tut (30 gün)', p: 'Son 30 günde teslim alan herkese, yorum yaparsa bir sonraki siparişte "250 ₺ üzeri 25 ₺" kupon. Hem yorum (dönüşüm) hem 2. sipariş (RPR) kazanırsınız. Kupon kullanımı 2. siparişte olduğundan maliyet ancak yeni ciro gelince oluşur.', w: 'RPR %5,5, tekrar eden müşterinin sepeti 308 ₺.', i: 'RPR %5,5 → %8 olursa 5 ayda +460 sipariş ≈ +140 B₺' },
    { t: 'ciro', h: 'İkinci siparişi ilk 2 haftada yakala', p: 'Tekrar alanların yarısı 9 gün içinde dönüyor, %75\'i 26 gün içinde. Hedef kitle kuponunu (önceki alıcılar) ilk siparişten 7–14 gün sonrasına denk getir.', w: 'Tekrar alım aralığı dağılımı.' },
    { t: 'ciro', h: 'Paket içine "tamamlayıcı ürün" kartı', p: 'Her pakete: "Mağazamızı takip edin, bir sonraki siparişte X ₺ takipçi kuponu sizi bekliyor" + QR/mağaza adı. Takipçi = ücretsiz bildirim kitlesi.', w: 'Takipçi dönüşümü %24; paketten gelen müşteri zaten alıcı.' },
    { t: 'ciro', h: 'Sepete ekleme verisini indir, huninin kör noktasını kapat', p: 'ATC oranı olmadan ürün sayfası mı, fiyat mı sorunlu bilinmez. Satıcı Paneli > Raporlar\'dan ürün bazında "ziyaret / sepete ekleme / favori" raporunu aylık indir; favori sayısı yüksek, satışı düşük ürünlere favorileyenlere kupon ver.', w: 'Transkript: favori raporundan hedef kitle kuponu önerisi.' },
    { t: 'ciro', h: 'Plus müşterisine özel teklif', p: 'Siparişlerin %56\'sı Trendyol Plus üyelerinden. Plus bölgesinde Üründen Kazan kuponu (yalnız Plus\'a görünür) yüksek değerli kitleye ek indirim demek; Hero ürünlerde dene.', w: 'Trendyol Plus dağılımı.' },
    { t: 'ciro', h: 'Kadın 19–39 yaş için görsel dil', p: 'Kitle ağırlıkla kadın (%88) ve 19–39 yaş. Kullanım senaryolu görseller (nikah şekeri, bohça, hediye paketi, dikiş atölyesi) ve kısa video ürün kartları dönüşümü artırır.', w: 'Yaş ve cinsiyet dağılımı.' },
    { t: 'kar', h: 'CLV\'ye göre müşteri edinme tavanı', p: `12 aylık müşteri değeri ~${TL(CLV_REV, 0)} ciro. Bir müşteriyi kazanmak için kupon + reklam toplamı, ilk siparişin katkı payını aşmamalı. Tekrar alım artmadan agresif indirim sürdürülemez.`, w: 'CLV ve katkı payı.' },
    { t: 'ciro', h: 'Mağaza sayfasını satış sayfasına çevir', p: 'Mağaza sayfası cironun ~%25\'ini getiriyor ve ziyaretçinin %15\'i müşteriye dönüyor. Vitrin: setler, yeni gelenler, en çok satanlar. Takipçi kupon banner\'ı en üstte.', w: 'Mağaza raporu.' },
    { t: 'ciro', h: 'Kaybedilen takipçiyi izle', p: `Günde ~${nf(lost, 0)} takipçi kaybı var (kazanımın %${nf(lost / gain * 100, 0)}'i). Kampanya bildirimleri çok sıksa kayıp artar. Haftada 1–2 değerli bildirimle sınırla.`, w: 'Mağaza raporu.' },
    { t: 'ikisi', h: 'Sadık müşteri (3+ sipariş) kitlesini büyüt', p: `${nf(D.cust.nth['Devamlı Müşteri(3-30 Sipariş Veren Müşteri)'] || 296)} sipariş "devamlı müşteri"den. Bu kitleye çeyrekte bir "sadık müşteri" hedef kitle kuponu (önceki alıcılar, 400 ₺ üzeri 50 ₺).`, w: 'Müşteri Sipariş Adedi etiketi.' },
    { t: 'ciro', h: 'Soru-cevap ve yorumları haftalık yanıtla', p: 'Metre, genişlik, renk tonu gibi sorular dönüşümü doğrudan etkiler. Yanıtları ürün açıklamasına geri besle.', w: 'Ebat kaynaklı iade 244 adet.' },
    { t: 'ciro', h: 'Kurumsal/atölye müşterisini ayrı hedefle', p: '750 ₺ üstü 462 paket (ort. 1.212 ₺, 8 adet) var. Bunlar terzi, organizasyon ve atölye alıcıları. Büyük paket (50 m top, 100\'lü fiyonk) ve toptan fiyat kademesiyle bu segmenti büyüt.', w: 'Sepet dilimleri.' }
  ]);
}

// ================= ÜRÜN =================
function buildUrun() {
  const pr = D.products; const top5 = pr.slice(0, 5).reduce((a, p) => a + p.rev_share, 0);
  const n80 = pr.findIndex(p => p.cum >= 80) + 1;
  $('#kpi-urun').innerHTML = [
    { code: 'MOD', l: 'Satan Model', v: nf(pr.length), n: `${T.skus} barkod`, tip: 'prodtable' },
    { code: 'TOP5', l: 'İlk 5 Modelin Payı', v: P(top5, 0), n: 'Yoğunlaşma riski', s: 'warn', tip: 'pareto' },
    { code: '80%', l: 'Cironun %80\'i', v: n80 + ' <small>model</small>', n: `Modellerin %${nf(n80 / pr.length * 100, 0)}'i`, tip: 'pareto' },
    { code: 'HERO', l: 'Lider Ürün', v: KTL(pr[0].net_rev), n: esc(pr[0].name), tip: 'topprod' },
    { code: 'OOS', l: 'Stoksuz Barkod', v: D.oos.oos_now, n: `Günlük ~${TL(D.oos.lost_daily)} kayıp`, s: 'bad', tip: 'oos' },
    { code: 'RISE', l: 'Yükselen Model', v: pr.filter(p => p.seg === 'Rising').length, n: 'Tem–Ağu\'da hızla büyüyen', s: 'good', tip: 'movers' }
  ].map(kpi).join('');
  const t15 = pr.slice(0, 15);
  chart('c-topprod', th => ({ type: 'bar', data: { labels: t15.map(p => p.name.length > 34 ? p.name.slice(0, 33) + '…' : p.name), datasets: [{ data: t15.map(p => p.net_rev / 1000), backgroundColor: t15.map(p => th[{ Hero: 'hero', Core: 'core', Rising: 'rising', 'Long Tail': 'tail' }[p.seg]]), borderRadius: 4 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => ` ${KTL(t15[x.dataIndex].net_rev)} · ${SEGNAME[t15[x.dataIndex].seg]} · %${nf(t15[x.dataIndex].rev_share, 1)} pay` } } }, scales: { x: axis(th, { title: { display: true, text: 'B₺', color: th.muted } }), y: axis(th, { grid: { display: false }, ticks: { font: { size: 10.5 } } }) } } }));
  chart('c-bubble', th => ({ type: 'bubble', data: { datasets: ['Hero', 'Core', 'Rising', 'Long Tail'].map(s => ({ label: SEGNAME[s], data: pr.filter(p => p.seg === s && p.net_units > 20).map(p => ({ x: p.asp, y: p.net_units, r: Math.max(3, Math.sqrt(p.net_rev) / 45), n: p.name, rev: p.net_rev })), backgroundColor: th[{ Hero: 'hero', Core: 'core', Rising: 'rising', 'Long Tail': 'tail' }[s]] + 'B0' })) },
    options: { plugins: { tooltip: { callbacks: { label: x => ` ${x.raw.n}: ${TL(x.raw.x, 0)} · ${nf(x.raw.y)} adet · ${KTL(x.raw.rev)}` } } }, scales: { x: axis(th, { title: { display: true, text: 'Ortalama satış fiyatı ₺', color: th.muted } }), y: axis(th, { type: 'logarithmic', title: { display: true, text: 'Net adet (log)', color: th.muted } }) } } }));
  const cats = [...new Set(pr.map(p => p.cat))]; $('#f-cat').innerHTML += cats.map(c => `<option>${esc(c)}</option>`).join('');
  const draw = () => {
    const s = $('#f-seg').value, c = $('#f-cat').value, k = $('#f-sort').value;
    let rows = pr.filter(p => (!s || p.seg === s) && (!c || p.cat === c));
    rows = [...rows].sort((a, b) => (k === 'cover_days' ? (a[k] ?? 1e9) - (b[k] ?? 1e9) : (b[k] ?? -1e9) - (a[k] ?? -1e9)));
    table('#tb-prod', ['Model', 'Kategori', 'Seg.', 'Net ciro', 'Pay', 'Net adet', 'Ort. fiyat', 'Güncel fiyat', 'İade', 'Büyüme', 'Stok', 'Stok gün', 'Çoklu sepet', 'Trend'],
      rows.map(p => [esc(p.name) + `<div class="mono" style="font-size:10.5px;color:var(--faint)">${esc(p.code)}</div>`, p.cat, `<span class="seg ${segCls(p.seg)}">${SEGNAME[p.seg]}</span>`, TL(p.net_rev), P(p.rev_share), nf(p.net_units), TL(p.asp, 1), p.price ? TL(p.price, 0) : '–', `<span class="pill ${p.ret_rate > 5 ? 'bad' : p.ret_rate > 3.5 ? 'warn' : 'neu'}">${P(p.ret_rate)}</span>`, pillGrowth(p.growth), p.stock != null ? nf(p.stock) : '<span class="pill bad">listede yok</span>', p.cover_days != null ? `<span class="pill ${p.cover_days < 30 ? 'bad' : p.cover_days < 60 ? 'warn' : 'neu'}">${nf(p.cover_days, 0)}</span>` : '–', P(p.multi, 0), spark(D.prod_trend[p.name] || [0, 0])]), [3, 4, 5, 6, 7]);
  };
  ['#f-seg', '#f-cat', '#f-sort'].forEach(s => $(s).addEventListener('change', draw)); draw();
  table('#tb-oos', ['Ürün', 'Renk', 'Günlük satış', 'Ort. fiyat', 'Günlük kayıp'], D.oos.items.map(o => [esc(o.name), o.color, nf(o.daily, 1), TL(o.asp, 0), TL(o.daily * o.asp, 0)]), [2, 3, 4]);
  const mv = pr.filter(p => p.net_rev > 20000 && p.months_active >= 4);
  const up = [...mv].sort((a, b) => b.growth - a.growth).slice(0, 6), dn = [...mv].sort((a, b) => a.growth - b.growth).slice(0, 6);
  table('#tb-movers', ['Model', 'Seg.', 'Büyüme', 'Eylül ciro'], [...up, ...dn].map(p => [esc(p.name), `<span class="seg ${segCls(p.seg)}">${SEGNAME[p.seg]}</span>`, pillGrowth(p.growth), TL(p.eyl)]), [3]);
  recs('#rec-urun', [
    { t: 'ciro', h: 'Stoksuz fiyonk renklerini 48 saatte tamamla', p: 'Bebe Mavi (günde 7,4 adet) ve Bordo (4 adet) fiyonk stokta yok. Bu iki renk için minimum 45 günlük stok (≈ 510 adet) tut; yeniden sipariş noktasını 15 güne ayarla.', w: 'Eylül satış raporu, güncel stok 0.', i: `Günde ~${TL(D.oos.lost_daily)} ciro kurtarılır` },
    { t: 'ciro', h: 'Fiyonk ailesine yeni renkler ekle', p: 'En çok satan aile 10+ renkle satılıyor ve müşteri çoklu renk alıyor. Pastel (lila, mint, somon) ve metalik (altın, gümüş) renkler ekle; her yeni renk ailenin arama görünürlüğünü artırır.', w: 'Fiyonk 6 ayda 1,38 M₺, Tem–Ağu Nis–May\'a göre +%72.' },
    { t: 'ciro', h: 'İncili Keten Fiyonk\'u ikinci Hero yap', p: 'Temmuz\'da girdi, Eylül\'de 49 B₺ ciro yaptı, iade oranı %0,8. 50\'li paket, 3 renk set ve ayrı reklam grubu aç.', w: 'Eylül: 49,2 B₺, iade %0,8.' },
    { t: 'ciro', h: 'Sakallı Dantel\'i genişlet', p: 'Sakallı Dantel 15 cm yeni ama çok hızlı büyüyor (Eylül 21 B₺). 6 cm varyantı da yükselişte. Siyah/ekru dışında pudra, bordo ve lacivert ekle; 5 m ve 10 m boyları aç.', w: 'Tem–Ağu, Nis–May\'ın ~70 katı.' },
    { t: 'kar', h: 'Saten Kurdele 4 cm ve Kadife Kurdele\'de stok erit', p: 'SK4 cirosu −%66, kadife kurdele −%83 düştü, stok günü 20.000–31.000 (yıllarca yeter). Bu ürünleri setlerin içine koy ve "2. ürüne %20" ile erit; yeni alım yapma.', w: 'Stok günü tablosu.' },
    { t: 'ciro', h: 'Omuz vatkası düşüşünü incele', p: 'Vatka 3 cm siyah ve beyaz −%43/−%44 düştü. Fiyat, rakip ve görsel kontrolü yap. 2\'li set ile yeniden canlandır (birliktelik en güçlü ürün grubu).', w: 'Büyüme: Tem–Ağu vs Nis–May.' },
    { t: 'ciro', h: 'Listeden düşen kârlı ürünleri geri aç', p: 'Kopanaki 25 m paket (326 ₺), Panda Anahtarlık Seti (198 ₺), Çift Katlı Güpür Kurdele Eylül raporunda yok. Stok sorunu ise tedarik et, sezonsalsa takvime al.', w: 'Eylül listesinde görünmeyen modeller.' },
    { t: 'kar', h: 'Yüksek iadeli ürünlere içerik düzeltmesi', p: 'Çiçek Desenli Güpür (%9,4), Güpür Ekru Bant (%7,8), Kadife Kurdele (%7,7), Saten 4 cm (%6,4) iade oranları ortalamanın 2–3 katı. Gerçek renk fotoğrafı, ölçü ve doku yakın çekimi ekle.', w: 'Model bazlı iade oranı.' },
    { t: 'ciro', h: 'Likralı Dantel 18 cm\'i sabit Hero olarak koru', p: 'İkinci en büyük model (465 B₺), büyüyor (+%27) ve fiyatı yüksek (232 ₺). Stok güçlü; reklamda 2. sıraya koy ve renk genişlet (bej, pudra, lacivert).', w: 'Ürün tablosu.' },
    { t: 'ciro', h: 'Pamuk Biye\'de renk ve uzunluk genişlet', p: 'Biye çok renkli alınıyor (%35) ve stok çok yüksek (78 bin). Uzunluk (10 m / 50 m) ve renk varyantlarıyla hem küçük hem atölye müşterisini yakala.', w: 'Çok renkli sepet oranı.' },
    { t: 'kar', h: 'Stok günü 365+ olan ürünlerde sermaye bağlama', p: 'Birçok üründe stok günü binlerle ifade ediliyor (ör. SK6, SK4, Biye). Yeni alımları durdur, nakdi hızlı dönen Hero/Yükselen ürünlere kaydır.', w: 'Stok gün = güncel stok ÷ Eylül günlük satış.' },
    { t: 'ciro', h: 'Ürün başlık ve görsel standardı', p: 'En çok satan ürünlerin başlık yapısını (ürün + ölçü + adet/metre + kullanım alanı) tüm katalogda standartlaştır. Long Tail ürünlerde başlıklar dağınık (ör. "dynyhy..." kodlu ürünler).', w: 'Ürün adları.' }
  ]);
}
