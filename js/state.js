// js/state.js
import { T } from './i18n.js';

const b64u = s => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => s.replace(/-/g, '+').replace(/_/g, '/');

const enc = o => b64u(btoa(unescape(encodeURIComponent(JSON.stringify(o)))));
const dec = s => JSON.parse(decodeURIComponent(escape(atob(unb64u(s)))));

const MAX_URL = 6000;

export function saveState(obj) {
  try {
    history.replaceState(null, '', '#s=' + enc(obj)); // não empilha histórico
    return location.href;
  } catch {
    return location.href;
  }
}

export function loadState() {
  const m = location.hash.match(/[#&]s=([^&]+)/);
  if (!m) return null;
  try { return dec(m[1]); } catch { return null; }
}

export async function copyShareLink(obj, btn) {
  let url = saveState(obj);

  if (url.length > MAX_URL) {
    saveState({ ...obj, data: undefined, note: 'dados omitidos (muito grandes)' });
    url = location.href;
  }

  const feedback = msg => {
    if (!btn) return;
    const t = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = t; }, 2000);
  };

  try {
    await navigator.clipboard.writeText(url);
    feedback(T.linkCopied);
  } catch {
    // fallback para contextos sem permissão de clipboard
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); feedback(T.linkCopied); }
    catch { prompt(T.promptCopy, url); }
    ta.remove();
  }
}
