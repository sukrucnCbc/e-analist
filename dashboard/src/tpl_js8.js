
// ================= RAPORLAR =================
// Rapor doluluk takvimi. Veri: D.coverage (panel üretilirken gömülü) → panel.py açıksa /api/coverage ile canlı.
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const AYTAM = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const RP_MONTHLY = ['sales', 'orders', 'distribution'];  // dönemi dosya adından alan raporlar: ay seçilir
const RP_ADS = { key: 'ads', label: 'Ürün reklamları', where: 'Reklam → Ürün Reklamları → Excel' };
const RP = { cov: D.coverage || null, live: false, year: null, pending: [], polling: false };

async function rpApi(path, opts = {}) {
  const r = await fetch(path, Object.assign({}, opts, { headers: Object.assign({ 'X-Panel': '1' }, opts.headers || {}) }));
  let j = {}; try { j = await r.json(); } catch (e) { }
  if (!r.ok) throw new Error(j.error || `Sunucu hatası (${r.status})`);
  return j;
}
const rpTypes = () => (RP.cov ? RP.cov.types : []);
const rpToday = () => (RP.cov ? RP.cov.today : new Date().toISOString().slice(0, 10));
const ymOf = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
const ymLabel = ym => `${AYTAM[+ym.slice(5) - 1]} ${ym.slice(0, 4)}`;
const typeLabel = k => (rpTypes().find(t => t.key === k) || RP_ADS).label;

// 0 → kırmızı, 0,5 → sarı, 1 → koyu yeşil
function covColor(v) {
  return v <= 0.5 ? `color-mix(in oklab, var(--cov-50) ${Math.round(v / 0.5 * 100)}%, var(--cov-0))`
    : `color-mix(in oklab, var(--cov-100) ${Math.round((v - 0.5) / 0.5 * 100)}%, var(--cov-50))`;
}
function monthState(ym) {
  if (ym > rpToday().slice(0, 7)) return null;  // gelecek ay
  const m = (RP.cov && RP.cov.months[ym]) || {};
  const parts = rpTypes().map(t => ({ t, v: m[t.key] ? m[t.key].v : 0, r: m[t.key] }));
  return { parts, score: parts.length ? parts.reduce((a, p) => a + p.v, 0) / parts.length : 0 };
}
function partText(p) {
  if (!p.r) return 'yok';
  if (p.t.key === 'orders' && p.v < 1) return `ayın ${p.r.d}. gününe kadar`;
  if (p.t.key === 'store' && p.v < 1) return `${p.r.n} gün`;
  return 'tam';
}

function renderRaporlar() {
  const cov = RP.cov;
  const years = cov ? cov.years : [new Date().getFullYear()];
  if (!RP.year || !years.includes(RP.year)) RP.year = +rpToday().slice(0, 4);
  $('#rp-years').innerHTML = years.map(y => `<button type="button" data-y="${y}" aria-pressed="${y === RP.year}">${y}</button>`).join('');

  if (!cov) {
    $('#rp-grid').innerHTML = '<p class="rl" style="grid-column:1/-1">Doluluk bilgisi yok. Panel veritabanından üretilmediyse <code>python guncelle.py</code> çalıştırın ya da paneli <code>python panel.py</code> ile açın.</p>';
    return;
  }
  const pend = new Set(RP.pending.filter(p => p.period).map(p => p.type + '|' + p.period));
  const y = RP.year;
  let h = '<span></span>' + AY.map(a => `<span class="mh">${a}</span>`).join('');
  h += '<span class="rl main">Tüm raporlar</span>';
  for (let m = 0; m < 12; m++) {
    const ym = ymOf(y, m), s = monthState(ym);
    if (!s) { h += `<button type="button" class="rp-cell big future" data-ym="${ym}" aria-label="${ymLabel(ym)}: henüz gelmedi" tabindex="-1"></button>`; continue; }
    const full = s.parts.filter(p => p.v >= 0.999).length;
    const fg = s.score > 0.28 && s.score < 0.78 ? '#1C1A24' : '#fff';
    h += `<button type="button" class="rp-cell big" data-ym="${ym}" style="--c:${covColor(s.score)};--fg:${fg}" aria-label="${ymLabel(ym)}: ${full}/${s.parts.length} rapor tam">${full}/${s.parts.length}</button>`;
  }
  h += '<span class="gap"></span>';
  rpTypes().forEach(t => {
    h += `<span class="rl">${esc(t.label)}</span>`;
    for (let m = 0; m < 12; m++) {
      const ym = ymOf(y, m), s = monthState(ym);
      if (!s) { h += `<button type="button" class="rp-cell future" tabindex="-1" aria-hidden="true"></button>`; continue; }
      const p = s.parts.find(x => x.t.key === t.key);
      const ring = pend.has(t.key + '|' + ym) ? ';outline:2px dashed var(--accent);outline-offset:1px' : '';
      h += `<button type="button" class="rp-cell" data-ym="${ym}" data-t="${t.key}" style="--c:${covColor(p.v)}${ring}" aria-label="${ymLabel(ym)} · ${esc(t.label)}: ${partText(p)}"></button>`;
    }
  });
  $('#rp-grid').innerHTML = h;

  // özet kartları: seçili yılın gelmiş ayları
  const past = [...Array(12).keys()].map(m => monthState(ymOf(y, m))).filter(Boolean);
  const cells = past.flatMap(s => s.parts);
  const fullM = past.filter(s => s.score >= 0.999).length;
  const missing = cells.filter(p => p.v === 0).length, partial = cells.filter(p => p.v > 0 && p.v < 0.999).length;
  const avg = cells.length ? cells.reduce((a, p) => a + p.v, 0) / cells.length * 100 : 0;
  const when = cov.last_sync ? new Date(cov.last_sync).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '–';
  $('#kpi-rapor').innerHTML = [
    kpi({ l: `${y} doluluğu`, v: P(avg, 0), n: `${past.length} ayın ${past.length * rpTypes().length} rapor kutusu`, s: avg >= 90 ? 'good' : avg >= 50 ? 'warn' : 'bad' }),
    kpi({ l: 'Tam aylar', v: `${fullM} <small>/ ${past.length}</small>`, n: 'Tüm aylık raporları dolu' }),
    kpi({ l: 'Eksik rapor', v: nf(missing), n: partial ? `+ ${partial} kısmi rapor` : 'kısmi rapor yok', s: missing ? 'bad' : 'good' }),
    kpi({ l: 'Son yükleme', v: `<span style="font-size:17px">${when}</span>`, n: RP.live ? 'Supabase · canlı' : 'Panel üretildiği andaki durum' }),
  ].join('');

  const ads = cov.ads || {};
  $('#rp-ads').innerHTML = ads.last_upload
    ? `<p style="margin:0">Supabase'de <b>${nf(ads.campaigns)}</b> kampanya · son yükleme <b>${new Date(ads.last_upload).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</b></p>`
    : '<p style="margin:0">Henüz yüklenmedi.</p>';

  $('#rp-pending-card').hidden = !RP.pending.length;
  $('#rp-pending').innerHTML = RP.pending.map(p => `<li><b>${esc(typeLabel(p.type))}</b>${p.period ? ' · ' + ymLabel(p.period) : ''} · ${nf(p.rows)} satır <span class="mono" style="color:var(--faint)">${esc(p.file)}</span></li>`).join('');
}

function rpStatus(msg, cls = '') {
  const el = $('#rp-status'); el.hidden = !msg; el.className = 'rp-status ' + cls; el.innerHTML = msg || '';
}
function rpSetLive(on) {
  RP.live = on;
  $('#rp-import').disabled = !on; $('#rp-sync').disabled = !on || RP.polling;
}

async function rpLoad() {
  if (location.protocol === 'file:') {
    rpSetLive(false);
    rpStatus('Rapor içe aktarma ve senkronizasyon için paneli <b>python panel.py</b> komutuyla açın. Bu dosya doğrudan açıldığında takvim, panelin üretildiği andaki durumu gösterir.');
    return;
  }
  try {
    const c = await rpApi('/api/coverage');
    RP.pending = c.pending || []; RP.cov = c; rpSetLive(true);
    const s = await rpApi('/api/sync');
    if (s.running) rpPoll(); else rpStatus('');
  } catch (e) {
    rpSetLive(false);
    rpStatus(`Canlı veri alınamadı: ${esc(e.message)}`, 'err');
  }
  renderRaporlar();
}

// ---------- hücre ipucu ----------
function rpTip(cell) {
  const ym = cell.dataset.ym, s = ym && monthState(ym); if (!s) return;
  const rows = (cell.dataset.t ? s.parts.filter(p => p.t.key === cell.dataset.t) : s.parts)
    .map(p => `<span style="display:flex;justify-content:space-between;gap:14px"><span>${p.v >= 0.999 ? '✓' : p.v > 0 ? '◐' : '✕'} ${esc(p.t.label)}</span><b>${partText(p)}</b></span>`).join('');
  const act = s.score < 0.999 ? `<span class="t-w">${RP.live ? 'Eksik raporu yüklemek için tıklayın.' : 'Yüklemek için paneli python panel.py ile açın.'}</span>` : '';
  tip.innerHTML = `<span class="t-h">${ymLabel(ym)} · %${nf(s.score * 100)}</span>${rows}${act}`;
  tip.hidden = false;
  const r = cell.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  let x = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), innerWidth - w - 12);
  let yy = r.bottom + 8; if (yy + h > innerHeight - 8) yy = r.top - h - 8;
  tip.style.left = x + 'px'; tip.style.top = Math.max(8, yy) + 'px';
}

// ---------- içe aktarma penceresi ----------
function rpOpen(type, ym) {
  if (!RP.live) { rpStatus('Rapor yüklemek için paneli <b>python panel.py</b> komutuyla açın.', 'err'); return; }
  const types = [...rpTypes(), RP_ADS];
  $('#rp-type').innerHTML = types.map(t => `<option value="${t.key}">${esc(t.label)}</option>`).join('');
  const now = rpToday();
  const years = [...new Set([...(RP.cov ? RP.cov.years : []), +now.slice(0, 4) - 1, +now.slice(0, 4)])].sort();
  $('#rp-year').innerHTML = years.map(y => `<option>${y}</option>`).join('');
  $('#rp-month').innerHTML = AYTAM.map((a, i) => `<option value="${i + 1}">${a}</option>`).join('');
  ym = ym || now.slice(0, 7);
  $('#rp-type').value = type || 'sales';
  $('#rp-year').value = ym.slice(0, 4); $('#rp-month').value = String(+ym.slice(5));
  $('#rp-file').value = ''; $('#rp-msg').textContent = ''; $('#rp-msg').className = 'rp-msg';
  rpTypeChanged();
  $('#rp-dialog').showModal();
}
function rpTypeChanged() {
  const k = $('#rp-type').value, t = [...rpTypes(), RP_ADS].find(x => x.key === k);
  $('#rp-period-row').hidden = !RP_MONTHLY.includes(k);
  $('#rp-where').textContent = (t ? `Trendyol: ${t.where}. ` : '') + (RP_MONTHLY.includes(k) ? 'Hangi aya ait olduğunu seçin.' : 'Tarihler dosyanın içinden okunur.');
}
async function rpUpload(e) {
  e.preventDefault();
  const f = $('#rp-file').files[0], msg = $('#rp-msg');
  if (!f) { msg.textContent = 'Bir Excel dosyası seçin.'; msg.className = 'rp-msg err'; return; }
  const type = $('#rp-type').value;
  const period = RP_MONTHLY.includes(type) ? `${$('#rp-year').value}-${String($('#rp-month').value).padStart(2, '0')}` : '';
  $('#rp-send').disabled = true; msg.className = 'rp-msg'; msg.textContent = 'Dosya kontrol ediliyor…';
  try {
    const r = await rpApi(`/api/upload?type=${type}&period=${period}`, { method: 'POST', body: f, headers: { 'X-Filename': encodeURIComponent(f.name) } });
    RP.pending.push(r);
    $('#rp-dialog').close();
    rpStatus(`<b>${esc(typeLabel(r.type))}${r.period ? ' · ' + ymLabel(r.period) : ''}</b> eklendi (${nf(r.rows)} satır okundu)${r.archived.length ? `; önceki dosya <span class="mono">data/raw/_arsiv</span> klasörüne taşındı` : ''}. Supabase'e yazmak için <b>Senkronize et</b>.`, 'ok');
    renderRaporlar();
  } catch (err) {
    msg.textContent = err.message; msg.className = 'rp-msg err';
  } finally {
    $('#rp-send').disabled = false;
  }
}

// ---------- senkronizasyon ----------
async function rpSync() {
  try { await rpApi('/api/sync', { method: 'POST' }); rpPoll(); }
  catch (e) { rpStatus(esc(e.message), 'err'); }
}
async function rpPoll() {
  RP.polling = true; rpSetLive(RP.live);
  let s;
  while (true) {
    try { s = await rpApi('/api/sync'); } catch (e) { rpStatus(`Sunucuya ulaşılamadı: ${esc(e.message)}`, 'err'); break; }
    const last = (s.log || '').split('\n').filter(l => l.startsWith('>>')).pop() || '>> Başlıyor';
    rpStatus(`Senkronize ediliyor: ${esc(last.slice(3))}… <span style="opacity:.75">(tüm siparişler dosyaları büyükse birkaç dakika sürebilir)</span>`, 'busy');
    if (!s.running) break;
    await new Promise(r => setTimeout(r, 1500));
  }
  RP.polling = false; rpSetLive(RP.live);
  if (!s) return;
  $('#rp-log-card').hidden = false; $('#rp-log').textContent = s.log || '';
  if (s.ok) {
    rpStatus('Senkronizasyon tamamlandı. Supabase güncellendi, panel yeniden üretildi. Sayfa yenileniyor…', 'ok');
    setTimeout(() => location.reload(), 1200);
  } else if (s.ok === false) {
    rpStatus('Senkronizasyon başarısız oldu. Ayrıntılar aşağıdaki kayıtta.', 'err');
    $('#rp-log-card').open = true;
  }
}

function buildRaporlar() {
  renderRaporlar();
  $('#rp-years').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { RP.year = +b.dataset.y; renderRaporlar(); } });
  const g = $('#rp-grid');
  g.addEventListener('mouseover', e => { const c = e.target.closest('.rp-cell'); if (c) rpTip(c); });
  g.addEventListener('mouseout', e => { const c = e.target.closest('.rp-cell'); if (c && !c.contains(e.relatedTarget)) hideTip(); });
  g.addEventListener('focusin', e => { const c = e.target.closest('.rp-cell'); if (c) rpTip(c); });
  g.addEventListener('focusout', hideTip);
  g.addEventListener('click', e => {
    const c = e.target.closest('.rp-cell'); if (!c || c.classList.contains('future')) return;
    const s = monthState(c.dataset.ym);
    const t = c.dataset.t || (s.parts.find(p => p.v < 0.999) || s.parts[0]).t.key;
    hideTip(); rpOpen(t, c.dataset.ym);
  });
  $('#rp-import').addEventListener('click', () => rpOpen());
  $('#rp-sync').addEventListener('click', rpSync);
  $('#rp-type').addEventListener('change', rpTypeChanged);
  $('#rp-form').addEventListener('submit', rpUpload);
  $('#rp-cancel').addEventListener('click', () => $('#rp-dialog').close());
  rpLoad();
}
