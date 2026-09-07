// js/buscador.js — paginação real via cursor da API + mailto
const MAILTO = 'contato@r-latex-generator.vercel.app';
let offset = 0, total = 0, perPage = 15;

export async function search(page = 1) {
  const q = document.getElementById('q').value.trim();
  if (!q) return alert('Digite um tema.');
  perPage = +document.getElementById('per').value;
  const year = document.getElementById('year').value.trim();
  offset = (page - 1) * perPage;                    // paginação server-side correta
  let url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}`
    + `&rows=${perPage}&offset=${offset}&select=DOI,title,author,published,publisher,container-title,abstract,is-referenced-by-count`
    + `&mailto=${MAILTO}&sort=relevance`;
  if (year) url += `&filter=from-pub-date:${year}-01-01`;
  const r = await fetch(url);
  const j = await r.json();
  total = j.message['total-results'];
  render(j.message.items, page);                     // + botão "Gerar citação ABNT" em cada item
}
