// js/state.js — estado na URL (hash) para links compartilháveis
const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, '');
const dec = s => JSON.parse(decodeURIComponent(escape(atob(s))));

export function saveState(obj) {
  try {
    location.hash = 's=' + enc(obj);
    return location.href;
  } catch { return location.href; }
}

export function loadState() {
  const m = location.hash.match(/s=([^&]+)/);
  if (!m) return null;
  try { return dec(m[1]); } catch { return null; }
}

export async function copyShareLink(obj, btn) {
  // Limite prático: ~6000 caracteres de URL. Acima disso, exporta só os parâmetros.
  const url = saveState(obj);
  if (url.length > 6000) {
    const slim = { ...obj, data: undefined, note: 'dados omitidos (muito grandes)' };
    saveState(slim);
  }
  await navigator.clipboard.writeText(location.href);
  if (btn) { const t = btn.textContent; btn.textContent = 'Link copiado!'; setTimeout(() => btn.textContent = t, 2000); }
}
