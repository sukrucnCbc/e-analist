// ================= SEGMENT =================
function roleOf(p) {
  if (p.asp >= 180 && p.cargo_pct < 21) return 'Kâr çapası';
  if (p.solo >= 80) return 'Trafik mıknatısı';
  if (p.multi >= 35) return 'Sepet ortağı';
  return 'Tamamlayıcı';
}
function buildSegment() {
  const ss = D.segsum, order = ['Hero', 'Core', 'Rising', 'Long Tail'];
  chart('c-seg', th => ({ type: 'bar', data: { labels: order.map(s => SEGNAME[s]), datasets: [
    { label: 'Ciro payı %', data: order.map(s => ss[s].share), backgroundColor: [th.hero, th.core, th.rising, th.tail], borderRadius: 4 },
    { label: 'Model payı %', data: order.map(s => ss[s].n / D.products.length * 100), backgroundColor: th.line, borderRadius: 4 }] }, options: { scales: { y: axis(th, { max: 100 }), x: axis(th, { grid: { display: false } }) } } }));
  chart('c-pareto', th => ({ type: 'line', data: { labels: D.products.map((_, i) => i + 1), datasets: [{ label: 'Kümülatif ciro %', data: D.products.map(p => p.cum), borderColor: th.accent, backgroundColor: th.soft, fill: true, pointRadius: 0, tension: .2 }] }, options: { plugins: { legend: { display: false } }, scales: { y: axis(th, { max: 100 }), x: axis(th, { grid: { display: false }, title: { display: true, text: 'Model sırası', color: th.muted }, ticks: { maxTicksLimit: 12 } }) } } }));
  const strat = {
    Hero: ['Sıfır stoksuzluk: 45 gün emniyet stoğu, haftalık stok kontrolü', 'Reklam bütçesinin %50–60\'ı; başa baş ROAS üstünde ölçekle', 'Fiyat testi (+%5–7), indirimi yalnızca set ve 350 ₺+ kuponla ver', '"Birlikte Al" setlerinin ÇAPASI: sete trafik çeker', 'Yorum ve soru-cevap puanını haftalık izle'],
    Core: ['İstikrarlı nakit akışı; stok devir hızını optimize et', 'Hero ürünlerle set kur (Vatka 2\'li, Kopanaki 3\'lü, Biye ikilisi)', 'Düşenlerde (vatka −%43) görsel/fiyat revizyonu', 'Reklam payı %20–25; çoklu ürün reklamında Hero\'nun yanına', 'Üründen Kazan kategori kuponlarının ana gövdesi'],
    Rising: ['Yatırım önceliği: ayrı ürün reklamı (100–150 ₺/gün)', 'Stok 60 gün; renk ve boy genişlet', 'Takipçilere "yeni ürün" bildirimi ile tanıt', 'Setlere dahil et (İncili fiyonk → yılbaşı kiti)', '3 ay sonra Hero adaylığını değerlendir'],
    'Long Tail': ['Katalog genişliği ve arama görünürlüğü sağlar, sepet tamamlayıcıdır', 'Çoklu sepet oranı en yüksek grup (%51): çapraz satış önerisinde kullan', 'Stok günü 365+ olanlarda yeni alımı durdur, setle erit', 'Reklam verme; kupon kapsamında tut', '6 ayda 20 adedin altında satanları sadeleştir']
  };
  $('#segcards').innerHTML = order.map(s => {
    const list = D.products.filter(p => p.seg === s);
    return `<div class="card"><h3><span class="seg ${segCls(s)}">${SEGNAME[s]}</span> ${list.length} model · cironun %${nf(ss[s].share, 1)}'i</h3>
      <div class="sub">Medyan büyüme ${pillGrowth(ss[s].growth)} · ort. iade %${nf(ss[s].ret, 1)} · çoklu sepet %${nf(ss[s].multi, 0)} · kargo payı %${nf(ss[s].cargo, 0)} · medyan fiyat ${TL(ss[s].asp, 0)}</div>
      <ul class="list">${strat[s].map(x => `<li>${x}</li>`).join('')}</ul>
      <div class="foot"><b>Modeller:</b> ${list.slice(0, s === 'Long Tail' ? 14 : 12).map(p => esc(p.name)).join(' · ')}${list.length > 14 ? ` · +${list.length - 14} model` : ''}</div></div>`;
  }).join('');
  const dec = (p, r) => {
    if (p.seg === 'Hero') return r === 'Trafik mıknatısı' ? 'Stok + reklam; sete çapa yap' : 'Ölçekle, renk genişlet';
    if (p.seg === 'Rising') return 'Ayrı reklam, stok 60 gün';
    if (p.seg === 'Core') return r === 'Sepet ortağı' ? 'Set içine al' : p.growth < -30 ? 'İçerik/fiyat revizyonu' : 'Koru';
    return p.cover_days > 365 ? 'Yeni alım yok, setle erit' : r === 'Sepet ortağı' ? 'Çapraz öneri' : 'Kupon kapsamında tut';
  };
  table('#tb-role', ['Model', 'Seg.', 'Rol', 'Tek başına', 'Çoklu sepet', 'Kargo payı', 'Büyüme', 'Karar'],
    D.products.slice(0, 30).map(p => { const r = roleOf(p); return [esc(p.name), `<span class="seg ${segCls(p.seg)}">${SEGNAME[p.seg]}</span>`, r, P(p.solo, 0), P(p.multi, 0), P(p.cargo_pct, 0), pillGrowth(p.growth), dec(p, r)]; }), [3, 4, 5], true);
  recs('#rec-seg', [
    { t: 'ciro', h: 'Hero: Fiyonk ailesini "koruma altına" al', p: 'Cironun %27\'si tek ailede. Tedarikçi yedeği bul, 45 günlük stok, rakip fiyat takibi. Fiyat artışını renk bazında test et.', w: 'Pareto: ilk model %26,7.' },
    { t: 'ikisi', h: 'Hero\'yu trafik, Core\'u sepet için kullan', p: 'Fiyonk ve Saten kurdele tek başına alınıyor (%87–96): trafik getiriyorlar. Kopanaki, vatka ve lastik çoklu sepette (%35–49): sepet büyütüyorlar. Hero sayfasına Core önerisi koy.', w: 'Rol matrisi.' },
    { t: 'ciro', h: 'Yükselenlere 90 günlük yatırım planı', p: 'İncili Keten Fiyonk, Sakallı Dantel (15 ve 6 cm), Likralı Dantel 3 cm, Saten Kurdele 3 cm ve Yassı Lastik Siyah için: ayrı reklam, renk genişletme, set içine alma. 90 gün sonra ciro payı %10,8 → %15 hedefi.', w: 'Yükselen segment cirosu 557 B₺.' },
    { t: 'kar', h: 'Long Tail\'i sadeleştir ama yok etme', p: '93 model cironun %18\'i. Çoklu sepet oranı en yüksek grup (%51) olduğu için sepet tamamlayıcı değeri var. 6 ayda 20 adedin altında satan ve stok günü 365+ olanları set içinde erit.', w: 'Segment özeti.' },
    { t: 'kar', h: 'Kâr çapalarını reklamda öne çıkar', p: 'Likralı Dantel 18 cm ve Pamuk Biye gibi yüksek fiyatlı (180 ₺+) ve kargo payı düşük (%20 altı) ürünlerde her satış daha kârlı. Reklamda Hero fiyonkla eşit bütçe ver.', w: 'Birim ekonomisi.' },
    { t: 'ciro', h: 'Core düşüşlerini durdur', p: 'Vatka 3 cm, Saten 4 cm, Kopanaki 405 düşüşte (−%43 ile −%66). Görsel yenileme, set ve fiyat testi. 60 günde toparlanmazsa Long Tail\'e al.', w: 'Büyüme sütunu.' },
    { t: 'ikisi', h: 'Her segmente kupon rolü ver', p: 'Hero: yalnızca 350 ₺+ kuponla. Core: kategori kuponları. Yükselen: Plus ve takipçi kuponunda görünürlük. Long Tail: "2. ürüne %20" ile erit.', w: 'Kupon sekmesi.' },
    { t: 'ciro', h: 'Segmentleri 3 ayda bir yeniden hesapla', p: 'Bu segmentasyon Nis–Eyl verisine dayanıyor. Sezon (Haziran) etkisi sonrası Hero/Core sınırları değişebilir. Aynı raporları çeyrek sonunda tekrar yükleyin.', w: 'Metodoloji.' }
  ]);
}

// ================= KUPON =================
const N_M = T.pk / 5;
function simCalc(Tv, Dv, u, s, g) {
  let cost = 0, dRev = 0, dCm = 0, base = 0, baseN = 0;
  D.net_hist.forEach((n0, i) => {
    const n = n0 / 5, v = i === 59 ? D.hist_tail_mean : i * 10 + 5; baseN += n; base += n * v;
    if (v >= Tv) { const k = u * n; cost += k * Dv; dRev -= k * Dv; dCm += k * (-Dv * (1 - S.c * 0) / (1 + S.k) + COMM_R * Dv + (S.ads ? TACOS * Dv : 0) - (cargo(v - Dv) - cargo(v))); }
    else if (v >= 0.7 * Tv) { const m = s * n, vp = Tv + 10, add = vp - v, f = vp - Dv; cost += m * Dv; dRev += m * (f - v); dCm += m * (cmOrder(f) - cmOrder(v) - (S.c * (add) - S.c * (f - v)) / (1 + S.k)); }
  });
  const extraN = g * N_M, extraV = Math.max(Tv, AOV) + 10, extraF = extraV - Dv, extraCm = cmOrder(extraF) - S.c * Dv / (1 + S.k) * 0;
  const noG = dCm;
  cost += extraN * Dv; dRev += extraN * extraF; dCm += extraN * extraCm;
  const beG = extraCm > 0 ? Math.max(0, -noG / extraCm) : null;
  return { cost, dRev, dCm, aov: (base + dRev) / (baseN + extraN), beN: beG, beP: beG != null ? beG / N_M * 100 : null, extraCm };
}
const PRESETS = [
  ['Takipçi A · 0/15 ₺', 0, 15, 5, 0, 1.5], ['Takipçi B · 400/50 ₺', 400, 50, 5, 3, 1.5], ['Üründen Kazan · 350/30 ₺', 350, 30, 35, 10, 3],
  ['Transkript örneği · 200/10 ₺', 200, 10, 35, 10, 3], ['Sepete ekleyenler · 250/25 ₺', 250, 25, 4, 0, 1.5], ['Yorum Yap · 250/25 ₺', 250, 25, 8, 0, 2]
];
function runSim() {
  const Tv = +$('#s-T').value, Dv = +$('#s-D').value, u = $('#s-u').value / 100, s = $('#s-s').value / 100, g = $('#s-g').value / 100;
  $('#v-T').textContent = TL(Tv); $('#v-D').textContent = TL(Dv); $('#v-u').textContent = '%' + Math.round(u * 100); $('#v-s').textContent = '%' + Math.round(s * 100); $('#v-g').textContent = '%' + nf(g * 100, 1);
  const r = simCalc(Tv, Dv, u, s, g);
  $('#sim-out').innerHTML = [
    { l: 'Aylık kupon maliyeti', v: KTL(r.cost), n: `≈ ${nf(r.cost / Dv, 0)} kupon kullanımı`, s: 'warn' },
    { l: 'Net ciro değişimi', v: (r.dRev >= 0 ? '+' : '') + KTL(r.dRev), n: 'Kupon sonrası, aylık', s: r.dRev >= 0 ? 'good' : 'bad' },
    { l: 'Katkı payı değişimi', v: (r.dCm >= 0 ? '+' : '') + TL(r.dCm, 0), n: `Aylık · maliyet %${Math.round(S.c * 100)}`, s: r.dCm >= 0 ? 'good' : 'bad' },
    { l: 'Yeni ortalama sepet', v: TL(r.aov, 1), n: `Bugün ${TL(D.net_hist.reduce((a, n, i) => a + n * (i === 59 ? D.hist_tail_mean : i * 10 + 5), 0) / D.net_hist.reduce((a, b) => a + b, 0), 1)}`, s: '' },
    { l: 'Başa baş için ek sipariş', v: r.beN == null ? 'mümkün değil' : nf(r.beN, 0) + ' <small>/ay</small>', n: r.beP == null ? 'Ek sipariş de zarar ediyor' : `Aylık siparişin %${nf(r.beP, 1)}'i`, s: r.beP != null && r.beP < 3 ? 'good' : 'bad' }
  ].map(kpi).join('');
  $('#sim-foot').innerHTML = `Ek siparişin katkı payı: ${TL(r.extraCm, 1)} (sepet ≈ ${TL(Math.max(Tv, AOV) + 10 - Dv, 0)}). Kargo baremi kupon sonrası tutara göre uygulanır; 350–${350 + Dv} ₺ arası sepetlerde kupon, kargoyu 93,05 → 78,99 ₺'ye indirir. Aylık baz ≈ ${nf(N_M, 0)} paket.`;
}
function buildKupon() {
  const cm = cmAll();
  $('#kupon-rule').innerHTML = `Barem kargo, <b>kupon ve indirim sonrası</b> tutara göre hesaplanıyor. Sepetlerin %${nf(UNDER200, 0)}'i 200 ₺ altında ve seçili senaryoda tek ürünlük 139 ₺ sipariş ${TL(cmOrder(139), 1)} katkı bırakıyor. Bu yüzden <b>düşük alt limitli kuponlar zaten kârsız olan siparişi ucuzlatır</b>. Kupon ya (1) sepeti 350 ₺ üstüne taşımalı (orada kuponun bir kısmını kargo tasarrufu karşılar), ya (2) takipçi ve yorum gibi kalıcı bir varlık kazandırmalı, ya da (3) yalnızca sepete ekleyip almayan gibi gerçekten kararsız bir kitleye gitmeli. Transkriptteki "200 ₺'ye 10 ₺" kurgusu sizin sepet yapınızda en kötü seçeneklerden biri: 200–210 ₺ sepet kupondan sonra 200 ₺'nin altına düşerse kargo 38 ₺ ucuzlar, ama 200 ₺'ye yükselen 180–199 ₺ sepetin kargosu 38 ₺ artar.`;
  table('#tb-ctypes', ['Kupon türü', 'Nerede görünür / kime gider', 'Kurallar (panel)', 'Sizin için amacı', 'Önerilen kurgu'], [
    ['<b>Üründen Kazan</b>', 'Ürün detay sayfasında "Kazan" butonu; ürünü ziyaret eden herkes', 'Tüm ürün / kategori / marka / seçili ürün · tutar veya % (en fazla %50, % indiriminde üst tutar 25\'in katı) · en fazla ~1 ay · iptal edilebilir · toplam 10 kupona kadar; müşteriye en avantajlısı önce gösterilir', 'Dönüşüm + sepet büyütme', 'Kategori bazlı 350 ₺ / 30 ₺ (Kurdele, Dantel, Lastik); Efsane Kasım\'da 400 ₺ / 40 ₺ ek katman'],
    ['<b>Takipçi Kazan</b>', 'Mağaza sayfası girişinde; takip eden kazanır', 'Tek aktif kupon · tüm ürünlerde · en fazla ~1 ay · "tekrarlansın" ile otomatik yenilenir · iptal edilebilir · örnek: 145 takipçi / 4 kullanım', 'Ücretsiz bildirim (push) kitlesi büyütme', 'A/B: 0 ₺ / 15 ₺ vs 400 ₺ / 50 ₺; kazanan sürekli açık'],
    ['<b>Hedef Kitle</b>', 'Ekranda görünmez; seçilen kitleye bildirim olarak gider', 'En fazla 7 gün · aynı anda en fazla 3 aktif · kitle: Trendyol otomatik, sepete ekleyenler, favorileyenler, ürünü ziyaret edenler, takipçiler, önceki alıcılar · iptal edilemez (kazanılmış hak)', 'Kararsız kitleyi kapatma, winback', 'Ay sonu sepete ekleyenler 250/25; kampanya öncesi favorileyenler 300/30; önceki alıcılar 300/30'],
    ['<b>Yorum Yap Kazan</b>', 'Son 7/14/30 günde teslim alan müşteriye bildirim; yorum yaparsa kazanır', 'Kupon bir SONRAKİ siparişte geçerli · tüm ürünler · iptal edilemez', 'Yorum sayısı (dönüşüm) + 2. sipariş (RPR)', 'Son 30 gün · 250 ₺ / 25 ₺ · her ay yenile']
  ], [], true);
  $('#sim-presets').innerHTML = PRESETS.map((p, i) => `<button type="button" class="pill neu" style="cursor:pointer;border:1px solid var(--line)" data-p="${i}">${p[0]}</button>`).join('');
  $('#sim-presets').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; const p = PRESETS[+b.dataset.p];[['#s-T', p[1]], ['#s-D', p[2]], ['#s-u', p[3]], ['#s-s', p[4]], ['#s-g', p[5]]].forEach(([s, v]) => $(s).value = v); runSim(); });
  ['#s-T', '#s-D', '#s-u', '#s-s', '#s-g'].forEach(s => $(s).addEventListener('input', runSim)); runSim();
  const C = n => D.cats.find(c => c.name === n) || {};
  const row = (n, type, kurgu, sure, adet, hedef) => { const c = C(n); return [`<b>${n}</b>`, `Ciro %${nf(c.share, 1)} · ort. fiyat ${TL(c.asp, 0)} · <200 ₺ sepet %${nf(c.under200, 0)} · kargo %${nf(c.cargo_pct, 0)} · iade %${nf(c.ret_rate, 1)}`, type, kurgu, sure, adet, hedef]; };
  table('#tb-catplan', ['Kategori', 'Veri', 'Kupon türü', 'Kurgu', 'Süre / tarih', 'Adet (bütçe tavanı)', 'Hedef KPI'], [
    row('Kurdele', 'Üründen Kazan (kategori)', '350 ₺ üzeri 30 ₺ · Fiyonk 3 renk seti (389 ₺) ile eşle', '30 gün · 9 Kas–8 Ara; Yılbaşı için 9–24 Ara 350/35', '600 (18.000 ₺)', '350 ₺+ sepet payı %16 → %20'),
    row('Dantel', 'Üründen Kazan (kategori)', '400 ₺ üzeri 40 ₺ · Kopanaki 3\'lü set (499 ₺) ile eşle', '30 gün · 5 Eki–3 Kas', '300 (12.000 ₺)', 'Dantel AOV 250 → 300 ₺'),
    row('Dikiş Makinesi Aksesuarı', 'Hedef Kitle (ürünü ziyaret edenler)', 'Kupon yerine Vatka 2\'li set 179 ₺; set sayfasında 175 ₺ / 15 ₺', '7 gün · 19–25 Eki', '150 (2.250 ₺)', 'Vatka düşüşünü durdur, UPT +0,3'),
    row('Dekoratif Şerit', 'Üründen Kazan (Kurdele kuponuna ekle)', '350 ₺ / 30 ₺ · Dikiş Lastik Kiti (379 ₺)', 'Kurdele kuponuyla aynı dönem', 'Kurdele bütçesinden', 'Lastik kiti satışı 60+/ay'),
    row('Güpür', 'Hedef Kitle (favorileyenler)', '300 ₺ / 30 ₺ · önce görsel/iade düzeltmesi', '7 gün · 2–8 Kas', '120 (3.600 ₺)', 'İade %3,7 → %2,5; favoriden satışa'),
    row('Paketleme Malzemesi', 'Üründen Kazan (Paketleme + Kurdele)', '350 ₺ / 35 ₺ · Yılbaşı Hediye Paketleme Kiti', '1–24 Ara', '250 (8.750 ₺)', 'Aralık kurdele cirosu +%25'),
    row('El İşi Malzemesi', 'Üründen Kazan (seçili ürün)', 'Kit + 2 şerit sepeti için 300 ₺ / 30 ₺', '14 gün · Kas', '80 (2.400 ₺)', 'Kit alanların şerit ekleme oranı %60+')
  ], [], true);
  const gain = stAvg('Toplam Takipçi Sayısı - Kazanılan');
  $('#fol-now').textContent = `17.729 takipçi · günde ~${nf(gain, 0)} kazanım · ziyaretçinin %${nf(FOLLOW_CVR, 0)}'i takip ediyor`;
  const fp = [
    ['Faz 1 · 28 Eyl – 11 Eki 2026 (14 gün)', 'Takipçi Kazan <b>A: 0 ₺ alt limit / 15 ₺</b>', ['Adet 500 → bütçe tavanı 7.500 ₺; transkriptteki oranla (%3 kullanım) gerçek maliyet ~1–2 B₺', 'Tekrarlansın: Hayır (test)', 'Ölç: günlük kazanılan takipçi (baz ~' + nf(gain, 0) + '/gün), kazanılan/kullanılan kupon', 'Beklenti: günde +20–40 ek takipçi']],
    ['Faz 2 · 12 – 25 Eki 2026 (14 gün)', 'Takipçi Kazan <b>B: 400 ₺ alt limit / 50 ₺</b>', ['Adet 300 → bütçe tavanı 15.000 ₺; yalnızca kârlı 400 ₺+ sepetlerde kullanılır', 'Başlıkta "50 ₺" büyük görünür: takip motivasyonu yüksek', 'Ölç: ek takipçi başına maliyet = kupon maliyeti ÷ (kazanılan − baz)', 'Kazanan: ek takipçi başına maliyeti düşük olan']],
    ['Faz 3 · 26 Eki – 8 Kas (sürekli)', 'Kazanan kurgu <b>tekrarlansın</b> ile sürekli açık', ['Efsane Kasım öncesi (1–10 Kas) tutarı 1,5 katına çıkar (ör. 0/20 ya da 400/70)', 'Takipçi havuzu büyüdükçe Kasım kampanya bildirimleri daha geniş kitleye gider', 'Takipçi kaybını (günde ~4) izle, haftada en fazla 2 bildirim']],
    ['Destekleyiciler (sürekli)', 'Kupon dışı takipçi kaldıraçları', ['Her pakete "takip et, 15 ₺ kazan" kartı', 'Mağaza vitrinine takipçi kuponu banner\'ı', 'Yeni ürün lansmanlarını takipçiye ilk duyur', 'Hedef: 90 günde 17.729 → 25.000 takipçi (günde ~80)']]
  ];
  $('#follow-plan').innerHTML = fp.map(([w, h, l]) => `<div class="card"><div class="eyebrow">${w}</div><h3 style="margin:4px 0 8px">${h}</h3><ul class="list">${l.map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('');
  const cal = [
    ['28 Eyl – 11 Eki', 'Takipçi Kazan A testi', 'Yeni dönemi takipçi havuzuyla başlat. Pazartesi 12:00\'de aç.', ['Takipçi Kazan', '0 ₺ / 15 ₺', '14 gün', '500 adet']],
    ['1 Eki → her ay', 'Yorum Yap Kazan (sürekli)', 'Son 30 gün alıcılarına; yorum → sonraki siparişte kupon. RPR ve yorum sayısı için.', ['Yorum Yap Kazan', '250 ₺ / 25 ₺', '30 gün, her ay yenile', 'Tüm alıcılar']],
    ['5 Eki – 3 Kas', 'Dantel sonbahar kuponu + Kopanaki seti lansmanı', 'Dantel ortalama sepetini sete taşı.', ['Üründen Kazan', '400 ₺ / 40 ₺', '30 gün', '300 adet']],
    ['12 – 25 Eki', 'Takipçi Kazan B testi', 'Yüksek başlıklı, kârlı sepetlere kilitli takipçi kuponu.', ['Takipçi Kazan', '400 ₺ / 50 ₺', '14 gün', '300 adet']],
    ['19 – 25 Eki', 'Vatka 2\'li set lansmanı', 'Vatka sayfasını ziyaret edenlere set kuponu.', ['Hedef Kitle · ürünü ziyaret edenler', '175 ₺ / 15 ₺', '7 gün', '150 adet']],
    ['25 – 31 Eki', 'Ay sonu çukuru', 'Sepete ekleyip almayanları kapat.', ['Hedef Kitle · sepete ekleyenler', '250 ₺ / 25 ₺', '7 gün', '150 adet']],
    ['2 – 8 Kas', 'Efsane Kasım ısınması', 'Favori listesindekileri kampanya öncesi dönüştür.', ['Hedef Kitle · favorileyenler', '300 ₺ / 30 ₺', '7 gün', '200 adet']],
    ['9 Kas – 8 Ara', 'Efsane Kasım + Black Friday (27 Kas)', 'Kurdele ve lastik kategorisi; tüm ürünlerde ikinci katman. Reklam bütçesi +%50.', ['Üründen Kazan', '350 ₺ / 30 ₺ + 400 ₺ / 40 ₺', '30 gün', '600 + 400 adet']],
    ['24 – 30 Kas', 'Kasım ay sonu', 'Kampanya sepetini terk edenler.', ['Hedef Kitle · sepete ekleyenler', '250 ₺ / 25 ₺', '7 gün', '200 adet']],
    ['1 – 24 Ara', 'Yılbaşı hediye paketleme', 'Hediye Paketleme Kiti + Fiyonk 3 renk seti. Kurdele sezonun ikinci zirvesi.', ['Üründen Kazan · Kurdele + Paketleme', '350 ₺ / 35 ₺', '24 gün', '250 adet']],
    ['25 – 31 Ara', 'Yıl sonu winback', 'Nisan–Kasım alıcılarını geri çağır.', ['Hedef Kitle · önceki alıcılar', '300 ₺ / 30 ₺', '7 gün', '200 adet']],
    ['1 – 14 Şub 2027', 'Sevgililer Günü', 'Kırmızı saten kurdele, kırmızı fiyonk, hediye kiti.', ['Üründen Kazan · Kurdele', '350 ₺ / 30 ₺', '14 gün', '300 adet']],
    ['15 Şub – 8 Mar 2027', 'Ramazan ve bayram öncesi (Ramazan Bayramı ≈ 9–11 Mart 2027, tahmini)', 'Bohça, hediye ve şeker paketi kurdelesi; favorileyenlere hatırlatma.', ['Hedef Kitle · favorileyenler', '300 ₺ / 30 ₺', '7 gün × 2', '2 × 200 adet']],
    ['1 Nis – 15 May 2027', 'Nikah/düğün sezonu + Anneler Günü (9 May)', 'Stoğu 1,5 katına çıkar, Fiyonk 3 renk seti reklamı, takipçi kuponunu 1,5 kat. Kurban Bayramı (≈ 16–19 May 2027, tahmini) öncesi kampanyayı bitir.', ['Üründen Kazan · Kurdele', '350 ₺ / 30 ₺', '30 + 15 gün', '800 adet']]
  ];
  $('#calendar').innerHTML = cal.map(([w, h, p, sp]) => `<div class="tl"><div class="when">${w}</div><div><h4>${h}</h4><p>${p}</p><div class="spec">${sp.map((x, i) => `<span class="pill ${i === 0 ? 'warn' : 'neu'}">${x}</span>`).join('')}</div></div></div>`).join('');
  const bud = [['Üründen Kazan', 45], ['Hedef Kitle', 20], ['Yorum Yap Kazan', 20], ['Takipçi Kazan', 15]];
  const monthlyBudget = SEP_RUN * 0.025;
  chart('c-budget', th => ({ type: 'doughnut', data: { labels: bud.map(b => b[0]), datasets: [{ data: bud.map(b => b[1]), backgroundColor: [th.accent, th.teal, th.gold, th.tail], borderColor: th.surface }] }, options: { cutout: '58%', plugins: { legend: { position: 'right' }, tooltip: { callbacks: { label: x => ` %${x.raw} · ${KTL(monthlyBudget * x.raw / 100)}/ay` } } } } }));
  $('#budget-foot').innerHTML = `Önerilen gerçekleşen kupon maliyeti ≈ ${KTL(monthlyBudget)}/ay (net cironun %2,5'i). Son 6 ayda indirim cironun %${nf(T.disc / T.gross_rev * 100, 1)}'i idi. Paneldeki "adet × tutar" tavanı bundan yüksek girilebilir; tavan maliyet değildir.`;
  $('#kupon-kpis').innerHTML = ['Kazanılan / kullanılan kupon (panel "Kuponlarım")', 'Kullanım oranı = kullanılan ÷ kazanılan', 'Kupon başına ek sipariş (kupon dönemi vs önceki 2 hafta, aynı günler)', 'Ek takipçi başına maliyet (takipçi kuponları)', '350 ₺+ sepet payı ve AOV (bu paneldeki Kârlılık sekmesi)', 'Paket başı katkı payı: kupon döneminde düşmemeli', '2. sipariş oranı (RPR) ve yorum sayısı (Yorum Yap Kazan)', 'Ay sonu (25–31) günlük sipariş: çukur kapanıyor mu?'].map(x => `<li>${x}</li>`).join('');
  recs('#rec-kupon', [
    { t: 'kar', h: '200 ₺ altına kupon verme', p: 'Sepetlerin %68\'i 200 ₺ altında ve bu siparişlerin katkısı zaten ince ya da eksi. Düşük limitli kupon, kârsız siparişi daha da ucuzlatır. İstisna: takipçi kazanma testi.', w: 'Katkı payı eğrisi.' },
    { t: 'kar', h: '350 ₺ eşiğini kupon çapası yap', p: 'Kupon sonrası tutar 350 ₺\'nin altına inerse kargo 93,05 → 78,99 ₺ olur. 350 ₺ / 30 ₺ kuponda, 350–379 ₺ sepetlerde kuponun ~14 ₺\'sini kargo tasarrufu karşılar.', w: 'Barem kupon sonrası tutarla işliyor (171/171 paket).' },
    { t: 'ciro', h: 'Her kuponu bir setle eşle', p: 'Kupon alt limitini set fiyatının hemen altına koy (Fiyonk seti 389 → kupon 350; Kopanaki seti 499 → kupon 400). Müşteri tek tıkla limite ulaşır.', w: 'Set önerileri.' },
    { t: 'ikisi', h: 'Hedef kitle kuponlarını takvime bağla', p: '3 aktif hakkı sürekli kullan: (1) ay sonu sepete ekleyenler, (2) kampanya öncesi favorileyenler, (3) ilk siparişten 7–14 gün sonra önceki alıcılar.', w: 'Ay sonu −%25, tekrar alım medyanı 9 gün.' },
    { t: 'ciro', h: 'Takipçi kuponunu A/B ile seç', p: 'Transkriptte 0 ₺ / 15 ₺ kupon 145 takipçi getirip yalnızca 4 kez kullanıldı. Sizde 400 ₺ / 50 ₺ de denenmeli; hangisi ek takipçi başına daha ucuzsa sürekli açık kalsın.', w: 'Transkript + mağaza raporu.' },
    { t: 'ikisi', h: 'Yorum Yap Kazan\'ı her ay yenile', p: 'İptal edilemez ama maliyet yalnızca ikinci siparişte oluşur. RPR\'yi artırmanın en ucuz yolu. Tutarı 25 ₺, alt limiti 250 ₺ tut; tekrar eden müşterinin sepeti zaten 308 ₺.', w: 'Tekrar eden müşteri AOV.' },
    { t: 'kar', h: 'Yüzde değil tutar indirimi kullan', p: 'Ortalama sepet düşük ve dağılım dar. %10 kupon büyük sepette fazla, küçük sepette etkisiz kalır. Tutar indirimi barem hesabını öngörülebilir kılar. % kullanırsan üst tutarı 25\'in katı olarak sınırla.', w: 'Kupon kuralları.' },
    { t: 'ciro', h: 'Kuponları Pazartesi başlat', p: 'Pazartesi en yüksek sipariş günü, 12–15 saatleri zirve. Kupon bildirimlerinin ilk gününü buna denk getir; Cumartesi–Pazar zayıf, hedef kitle kuponu için Pazar akşamı iyi.', w: 'Gün × saat ısı haritası.' },
    { t: 'kar', h: 'Kupon + Trendyol kampanyası çakışmasını hesapla', p: 'Efsane Kasım gibi platform kampanyalarında ürün indirimi + kupon üst üste binebilir. Set ürünlerde toplam indirimin %15\'i aşmamasına dikkat et.', w: 'Katkı payı %' + nf(cm.pct, 1) + ' (seçili senaryo).' },
    { t: 'ciro', h: 'Plus bölgesinde Hero kuponu', p: 'Siparişlerin %56\'sı Plus üyelerinden. Plus\'a özel Üründen Kazan kuponu (Fiyonk seti, 350/30) bu sadık kitleye görünür.', w: 'Trendyol Plus dağılımı.' },
    { t: 'ikisi', h: 'Her kupondan sonra 2 haftalık karşılaştırma', p: 'Kupon dönemi ile önceki iki haftanın aynı günlerini karşılaştır: sipariş, AOV, 350 ₺+ payı, paket başı katkı. Simülatörü kendi kullanım oranlarınızla güncelleyin.', w: 'Kupon simülatörü.' },
    { t: 'kar', h: 'Kupon adedini düşük başlat, sonra artır', p: 'Bütçe tavanı "adet × tutar". Yeni kurgularda tavanı düşük tut (150–300 adet); iptal edilemeyen kuponlarda (Hedef Kitle, Yorum) bu özellikle önemli.', w: 'Kupon kuralları.' }
  ]);
  $('#sources').innerHTML = [
    ['Trendyol Kuponları transkripti (yüklediğiniz dosya)', null],
    ['Trendyol Kupon Türleri Rehberi – Olay Bu İşte', 'https://olaybuiste.com/trendyol-kupon-turleri-rehberi/'],
    ['Trendyol Kupon Türleri 2026 – Veritas Dijital', 'https://www.veritasdijital.com/trendyol-kupon-turleri-nelerdir/'],
    ['Trendyol Kupon Kullanımı – EasyEntegre', 'https://www.easyentegre.com/blogs/trendyol-kupon-kullanimi'],
    ['Trendyol Takipçi ve Favori Artırma – Ticimax', 'https://www.ticimax.com/blog/trendyol-takipci-ve-favori-artirma-nedir-nasil-calisir'],
    ['Takipçi ve Favori: Bedava Remarketing – Tor Dijital', 'https://tordijital.com/blog/trendyol-takipci-favori-push-remarketing'],
    ['Trendyol Platform Hizmet Bedeli 2026 – Pazar Fiyat', 'https://pazarfiyat.com/blog/51-trendyol-platform-hizmet-bedeli-2026'],
    ['Kargo Baremi Uygulaması – Trendyol Akademi', 'https://akademi.trendyol.com/satici-bilgi-merkezi/detay/kargo-baremi-uygulamasi'],
    ['Barem 200 ₺ / 350 ₺ güncellemesi (26 Mart 2026) – Gökhan Tanrıverdi, X', 'https://x.com/gkntan/status/2026292670218346613'],
    ['Trendyol Kargo Ücretleri 2026 – Dopigo', 'https://www.dopigo.com/trendyol-kargo-ucretleri/']
  ].map(([t, u]) => `<li>${u ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : t}</li>`).join('');
}

// ================= TABS =================
const built = {};
const BUILD = { ozet: buildOzet, satis: buildSatis, kar: () => { scenControls($('#scen-kar')); syncScen(); renderKar(false); }, sepet: buildSepet, musteri: buildMusteri, urun: buildUrun, segment: buildSegment, kupon: buildKupon, raporlar: buildRaporlar };
function show(id) {
  if (!BUILD[id]) id = 'ozet';
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.getAttribute('aria-controls') === id)));
  document.querySelectorAll('.panel').forEach(p => p.hidden = p.id !== id);
  if (!built[id]) { built[id] = true; BUILD[id](); }
  try { localStorage.setItem('akt-tab', id); } catch (e) { }
  if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
  hideTip();
}
document.querySelector('.tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) { show(t.getAttribute('aria-controls')); scrollTo({ top: 0 }); } });
document.querySelector('.tabs').addEventListener('keydown', e => {
  if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return; const tabs = [...document.querySelectorAll('.tab')]; const i = tabs.indexOf(document.activeElement); if (i < 0) return;
  const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); show(n.getAttribute('aria-controls'));
});
let first = location.hash.slice(1); if (!first) { try { first = localStorage.getItem('akt-tab') || 'ozet'; } catch (e) { first = 'ozet'; } }
if (!built.ozet && first !== 'ozet') { built.ozet = true; buildOzet(); }
show(first);
