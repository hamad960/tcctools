// js/cite.js
const MAILTO = 'contato@r-latex-generator.vercel.app'; // <-- TROQUE: acelera a fila da API Crossref

export async function fetchWork(doiOrUrl) {
  const doi = doiOrUrl.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${MAILTO}`);
  if (!r.ok) throw new Error('DOI não encontrado');
  return (await r.json()).message;
}

const authors = w => w.author || [];
const year = w => (w.issued?.['date-parts']?.[0]?.[0]) ?? 's.d.';
const journal = w => (w['container-title'] || [])[0] || '';
const title = w => (w.title || [])[0] || 'Sem título';
const initials = g => (g || '').split(/[\s.-]+/).filter(Boolean).map(s => s[0].toUpperCase() + '.').join(' ');

export function abnt(w) {
  const a = authors(w).map(x => `${(x.family || '').toUpperCase()}, ${initials(x.given)}`);
  const aut = a.length > 3 ? `${a[0]} et al.` : a.join('; ') || 'AUTOR DESCONHECIDO';
  const vol = w.volume ? `, v. ${w.volume}` : '';
  const iss = w.issue ? `, n. ${w.issue}` : '';
  const pg = w.page ? `, p. ${w.page}` : '';
  return `${aut}. ${title(w)}. <b>${journal(w)}</b>${vol}${iss}${pg}, ${year(w)}. DOI: ${w.DOI}. Disponível em: https://doi.org/${w.DOI}. Acesso em: ${hoje()}.`;
}

export function apa7(w) {
  const a = authors(w).map(x => `${x.family}, ${initials(x.given)}`);
  let aut = a.length === 0 ? '' : a.length === 1 ? a[0]
    : a.length <= 20 ? a.slice(0, -1).join(', ') + ', & ' + a.at(-1)
    : a.slice(0, 19).join(', ') + ', ... ' + a.at(-1);
  const vol = w.volume ? `<i>${w.volume}</i>` : '';
  const iss = w.issue ? `(${w.issue})` : '';
  return `${aut} (${year(w)}). ${title(w)}. <i>${journal(w)}</i>, ${vol}${iss}${w.page ? ', ' + w.page : ''}. https://doi.org/${w.DOI}`;
}

export function vancouver(w) {
  const a = authors(w).map(x => `${x.family} ${initials(x.given).replace(/[.\s]/g, '')}`);
  const aut = a.length > 6 ? a.slice(0, 6).join(', ') + ', et al' : a.join(', ');
  return `${aut}. ${title(w)}. ${journal(w)}. ${year(w)}${w.volume ? ';' + w.volume : ''}${w.issue ? '(' + w.issue + ')' : ''}${w.page ? ':' + w.page : ''}. doi:${w.DOI}`;
}

const yr = w => w.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
const jn = w => (w['container-title'] || [''])[0] || '';
const tt = w => (w.title || [''])[0] || '';
const pg = w => (w.page || '').replace('-', '–');

export function mla9(w) {
  const a = w.author || [];
  let au = '';
  if (a.length === 1) au = `${a[0].family}, ${a[0].given}.`;
  else if (a.length === 2) au = `${a[0].family}, ${a[0].given}, and ${a[1].given} ${a[1].family}.`;
  else if (a.length > 2) au = `${a[0].family}, ${a[0].given}, et al.`;
  return [au, `"${tt(w)}."`, `${jn(w)},`,
    w.volume ? `vol. ${w.volume},` : '', w.issue ? `no. ${w.issue},` : '',
    `${yr(w)},`, pg(w) ? `pp. ${pg(w)}.` : '',
    w.DOI ? `https://doi.org/${w.DOI}.` : ''].filter(Boolean).join(' ');
}

export function chicago(w) {
  const a = w.author || [];
  let au = '';
  if (a.length === 1) au = `${a[0].family}, ${a[0].given}.`;
  else if (a.length <= 3) au = `${a[0].family}, ${a[0].given}, `
    + a.slice(1).map(x => `${x.given} ${x.family}`).join(', and ') + '.';
  else if (a.length > 3) au = `${a[0].family}, ${a[0].given}, et al.`;
  return [au, `${yr(w)}.`, `"${tt(w)}."`, jn(w),
    w.volume ? `${w.volume}` : '', w.issue ? `(${w.issue})` : '',
    pg(w) ? `: ${pg(w)}.` : '.',
    w.DOI ? `https://doi.org/${w.DOI}.` : ''].filter(Boolean).join(' ')
    .replace(/\s+:/, ':');
}

export function bibtex(w) {
  const key = `${(authors(w)[0]?.family || 'ref').toLowerCase()}${year(w)}`;
  return `@article{${key},
  author  = {${authors(w).map(x => `${x.family}, ${x.given}`).join(' and ')}},
  title   = {${title(w)}},
  journal = {${journal(w)}},
  year    = {${year(w)}},${w.volume ? `\n  volume  = {${w.volume}},` : ''}${w.issue ? `\n  number  = {${w.issue}},` : ''}${w.page ? `\n  pages   = {${w.page}},` : ''}
  doi     = {${w.DOI}}
}`;
}

export function riscsv(w) { // .ris para Mendeley/Zotero
  return ['TY  - JOUR', ...authors(w).map(x => `AU  - ${x.family}, ${x.given}`),
    `TI  - ${title(w)}`, `JO  - ${journal(w)}`, `PY  - ${year(w)}`,
    w.volume ? `VL  - ${w.volume}` : '', w.issue ? `IS  - ${w.issue}` : '',
    `DO  - ${w.DOI}`, 'ER  - '].filter(Boolean).join('\r\n');
}

const hoje = () => {
  const m = ['jan.','fev.','mar.','abr.','maio','jun.','jul.','ago.','set.','out.','nov.','dez.'];
  const d = new Date();
  return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}`;
};
