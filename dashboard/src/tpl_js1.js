const D = window.__DATA__;
const $ = s => document.querySelector(s);
const nf = (n, d = 0) => (n == null || isNaN(n)) ? '–' : Number(n).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
const TL = (n, d = 0) => nf(n, d) + ' ₺';
const KTL = n => Math.abs(n) >= 1e6 ? nf(n / 1e6, 2) + ' M₺' : nf(n / 1e3, 0) + ' B₺';
const P = (n, d = 1) => '%' + nf(n, d);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const MON = D.monthly;
const T = D.tot;
const ADS = D.ads_total;
const COMM_R = T.comm_o / T.net_o;             // sipariş bazlı komisyon oranı
const TACOS = ADS.spend / T.net_rev;           // reklam / net ciro
const SEGNAME = { Hero: 'Hero', Core: 'Core', Rising: 'Yükselen', 'Long Tail': 'Long Tail' };
const segCls = s => s === 'Long Tail' ? 'LongTail' : s;
const store = D.store;
const stAvg = k => store.reduce((a, r) => a + parseFloat(String(r[k]).replace('+', '').trim()), 0) / store.length;

// ---------------- Scenario ----------------
const S = { c: 0.40, k: 0.10, fee: 10.99, ads: true };
try { const s = JSON.parse(localStorage.getItem('akt-scen') || 'null'); if (s) Object.assign(S, s); } catch (e) { }
const cargo = v => v < 200 ? 40.99 : (v < 350 ? 78.99 : 93.05);
const cmOrder = v => v * (1 - S.c) / (1 + S.k) - COMM_R * v - cargo(v) - S.fee - (S.ads ? TACOS * v : 0);
function cmTotals(net, cg, cm, pk) {
  const vat = (net - S.c * net) * S.k / (1 + S.k);
  const cogs = S.c * net, fee = S.fee * pk, ads = S.ads ? TACOS * net : 0;
  const cmv = net - vat - cogs - cm - cg - fee - ads;
  return { net, vat, cogs, comm: cm, cargo: cg, fee, ads, cm: cmv, pct: cmv / net * 100 };
}
const cmAll = () => cmTotals(T.net_o, T.cargo_o, T.comm_o, T.pk);
const breakEvenC = () => { // maliyet oranı ki CM=0
  let lo = 0, hi = 1; const s0 = S.c;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; S.c = m; (cmAll().cm > 0 ? lo = m : hi = m); }
  const r = lo; S.c = s0; return r;
};

function scenControls(el) {
  el.innerHTML = `
  <div class="ctl"><span>Ürün maliyeti (satış fiyatının %) <button class="i" data-tip="cogs">i</button></span>
    <div style="display:flex;gap:8px;align-items:center"><div class="seg-btns" data-k="c">${[30, 40, 50].map(v => `<button type="button" data-v="${v / 100}">%${v}</button>`).join('')}</div>
    <input type="range" min="15" max="60" step="1" aria-label="Ürün maliyeti yüzdesi" data-k="cr"><span class="mono" data-out="c"></span></div></div>
  <div class="ctl"><span>KDV oranı <button class="i" data-tip="kdv">i</button></span><div class="seg-btns" data-k="k">${[0.10, 0.20].map(v => `<button type="button" data-v="${v}">%${v * 100}</button>`).join('')}</div></div>
  <div class="ctl"><span>Platform hizmet bedeli <button class="i" data-tip="fee">i</button></span><div class="seg-btns" data-k="fee">${[6.99, 10.99].map(v => `<button type="button" data-v="${v}">${nf(v, 2)} ₺</button>`).join('')}</div></div>
  <div class="ctl"><span>Reklamı dahil et <button class="i" data-tip="adsin">i</button></span><div class="seg-btns" data-k="ads"><button type="button" data-v="1">Evet</button><button type="button" data-v="0">Hayır</button></div></div>`;
  el.addEventListener('click', e => {
    const b = e.target.closest('.seg-btns button'); if (!b) return;
    const k = b.parentElement.dataset.k; let v = parseFloat(b.dataset.v); if (k === 'ads') v = v === 1;
    S[k] = v; scenChanged();
  });
  el.querySelector('input[data-k=cr]').addEventListener('input', e => { S.c = e.target.value / 100; scenChanged(); });
}
function syncScen() {
  document.querySelectorAll('.seg-btns').forEach(g => {
    const k = g.dataset.k; if (!k || !(k in S)) return;
    g.querySelectorAll('button').forEach(b => { let v = parseFloat(b.dataset.v); if (k === 'ads') v = v === 1; b.setAttribute('aria-pressed', String(Math.abs(v - S[k]) < 1e-9 || v === S[k])); });
  });
  document.querySelectorAll('input[data-k=cr]').forEach(i => i.value = Math.round(S.c * 100));
  document.querySelectorAll('[data-out=c]').forEach(o => o.textContent = '%' + Math.round(S.c * 100));
}
function scenChanged() {
  try { localStorage.setItem('akt-scen', JSON.stringify(S)); } catch (e) { }
  syncScen(); renderOzetKpis(); if (built.kar) renderKar(true); if (built.ozet) rebuild('c-where');
  if (built.kupon) runSim();
}

// ---------------- Tooltips ----------------
const TIPS = {
  aov: ['AOV · Ortalama Sepet Tutarı', 'Paket cirosu ÷ paket sayısı (indirim ve kupon sonrası, KDV dahil). Nisan–Ağustos 19.982 paket.', 'Kargo ücreti sepet başına sabit. AOV 1 ₺ artınca kargo payı düşer, kâr artar. Sizde 200 ₺ ve 350 ₺ barem sınırları var; AOV\'yi bu basamaklara göre yönetmek gerekiyor.'],
  upt: ['UPT · İşlem Başına Ürün Adedi', 'Toplam satılan adet ÷ paket sayısı.', 'Aynı kargo kutusuna ikinci ürünün girmesi neredeyse ek kargo maliyeti getirmez. UPT lojistik verimliliğinin ana ölçüsüdür.'],
  cvr: ['CVR · Satışa Dönüşüm Oranı', 'Mağaza raporundaki "Mağazanın Satışa Dönüş Oranı" (16–22 Eylül ortalaması). Reklam tıklamasından satışa dönüşüm ayrıca gösterildi: 11.007 satış ÷ 141.168 tıklama.', 'Trafiği ikiye katlamak pahalıdır, dönüşümü %5\'ten %6\'ya çıkarmak ciroyu %20 artırır. Görsel, fiyat, yorum ve kupon görünürlüğü dönüşümü doğrudan etkiler.'],
  atc: ['ATC Rate · Sepete Ekleme Oranı', 'Sepete ekleyen ziyaretçi ÷ ürün ziyaretçisi. Yüklenen raporlarda bu alan yok.', 'Ürün sayfası mı, sepet/ödeme adımı mı sorunlu, onu ATC gösterir. Satıcı Paneli > Raporlar > Ürün/Trafik raporundan "sepete ekleme" sütunuyla indirin; bu panelde yeri hazır.'],
  cm: ['Contribution Margin · Katkı Payı', 'Net ciro − KDV (katma değer üzerinden) − ürün maliyeti − komisyon − kargo − platform hizmet bedeli − reklam. Formül: (Ciro − Maliyet)÷(1+KDV) − komisyon − kargo − hizmet bedeli − reklam.', 'Ciro büyürken kârın büyüyüp büyümediğini gösteren tek metrik. Kuponun, reklamın ve fiyatın "yapılır mı" kararı buna göre verilir.'],
  ret: ['Return Rate · İade Oranı', 'İade adedi ÷ brüt satış adedi (satış raporları, 6 ay). Kusurlu/yanlış ürün iadesi ayrıca operasyon raporundan.', 'Her iade çift yönlü kargo, işçilik ve bazen satılamaz ürün demek. İade oranı ürün sıralamasını ve Trendyol satıcı puanını da etkiler.'],
  roas: ['ROAS · Reklam Harcaması Getirisi', 'Reklam cirosu ÷ reklam harcaması (Trendyol "Harcama Getirisi"). Doğrudan + dolaylı satışlar dahil.', 'Maliyet %40 iken sipariş başı katkı payınız ince. Başa baş ROAS\'ın üzerinde kalan her reklamı ölçeklemek, altındakileri kesmek gerekir. Dolaylı satışlar tahmini olduğundan "doğrudan ROAS"a da bakın.'],
  acos: ['ACoS · Reklam Satış Maliyeti', 'Reklam harcaması ÷ reklam cirosu = 1 ÷ ROAS.', 'Reklamla gelen her 100 ₺ ciroya kaç ₺ ödediğinizi gösterir. Hedef ACoS = ürün başına reklam öncesi katkı payı %\'si; bunun üzeri zarar.'],
  tacos: ['TACoS · Toplam Reklam Satış Maliyeti', 'Reklam harcaması ÷ toplam net ciro (organik + reklam).', 'Reklama ne kadar bağımlı olduğunuzu gösterir. Reklam artarken TACoS sabit veya düşüyorsa reklam organik satışları da büyütüyor demektir.'],
  clv: ['CLV · Müşteri Yaşam Boyu Değeri (12 ay)', 'AOV × (1 + 12 ayda beklenen tekrar sipariş). 5 ayda müşteri başına 0,08 tekrar sipariş gözlendi → 12 ayda ~0,19.', 'Bir müşteriyi kazanmak için harcayabileceğiniz tavan tutarı belirler (kupon + reklam). CLV düşükse ilk siparişin kendisi kârlı olmalı.'],
  rpr: ['RPR · Tekrar Satın Alma Oranı', 'Nis–Ağu içinde 2+ sipariş veren müşteri ÷ tüm müşteriler. Müşteri, alıcı adı + il + ilçe ile eşlendi. Trendyol\'un "2. sipariş ve üzeri" etiketiyle de kontrol edildi.', 'Tekrar eden müşteri reklam ve kupon maliyeti olmadan gelir. Sizde tekrar eden müşterinin sepeti %38 daha büyük.'],
  oos: ['OOS · Stoksuz Kalma Oranı', '22 Eylül itibarıyla stoğu 0 olan aktif barkod ÷ tüm aktif barkodlar.', 'Stoksuz ürün satış kaybettirir ve Trendyol\'da listeleme sırası düşer. En çok satan renkler tükenirse kayıp katlanır.'],
  lead: ['Fulfillment Lead Time · Kargoya Verme Süresi', 'Sipariş → kargoya teslim süresi (medyan, saat) ve sipariş → müşteriye teslim (medyan, gün).', 'Hızlı teslimat etiketi, "Bugün Kargoda" ve düşük hizmet bedeli (6,99 ₺ yerine 10,99 ₺) buna bağlı. Algoritma hızlı satıcıyı öne çıkarır.'],
  trend: ['Aylık trend', 'Net ciro satış raporlarından, paket sayısı tüm siparişler dosyasından. Eylül raporu 22 gün kapsıyor.', 'Haziran sezon zirvesi. Sezonu önceden stok ve reklamla karşılamak gerekir.'],
  waterfall: ['1 ₺ cironun dağılımı', 'Nisan–Ağustos sipariş dosyasındaki gerçek kargo ve komisyon + seçili maliyet, KDV, hizmet bedeli ve reklam varsayımı.', 'Kâr kaçağının nerede olduğunu gösterir. Sizde en büyük kalem ürün maliyetinden sonra kargo.'],
  cat: ['Kategori payı', 'Kategori bazlı satış raporları (6 ay) toplandı.', 'Kurdele cironun yarısından fazlası. Risk ve fırsat aynı yerde.'],
  cattrend: ['Kategori trendi', 'Kategori bazlı net ciro, ay ay.', 'Hangi kategori sezonsal, hangisi istikrarlı? Stok ve reklam bütçesini buna göre kaydırın.'],
  wd: ['Haftanın günü etkisi', 'Nis–Ağu paketleri, sipariş tarihine göre.', 'Pazartesi en yüksek, Cumartesi en düşük gün (−%29). Reklam bütçesi ve kupon başlangıcı buna göre ayarlanmalı.'],
  dom: ['Ayın günü etkisi', 'Nis–Ağu paketlerinin ayın gününe göre toplamı (31. gün 3 ayda var).', 'Ay sonu (25–30) talep düşüyor, maaş/ay başı dönemi yükseliyor. Kuponları çukuru doldurmak için kullanın.'],
  heat: ['Gün × saat', 'Trendyol sipariş dağılım raporu (Nis–Eyl) toplamı.', 'Reklam gün içi zamanlama ve kupon bildirimlerinin saatini belirler.'],
  city: ['İl dağılımı', 'Paket sayısı, cirosu ve ortalama sepet.', 'Kargo süreleri ve bölgesel talep. İstanbul tek başına paketlerin dörtte biri.'],
  reasons: ['İptal/iade nedenleri', 'Satış raporlarındaki neden sütunları, 6 ay toplamı.', 'En büyük kalem müşteri iptali; kargoya hızlı verme ve net ürün açıklaması azaltır. "Beden/ebat" iadeleri ölçü bilgisi eksikliğine işaret eder.'],
  ops: ['Operasyon karnesi', 'Operasyon raporu, 12 ay.', 'Haziran\'daki iade sıçraması (%5,7) hacim artışıyla geldi; zirvede kalite kontrol şart.'],
  cmcurve: ['Sepet tutarına göre katkı payı', 'Seçili senaryoda tek bir paketin katkı payı: tutar×(1−maliyet)÷(1+KDV) − %18,6 komisyon − barem kargo − hizmet bedeli − reklam.', 'Eğrinin sıfırın altında kaldığı bölgelerdeki siparişler zarar ettirir. 200 ₺\'de kargo 41 ₺\'den 79 ₺\'ye çıkıyor.'],
  hist: ['Sepet dağılımı', 'Kupon/indirim sonrası paket tutarı. Barem, indirim SONRASI tutara göre uygulanıyor (verinizde doğrulandı: brüt ≥350 ₺, net <350 ₺ olan 171 paketin tamamı düşük baremden faturalanmış).', '130–140 ₺ ve 170–199 ₺ yığılmaları var, 200–249 ₺ neredeyse boş. Kuponları bu şekle göre kurmak gerekir.'],
  bins: ['Sepet dilimi ekonomisi', 'Her tutar diliminde ortalama kargo, komisyon ve katkı payı.', 'Hangi sepet büyüklüğü kâr ediyor, hangisi etmiyor? Kupon alt limitleri kârlı dilime itmeli.'],
  catcm: ['Kategori katkı payı', 'Kategorinin satış cirosu, siparişlerdeki gerçekleşen kargo payı ve komisyonuyla.', 'Reklam ve kupon bütçesini kâr eden kategoriye kaydırın.'],
  unitcm: ['Birim ekonomisi', 'Ortalama satış fiyatı, gerçekleşen komisyon ve ürünün paketlerindeki kargo payı ile.', 'Kargo payı %25\'i geçen ürünler tek başına satıldığında kâr etmez. Bunlar set/paket olarak satılmalı.'],
  moncm: ['Aylık katkı payı', 'Nisan–Ağustos sipariş dosyaları, seçili senaryo.', 'Hacim arttığında kâr da artıyor mu, kontrol edin.'],
  upt: ['UPT dağılımı', 'Paket başına toplam adet (Nis–Ağu).', 'Tek adetlik paketler en düşük kârlı gruptur.'],
  models: ['Farklı model sayısı', 'Bir pakette kaç farklı model (ürün ailesi) var.', 'Sepetlerin %89\'u tek model. Çapraz satış neredeyse hiç çalışmıyor; en büyük sepet fırsatı burada.'],
  pairs: ['Birliktelik analizi (Market Basket)', 'Destek = iki ürünün birlikte geçtiği paket ÷ tüm paketler. Güven A→B = ikisini birlikte alan ÷ A alan. Lift = gerçek birliktelik ÷ tesadüfen beklenen.', 'Lift 3\'ün üzerindeki çiftler hazır "Birlikte Al" setidir. Güven yüksekse ürün sayfasında öneri olarak gösterin.'],
  catpairs: ['Kategori birliktelikleri', 'Kategori düzeyinde aynı mantık.', 'Dantel + Güpür ve Dekoratif Şerit + Kit kategorileri birbirini tamamlıyor.'],
  multicolor: ['Çok renkli alımlar', 'Aynı modelin birden çok rengi/ebadı aynı pakette.', 'Müşteri zaten "renk seti" alıyor; hazır karışık renk seti ürünleri açın.'],
  funnel: ['Mağaza hunisi', 'Mağaza raporu 16–22 Eylül günlük ortalaması.', 'Mağaza sayfasına gelenin %24\'ü takipçi, %15\'i müşteri oluyor. Mağaza sayfası güçlü bir dönüşüm aracı.'],
  follow: ['Takipçi kazanımı', 'Mağaza raporu, günlük kazanılan ve kaybedilen takipçi.', 'Takipçi, Trendyol\'un ücretsiz bildirim (push) kitlesi. Her kampanya ve yeni ürün takipçiye bildirim olarak gider.'],
  gap: ['Tekrar alım aralığı', 'Aynı müşterinin art arda iki siparişi arasındaki gün (Nis–Ağu).', 'Medyan 9 gün: müşteri eksik malzemeyi hızla tamamlıyor. Yorum Yap Kazan ve hedef kitle kuponu ilk 2–4 haftada gönderilmeli.'],
  cohort: ['Kohort tablosu', 'İlk siparişini o ay veren müşterilerin sonraki aylarda tekrar sipariş verme oranı.', 'Tekrar oranı her ay %1–3 bandında. Sadakat kurgusu yok denecek kadar zayıf.'],
  age: ['Yaş dağılımı', 'Sipariş dağılım raporu, bilinenler (belirtilmemiş hariç).', 'Kitle ağırlıklı 19–39 yaş, kadın. Görsel dil ve reklam hedeflemesi buna göre.'],
  plus: ['Plus ve cinsiyet', 'Sipariş dağılım raporları toplamı.', 'Siparişlerin %56\'sı Trendyol Plus üyesinden. Plus\'a özel kupon/indirim bölgesi bu kitleye doğrudan ulaşır.'],
  newold: ['Yeni vs mevcut', 'Trendyol sipariş dağılım raporu: o ay "yeni müşteri" payı.', '%94 yeni müşteri: büyüme tamamen yeni müşteri kazanımına dayanıyor, bu pahalı ve kırılgan.'],
  topprod: ['En çok ciro', 'Model kodu bazında 6 aylık net ciro (tüm renkler toplamı).', 'İlk 5 model cironun yarısı. Bu ürünlerde stok, fiyat ve görsel hatasına tolerans yok.'],
  bubble: ['Fiyat × hacim', 'X: ortalama satış fiyatı, Y: net satış adedi (log ölçek).', 'Sağ üst = yüksek fiyat + yüksek hacim, yatırım önceliği.'],
  prodtable: ['Model tablosu', 'Büyüme = (Tem+Ağu ort.) ÷ (Nis+May ort.) − 1. Stok gün = güncel stok ÷ Eylül günlük satış.', 'Filtreleyin: stok günü düşük + büyüyen = acil tedarik; stok günü çok yüksek + düşen = eritme kampanyası.'],
  oos: ['Stoksuz barkodlar', 'Eylül satış raporunda güncel stoğu 0 olup Eylül\'de satışı olan barkodlar. Kayıp = günlük satış × ortalama fiyat.', 'Stoğu biten hero renkler her gün ciro kaybettiriyor.'],
  movers: ['Yükselen/düşen', 'Tem–Ağu ortalamasının Nis–May ortalamasına göre değişimi (ciro ≥ 20 B₺ olan modeller).', 'Yükselenlere reklam ve stok, düşenlere fiyat/görsel revizyonu.'],
  segshare: ['Segment payı', 'Segmentlerin model sayısı ve ciro payı.', 'Az sayıda ürün cironun çoğunu taşıyor; Long Tail ise çeşitlilik ve sepet tamamlayıcı rolünde.'],
  pareto: ['Pareto', 'Modeller ciroya göre sıralı, kümülatif pay.', 'Eğrinin dikliği bağımlılık riskini gösterir.'],
  rolematrix: ['Rol matrisi', 'Tek başına alınma oranı, çoklu sepet oranı, kargo payı ve büyümeye göre roller.', 'Trafik çeken ürün ile sepet dolduran ürün farklı yönetilir.'],
  sim: ['Kupon simülatörü', 'Gerçek 10 ₺\'lik sepet dağılımı. Alt limit üstündeki sepetlerin "kullanım" kadarı kuponu kullanır (maliyet). Alt limitin %70–100\'ü arasındaki sepetlerin "yükselme" kadarı limite çıkar (ek ciro). "Ek sipariş" kuponun dönüşüme etkisiyle gelen yeni siparişlerdir. Kargo baremi kupon sonrası tutara göre hesaplanır.', 'Bir kuponun kendini amorti etmesi için kaç ek sipariş gerektiğini gösterir. Varsayımları kupon raporlarınızdaki kazanılan/kullanılan sayılarıyla güncelleyin.'],
  budget: ['Bütçe dağılımı', 'Önerilen aylık kupon bütçesi: net cironun ~%2,5\'i, türlere göre bölünmüş.', 'Bütçe "adet × tutar" üst sınırıdır. Gerçek maliyet kullanım kadar oluşur.'],
  cogs: ['Ürün maliyeti', 'Alış/üretim maliyetinizin satış fiyatına oranı (KDV dahil fiyat üzerinden).', 'Raporlarda yok; senaryo olarak seçin. Tüm kâr metrikleri buna göre değişir.'],
  kdv: ['KDV', 'Tekstil/tuhafiye ürünlerinde oran genelde %10. Emin değilseniz muhasebecinize teyit ettirin.', 'KDV, alış ve satış arasındaki katma değer üzerinden hesaplanır.'],
  fee: ['Platform hizmet bedeli', 'Trendyol 2026: "Bugün Kargoda" etiketiyle aynı gün kargolanan paketlerde 6,99 ₺ + KDV, diğerlerinde 10,99 ₺ + KDV (paket başı).', 'Aynı gün kargoya vermek paket başı 4 ₺ kazandırır; ayda ~4.000 pakette ~16 B₺.'],
  adsin: ['Reklam maliyeti', 'Toplam reklam harcaması (140.694 ₺) cironun %2,7\'si olarak dağıtılır.', 'Reklam öncesi ve sonrası kârı ayrı ayrı görmek için kapatıp açın.']
};
const tip = $('#tip'); let tipFor = null;
function showTip(btn) {
  const t = TIPS[btn.dataset.tip]; if (!t) return;
  tip.innerHTML = `<span class="t-h">${esc(t[0])}</span>${esc(t[1])}<span class="t-w"><b>Neden önemli:</b> ${esc(t[2])}</span>`;
  tip.hidden = false; tipFor = btn; btn.setAttribute('aria-expanded', 'true');
  const r = btn.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  let x = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), innerWidth - w - 12);
  let y = r.bottom + 8; if (y + h > innerHeight - 8) y = r.top - h - 8;
  tip.style.left = x + 'px'; tip.style.top = Math.max(8, y) + 'px';
}
function hideTip() { tip.hidden = true; if (tipFor) tipFor.setAttribute('aria-expanded', 'false'); tipFor = null; }
document.addEventListener('mouseover', e => { const b = e.target.closest('.i'); if (b) showTip(b); });
document.addEventListener('mouseout', e => { const b = e.target.closest('.i'); if (b && !b.contains(e.relatedTarget)) hideTip(); });
document.addEventListener('focusin', e => { const b = e.target.closest('.i'); if (b) showTip(b); });
document.addEventListener('focusout', e => { if (e.target.closest('.i')) hideTip(); });
document.addEventListener('click', e => { const b = e.target.closest('.i'); if (b) { e.preventDefault(); tipFor === b ? hideTip() : showTip(b); } else if (!e.target.closest('#tip')) hideTip(); });
addEventListener('scroll', hideTip, { passive: true });

// ---------------- UI helpers ----------------
function kpi(o) {
  return `<div class="kpi ${o.s ? 's-' + o.s : ''}">
    <div class="lab"><span>${o.code ? `<span class="code">${o.code}</span> ` : ''}${o.l}</span>${o.tip ? `<button class="i" data-tip="${o.tip}" aria-label="${esc(o.l)} açıklaması">i</button>` : ''}</div>
    <div class="val">${o.v}</div>${o.n ? `<div class="note">${o.n}</div>` : ''}</div>`;
}
const TAGL = { ciro: 'Ciro', kar: 'Kâr', ikisi: 'Ciro + Kâr' };
function recs(el, arr) {
  $(el).innerHTML = arr.map(r => `<div class="rec"><div class="rh"><h4>${r.h}</h4><span class="tag ${r.t}">${TAGL[r.t]}</span></div><p>${r.p}</p>${r.w ? `<p class="why">Veri: ${r.w}</p>` : ''}${r.i ? `<div class="imp">Etki tahmini: ${r.i}</div>` : ''}</div>`).join('');
}
function table(el, head, rows, numCols = [], txt = false) {
  $(el).classList.toggle('txt', txt);
  $(el).innerHTML = `<thead><tr>${head.map((h, i) => `<th class="${numCols.includes(i) ? 'n' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${numCols.includes(i) ? 'n' : ''}${typeof c === 'string' && c.length > 70 ? ' wt' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
}
const pillGrowth = g => g == null ? '–' : g >= 900 ? '<span class="pill good">yeni ↑</span>' : `<span class="pill ${g > 10 ? 'good' : g < -10 ? 'bad' : 'neu'}">${g > 0 ? '+' : ''}${nf(g, 0)}%</span>`;

// ---------------- Charts ----------------
const charts = {}; const builders = {};
function theme() {
  return { ink: css('--ink'), muted: css('--muted'), line: css('--line'), accent: css('--accent'), teal: css('--teal'), gold: css('--gold'), good: css('--good'), bad: css('--bad'), faint: css('--faint'),
    hero: css('--hero'), core: css('--core'), rising: css('--rising'), tail: css('--tail'), surface: css('--surface'), soft: css('--accent-soft'), tealsoft: css('--teal-soft') };
}
function chart(id, fn) { builders[id] = fn; rebuild(id); }
function rebuild(id) {
  const el = document.getElementById(id); if (!el || !builders[id] || typeof Chart === 'undefined') return;
  if (charts[id]) charts[id].destroy();
  const th = theme();
  Chart.defaults.font.family = css('--body'); Chart.defaults.font.size = 11.5; Chart.defaults.color = th.muted; Chart.defaults.borderColor = th.line;
  const cfg = builders[id](th); cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 400 } }, cfg.options || {});
  cfg.options.plugins = Object.assign({ legend: { labels: { boxWidth: 10, boxHeight: 10, color: th.muted } }, tooltip: { backgroundColor: th.ink, titleColor: th.surface, bodyColor: th.surface, padding: 9, cornerRadius: 6 } }, cfg.options.plugins || {});
  charts[id] = new Chart(el, cfg);
}
const mq = matchMedia('(prefers-color-scheme: dark)');
const reAll = () => Object.keys(charts).forEach(rebuild);
mq.addEventListener ? mq.addEventListener('change', reAll) : mq.addListener(reAll);
new MutationObserver(reAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
const axis = (th, extra = {}) => Object.assign({ grid: { color: th.line, drawTicks: false }, border: { display: false }, ticks: { color: th.muted, padding: 6 } }, extra);
