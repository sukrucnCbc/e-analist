// ================= KÂRLILIK =================
function renderKarKpis() {
  const c = cmAll(), be = breakEvenC();
  const beSingle = (() => { for (let v = 60; v < 200; v += 0.5) if (cmOrder(v) >= 0) return v; return null; })();
  const binCm = D.aov_bins.map(b => cmOrder(b.net));
  const lossShare = D.aov_bins.reduce((a, b, i) => a + (binCm[i] < 0 ? b.n : 0), 0) / T.pk * 100;
  $('#kpi-kar').innerHTML = [
    { code: 'CM', l: 'Katkı Payı (Nis–Ağu)', v: KTL(c.cm), n: `%${nf(c.pct, 1)} · aylık ort. ${KTL(c.cm / 5)}`, s: c.pct < 5 ? 'bad' : c.pct < 12 ? 'warn' : 'good', tip: 'cm' },
    { code: 'CM/P', l: 'Paket Başı Katkı', v: TL(c.cm / T.pk, 1), n: `Ortalama sepet ${TL(AOV, 0)}`, s: c.cm / T.pk < 15 ? 'bad' : 'warn', tip: 'cm' },
    { code: 'BE', l: 'Başa Baş Maliyet Oranı', v: P(be * 100, 0), n: 'Ürün maliyetiniz bunun altında olmalı', s: be < S.c ? 'bad' : 'good', tip: 'cogs' },
    { code: 'MIN', l: 'Tekil Siparişte Başa Baş Tutar', v: beSingle ? TL(beSingle, 0) : '>200 ₺', n: 'Bu tutarın altındaki 1 ürünlük sipariş zarar eder', s: 'warn', tip: 'cmcurve' },
    { code: 'LOSS', l: 'Zarar Eden Sepet Payı', v: P(lossShare, 0), n: 'Ortalama tutarı eksi katkıda kalan dilimler', s: lossShare > 30 ? 'bad' : lossShare > 10 ? 'warn' : 'good', tip: 'bins' },
    { code: 'FEE', l: 'Bugün Kargoda Tasarrufu', v: KTL(4 * T.pk / 5), n: 'Aylık, tüm paketler aynı gün kargolanırsa', s: 'good', tip: 'fee' }
  ].map(kpi).join('');
}
function renderKar(update) {
  renderKarKpis();
  table('#tb-bins', ['Sepet', 'Paket', 'Pay', 'Ort. tutar', 'Ort. adet', 'Kargo', 'Kargo %', 'Katkı/paket', 'Katkı %'],
    D.aov_bins.map(b => { const cm = cmOrder(b.net); return [b.b + ' ₺', nf(b.n), P(b.n / T.pk * 100), TL(b.net, 0), nf(b.units, 1), TL(b.cargo, 1), P(b.cargo_pct, 0), `<span class="pill ${cm < 0 ? 'bad' : cm < 20 ? 'warn' : 'good'}">${TL(cm, 1)}</span>`, P(cm / b.net * 100, 0)]; }), [1, 2, 3, 4, 5, 6, 7, 8]);
  table('#tb-catcm', ['Kategori', 'Net ciro', 'Kargo %', 'Komisyon %', 'Katkı %', 'Katkı'],
    D.cats.filter(c => c.cargo_pct).map(c => { const r = (1 - S.c) / (1 + S.k) - c.comm_rate / 100 - c.cargo_pct / 100 - (S.ads ? TACOS : 0) - S.fee / (c.aov_with || AOV); return [c.name, TL(c.net_rev), P(c.cargo_pct), P(c.comm_rate), `<span class="pill ${r < 0 ? 'bad' : r < .1 ? 'warn' : 'good'}">${P(r * 100)}</span>`, KTL(r * c.net_rev)]; }), [1, 2, 3, 4, 5]);
  table('#tb-unitcm', ['Model', 'Seg.', 'Ort. fiyat', 'Komisyon %', 'Kargo payı', 'Tek başına alınma', 'Katkı/adet', 'Katkı %', '6 ay katkı'],
    D.products.slice(0, 25).map(p => { const r = (1 - S.c) / (1 + S.k) - (p.comm_rate || 18.6) / 100 - (p.cargo_pct || 24) / 100 - (S.ads ? TACOS : 0) - S.fee / (p.aov_with || AOV); return [esc(p.name), `<span class="seg ${segCls(p.seg)}">${SEGNAME[p.seg]}</span>`, TL(p.asp, 1), P(p.comm_rate), P(p.cargo_pct), P(p.solo, 0), TL(r * p.asp, 1), `<span class="pill ${r < 0 ? 'bad' : r < .1 ? 'warn' : 'good'}">${P(r * 100)}</span>`, KTL(r * p.net_rev)]; }), [2, 3, 4, 5, 6, 7, 8]);
  if (update) { ['c-cmcurve', 'c-moncm', 'c-hist'].forEach(rebuild); return; }
  chart('c-cmcurve', th => {
    const xs = []; for (let v = 50; v <= 800; v += 5) xs.push(v);
    return {
      type: 'line', data: { labels: xs, datasets: [{ label: 'Katkı payı / paket (₺)', data: xs.map(cmOrder), borderColor: th.accent, pointRadius: 0, borderWidth: 2, stepped: false, fill: { target: { value: 0 }, above: th.soft, below: 'rgba(184,50,42,.18)' } }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { title: x => x[0].label + ' ₺ sepet', label: x => ` Katkı: ${TL(x.raw, 1)} · kargo ${TL(cargo(+x.label), 2)}` } } },
        scales: { x: axis(th, { type: 'linear', min: 50, max: 800, title: { display: true, text: 'Paket tutarı (₺)', color: th.muted }, ticks: { stepSize: 50 } }), y: axis(th, { title: { display: true, text: '₺ / paket', color: th.muted } }) } },
      plugins: [baremLines]
    };
  });
  chart('c-hist', th => ({
    type: 'bar', data: { labels: D.net_hist.map((_, i) => i * 10), datasets: [{ label: 'Paket', data: D.net_hist, backgroundColor: D.net_hist.map((_, i) => i * 10 < 200 ? th.teal : i * 10 < 350 ? th.gold : th.accent), barPercentage: 1, categoryPercentage: .92 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { title: x => `${x[0].dataIndex * 10}–${x[0].dataIndex * 10 + 9} ₺${x[0].dataIndex === 59 ? '+' : ''}`, label: x => ` ${nf(x.raw)} paket · kargo ${TL(cargo(x.dataIndex * 10 + 5), 2)}` } } },
      scales: { x: axis(th, { grid: { display: false }, ticks: { callback: (v, i) => i % 5 === 0 ? i * 10 : '', autoSkip: false, maxRotation: 0 } }), y: axis(th, { beginAtZero: true }) } }
  }));
  chart('c-moncm', th => {
    const keys = ['nisan', 'mayis', 'haziran', 'temmuz', 'a_ustos'];
    const rows = keys.map(k => { const [pk, net, cg, cm] = D.mon_orders[k]; return cmTotals(net, cg, cm, pk); });
    return { type: 'bar', data: { labels: MON.slice(0, 5).map(m => m.m), datasets: [{ label: 'Katkı payı (B₺)', data: rows.map(r => r.cm / 1000), backgroundColor: rows.map(r => r.cm >= 0 ? th.good : th.bad), borderRadius: 4, yAxisID: 'y' },
      { type: 'line', label: 'Katkı %', data: rows.map(r => r.pct), borderColor: th.accent, backgroundColor: th.accent, yAxisID: 'y2' }] },
      options: { scales: { y: axis(th), y2: axis(th, { position: 'right', grid: { display: false } }), x: axis(th, { grid: { display: false } }) } } };
  });
  recs('#rec-kar', [
    { t: 'kar', h: 'Tekil ürünleri "barem dostu" fiyatla', p: 'Tek başına alınan ve 200 ₺\'nin hemen üstüne düşen fiyatlardan kaçın (200–249 ₺ bandı kargo +38 ₺ demek). Tek ürün fiyatı 199 ₺\'yi aşıyorsa 2\'li paketle 350 ₺ üstüne taşı.', w: '200–249 ₺ sepetlerin kargo payı %34, 150–199 ₺\'de %22.', i: 'Bu banttaki 623 paket için paket başı ~20–38 ₺' },
    { t: 'kar', h: 'Fiyonk tekil fiyatını test et: 139 → 149 ₺', p: 'Fiyonk 50\'li ürün en çok satan ve çoğunlukla tek başına alınıyor (%96). 139 ₺\'de, %40 maliyette neredeyse sıfır katkı bırakıyor. 2 hafta 149 ₺ A/B testi yap; dönüşüm %7\'den fazla düşmezse fiyatı kalıcı yap.', w: 'Fiyonk: 6 ay 1,38 M₺, tek başına alınma %96, kargo payı %27,6.', i: 'Aynı hacimde ayda +12–15 B₺ katkı' },
    { t: 'kar', h: '"Bugün Kargoda" ile hizmet bedelini düşür', p: 'Paketlerin %71\'i zaten 24 saat içinde kargoda. Kesim saatini (ör. 15:00) sabitle, etiketi aç, aynı gün teslimi %90\'a çıkar. Paket başı 10,99 → 6,99 ₺.', w: 'Platform hizmet bedeli 2026 tarifesi.', i: 'Ayda ~16 B₺ (4 ₺ × ~4.000 paket)' },
    { t: 'kar', h: 'Set ürünlerle paket başı kargoyu böl', p: '3\'lü setler (ör. Fiyonk 3 renk 379 ₺) kargoyu 93 ₺\'ye sabitler; ürün başı kargo 41 ₺ → 31 ₺. Set fiyatı tekil toplamın %5–8 altında olsun.', w: 'Kargo baremi ve set önerileri (Sepet sekmesi).' },
    { t: 'kar', h: 'Kargo firması seçimi: Sürat Kargo\'yu kapat', p: 'Sürat Kargo paket başı 73,8 ₺, TEX ve PTT ~55 ₺. Aynı barem dilimlerinde Sürat daha pahalı (ör. <200 ₺: 58,49 ₺ vs 40,99 ₺). Tüm gönderileri TEX/PTT barem desteğine taşı.', w: 'Kargo firması bazında gerçekleşen ücretler.', i: '547 paket × ~18 ₺ ≈ 10 B₺ (5 ayda)' },
    { t: 'kar', h: 'Desi kontrolü: 350 ₺ üstünü 1 desiye sığdır', p: '350 ₺ üstü paketler desiye göre fiyatlanıyor (93,05 ₺ = 0–1 desi; bazı paketler 107–115 ₺). Kurdele/dantel rulolarını vakumlu poşet ya da düz zarfla gönder, 1 desiyi aşma.', w: '350 ₺+ paketlerde 95–115 ₺ kargo satırları.' },
    { t: 'kar', h: 'İndirimi yalnızca barem kazancı olan yerde ver', p: 'Barem, kupon SONRASI tutara bakıyor. 350–379 ₺ sepette 25–30 ₺ kupon, sepeti 78,99 ₺ dilimine indirip 14 ₺ kargo kazandırır; kuponun yarısını kargo öder. 200–225 ₺ sepette 25 ₺ kupon, 38 ₺ kargo kazandırır.', w: 'Barem kuralı veride doğrulandı.' },
    { t: 'kar', h: 'Komisyon indirim kampanyalarını hesapla', p: 'Trendyol\'un "komisyon indirimli" kampanyalarında indirim oranı ile komisyon düşüşü toplamını karşılaştır. %19 komisyonda 5 puan komisyon indirimi için %10 fiyat indirimi zarar ettirir.', w: 'Ortalama komisyon %18,6.' },
    { t: 'kar', h: 'Kargo payı %25 üzerindeki ürünleri tekil satmaktan vazgeç', p: 'Omuz vatkaları (%29), Saten kurdele 1 cm (%28), Monofil (%30), Balıksırtı (%26), Lastikler (%25–30) ya çoklu paket ya da set olarak satılmalı; tekil ürün sayfası "min. 2 adet" ya da 2\'li varyantla açılmalı.', w: 'Birim ekonomisi tablosu.' },
    { t: 'kar', h: 'Ürün maliyetinizi girin, kararları netleştirin', p: 'Bu paneldeki kâr metrikleri %30/%40/%50 senaryosuna göre çalışıyor. Model bazında gerçek maliyet listenizi gönderirseniz ürün ürün kâr haritası çıkarılabilir.', w: 'Başa baş maliyet oranı KPI\'sı.' }
  ]);
}
const baremLines = {
  id: 'barem', afterDatasetsDraw(ch) {
    const x = ch.scales.x, a = ch.chartArea, ctx = ch.ctx; ctx.save();
    [200, 350].forEach(v => { const px = x.getPixelForValue(v); ctx.strokeStyle = css('--gold'); ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = css('--gold'); ctx.font = '600 11px ' + css('--mono'); ctx.fillText(v + ' ₺ barem', px + 4, a.top + 12); });
    const y = ch.scales.y; if (y.min < 0) { const py = y.getPixelForValue(0); ctx.strokeStyle = css('--muted'); ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke(); }
    ctx.restore();
  }
};
