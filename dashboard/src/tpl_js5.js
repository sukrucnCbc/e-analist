// ================= SEPET =================
function buildSepet() {
  const single = D.upt_dist['1'] / T.pk * 100;
  $('#kpi-sepet').innerHTML = [
    { code: 'AOV', l: 'Ortalama Sepet', v: TL(AOV, 1), n: 'Tekrar eden müşteride ' + TL(D.cust.aov_rep, 0), tip: 'aov' },
    { code: 'UPT', l: 'Paket Başına Adet', v: nf(UPT, 2), n: `Tek adetlik paket %${nf(single, 0)}`, s: 'warn', tip: 'upt' },
    { code: 'X-SELL', l: 'Çok Modelli Sepet', v: P(MULTI_MODEL), n: 'Farklı ürün ailesi içeren paket', s: 'bad', tip: 'models' },
    { code: 'COLOR', l: 'Çok Renkli Sepet', v: P(D.multicolor.pk_same_model_multi / T.pk * 100), n: `${nf(D.multicolor.pk_same_model_multi)} paket aynı modelden 2+ renk`, s: 'good', tip: 'multicolor' },
    { code: '<200', l: '200 ₺ Altı Sepet', v: P(UNDER200, 0), n: `Kargo 40,99 ₺ · ${nf(D.cliff.n_180_200)} paket 180–199 ₺'de`, s: 'warn', tip: 'hist' },
    { code: '350+', l: '350 ₺ Üstü Sepet', v: P(D.aov_bins.slice(6).reduce((a, b) => a + b.n, 0) / T.pk * 100, 0), n: 'En kârlı dilim, büyütülecek hedef', s: 'good', tip: 'bins' }
  ].map(kpi).join('');
  chart('c-upt', th => ({ type: 'bar', data: { labels: Object.keys(D.upt_dist).map(k => k === '8' ? '8+' : k), datasets: [{ data: Object.values(D.upt_dist), backgroundColor: th.teal, borderRadius: 4 }] }, options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => ` ${nf(x.raw)} paket (%${nf(x.raw / T.pk * 100, 1)})` } } }, scales: { y: axis(th), x: axis(th, { grid: { display: false }, title: { display: true, text: 'adet', color: th.muted } }) } } }));
  chart('c-models', th => ({ type: 'bar', data: { labels: Object.keys(D.models_dist).map(k => k === '5' ? '5+' : k), datasets: [{ data: Object.values(D.models_dist), backgroundColor: Object.keys(D.models_dist).map(k => k === '1' ? th.accent : th.teal), borderRadius: 4 }] }, options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => ` ${nf(x.raw)} paket (%${nf(x.raw / T.pk * 100, 1)})` } } }, scales: { y: axis(th), x: axis(th, { grid: { display: false }, title: { display: true, text: 'farklı model', color: th.muted } }) } } }));
  table('#tb-pairs', ['Ürün A', 'Ürün B', 'Ortak paket', 'Destek', 'Güven A→B', 'Güven B→A', 'Lift', 'Öneri'],
    D.pairs.slice(0, 30).map(r => [esc(r.an), esc(r.bn), nf(r.n), P(r.sup, 2), P(r.conf_ab), P(r.conf_ba), `<span class="pill ${r.lift >= 3 ? 'good' : r.lift >= 1 ? 'neu' : 'bad'}">${nf(r.lift, 1)}</span>`, r.lift >= 3 ? 'Set yap' : r.lift >= 1.2 ? 'Çapraz öner' : 'Hacimden kaynaklı: öneri yeterli']), [2, 3, 4, 5, 6]);
  table('#tb-catpairs', ['Kategori A', 'Kategori B', 'Paket', 'A→B', 'B→A', 'Lift'], D.cat_pairs.filter(r => r.a !== 'Diğer' && r.b !== 'Diğer').slice(0, 14).map(r => [r.a, r.b, nf(r.n), P(r.conf_ab), P(r.conf_ba), `<span class="pill ${r.lift >= 1.5 ? 'good' : 'neu'}">${nf(r.lift, 2)}</span>`]), [2, 3, 4, 5]);
  table('#tb-mc', ['Model', 'Çok renkli paket', 'Modelin paketlerine oranı'], D.multicolor_models.map(r => [esc(r.name), nf(r.n), P(r.share)]), [1, 2]);
  const B = [
    ['Vatka Siyah + Beyaz 3 cm · 2\'li', 'Omuz Vatkası 3 cm Siyah + Beyaz', '216 ortak paket · beyaz alanların %34\'ü siyahı da aldı · lift 9,0', '179 ₺', '<200 ₺, kargo 40,99 ₺ sabit', 'Tek vatka alanı 2\'liye taşı (UPT +1)'],
    ['Vatka 4\'lü Karma (2 ebat × 2 renk)', '2 cm + 3 cm, siyah ve beyaz', '1–2–3 cm arası lift 3–16 · Reglan siyah+beyaz lift 134', '339 ₺', '200–349 dilimi, kargo payı %23', 'Terzi ve atölye müşterisi'],
    ['Fiyonk 3 Renk Karışık Set', 'Fiyonk Saten Kurdele 50\'li × 3 renk', '355 pakette birden fazla fiyonk rengi · en çok satan ürün', '389 ₺ (tekil 417 ₺)', '350+ dilim, ürün başı kargo 41 → 31 ₺', 'Nikah şekeri, kına, düğün organizasyonu'],
    ['Kopanaki 3 Genişlik Seti', 'Kopanaki 0,8 cm + 1,6 cm + No:405 (10\'ar m)', '1013↔8383: 91 paket, lift 4,6 · 405↔1013 lift 2,7', '499 ₺ (tekil 524 ₺)', '350+ dilim, kargo payı %19', 'Çeyiz, havlu kenarı, bohça'],
    ['Biye İkilisi', 'Pamuk Biye Siyah 25 m + Ekose Biye 25 m', 'Ekose alanların %39\'u pamuk biye de aldı · lift 8,4', '389 ₺ (tekil 410 ₺)', '350+ dilim', 'Dikiş/önlük/örtü kenar'],
    ['Dikiş Lastik Kiti', 'Paça-bel 1 cm + 2 cm + Bebe lastiği (beyaz)', '2 cm↔1 cm: 59 paket, lift 7,2 · bebe↔1 cm lift 3,8', '379 ₺ (tekil 401 ₺)', '350+ dilim', 'Tadilat, eşofman, pijama'],
    ['Bebe Lastiği Beyaz + Siyah', 'Oluklu Bebe Lastiği 20 m × 2 renk', 'Siyah alanların %54\'ü beyazı da aldı · lift 44', '279 ₺', '200–349 dilimi', 'Hazır renk ikilisi'],
    ['Saten Kurdele 1 cm 5\'li Renk Paketi', '5 farklı renk × 10 m', 'Satır başına ortalama 4,1 adet alınıyor', '159 ₺', '<200 ₺, kargo 40,99 ₺', 'Hediye, bohça, çiçekçi'],
    ['Balıksırtı Şerit Ham + Siyah', 'Balıksırtı 1 cm (veya 2 cm) × 2 renk', 'Renk çiftlerinde lift 40–70', '169 ₺', '<200 ₺', 'Çanta, askı, dekorasyon'],
    ['Dantel Kombin', 'Likralı Dantel 18 cm + Sakallı Dantel 15 cm', 'Sakallı alanların %12\'si likralıyı da aldı · 39 paket', '369 ₺', '350+ dilim', 'Abiye/elbise tadilatı'],
    ['Yılbaşı Hediye Paketleme Kiti', 'Saten kurdele 3 cm + İncili fiyonk 20\'li + Simli monofil', 'Kurdele + Paketleme malzemesi 30 paket · İncili fiyonk yükselen', '349 ₺', '350 ₺\'nin hemen altı, kargo 78,99 ₺', 'Aralık hediye sezonu'],
    ['El İşi Başlangıç Seti', 'Örgü/Nakış kiti + 2 dekoratif şerit', 'Kit alanların %58–70\'i şerit de aldı · lift 7–8,7', 'Kit + 99 ₺', 'Sepeti 350 ₺ üstüne taşır', 'Hobi, hediye']
  ];
  table('#tb-bundles', ['Set adı', 'İçerik', 'Veri kanıtı', 'Önerilen fiyat', 'Barem etkisi', 'Kitle / kullanım'], B, [], true);
  table('#tb-cross', ['Ürün sayfası', 'Önerilecek ürün', 'Güven'], [
    ['Ekose Koton Biye', 'Pamuk Koton Biye Siyah', '%38,9'], ['Omuz Vatkası Beyaz (tüm ebatlar)', 'Aynı ebat siyah vatka', '%25–45'], ['Oluklu Bebe Lastiği Siyah', 'Bebe Lastiği Beyaz', '%53,9'],
    ['Kopanaki 0,8 cm (8383)', 'Kopanaki 1,6 cm (1013)', '%18,7'], ['Paça-Bel Lastiği 2 cm', 'Yassı Lastik 1 cm', '%18,2'], ['Kopanaki 5 m (1023)', 'Kopanaki 10 m (1013 / 8383)', '%11–15'],
    ['Sakallı Dantel 15 cm', 'Likralı Dantel 18 cm', '%11,7'], ['Balıksırtı Şerit', 'Pamuk Koton Biye', '%13–15'], ['Örgü / Nakış kiti', 'Dekoratif Şerit', '%58–70 (kategori)'],
    ['Güpür ürünleri', 'Dantel (kopanaki)', '%16,2 (kategori)'], ['Fiyonk 50\'li', 'Saten Kurdele 1 cm (eşlik eden)', '78 paket'], ['Likralı Dantel 3 cm', 'Likralı Dantel 18 cm', '%7,9']
  ], [2], true);
  table('#tb-up', ['Mevcut alım', 'Önerilecek üst paket', 'Gerekçe'], [
    ['Fiyonk 50\'li (tekil 139 ₺)', '3 renk set 389 ₺ ya da 100\'lü paket', 'Ürün başı kargo 41 → 31 ₺'], ['Saten Kurdele 1 cm × 4 adet', '50 m top ya da 5\'li renk paketi', 'Satır başına ort. 4,1 adet'],
    ['Kopanaki 5 m', 'Kopanaki 10 m / 25 m paket (KOP250K\'yı yeniden aç)', '25 m paket 326 ₺, stoğu bitmiş'], ['Tek vatka', 'Vatka 2\'li / 4\'lü set', 'Renk ikilisi lift 9–134'],
    ['Paça lastiği 10 m', 'Yuvarlak lastik 50 m (302 ₺)', 'Atölye müşterisi'], ['İncili Fiyonk 20\'li', 'İncili Fiyonk 50\'li', 'Yükselen yıldız, ort. 1,6 adet'],
    ['Likralı Dantel 5 m', 'Likralı Dantel 10 m', 'Aynı müşteri 2 adet alıyor (%16 çok renk)'], ['Pamuk Biye 25 m', 'Biye ikilisi / 50 m', 'Biye alanların %35\'i çok renk']
  ], [], true);
  recs('#rec-sepet', [
    { t: 'ikisi', h: 'Set ürünleri ayrı listele', p: 'Yukarıdaki 12 seti ayrı barkodla aç. Trendyol\'da set ürünü, tekil ürünlerden ayrı arama sonucu ve ayrı yorum birikimi demek. Setlerin fiyatı tekil toplamın %5–8 altında olsun.', w: 'Birliktelik analizi (lift ≥3).', i: 'Sepetlerin %5\'i sete dönerse AOV +10–12 ₺' },
    { t: 'ikisi', h: '"Birlikte Al" (Çok Al Az Öde) kampanyası', p: 'Vatka, lastik, biye ve saten kurdelede "2. ürüne %15" kurgusu. Çok renkli alım zaten %8; bunu teşvik etmek ucuz.', w: '1.616 paket aynı modelden 2+ renk.' },
    { t: 'kar', h: 'Sepeti 350 ₺\'ye taşıyan eşik mesajı', p: 'Mağaza vitrininde ve ürün açıklamasında "3 ürün al, kargo başına daha az öde" mesajı yerine doğrudan 3\'lü set sun. Müşteri kargo ödemiyor; teşviki fiyat avantajı olmalı.', w: '350 ₺+ sepetlerde kargo payı %8–21.' },
    { t: 'ciro', h: 'Ürün görsellerine "birlikte kullanım" karesi ekle', p: 'Fiyonk + saten kurdele nikah şekeri, kopanaki + biye havlu kenarı, vatka + lastik tadilat gibi 2. ve 3. görselde tamamlayıcı ürünü göster. Bu, çapraz satışı görünür yapar.', w: 'Çok modelli sepet oranı yalnızca %11.' },
    { t: 'ciro', h: 'Mağaza vitrininde "Setler" koleksiyonu', p: 'Mağaza ziyaretçisinin %15\'i müşteriye dönüyor. Vitrinin ilk satırına setleri koy; mağaza sayfasından gelen siparişin ortalama sepeti yükselir.', w: 'Mağaza raporu: ziyaretçiden müşteriye %15.' },
    { t: 'kar', h: 'Küçük ürünleri "min. 2 adet" varyantla sat', p: 'Saten kurdele 1 cm (33 ₺), güpür 1 m (74 ₺), ponpon (54 ₺) tekil satıldığında kargo payı %28–45. Bu ürünleri 3\'lü/5\'li varyant olarak listele.', w: '<100 ₺ sepetlerde kargo payı %45.' },
    { t: 'ciro', h: 'Kupon alt limitini set fiyatının hemen altına koy', p: 'Setler 379–389 ₺ bandında. Kurdele/dantel Üründen Kazan kuponunu 350 ₺ alt limitle kur; set alan kuponu kullanır, tekil alan sete geçmeye teşvik edilir.', w: 'Kupon simülatörü (Kupon sekmesi).' },
    { t: 'ciro', h: 'Stoğu biten 25 m kopanaki paketini geri getir', p: 'KOP250K 6 ayda 32,6 B₺ ciro yaptı (326 ₺ ortalama sepet), Ağustos\'tan beri listede yok. Büyük paket, en kârlı dilimde (350 ₺ civarı) satılıyor.', w: 'Ürün bazlı satış raporları.' },
    { t: 'ciro', h: 'Tekrar eden müşteriye "tamamlayıcı ürün" kuponu', p: 'Tekrar eden müşterinin sepeti %38 daha büyük ve ortalama 9 gün sonra geri geliyor. İlk siparişten sonraki 7–14 gün içinde yorum yap kazan / hedef kitle kuponunu tamamlayıcı kategoriye bağla.', w: 'Tekrar alım aralığı medyan 9 gün.' },
    { t: 'kar', h: 'Fiyonk müşterisini saten kurdeleyle eşleştir', p: 'Fiyonk + Saten 1 cm 78 pakette birlikte. Fiyonk sayfasına "nikah şekeri kurdelesi" olarak Saten 1 cm 5\'li paket öner; sepet 139 → 298 ₺.', w: 'Birliktelik: 78 ortak paket.' },
    { t: 'ciro', h: 'Kategori köprüsü: Güpür ↔ Dantel', p: 'Güpür alanların %16\'sı dantel de alıyor. Güpür ürün sayfalarında kopanaki önerisi ve "çeyiz kenar seti" (güpür + kopanaki) kur.', w: 'Kategori birliktelikleri.' },
    { t: 'ikisi', h: 'Sepet raporunu aylık izle', p: 'Bu sekmedeki UPT, çok modelli sepet oranı ve 350 ₺+ sepet payı her ay güncellenmeli. Hedef: 3 ayda çok modelli sepet %11 → %16, 350 ₺+ pay %16 → %22.', w: 'Mevcut değerler.' }
  ]);
}
