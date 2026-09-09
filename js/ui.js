// js/ui.js
import { T, IS_EN, LANG } from './i18n.js';

const CONSENT_KEY = 'consent_v2';
const CONSENT_TTL = 365 * 24 * 60 * 60 * 1000; // 12 meses, conforme a política

/* ---------- Consent Mode v2 ---------- */

function gtagConsent(granted) {
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  const v = granted ? 'granted' : 'denied';
  gtag('consent', 'update', {
    ad_storage: v,
    ad_user_data: v,
    ad_personalization: v,
    analytics_storage: v
  });
}

function readConsent() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONSENT_KEY));
    if (!raw || !raw.v || Date.now() - raw.ts > CONSENT_TTL) return null;
    return raw.v;
  } catch { return null; }
}

function saveConsent(v) {
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ v, ts: Date.now() })); } catch {}
  gtagConsent(v === 'all');
}

function consentBanner() {
  const prev = readConsent();
  if (prev) { gtagConsent(prev === 'all'); return; }

  if (document.getElementById('consent-bar')) return;

  const d = document.createElement('div');
  d.id = 'consent-bar';
  d.setAttribute('role', 'dialog');
  d.setAttribute('aria-live', 'polite');
  d.setAttribute('aria-label', T.cookieLabel || (IS_EN ? 'Cookies' : 'Cookies'));
  d.className = 'fixed bottom-0 inset-x-0 z-[100] bg-slate-900 border-t border-slate-700 p-4 text-xs text-slate-300';
  d.innerHTML = `<div class="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-3 justify-between">
    <p>${T.cookie} <a href="${T.inst[1][0]}" class="text-blue-400 underline">${T.cookieLink}</a>.</p>
    <div class="flex gap-2 shrink-0">
      <button id="cRej" type="button" class="px-3 py-1.5 rounded border border-slate-600 hover:bg-slate-800">${T.reject}</button>
      <button id="cAcc" type="button" class="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white">${T.accept}</button>
    </div></div>`;
  document.body.appendChild(d);

  const set = v => { saveConsent(v); d.remove(); };
  d.querySelector('#cAcc').onclick = () => set('all');
  d.querySelector('#cRej').onclick = () => set('none');
}

export function reopenConsent() {
  try { localStorage.removeItem(CONSENT_KEY); } catch {}
  gtagConsent(false);
  consentBanner();
}

/* ---------- Header / Footer ---------- */

function isActive(path, href) {
  const clean = href.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  if (clean === '/') return path === '/';
  return path === clean || path.startsWith(clean + '/');
}

/* ---------- Botão copiar nos blocos .mdl ---------- */

function mountCopyButtons() {
  const label = IS_EN ? 'copy' : 'copiar';
  const done  = IS_EN ? 'copied' : 'copiado';

  document.querySelectorAll('.mdl').forEach(box => {
    if (box.querySelector('.mdl-copy')) return;

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mdl-copy';
    b.textContent = label;
    b.setAttribute('aria-label', IS_EN ? 'Copy text' : 'Copiar texto');

    b.onclick = async () => {
      const clone = box.cloneNode(true);
      clone.querySelectorAll('.mdl-copy').forEach(el => el.remove());
      try {
        await navigator.clipboard.writeText(clone.innerText.trim());
        b.textContent = done;
        b.dataset.copied = '1';
        setTimeout(() => { b.textContent = label; delete b.dataset.copied; }, 1800);
      } catch {}
    };

    box.appendChild(b);
  });
}


export function mountShell() {
  const path = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';

  const h = document.getElementById('site-header');
  if (h) h.innerHTML = `
  <header class="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
    <div class="max-w-6xl mx-auto px-6 py-3 flex flex-col md:flex-row md:items-center gap-3 justify-between">
      <a href="${IS_EN ? '/en/' : '/'}" class="font-bold text-slate-100">${T.brand}<span class="text-blue-400">.</span></a>
      <nav class="flex flex-wrap gap-1.5 text-xs items-center" aria-label="${IS_EN ? 'Main navigation' : 'Navegação principal'}">
        ${T.nav.map(([u, t]) => {
          const on = isActive(path, u);
          return `<a href="${u}"${on ? ' aria-current="page"' : ''} class="px-2.5 py-1.5 rounded-lg ${
            on ? 'bg-blue-600 text-white'
               : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">${t}</a>`;
        }).join('')}
        <a href="${T.switchHref}" hreflang="${IS_EN ? 'pt-BR' : 'en'}" rel="alternate"
           class="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-blue-400">${T.switchTo}</a>
      </nav>
    </div>
  </header>`;

  const f = document.getElementById('site-footer');
  if (f) {
    f.innerHTML = `
    <footer class="border-t border-slate-800 bg-slate-900 mt-12">
      <div class="max-w-6xl mx-auto px-6 py-8 grid md:grid-cols-3 gap-6 text-xs text-slate-400">
        <div><p class="font-bold text-slate-200 mb-2">${T.footTools}</p>
          ${T.nav.slice(0, 6).map(([u, t]) =>
            `<a href="${u}" class="block hover:text-blue-400 py-0.5">${t}</a>`).join('')}</div>
        <div><p class="font-bold text-slate-200 mb-2">${T.footInst}</p>
          ${T.inst.map(([u, t]) =>
            `<a href="${u}" class="block hover:text-blue-400 py-0.5">${t}</a>`).join('')}
          <button id="reopenConsent" type="button"
            class="block hover:text-blue-400 py-0.5 text-left">${T.cookiePrefs}</button></div>
        <div><p class="font-bold text-slate-200 mb-2">${T.footNotice}</p>
          <p>${T.privacyNote}</p>
          <p class="mt-2">© ${new Date().getFullYear()} ${T.brand.replace(/&nbsp;/g, ' ')}.</p></div>
      </div>
    </footer>`;

    const rc = document.getElementById('reopenConsent');
    if (rc) rc.onclick = reopenConsent;
  }

  consentBanner();
  mountCopyButtons();

}
