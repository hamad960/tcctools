// js/calculadora.js
import * as S from './stats.js';
import { chartToPNG, tableToDocx } from './export.js';
import { copyShareLink, loadState, saveState } from './state.js';
import { mountShell } from './ui.js';

mountShell();

let rows = [], chart = null, light = false, last = null;
const $ = id => document.getElementById(id);

// ---------- carregar dados ----------
$('file').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: false });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
    setupColumns();
  };
  r.readAsArrayBuffer(f);
};

$('btnPaste').onclick = () => {
  const a = $('pasteArea'); a.classList.toggle('hidden'); a.focus();
};
$('pasteArea').oninput = e => {
  const lines = e.target.value.trim().split(/\r?\n/);
  if (lines.length < 2) return;
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  rows = lines.map(l => l.split(sep).map(c => c.trim()));
  setupColumns();
};

$('btnDemo').onclick = () => {
  rows = [['Grupo', 'Idade', 'Desempenho'],
    ...Array.from({ length: 40 }, (_, i) => {
      const g = i < 20 ? 'Controle' : 'Intervenção';
      const idade = 18 + Math.round(Math.random() * 22);
      const base = i < 20 ? 62 : 74;
      return [g, idade, +(base + (Math.random() - .5) * 18 + idade * 0.15).toFixed(1)];
    })];
  setupColumns();
};

function setupColumns() {
  if (rows.length < 2) return alert('Planilha vazia ou sem cabeçalho.');
  const hdr = rows[0];
  const opts = hdr.map((h, i) => `<option value="${i}">${h || 'Coluna ' + (i + 1)}</option>`).join('');
  $('colX').innerHTML = opts; $('colY').innerHTML = opts;
  $('colY').selectedIndex = Math.min(1, hdr.length - 1);
  $('colBox').classList.remove('hidden');
  $('preview').textContent = `${rows.length - 1} linhas × ${hdr.length} colunas carregadas.`;
  checkAssumptions();
  ['colX', 'colY', 'objective', 'pairing'].forEach(id => $(id).onchange = () => { checkAssumptions(); suggest(); });
  suggest();
}

const colVals = i => rows.slice(1).map(r => r?.[i]);
const numCol = i => S.clean(colVals(i));

function grouped() {
  const xi = +$('colX').value, yi = +$('colY').value, map = {};
  rows.slice(1).forEach(r => {
    if (!r) return;
    const y = Number(String(r[yi] ?? '').replace(',', '.'));
    if (!Number.isFinite(y)) return;               // célula vazia NÃO vira zero
    const k = String(r[xi] ?? 'Grupo 1').trim();
    (map[k] ||= []).push(y);
  });
  return map;
}

// ---------- pressupostos ----------
function checkAssumptions() {
  const box = $('assump');
  const obj = $('objective').value;
  let html = '';
  if (obj === 'correlate' || obj === 'regression') {
    [['X', +$('colX').value], ['Y', +$('colY').value]].forEach(([lab, i]) => {
      const v = numCol(i);
      if (v.length < 3) return;
      const sw = S.shapiroWilk(v);
      html += badge(`Shapiro-Wilk ${lab} (${rows[0][i]})`, `W = ${S.br(sw.W, 4)}; ${S.fmtP(sw.p)}`, sw.normal);
    });
  } else {
    const g = grouped(), names = Object.keys(g);
    names.forEach(n => {
      if (g[n].length < 3) return;
      const sw = S.shapiroWilk(g[n]);
      html += badge(`Shapiro-Wilk — ${n} (n=${g[n].length})`, `W = ${S.br(sw.W, 4)}; ${S.fmtP(sw.p)}`, sw.normal);
    });
    if (names.length > 1) {
      const lv = S.levene(names.map(n => g[n]));
      html += badge('Levene (variâncias)', `F = ${S.br(lv.F)}; ${S.fmtP(lv.p)}`, lv.p > 0.05);
    }
  }
  box.innerHTML = html || '<span class="text-slate-500">Dados insuficientes para testar pressupostos (n mínimo = 3).</span>';
}

const badge = (t, v, ok) => `<div class="kv">
  <span>${t}</span>
  <span>${v} <span class="tag ${ok ? 'tag-ok' : 'tag-no'}">${ok ? 'OK' : 'VIOLADO'}</span></span></div>`;

// ---------- sugestão automática de teste ----------
function suggest() {
  const obj = $('objective').value, paired = $('pairing').value === 'paired';
  let normal = true;
  if (obj === 'correlate' || obj === 'regression') {
    normal = [+$('colX').value, +$('colY').value].every(i => {
      const v = numCol(i); return v.length < 3 || S.shapiroWilk(v).normal;
    });
  } else {
    const g = grouped();
    normal = Object.values(g).every(v => v.length < 3 || S.shapiroWilk(v).normal);
  }
  const map = {
    compare2: normal ? (paired ? 't_paired' : 't_indep') : (paired ? 'wilcoxon' : 'mann'),
    compare3: normal ? 'anova' : 'kruskal',
    correlate: normal ? 'pearson' : 'spearman',
    regression: 'reg'
  };
  $('testSel').value = map[obj];
}

// ---------- executar ----------
$('btnRun').onclick = run;

function run() {
  if (rows.length < 2) return alert('Carregue seus dados primeiro.');
  const t = $('testSel').value;
  const xi = +$('colX').value, yi = +$('colY').value;
  const labels = { x: rows[0][xi], y: rows[0][yi] };
  let res;

  try {
    if (['pearson', 'spearman', 'reg'].includes(t)) {
      const pairs = rows.slice(1).map(r => [Number(String(r?.[xi] ?? '').replace(',', '.')),
                                            Number(String(r?.[yi] ?? '').replace(',', '.'))])
                                 .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
      if (pairs.length < 4) return alert('São necessários pelo menos 4 pares numéricos válidos.');
      const X = pairs.map(p => p[0]), Y = pairs.map(p => p[1]);
      res = t === 'pearson' ? S.pearson(X, Y) : t === 'spearman' ? S.spearman(X, Y) : S.linearRegression(X, Y);
      res._scatter = pairs.map(([x, y]) => ({ x, y }));
    } else {
      const g = grouped(), names = Object.keys(g), arr = names.map(n => g[n]);
      labels.groups = names;
      if (['t_indep', 'mann', 't_paired', 'wilcoxon'].includes(t) && arr.length !== 2)
        return alert(`Este teste exige exatamente 2 grupos. Encontrei ${arr.length} na coluna "${labels.x}".`);
      if (['t_paired', 'wilcoxon'].includes(t) && arr[0].length !== arr[1].length)
        return alert('Testes pareados exigem o mesmo número de observações nos dois momentos.');
      res = t === 't_indep' ? S.tTestIndependent(arr[0], arr[1])
          : t === 't_paired' ? S.tTestPaired(arr[0], arr[1])
          : t === 'mann' ? S.mannWhitney(arr[0], arr[1])
          : t === 'wilcoxon' ? S.wilcoxon(arr[0], arr[1])
          : t === 'anova' ? S.anovaOneWay(arr) : S.kruskalWallis(arr);
      res._groups = g;
    }
  } catch (e) { return alert('Erro no cálculo: ' + e.message); }

  last = { res, labels, t };
  render();
  $('out').classList.remove('hidden');
  $('out').scrollIntoView({ behavior: 'smooth' });
  saveState({ t, xi, yi, obj: $('objective').value, pair: $('pairing').value, data: rows });
}

// ---------- render ----------
function render() {
  const { res, labels } = last;
  const fg = light ? '#0f172a' : '#94a3b8', grid = light ? '#cbd5e1' : '#1e293b';

  // métricas
  const cards = [];
  const push = (k, v) => cards.push(
  `<div class="metric"><div class="metric-k">${k}</div><div class="metric-v">${v}</div></div>`);
  push('Teste', res.test);
  if (res.t !== undefined) push('t', S.br(res.t, 3));
  if (res.F !== undefined) push('F', S.br(res.F, 3));
  if (res.H !== undefined) push('H', S.br(res.H, 3));
  if (res.U !== undefined) push('U', S.br(res.U, 1));
  if (res.z !== undefined) push('z', S.br(res.z, 3));
  if (res.r2 !== undefined) push('R²', S.br(res.r2, 3));
  const p = res.p ?? res.pF;
  push('p-valor', `<span class="${p < 0.05 ? 'text-emerald-400' : 'text-amber-400'}">${S.fmtP(p)}</span>`);
  if (res.effect) push(res.effect.name, `${S.br(res.effect.value, 3)} (${res.effect.label})`);
  if (res.slope) push('β (inclinação)', S.br(res.slope.b, 4));
  $('statsGrid').innerHTML = cards.join('');

  // tabela APA
  let head, body, note = '';
  if (res._scatter) {
    head = ['Variável', 'n', 'M', 'DP', 'Md', 'Mín–Máx'];
    const d = res.x ? [['X', res.x], ['Y', res.y]] : [];
    body = d.length ? d.map(([k, s]) => [k === 'X' ? labels.x : labels.y, s.n, S.br(s.mean), S.br(s.sd), S.br(s.median), `${S.br(s.min)}–${S.br(s.max)}`])
      : [[labels.x, res.n, '—', '—', '—', '—']];
    note = res.r !== undefined ? `r = ${S.br(res.r, 3)}; ${S.fmtP(res.p)}.` : `R² = ${S.br(res.r2, 3)}; ${res.equation}.`;
  } else {
    head = ['Grupo', 'n', 'M', 'DP', 'Md', 'IC 95%'];
    const names = labels.groups || res.groups.map((_, i) => 'Grupo ' + (i + 1));
    body = res.groups.map((s, i) => [names[i], s.n, S.br(s.mean), S.br(s.sd), S.br(s.median),
      `[${S.br(s.ci95[0])}; ${S.br(s.ci95[1])}]`]);
    note = `${res.test}. ${S.fmtP(res.p)}. ${res.effect.name} = ${S.br(res.effect.value, 3)}.`;
  }
  $('tableWrap').innerHTML = `<p class="text-xs font-semibold mb-2">Tabela 1 — Estatística descritiva e inferencial</p>
  <table class="apa">
    <thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="${head.length}">Nota. ${note}</td></tr></tfoot></table>`;
  last.table = { head, body, note };

  // gráfico
  if (chart) chart.destroy();
  const ctx = $('chart').getContext('2d');
  let cfg;
  if (res._scatter) {
    const xs = res._scatter.map(p => p.x);
    const lr = res.slope ? res : S.linearRegression(xs, res._scatter.map(p => p.y));
    const mn = Math.min(...xs), mx = Math.max(...xs);
    cfg = { data: { datasets: [
      { type: 'scatter', label: 'Observações', data: res._scatter, backgroundColor: 'rgba(37,99,235,.65)' },
      { type: 'line', label: `Ajuste (R² = ${S.br(lr.r2, 3)})`, pointRadius: 0, borderColor: '#dc2626', borderWidth: 2,
        data: [{ x: mn, y: lr.intercept.b + lr.slope.b * mn }, { x: mx, y: lr.intercept.b + lr.slope.b * mx }] }] } };
  } else {
    const names = labels.groups || res.groups.map((_, i) => 'G' + (i + 1));
    cfg = { data: { labels: names, datasets: [{
      type: 'bar', label: labels.y, data: res.groups.map(s => s.mean),
      backgroundColor: 'rgba(37,99,235,.65)', borderColor: '#2563eb', borderWidth: 1,
      errorBars: res.groups.map(s => s.sd) }] } };
  }
  cfg.options = {
    responsive: true, maintainAspectRatio: false, devicePixelRatio: 3, animation: false,
    plugins: { legend: { labels: { color: fg } },
      title: { display: true, color: fg, text: res._scatter ? `${labels.x} × ${labels.y}` : `Média de ${labels.y} por ${labels.x}` } },
    scales: { x: { type: res._scatter ? 'linear' : 'category', title: { display: true, text: labels.x, color: fg }, ticks: { color: fg }, grid: { color: grid } },
              y: { title: { display: true, text: labels.y, color: fg }, ticks: { color: fg }, grid: { color: grid } } }
  };
  chart = new Chart(ctx, cfg);

  $('reportBox').textContent = S.report(res, labels);
}

// ---------- ações ----------
$('btnTheme').onclick = () => {
  light = !light;
  $('exportArea').classList.toggle('light', light);
  $('btnTheme').textContent = light ? 'Tema escuro' : 'Tema claro (exportação)';
  if (last) render();
};
$('btnPng').onclick = () => { if (!light) $('btnTheme').click(); setTimeout(() => chartToPNG(chart, 'figura1.png', 300), 400); };
$('btnDocx').onclick = () => last && tableToDocx({
  title: 'Tabela 1 — Estatística descritiva e inferencial',
  headers: last.table.head, rows: last.table.body,
  note: last.table.note, reportText: $('reportBox').textContent });
$('btnShare').onclick = e => copyShareLink({ t: last?.t, data: rows }, e.target);
$('btnCopyRep').onclick = e => navigator.clipboard.writeText($('reportBox').textContent)
  .then(() => { e.target.textContent = 'Copiado!'; setTimeout(() => e.target.textContent = 'Copiar', 1500); });

// ---------- restaurar de link ----------
const st = loadState();
if (st?.data) {
  rows = st.data; setupColumns();
  if (st.obj) $('objective').value = st.obj;
  if (st.pair) $('pairing').value = st.pair;
  if (st.xi != null) $('colX').value = st.xi;
  if (st.yi != null) $('colY').value = st.yi;
  if (st.t) $('testSel').value = st.t;
  setTimeout(run, 200);
}
