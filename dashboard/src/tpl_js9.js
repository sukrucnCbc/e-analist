
// ================= AI ASİSTAN =================
// Şimdilik yalnızca arayüz: her istek "test aşamasında" yanıtı alır. Arka uç sonra bağlanacak.
// dashboard/src/asistan.png varsa build.py onu buraya gömer ve küre yerine o görsel kullanılır.
const ASISTAN_IMG = /*ASISTAN_IMG*/'';
const AI_SOON = 'Bu özellik henüz <b>test aşamasında</b>, çok yakında hazır olacak. Şimdilik paneldeki sekmelerden ilgili analizlere göz atabilirsiniz.';

(function aiAssistant() {
  const fab = $('#ai-fab'), panel = $('#ai-panel'), msgs = $('#ai-msgs'), body = $('#ai-body'), input = $('#ai-q');
  if (ASISTAN_IMG) document.querySelectorAll('.orb').forEach(o => { o.classList.add('img'); o.style.setProperty('--orb-img', `url("${ASISTAN_IMG}")`); });
  let busy = false;

  function open() {
    panel.hidden = false; panel.classList.remove('closing');
    fab.setAttribute('aria-expanded', 'true'); fab.setAttribute('aria-label', 'AI asistanı kapat');
    setTimeout(() => input.focus(), 50);
  }
  function close() {
    if (panel.hidden) return;
    fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-label', 'AI asistanı aç');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { panel.hidden = true; return; }
    panel.classList.add('closing');
    panel.addEventListener('animationend', () => { if (panel.classList.contains('closing')) panel.hidden = true; }, { once: true });
  }
  fab.addEventListener('click', () => {
    fab.classList.remove('pop'); void fab.offsetWidth; fab.classList.add('pop');
    panel.hidden || panel.classList.contains('closing') ? open() : close();
  });
  fab.addEventListener('animationend', e => { if (e.animationName === 'ai-pop') fab.classList.remove('pop'); }, true);
  $('#ai-close').addEventListener('click', () => { close(); fab.focus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden && !panel.classList.contains('closing')) { close(); fab.focus(); } });

  function add(html, who) {
    const el = document.createElement('div');
    if (who === 'me') { el.className = 'ai-msg me'; el.textContent = html; msgs.append(el); }
    else {
      el.className = 'ai-row';
      el.innerHTML = `<span class="orb sm${ASISTAN_IMG ? ' img' : ''}" aria-hidden="true"${ASISTAN_IMG ? ` style="--orb-img:url('${ASISTAN_IMG}')"` : ''}></span><div class="ai-msg bot">${html}</div>`;
      msgs.append(el);
    }
    body.scrollTop = body.scrollHeight;
    return el;
  }
  function ask(q) {
    q = q.trim(); if (!q || busy) return;
    busy = true;
    $('#ai-hello').hidden = true; panel.classList.add('chatting');
    add(q, 'me');
    const typing = add('<span class="ai-dots" aria-label="Yazıyor"><i></i><i></i><i></i></span>', 'bot');
    setTimeout(() => { typing.querySelector('.ai-msg').innerHTML = AI_SOON; body.scrollTop = body.scrollHeight; busy = false; }, 900);
  }
  $('#ai-opts').addEventListener('click', e => { const b = e.target.closest('.ai-opt'); if (b) ask(b.textContent.trim() + ': ' + b.dataset.q); });
  $('#ai-form').addEventListener('submit', e => { e.preventDefault(); ask(input.value); input.value = ''; });
  panel.querySelectorAll('[data-soon]').forEach(b => b.addEventListener('click', () => ask(b.getAttribute('aria-label'))));
})();
