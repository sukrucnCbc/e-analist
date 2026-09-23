// ================= SATIŞ =================
function buildSatis() {
  const g = (MON[4].net_rev / MON[0].net_rev - 1) * 100;
  $('#kpi-satis').innerHTML = [
    { code: 'NET', l: 'Net Ciro (6 ay)', v: KTL(T.net_rev), n: `Brüt ${KTL(T.gross_rev)} · indirim ${KTL(T.disc)}`, tip: 'trend' },
    { code: 'ADET', l: 'Net Satış Adedi', v: nf(T.net_units), n: `${T.skus} barkod · ${T.models} model`, tip: 'upt' },
    { code: 'RUN', l: 'Eylül Tempo (30 gün)', v: KTL(SEP_RUN), n: `Ağustos ${KTL(MON[4].net_rev)} · Nis→Ağu ${g > 0 ? '+' : ''}${nf(g, 1)}%`, s: 'good', tip: 'trend' },
    { code: 'KOM', l: 'Komisyon Oranı', v: P(T.comm / T.net_rev * 100), n: `Nisan %16,9 → Ağustos %20,4`, s: 'bad', tip: 'waterfall' },
    { code: 'CANC', l: 'İptal Oranı', v: P(CANC), n: `${nf(T.cancel)} adet · çoğu müşteri iptali`, s: 'warn', tip: 'reasons' },
    { code: 'RET', l: 'İade Oranı', v: P(RET), n: 'Haziran zirvesi %5,4', s: 'good', tip: 'ret' }
  ].map(kpi).join('');
  table('#tb-month', ['Ay', 'Net ciro', 'Brüt ciro', 'İndirim', 'Net adet', 'Paket', 'AOV', 'UPT', 'Çok ürünlü paket', 'İptal', 'İade', 'Komisyon', 'Kargo/ciro', 'Yeni müşteri', 'Plus', 'Kargoya (saat)'],
    MON.map(m => [m.m + (m.key === 'eyl_l' ? ' <span class="pill neu">22 gün</span>' : ''), TL(m.net_rev), TL(m.gross_rev), TL(m.disc), nf(m.net_units), m.pkgs ? nf(m.pkgs) : '–', m.aov ? TL(m.aov, 1) : '–', m.upt ? nf(m.upt, 2) : '–', m.multi_item ? P(m.multi_item) : '–', P(m.cancel_rate), P(m.ret_rate), P(m.comm_rate), m.cargo_share ? P(m.cargo_share) : '–', P(m.new_share), P(m.plus_share), nf(m.op_ship_h, 1)]),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  const cats = D.cats.filter(c => c.net_rev > 5000);
  chart('c-cat', th => ({
    type: 'bar', data: { labels: cats.map(c => c.name), datasets: [
      { label: 'Ciro payı %', data: cats.map(c => c.share), backgroundColor: th.accent, borderRadius: 4, yAxisID: 'y' },
      { label: 'İade oranı %', type: 'line', data: cats.map(c => c.ret_rate), borderColor: th.gold, backgroundColor: th.gold, pointRadius: 4, showLine: false, yAxisID: 'y2' }] },
    options: { scales: { y: axis(th, { title: { display: true, text: 'Ciro payı %', color: th.muted } }), y2: axis(th, { position: 'right', grid: { display: false }, title: { display: true, text: 'İade %', color: th.muted } }), x: axis(th, { grid: { display: false }, ticks: { maxRotation: 40, minRotation: 0, autoSkip: false } }) } }
  }));
  const pal = th => [th.accent, th.teal, th.gold, th.rising, th.tail, th.good];
  chart('c-cattrend', th => ({
    type: 'line', data: { labels: MON.map(m => m.m), datasets: cats.slice(0, 5).map((c, i) => ({ label: c.name, data: c.trend.map(v => v / 1000), borderColor: pal(th)[i], backgroundColor: pal(th)[i], tension: .3, pointRadius: 2.5 })) },
    options: { scales: { y: axis(th, { beginAtZero: true }), x: axis(th, { grid: { display: false } }) } }
  }));
  table('#tb-cat', ['Kategori', 'Net ciro', 'Pay', 'Net adet', 'Ort. fiyat', 'İade', 'Komisyon', 'Kargo payı', 'Sepet (içeren)', '<200 ₺ sepet', 'Farklı kategoriyle', 'Trend (Nis→Eyl)'],
    D.cats.map(c => [c.name, TL(c.net_rev), P(c.share), nf(c.net_units), TL(c.asp, 1), P(c.ret_rate), P(c.comm_rate), c.cargo_pct ? P(c.cargo_pct) : '–', c.aov_with ? TL(c.aov_with, 0) : '–', c.under200 ? P(c.under200, 0) : '–', c.cross_cat ? P(c.cross_cat) : '–', spark(c.trend)]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  // ADS
  const ap = D.ads_products.filter(a => a['Harcanan Bütçe'] > 0);
  const pSpend = ap.reduce((a, r) => a + r['Harcanan Bütçe'], 0);
  const main = ap.find(a => a['Reklam Statüsü'] === 'Yayında');
  const other = ADS.spend - pSpend - ADS.meta.spend;
  $('#kpi-ads').innerHTML = [
    { code: 'SPEND', l: 'Harcama (1 Nis–23 Eyl)', v: KTL(ADS.spend), n: `≈ ${KTL(ADS.spend / 5.75)}/ay`, tip: 'tacos' },
    { code: 'ROAS', l: 'Harcama Getirisi', v: nf(ADS.roas, 2) + '<small>x</small>', n: `Reklam cirosu ${KTL(ADS.rev)}`, s: 'good', tip: 'roas' },
    { code: 'ACoS', l: 'Reklam Satış Maliyeti', v: P(ADS.spend / ADS.rev * 100), n: 'Doğrudan satış bazında ana reklam %27', s: 'good', tip: 'acos' },
    { code: 'TACoS', l: 'Toplam Reklam Maliyeti', v: P(TACOS * 100), n: 'Toplam net ciroya oranla', s: 'good', tip: 'tacos' },
    { code: 'CPC', l: 'Tıklama Başı Maliyet', v: TL(ADS.spend / ADS.clicks, 2), n: `CTR ${P(ADS.clicks / ADS.impr * 100, 2)} · ${nf(ADS.impr)} gösterim`, s: 'good', tip: 'roas' },
    { code: 'CVR', l: 'Tıklamadan Satışa', v: P(AD_CVR), n: `${nf(ADS.sales)} adet = satılan adedin %${nf(ADS.sales / T.gross_units * 100, 0)}'i`, s: 'good', tip: 'cvr' }
  ].map(kpi).join('');
  const adRow = (n, st, sp, cl, im, ds, ts, dr, tr) => [n, st, TL(sp), nf(cl), nf(im), cl ? TL(sp / cl, 2) : '–', im ? P(cl / im * 100, 2) : '–', nf(ds), nf(ts), TL(dr), TL(tr), sp ? nf(dr / sp, 2) + 'x' : '–', sp ? nf(tr / sp, 2) + 'x' : '–'];
  table('#tb-ads', ['Reklam', 'Durum', 'Harcama', 'Tık', 'Gösterim', 'TBM', 'CTR', 'Doğrudan adet', 'Toplam adet', 'Doğrudan ciro', 'Toplam ciro', 'Doğrudan ROAS', 'Toplam ROAS'],
    [...ap.map(a => adRow(a['Reklam Adı'] + ` <span class="pill neu">${a['Ürün Adedi']} ürün</span>`, a['Reklam Statüsü'], a['Harcanan Bütçe'], a['Tıklanma'], a['Görüntülenme'], a['Doğrudan Satış Adedi'], a['Toplam Satış Adedi'], a['Doğrudan Reklam Cirosu'], a['Toplam Reklam Cirosu'])),
    adRow('Meta reklamı (24–28 Haz)', 'Tamamlandı', ADS.meta.spend, ADS.meta.clicks, ADS.meta.impr, 0, ADS.meta.sales, 0, ADS.meta.rev).map((x, i) => [7, 9, 11].includes(i) ? '–' : x),
    ['Diğer reklam tipleri (mağaza/marka vb.) <span class="pill warn">kırılım yok</span>', '–', TL(other), '–', '–', '–', '–', '–', '–', '–', '–', '–', '–']], [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

  // time
  const wdn = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  chart('c-wd', th => ({
    type: 'bar', data: { labels: wdn, datasets: [{ label: 'Paket', data: D.wd.map(x => x.o), backgroundColor: D.wd.map((x, i) => i === 0 ? th.accent : th.tail), borderRadius: 4, yAxisID: 'y' },
      { type: 'line', label: 'Ort. sepet ₺', data: D.wd.map(x => x.aov), borderColor: th.teal, backgroundColor: th.teal, pointRadius: 3, yAxisID: 'y2' }] },
    options: { scales: { y: axis(th, { beginAtZero: true }), y2: axis(th, { position: 'right', grid: { display: false }, suggestedMin: 200, suggestedMax: 260 }), x: axis(th, { grid: { display: false } }) } }
  }));
  chart('c-dom', th => ({
    type: 'bar', data: { labels: D.dom.map((_, i) => i + 1), datasets: [{ label: 'Paket', data: D.dom.map((v, i) => i === 30 ? v * 5 / 3 : v), backgroundColor: D.dom.map((_, i) => i >= 24 ? th.gold : th.teal), borderRadius: 3 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => ` ${nf(x.raw)} paket${x.dataIndex === 30 ? ' (31 çeken aylara göre ölçeklendi)' : ''}` } } }, scales: { y: axis(th, { beginAtZero: true }), x: axis(th, { grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 16 } }) } }
  }));
  const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'], hrs = ['0-3', '3-6', '6-9', '9-12', '12-15', '15-18', '18-21', '21-24'];
  const hv = days.flatMap(d => hrs.map(h => D.dayhour[d + '|' + h] || 0)); const hmax = Math.max(...hv);
  $('#heat').innerHTML = '<div class="h"></div>' + hrs.map(h => `<div class="h">${h}</div>`).join('') + days.map(d => `<div class="h" style="text-align:left">${d}</div>` + hrs.map(h => { const v = D.dayhour[d + '|' + h] || 0, a = v / hmax; return `<div style="background:color-mix(in srgb,var(--accent) ${Math.round(a * 85)}%,var(--surface2));color:${a > .55 ? '#fff' : 'var(--ink)'}" title="${d} ${h}: ${v} sipariş">${v}</div>`; }).join('')).join('');
  table('#tb-city', ['İl', 'Paket', 'Pay', 'Ciro', 'Ort. sepet'], D.city.map(c => [c.c, nf(c.o), P(c.o / D.city_total * 100), TL(c.rev), TL(c.aov, 0)]), [1, 2, 3, 4]);
  const rs = Object.entries(D.reasons).slice(0, 10);
  chart('c-reasons', th => ({
    type: 'bar', data: { labels: rs.map(r => r[0]), datasets: [{ data: rs.map(r => r[1]), backgroundColor: rs.map(r => /İptal|Vazgeçtim|Teslim Edilemeyen/.test(r[0]) ? th.gold : th.accent), borderRadius: 4 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: axis(th), y: axis(th, { grid: { display: false } }) } }
  }));
  const oh = D.ops_hist;
  chart('c-ops', th => ({
    type: 'bar', data: { labels: oh.cols, datasets: [{ label: 'Satılan adet', data: oh.rows['Satılan Ürün Adedi'], backgroundColor: th.teal, borderRadius: 4, yAxisID: 'y' },
      { type: 'line', label: 'İade oranı %', data: oh.rows['İade Oranı'], borderColor: th.accent, backgroundColor: th.accent, tension: .3, yAxisID: 'y2' },
      { type: 'line', label: 'Müşteriye teslim (saat)', data: oh.rows['Müşteriye Teslim Süresi'], borderColor: th.gold, backgroundColor: th.gold, borderDash: [4, 3], tension: .3, yAxisID: 'y3', hidden: true }] },
    options: { scales: { y: axis(th, { beginAtZero: true }), y2: axis(th, { position: 'right', grid: { display: false }, beginAtZero: true }), y3: { display: false }, x: axis(th, { grid: { display: false } }) } }
  }));
  recs('#rec-satis', [
    { t: 'ciro', h: 'Haziran sezonunu Nisan\'dan hazırla', p: 'Kurdele Haziran\'da Nisan\'a göre +%39 büyüdü. 2027 için Nisan sonuna kadar fiyonk ve saten kurdele stoğunu 1,5 katına çıkar; Mayıs\'ın 2. haftasından itibaren reklam bütçesini %50 artır.', w: 'Kurdele: Nis 437 B₺ → Haz 607 B₺.', i: 'Sezonda stoksuz kalınmazsa Haziran gibi bir ayda +80–120 B₺' },
    { t: 'ciro', h: 'Reklam bütçesini maliyet senaryosuna göre artır', p: `Ürün maliyetiniz %35'in altındaysa ana ürün reklamının günlük bütçesini 350 ₺ → 500 ₺ yap, 14 gün izle; toplam ROAS 7x'in üstünde kaldıkça 650 ₺'ye çık. Maliyet %40 civarındaysa bütçeyi artırmadan önce reklamı set ürünlere (389–499 ₺) yönlendir: sepet büyüdükçe başa baş ROAS 14x'ten 6–8x'e iner.`, w: `CPC ${TL(main ? main['Gerçekleşen TBM'] : 0.84, 2)}, toplam ROAS ${nf(main ? main['Harcama Getirisi'] : 9.1, 2)}x, TACoS %2,7.`, i: 'Aynı verimde +%40 reklam cirosu ≈ ayda +25–30 B₺' },
    { t: 'ciro', h: 'Yükselen ürünlere ayrı reklam grubu', p: 'İncili Keten Fiyonk, Sakallı Dantel 15 cm, Likralı Dantel 3 cm ve Saten Kurdele 3 cm için ayrı ürün reklamı aç (her biri 100–150 ₺/gün). Tek ürüne bağlı reklam yapısını çeşitlendir.', w: 'Bu 4 model Tem–Ağu\'da Nis–May\'a göre 5–70 kat büyüdü.' },
    { t: 'kar', h: 'Performanssız reklamları hemen kapat', p: 'Bütçe atanıp hiç gösterim almayan (21 Nis ve 20 May 21:23) ve ROAS\'ı 3\'ün altında kalan (20 May 14:46, 2,75x) kurguları tekrarlama. Çoklu ürün reklamlarında ürün sayısını 3–4\'e indir.', w: 'Ürün Reklamları raporu.' },
    { t: 'kar', h: '"Diğer reklam" harcamasını görünür yap', p: `Toplam 140,7 B₺ harcamanın ~${KTL(other)}'si ürün reklamı ve Meta dışında. Reklam panelinden "Reklam Tipi" filtresiyle mağaza/marka reklamlarının raporunu indir, ROAS'ını ayrı ölç.`, w: 'Panel toplamı ile ürün raporu farkı.' },
    { t: 'ciro', h: 'Pazartesi ve öğle/gece saatlerine bütçe kaydır', p: 'Siparişlerin zirvesi Pazartesi ve 12–15 ile 21–24 saatleri. Kupon bildirimlerini Pazartesi 12:00\'de, hedef kitle kuponlarını Pazar akşamı başlat.', w: 'Gün × saat ısı haritası.' },
    { t: 'ciro', h: 'Ay sonu çukuruna kupon', p: 'Her ayın 25\'i–sonu arası 7 günlük hedef kitle kuponu (sepete ekleyenler) ile düşüşü doldur.', w: 'Ayın 25–30\'u günlük ortalamada −%25.', i: 'Çukurun yarısı dolarsa ayda +200–250 paket' },
    { t: 'kar', h: 'Komisyon artışını izle', p: 'Komisyon oranı Nisan %16,9 → Ağustos %20,4. Kategori komisyon tarifelerini ve "komisyon indirimli kampanya" tekliflerini her ay kontrol et. Kampanyaya ürün eklerken indirim + komisyon toplamını hesapla.', w: 'Satış raporu toplam komisyon / net ciro.' },
    { t: 'kar', h: 'Müşteri iptallerini azalt', p: '1.466 adet müşteri iptali var (tüm iptal/iade nedenlerinin en büyüğü). Siparişi aynı gün kargolamak iptal penceresini kapatır. Ürün başlığına metre, genişlik ve adet bilgisini ilk 40 karakterde yaz.', w: 'İptal nedenleri, 6 ay.' },
    { t: 'kar', h: '"Teslim edilemeyen gönderi" için adres kontrolü', p: '428 adet teslim edilemedi. Eksik adresli siparişlerde müşteriye Trendyol mesajıyla hızlı teyit iste. Bu gönderiler çift kargo maliyeti yaratır.', w: 'İade nedenleri.' },
    { t: 'kar', h: 'Ebat kaynaklı iadeleri ölçü görseliyle önle', p: '"Beden/ebat küçük/büyük geldi" 244 adet. Dantel, vatka ve lastik ürünlerine cetvelli ölçü görseli ekle (cm ve metre). Ürün sayfasına "kaç metre gerekir?" kısa rehberi koy.', w: 'İade nedenleri.' },
    { t: 'ciro', h: 'İstanbul, Ankara, İzmir\'e hızlı teslimat vurgusu', p: 'Paketlerin %40\'ı bu üç ilden. Bu illerde "yarın kapında" / hızlı teslimat etiketinin aktif olduğundan emin ol. Bu etiket dönüşümü artırır.', w: 'İl dağılımı.' },
    { t: 'ciro', h: 'Haziran zirvesinde iade kalitesini koru', p: 'Haziran\'da iade oranı %5,7\'ye çıktı (hacim +%60). Zirve dönemlerde ek paketleme personeli ve çift kontrol (renk/barkod) uygula.', w: 'Operasyon raporu.' },
    { t: 'ikisi', h: 'Güpür ve El İşi kategorilerinde iade sorununu çöz', p: 'Güpür (%3,7 ort.), El İşi (Haz %7,4) ve Paketleme (Haz %10,3) iade oranları yüksek. Ürün görsellerini gerçek renkte yeniden çek; "görsel ile uyuşmuyor" riskini azalt.', w: 'Kategori iade oranları.' },
    { t: 'ciro', h: 'Dantel kategorisini ikinci ana ayak yap', p: 'Dantel istikrarlı (aylık 190–240 B₺), ortalama fiyatı yüksek (~200 ₺), iade oranı makul. Kurdele bağımlılığını azaltmak için dantelde 3–5 yeni model ve renk genişletmesi yap.', w: 'Kategori trendi.' },
    { t: 'ciro', h: 'Eylül–Ekim sonbahar dikiş sezonu için lastik ve vatka', p: 'Paça-bel lastiği ve omuz vatkaları okul/sonbahar tadilat döneminde istikrarlı. Vatka 2\'li set ve lastik kiti ile Ekim\'de reklam yap.', w: 'Dikiş Makinesi Aksesuarı aylık 50–100 B₺.' },
    { t: 'ikisi', h: 'Trendyol kampanyalarına seçici katıl', p: 'Efsane Kasım ve Yılbaşı kampanyalarına yalnızca kargo baremini aşan setlerle (350 ₺+) katıl. Tekil 139 ₺ ürünlerde ek indirim, zarar eden siparişi büyütür.', w: 'Katkı payı eğrisi (Kârlılık sekmesi).' },
    { t: 'ciro', h: 'Ürün başlıklarında arama niyetini yakala', p: '"Nikah şekeri kurdele", "çeyiz bohça kurdelesi", "hediye paketi fiyonk" gibi kullanım amaçlı kelimeleri başlığa ve etiketlere ekle. Fiyonk ürünlerinde bu kelimeler zaten çalışıyor, diğer kurdelelere yay.', w: 'En çok satan ürün başlıkları.' }
  ]);
}
function spark(arr) {
  const w = 90, h = 22, mx = Math.max(...arr, 1);
  const pts = arr.map((v, i) => `${(i / (arr.length - 1) * w).toFixed(1)},${(h - 2 - v / mx * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.6"/></svg>`;
}
