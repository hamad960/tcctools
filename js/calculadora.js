// js/calculadora.js — TCC Tools
// Correções: normalização de pF, pareado por 2 colunas, barras de erro,
// descritiva de correlação, limite do link compartilhável.
import * as S from './stats.js';
import { chartToPNG, tableToDocx } from './export.js';
import { copyShareLink, loadState, saveState } from './state.js';
import { mountShell } from './ui.js';

mountShell();

let rows = [], chart = null, light = false, last = null, discarded = 0;
const $ = id => document.getElementById(id);
const isPaired = () => $('pairing')?.value === 'paired';
const num = v => S.toNumber(v);

/* ============ plugin de barras de erro ============ */
const errorBarPlugin = {
  id: 'errBars',
  afterDatasetsDraw(c) {
    const ds = c.data.datasets[0];
    if (!ds?._sd) return;
    const meta = c.getDatasetMeta(0), y = c.scales.y, ctx = c.ctx;
    ctx.save();
    ctx.strokeStyle = light ? '#0f172a' : '#e2e8f0';
    ctx.lineWidth = 1.5;
    meta.data.forEach((bar, i) => {
      const sd = ds._sd[i];
      if (!Number.isFinite(sd) || sd === 0) return;
      const top = y.getPixelForValue(ds.data[i] + sd);
      const bot = y.getPixelForValue(ds.data[i] - sd);
      const x = bar.x, w = 6;
      ctx.beginPath();
      ctx.moveTo(x, top); ctx.lineTo(x, bot);
      ctx.moveTo(x - w, top); ctx.lineTo(x + w, top);
      ctx.moveTo(x - w, bot); ctx.lineTo(x + w, bot);
      ctx.stroke();
    });
    ctx.restore();
  }
};

/* ============ carregar dados ============ */
$('file').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: false });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
      setupColumns();
    } catch (err) { alert('Não foi possível ler o arquivo: ' + err.message); }
  };
  r.readAsArrayBuffer(f);
};

$('btnPaste').onclick = () => { const a = $('pasteArea'); a.classList.toggle('hidden'); a.focus(); };

$('pasteArea').oninput = e => {
  const lines = e.target.value.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return;
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  rows = lines.map(l => l.split(sep).map(c => c.trim()));
  setupColumns();
};

$('btnDemo').onclick = () => {
  if (isPaired()) {
    rows = [['Pre_intervencao', 'Pos_intervencao'],
      ...Array.from({ length: 30 }, () => {
        const pre = 55 + Math.random() * 14;
        return [+pre.toFixed(1), +(pre + 8 + (Math.random() - .35) * 9).toFixed(1)];
      })];
  } else {
    rows = [['Grupo', 'Idade', 'Desempenho'],
      ...Array.from({ length: 40 }, (_, i) => {
        const g = i < 20 ? 'Controle' : 'Intervenção';
        const idade = 18 + Math.round(Math.random() * 22);
        const base = i < 20 ? 62 : 74;
        return [g, idade, +(base + (Math.random() - .5) * 18 + idade * 0.15).toFixed(1)];
      })];
  }
  setupColumns();
};

/* ============ colunas ============ */
let wired = false;
function setupColumns() {
  if (!rows.length || rows.length < 2) return alert('Planilha vazia ou sem linha de cabeçalho.');
  const hdr = rows[0];
  const opts = hdr.map((h, i) => `<option value="${i}">${h || 'Coluna ' + (i + 1)}</option>`).join('');
  $('colX').innerHTML = opts;
  $('colY').innerHTML = opts;
  $('colY').selectedIndex = Math.min(hdr.length - 1, hdr.length > 2 ? 2 : 1);
  $('colBox').classList.remove('hidden');
  $('preview').textContent = `${rows.length - 1} linhas × ${hdr.length} colunas carregadas.`;

  if (!wired) {
    wired = true;
    ['colX', 'colY', 'objective', 'pairing'].forEach(id =>
      $(id).addEventListener('change', () => { relabel(); checkAssumptions(); suggest(); }));
  }
  relabel();
  checkAssumptions();
  suggest();
}

// rótulos dinâmicos conforme o delineamento
function relabel() {
  const obj = $('objective').value;
  const lx = $('labX'), ly = $('labY');
  if (!lx || !ly) return;
  if (obj === 'compare2' && isPaired()) {
    lx.textContent = 'Momento 1 — pré (coluna numérica)';
    ly.textContent = 'Momento 2 — pós (coluna numérica)';
  } else if (obj === 'correlate' || obj === 'regression') {
    lx.textContent = obj === 'regression' ? 'Variável preditora X (numérica)' : 'Variável X (numérica)';
    ly.textContent = obj === 'regression' ? 'Variável desfecho Y (numérica)' : 'Variável Y (numérica)';
  } else {
    lx.textContent = 'Coluna de grupo (categórica)';
    ly.textContent = 'Variável desfecho (numérica)';
  }
}

const colVals = i => rows.slice(1).map(r => r?.[i]);
const numCol = i => S.clean(colVals(i));

// pares linha a linha de duas colunas numéricas
function numericPairs(xi, yi) {
  let bad = 0;
  const out = [];
  rows.slice(1).forEach(r => {
    if (!r) return;
    const a = num(r[xi]), b = num(r[yi]);
    if (Number.isFinite(a) && Number.isFinite(b)) out.push([a, b]);
    else bad++;
  });
  discarded = bad;
  return out;
}

// agrupa coluna numérica Y pela coluna categórica X
function grouped() {
  const xi = +$('colX').value, yi = +$('colY').value, map = {};
  let bad = 0;
  rows.slice(1).forEach(r => {
    if (!r) return;
    const y = num(r[yi]);
    if (!Number.isFinite(y)) { bad++; return; }
    const k = String(r[xi] ?? 'Grupo 1').trim() || 'Sem rótulo';
    (map[k] ||= []).push(y);
  });
  discarded = bad;
  return map;
}

/* ============ pressupostos ============ */
const badge = (t, v, ok) => `<div class="kv">
  <span>${t}</span>
  <span>${v} <span class="tag ${ok ? 'tag-ok' : 'tag-no'}">${ok ? 'OK' : 'VIOLADO'}</span></span></div>`;

function checkAssumptions() {
  const box = $('assump');
  const obj = $('objective').value;
  const xi = +$('colX').value, yi = +$('colY').value;
  let html = '';

  // pareado: normalidade DAS DIFERENÇAS
  if (obj === 'compare2' && isPaired()) {
    const dif = numericPairs(xi, yi).map(([a, b]) => b - a);
    if (dif.length >= 3) {
      const sw = S.shapiroWilk(dif);
      html = badge(`Shapiro-Wilk das diferenças (${rows[0][yi]} − ${rows[0][xi]}), n = ${dif.length}`,
        `W = ${S.br(sw.W, 4)}; ${S.fmtP(sw.p)}`, sw.normal);
    }
  } else if (obj === 'correlate' || obj === 'regression') {
    [['X', xi], ['Y', yi]].forEach(([lab, i]) => {
      const v = numCol(i);
      if (v.length < 3) return;
      const sw = S.shapiroWilk(v);
      html += badge(`Shapiro-Wilk ${lab} — ${rows[0][i]} (n = ${v.length})`,
        `W = ${S.br(sw.W, 4)}; ${S.fmtP(sw.p)}`, sw.normal);
    });
    if (obj === 'regression') {
      const pr = numericPairs(xi, yi);
      if (pr.length >= 4) {
        const lr = S.linearRegression(pr.map(p => p[0]), pr.map(p => p[1]));
        const resid = pr.map(([x, y]) => y - (lr.intercept.b + lr.slope.b * x));
        const sw = S.shapiroWilk(resid);
        html += badge('Shapiro-Wilk dos resíduos do modelo',
          `W = ${S.br(sw.W, 4)}; ${S.fmtP(sw.p)}`, sw.normal);
      }
    }
  } else {
    const g = grouped(), names = Object.keys(g);
    names.forEach(n => {
      if (g[n].length < 3) return;
      const sw = S.shapiroWilk(g[n]);
      html += badge(`Shapiro-Wilk — ${n} (n = ${g[n].length})`,
        `W = ${S.br(sw.W, 4)}; ${S.fmtP(sw.p)}`, sw.normal);
    });
    if (names.length > 1) {
      try {
        const lv = S.levene(names.map(n => g[n]));
        html += badge('Levene — homogeneidade das variâncias',
          `F = ${S.br(lv.F)}; ${S.fmtP(lv.p)}`, lv.p > 0.05);
      } catch (_) {}
    }
  }

  if (discarded > 0) html += `<p class="hint">${discarded} linha(s) descartada(s) por valor ausente ou não numérico.</p>`;
  box.innerHTML = html || '<span class="text-slate-500">Dados insuficientes para testar pressupostos (n mínimo = 3 por grupo).</span>';
}

/* ============ sugestão automática ============ */
function suggest() {
  const obj = $('objective').value, paired = isPaired();
  const xi = +$('colX').value, yi = +$('colY').value;
  let normal = true;

  try {
    if (obj === 'compare2' && paired) {
      const dif = numericPairs(xi, yi).map(([a, b]) => b - a);
      normal = dif.length < 3 || S.shapiroWilk(dif).normal;
    } else if (obj === 'correlate' || obj === 'regression') {
      normal = [xi, yi].every(i => { const v = numCol(i); return v.length < 3 || S.shapiroWilk(v).normal; });
    } else {
      normal = Object.values(grouped()).every(v => v.length < 3 || S.shapiroWilk(v).normal);
    }
  } catch (_) { normal = true; }

  const map = {
    compare2: normal ? (paired ? 't_paired' : 't_indep') : (paired ? 'wilcoxon' : 'mann'),
    compare3: normal ? 'anova' : 'kruskal',
    correlate: normal ? 'pearson' : 'spearman',
    regression: 'reg'
  };
  if ($('testSel')) $('testSel').value = map[obj];
}

/* ============ executar ============ */
$('btnRun').onclick = run;

function run() {
  if (rows.length < 2) return alert('Carregue seus dados primeiro.');
  const t = $('testSel').value;
  const xi = +$('colX').value, yi = +$('colY').value;
  if (xi === yi && t !== 'anova' && t !== 'kruskal')
    return alert('Selecione duas colunas diferentes.');

  const labels = { x: rows[0][xi] || 'X', y: rows[0][yi] || 'Y' };
  let res;

  try {
    // --- correlação e regressão: pares de duas colunas numéricas ---
    if (['pearson', 'spearman', 'reg'].includes(t)) {
      const pairs = numericPairs(xi, yi);
      if (pairs.length < 4)
        return alert(`São necessários pelo menos 4 pares numéricos válidos. Encontrei ${pairs.length}. `
          + 'Verifique se as duas colunas selecionadas contêm números.');
      const X = pairs.map(p => p[0]), Y = pairs.map(p => p[1]);
      res = t === 'pearson' ? S.pearson(X, Y)
          : t === 'spearman' ? S.spearman(X, Y)
          : S.linearRegression(X, Y);
      res._scatter = pairs.map(([x, y]) => ({ x, y }));

    // --- pareados: duas colunas numéricas (pré e pós) ---
    } else if (['t_paired', 'wilcoxon'].includes(t)) {
      const pairs = numericPairs(xi, yi);
      if (pairs.length < 3)
        return alert('Testes pareados exigem DUAS colunas numéricas (ex.: Pré e Pós), '
          + `com os valores do mesmo participante na mesma linha. Encontrei ${pairs.length} pares válidos.`);
      const A = pairs.map(p => p[0]), B = pairs.map(p => p[1]);
      res = t === 't_paired' ? S.tTestPaired(A, B) : S.wilcoxon(A, B);
      labels.groups = [labels.x, labels.y];
      labels.paired = true;
      res._paired = { A, B };

    // --- independentes: coluna de grupo + coluna numérica ---
    } else {
      const g = grouped(), names = Object.keys(g), arr = names.map(n => g[n]);
      labels.groups = names;
      if (!arr.length) return alert(`Nenhum valor numérico válido na coluna "${labels.y}".`);
      if (arr.some(a => a.length < 2))
        return alert('Todo grupo precisa de ao menos 2 observações válidas.');
      if (['t_indep', 'mann'].includes(t) && arr.length !== 2)
        return alert(`Este teste exige exatamente 2 grupos. Encontrei ${arr.length} `
          + `(${names.join(', ')}) na coluna "${labels.x}". Para 3 ou mais grupos, use ANOVA ou Kruskal-Wallis.`);
      if (['anova', 'kruskal'].includes(t) && arr.length < 3)
        return alert(`ANOVA e Kruskal-Wallis pressupõem 3 ou mais grupos. Encontrei ${arr.length}. `
          + 'Com 2 grupos, use teste t ou Mann-Whitney.');
      res = t === 't_indep' ? S.tTestIndependent(arr[0], arr[1])
          : t === 'mann' ? S.mannWhitney(arr[0], arr[1])
          : t === 'anova' ? S.anovaOneWay(arr, names)
          : S.kruskalWallis(arr,names);
      res._groups = g;
    }
  } catch (e) {
    console.error(e);
    return alert('Erro no cálculo: ' + e.message);
  }

  last = { res, labels, t };
  render();
  $('out').classList.remove('hidden');
  $('out').scrollIntoView({ behavior: 'smooth' });

  if (rows.length <= 60)
    saveState({ t, xi, yi, obj: $('objective').value, pair: $('pairing').value, data: rows });
}

/* ============ render ============ */
function render() {
  const { res, labels } = last;
  const fg = light ? '#0f172a' : '#94a3b8';
  const grid = light ? '#cbd5e1' : '#1e293b';

  /* --- métricas --- */
  const cards = [];
  const push = (k, v) => cards.push(
    `<div class="metric"><div class="metric-k">${k}</div><div class="metric-v">${v}</div></div>`);
  push('Teste', res.test);
  if (res.t !== undefined) push('t', S.br(res.t, 3));
  if (res.df !== undefined) push('gl', typeof res.df === 'number' ? S.br(res.df, res.df % 1 ? 1 : 0) : res.df);
  if (res.F !== undefined) push('F', S.br(res.F, 3));
  if (res.H !== undefined) push('H', S.br(res.H, 3));
  if (res.U !== undefined) push('U', S.br(res.U, 1));
  if (res.T !== undefined) push('T', S.br(res.T, 1));
  if (res.z !== undefined) push('z', S.br(res.z, 3));
  if (res.r !== undefined) push(res.test?.includes('Spearman') ? 'ρ' : 'r', S.br(res.r, 3));
  if (res.r2 !== undefined) push('R²', S.br(res.r2, 3));
  push('p-valor', `<span class="${res.p < 0.05 ? 'text-emerald-400' : 'text-amber-400'}">${S.fmtP(res.p)}</span>`);
  if (res.effect) push(res.effect.name, `${S.br(res.effect.value, 3)} (${res.effect.label})`);
  if (res.slope) push('β (inclinação)', S.br(res.slope.b, 4));
  if (res.intercept) push('Intercepto', S.br(res.intercept.b, 4));
  $('statsGrid').innerHTML = cards.join('');

  /* --- tabela em padrão editorial --- */
  let head, body, note = '';

  // 🔧 CORREÇÃO 4: descritiva calculada localmente
  if (res._scatter) {
    head = ['Variável', 'n', 'M', 'DP', 'Md', 'Mín–Máx'];
    const dx = S.describe(res._scatter.map(p => p.x));
    const dy = S.describe(res._scatter.map(p => p.y));
    body = [[labels.x, dx], [labels.y, dy]].map(([nm, s]) =>
      [nm, s.n, S.br(s.mean), S.br(s.sd), S.br(s.median), `${S.br(s.min)}–${S.br(s.max)}`]);
    note = res.r !== undefined
      ? `${res.test}. ${res.test.includes('Spearman') ? 'ρ' : 'r'} = ${S.br(res.r, 3)}; `
        + `${S.fmtP(res.p)}; n = ${dx.n}. M = média; DP = desvio-padrão; Md = mediana.`
      : `Regressão linear simples. R² = ${S.br(res.r2, 3)}`
        + `${res.r2adj !== undefined ? `; R² ajustado = ${S.br(res.r2adj, 3)}` : ''}`
        + `; ${S.fmtP(res.p)}. Equação: ${res.equation || '—'}.`;

  } else if (res._paired) {
    head = ['Momento', 'n', 'M', 'DP', 'Md', 'IC 95%'];
    const dA = S.describe(res._paired.A), dB = S.describe(res._paired.B);
    const dD = S.describe(res._paired.B.map((v, i) => v - res._paired.A[i]));
    body = [[labels.x, dA], [labels.y, dB], ['Diferença (pós − pré)', dD]].map(([nm, s]) =>
      [nm, s.n, S.br(s.mean), S.br(s.sd), S.br(s.median), `[${S.br(s.ci95[0])}; ${S.br(s.ci95[1])}]`]);
    note = `${res.test} para amostras pareadas. ${S.fmtP(res.p)}`
      + `${res.effect ? `. ${res.effect.name} = ${S.br(res.effect.value, 3)} (${res.effect.label})` : ''}`
      + `. M = média; DP = desvio-padrão; Md = mediana; IC = intervalo de confiança.`;

  } else {
    head = ['Grupo', 'n', 'M', 'DP', 'Md', 'IC 95%'];
    const names = labels.groups || res.groups.map((_, i) => 'Grupo ' + (i + 1));
    body = res.groups.map((s, i) => [names[i], s.n, S.br(s.mean), S.br(s.sd), S.br(s.median),
      `[${S.br(s.ci95[0])}; ${S.br(s.ci95[1])}]`]);
    note = `${res.test}. ${S.fmtP(res.p)}`
      + `${res.effect ? `. ${res.effect.name} = ${S.br(res.effect.value, 3)} (${res.effect.label})` : ''}`
      + `. M = média; DP = desvio-padrão; Md = mediana; IC = intervalo de confiança.`;
  }

  $('tableWrap').innerHTML =
    `<p class="text-xs font-semibold mb-2">Tabela 1 — Estatística descritiva e inferencial</p>
     <table class="apa">
       <thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
       <tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
       <tfoot><tr><td colspan="${head.length}">Nota. ${note}</td></tr></tfoot>
     </table>`;
  last.table = { head, body, note };

  /* --- gráfico --- */
  if (chart) chart.destroy();
  const ctx = $('chart').getContext('2d');
  let cfg;

  if (res._scatter) {
    const xs = res._scatter.map(p => p.x), ys = res._scatter.map(p => p.y);
    const lr = res.slope ? res : S.linearRegression(xs, ys);
    const mn = Math.min(...xs), mx = Math.max(...xs);
    cfg = {
      data: {
        datasets: [
          { type: 'scatter', label: 'Observações', data: res._scatter,
            backgroundColor: light ? 'rgba(37,99,235,.75)' : 'rgba(37,99,235,.65)', pointRadius: 4 },
          { type: 'line', label: `Reta de ajuste (R² = ${S.br(lr.r2, 3)})`, pointRadius: 0,
            borderColor: '#dc2626', borderWidth: 2,
            data: [{ x: mn, y: lr.intercept.b + lr.slope.b * mn },
                   { x: mx, y: lr.intercept.b + lr.slope.b * mx }] }
        ]
      }
    };
  } else {
    const sds = res.groups.map(s => s.sd);
    const names = res._paired
      ? [labels.x, labels.y]
      : (labels.groups || res.groups.map((_, i) => 'Grupo ' + (i + 1)));
    cfg = {
      data: {
        labels: names,
        datasets: [{
          type: 'bar',
          label: res._paired ? 'Média' : labels.y,
          data: res.groups.map(s => s.mean),
          backgroundColor: light ? 'rgba(37,99,235,.55)' : 'rgba(37,99,235,.65)',
          borderColor: '#2563eb', borderWidth: 1,
          _sd: sds                                  // 🔧 CORREÇÃO 3
        }]
      },
      plugins: [errorBarPlugin]
    };
  }

  const xTitle = res._scatter ? labels.x : (res._paired ? 'Momento da avaliação' : labels.x);
  const yTitle = res._paired ? 'Escore' : labels.y;
  cfg.options = {
    responsive: true, maintainAspectRatio: false, devicePixelRatio: 3, animation: false,
    layout: { padding: { top: 8, right: 12 } },
    plugins: {
      legend: { labels: { color: fg, font: { size: 11 } } },
      title: {
        display: true, color: fg, font: { size: 13 },
        text: res._scatter ? `Relação entre ${labels.x} e ${labels.y}`
          : `Média de ${yTitle} por ${xTitle}`
      },
      subtitle: !res._scatter ? {
        display: true, color: fg, font: { size: 10, style: 'italic' },
        text: 'Barras de erro representam ±1 desvio-padrão.', padding: { bottom: 6 }
      } : { display: false }
    },
    scales: {
      x: { type: res._scatter ? 'linear' : 'category',
           title: { display: true, text: xTitle, color: fg, font: { size: 11 } },
           ticks: { color: fg }, grid: { color: grid } },
      y: { title: { display: true, text: yTitle, color: fg, font: { size: 11 } },
           ticks: { color: fg }, grid: { color: grid } }
    }
  };
  chart = new Chart(ctx, cfg);

  /* --- parágrafo ABNT --- */
  $('reportBox').textContent = buildReport(res, labels);
}

/* ============ redação do parágrafo ============ */
function buildReport(res, labels) {
  // usa o gerador do stats.js e complementa o que faltar
  let txt = '';
  try { txt = S.report(res, labels) || ''; } catch (_) {}
  if (txt && !/undefined|NaN/.test(txt)) {
    if (discarded > 0)
      txt += ` Foram excluídas ${discarded} observação(ões) por ausência de dados.`;
    return txt;
  }

  // fallback próprio
  const pTxt = S.fmtP(res.p).replace(/^p\s*/, '');
  const sig = res.p < 0.05;
  const eff = res.effect ? ` ${res.effect.name} = ${S.br(res.effect.value, 3)}, indicando efeito de magnitude ${res.effect.label.toLowerCase()}.` : '';

  if (res._scatter && res.r !== undefined) {
    const dir = res.r > 0 ? 'positiva' : 'negativa';
    const mag = Math.abs(res.r) < .3 ? 'fraca' : Math.abs(res.r) < .5 ? 'moderada' : Math.abs(res.r) < .7 ? 'moderada a forte' : 'forte';
    return `A ${res.test} indicou correlação ${dir} ${mag}${sig ? ' e estatisticamente significativa' : ', sem significância estatística,'} `
      + `entre ${labels.x} e ${labels.y} (${res.test.includes('Spearman') ? 'ρ' : 'r'} = ${S.br(res.r, 3)}; ${S.fmtP(res.p)}). `
      + `Ressalta-se que a correlação observada não permite inferência de causalidade.`;
  }
  if (res._scatter) {
    return `A regressão linear simples ${sig ? 'mostrou-se estatisticamente significativa' : 'não alcançou significância estatística'} `
      + `(${S.fmtP(res.p)}), explicando ${S.br((res.r2 || 0) * 100, 1)}% da variância de ${labels.y} (R² = ${S.br(res.r2, 3)}). `
      + `A equação estimada foi ${res.equation || '—'}.`;
  }
  const gs = (res.groups || []).map((s, i) =>
    `${(labels.groups || [])[i] || 'Grupo ' + (i + 1)} (M = ${S.br(s.mean)}; DP = ${S.br(s.sd)}; n = ${s.n})`);
  return `${sig ? 'Observou-se diferença estatisticamente significativa' : 'Não foi observada diferença estatisticamente significativa'} `
    + `entre ${gs.join(' e ')}, conforme o ${res.test} (${S.fmtP(res.p)}).${eff}`
    + `${!sig ? ' Ressalta-se que a ausência de significância não permite afirmar equivalência entre os grupos.' : ''}`;
}

/* ============ ações ============ */
$('btnTheme').onclick = () => {
  light = !light;
  $('exportArea').classList.toggle('light', light);
  $('btnTheme').textContent = light ? 'Tema escuro' : 'Tema claro (exportação)';
  if (last) render();
};

// 🔧 CORREÇÃO c: espera o render de fato terminar
$('btnPng').onclick = async () => {
  if (!last) return;
  if (!light) $('btnTheme').click();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise(r => setTimeout(r, 120));
  chartToPNG(chart, 'figura1.png', 300);
};

$('btnDocx').onclick = async () => {
  if (!last?.table) {
    alert('Execute uma análise antes de exportar.');
    return;
  }

  const button = $('btnDocx');
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = 'Gerando DOCX...';

    await tableToDocx({
      title: 'Tabela 1 — Estatística descritiva e inferencial',
      headers: last.table.head,
      rows: last.table.body,
      note: last.table.note,
      reportText: $('reportBox').textContent
    });

  } catch (error) {
    console.error('Erro ao gerar DOCX:', error);
    alert(`Não foi possível gerar o arquivo DOCX: ${error.message}`);

  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
};


// 🔧 CORREÇÃO 5: limite de tamanho + estado completo
$('btnShare').onclick = e => {
  if (!last) return alert('Execute uma análise antes de compartilhar.');
  if (rows.length > 60)
    return alert('O link compartilhável suporta até 60 linhas de dados. '
      + 'Para conjuntos maiores, utilize a exportação em .docx ou .png.');
  copyShareLink({
    t: last.t, xi: +$('colX').value, yi: +$('colY').value,
    obj: $('objective').value, pair: $('pairing').value, data: rows
  }, e.target);
};

$('btnCopyRep').onclick = e => navigator.clipboard.writeText($('reportBox').textContent)
  .then(() => { e.target.textContent = 'Copiado!'; setTimeout(() => e.target.textContent = 'Copiar', 1500); });

/* ============ restaurar de link ============ */
const st = loadState();
if (st?.data?.length) {
  rows = st.data;
  if (st.obj) $('objective').value = st.obj;
  if (st.pair) $('pairing').value = st.pair;
  setupColumns();
  if (st.xi != null) $('colX').value = st.xi;
  if (st.yi != null) $('colY').value = st.yi;
  if (st.t) $('testSel').value = st.t;
  relabel();
  setTimeout(run, 250);
}

