// js/calculadora.js — TCC Tools / StatsFor Thesis (bilíngue)
import * as S from './stats.js';
import { T, IS_EN, tTest, tEff, tLbl, applyI18n } from './i18n.js';
import { reportEn } from './report-en.js';
import { chartToPNG, tableToDocx } from './export.js';
import { copyShareLink, loadState, saveState } from './state.js';
import { mountShell } from './ui.js';

mountShell();
applyI18n();

let rows = [], chart = null, light = false, last = null, discarded = 0;
const $ = id => document.getElementById(id);
const isPaired = () => $('pairing')?.value === 'paired';
const num = v => S.toNumber(v);

/* ============ TEMA: fonte única de verdade ============ */
const THEME = {
  dark: {
    fg: '#e2e8f0', muted: '#94a3b8', grid: '#1e293b',
    bg: '#0b1020', bar: 'rgba(37,99,235,.65)', barBorder: '#2563eb',
    dot: 'rgba(37,99,235,.65)', fit: '#f87171', err: '#e2e8f0'
  },
  light: {
    fg: '#0f172a', muted: '#334155', grid: '#cbd5e1',
    bg: '#ffffff', bar: 'rgba(37,99,235,.55)', barBorder: '#1d4ed8',
    dot: 'rgba(29,78,216,.75)', fit: '#b91c1c', err: '#0f172a'
  }
};
const TH = () => THEME[light ? 'light' : 'dark'];

/* ============ plugin: fundo sólido (PNG não sai transparente) ============ */
const bgPlugin = {
  id: 'solidBg',
  beforeDraw(c) {
    const g = c.ctx;
    g.save();
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = TH().bg;
    g.fillRect(0, 0, c.width, c.height);
    g.restore();
  }
};

/* ============ plugin de barras de erro ============ */
const errorBarPlugin = {
  id: 'errBars',
  afterDatasetsDraw(c) {
    const ds = c.data.datasets[0];
    if (!ds?._sd) return;
    const meta = c.getDatasetMeta(0), y = c.scales.y, ctx = c.ctx;
    ctx.save();
    ctx.strokeStyle = TH().err;
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
  $('fileName').textContent = f.name;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: false });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
      setupColumns();
    } catch (err) { alert(T.errRead + err.message); }
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
    rows = [[IS_EN ? 'Pre' : 'Pre_intervencao', IS_EN ? 'Post' : 'Pos_intervencao'],
      ...Array.from({ length: 30 }, () => {
        const pre = 55 + Math.random() * 14;
        return [+pre.toFixed(1), +(pre + 8 + (Math.random() - .35) * 9).toFixed(1)];
      })];
  } else {
    rows = [[IS_EN ? 'Group' : 'Grupo',
             IS_EN ? 'Age' : 'Idade',
             IS_EN ? 'Performance' : 'Desempenho'],
      ...Array.from({ length: 40 }, (_, i) => {
        const g = i < 20 ? (IS_EN ? 'Control' : 'Controle')
                         : (IS_EN ? 'Treatment' : 'Intervenção');
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
  if (!rows.length || rows.length < 2) return alert(T.errEmpty);
  const hdr = rows[0];
  const opts = hdr.map((h, i) =>
    `<option value="${i}">${h || `${T.colWord} ${i + 1}`}</option>`).join('');
  $('colX').innerHTML = opts;
  $('colY').innerHTML = opts;
  $('colY').selectedIndex = Math.min(hdr.length - 1, hdr.length > 2 ? 2 : 1);
  $('colBox').classList.remove('hidden');
  $('preview').textContent = T.rowsLoaded(rows.length - 1, hdr.length);

  if (!wired) {
    wired = true;
    ['colX', 'colY', 'objective', 'pairing'].forEach(id =>
      $(id).addEventListener('change', () => { relabel(); checkAssumptions(); suggest(); }));
  }
  relabel();
  checkAssumptions();
  suggest();
}

function relabel() {
  const obj = $('objective').value;
  const lx = $('labX'), ly = $('labY');
  if (!lx || !ly) return;
  if (obj === 'compare2' && isPaired()) {
    lx.textContent = T.labPre;
    ly.textContent = T.labPos;
  } else if (obj === 'correlate' || obj === 'regression') {
    lx.textContent = obj === 'regression' ? T.labPredX : T.labVarX;
    ly.textContent = obj === 'regression' ? T.labPredY : T.labVarY;
  } else {
    lx.textContent = T.labGroup;
    ly.textContent = T.labOutcome;
  }
}

const colVals = i => rows.slice(1).map(r => r?.[i]);
const numCol = i => S.clean(colVals(i));

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

function grouped() {
  const xi = +$('colX').value, yi = +$('colY').value, map = {};
  let bad = 0;
  rows.slice(1).forEach(r => {
    if (!r) return;
    const y = num(r[yi]);
    if (!Number.isFinite(y)) { bad++; return; }
    const k = String(r[xi] ?? `${T.groupWord} 1`).trim() || T.unlabeled;
    (map[k] ||= []).push(y);
  });
  discarded = bad;
  return map;
}

/* ============ pressupostos ============ */
const badge = (t, v, ok) => `<div class="kv">
  <span>${t}</span>
  <span>${v} <span class="tag ${ok ? 'tag-ok' : 'tag-no'}">${
    ok ? T.okTag : T.violatedTag}</span></span></div>`;

function checkAssumptions() {
  const box = $('assump');
  const obj = $('objective').value;
  const xi = +$('colX').value, yi = +$('colY').value;
  let html = '';

  if (obj === 'compare2' && isPaired()) {
    const dif = numericPairs(xi, yi).map(([a, b]) => b - a);
    if (dif.length >= 3) {
      const sw = S.shapiroWilk(dif);
      html = badge(T.swDiff(rows[0][yi], rows[0][xi], dif.length),
        `W = ${S.br(sw.W, 4)}; ${S.fmtP(sw.p)}`, sw.normal);
    }
  } else if (obj === 'correlate' || obj === 'regression') {
    [['X', xi], ['Y', yi]].forEach(([lab, i]) => {
      const v = numCol(i);
      if (v.length < 3) return;
      const sw = S.shapiroWilk(v);
      html += badge(T.swVar(lab, rows[0][i], v.length),
        `W = ${S.br(sw.W, 4)}; ${S.fmtP(sw.p)}`, sw.normal);
    });
    if (obj === 'regression') {
      const pr = numericPairs(xi, yi);
      if (pr.length >= 4) {
        const lr = S.linearRegression(pr.map(p => p[0]), pr.map(p => p[1]));
        const resid = pr.map(([x, y]) => y - (lr.intercept.b + lr.slope.b * x));
        const sw = S.shapiroWilk(resid);
        html += badge(T.swResid, `W = ${S.br(sw.W, 4)}; ${S.fmtP(sw.p)}`, sw.normal);
      }
    }
  } else {
    const g = grouped(), names = Object.keys(g);
    names.forEach(n => {
      if (g[n].length < 3) return;
      const sw = S.shapiroWilk(g[n]);
      html += badge(T.swGroup(n, g[n].length),
        `W = ${S.br(sw.W, 4)}; ${S.fmtP(sw.p)}`, sw.normal);
    });
    if (names.length > 1) {
      try {
        const lv = S.levene(names.map(n => g[n]));
        html += badge(T.leveneLab, `F = ${S.br(lv.F)}; ${S.fmtP(lv.p)}`, lv.p > 0.05);
      } catch (_) {}
    }
  }

  if (discarded > 0) html += `<p class="hint">${T.discarded(discarded)}</p>`;
  box.innerHTML = html || `<span class="muted-note">${T.insufficient}</span>`;
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
  if (rows.length < 2) return alert(T.errLoadFirst);
  const t = $('testSel').value;
  const xi = +$('colX').value, yi = +$('colY').value;
  if (xi === yi && t !== 'anova' && t !== 'kruskal') return alert(T.errSameCol);

  const labels = { x: rows[0][xi] || 'X', y: rows[0][yi] || 'Y' };
  let res;

  try {
    if (['pearson', 'spearman', 'reg'].includes(t)) {
      const pairs = numericPairs(xi, yi);
      if (pairs.length < 4) return alert(T.errPairs(pairs.length));
      const X = pairs.map(p => p[0]), Y = pairs.map(p => p[1]);
      res = t === 'pearson' ? S.pearson(X, Y)
          : t === 'spearman' ? S.spearman(X, Y)
          : S.linearRegression(X, Y);
      res._scatter = pairs.map(([x, y]) => ({ x, y }));

    } else if (['t_paired', 'wilcoxon'].includes(t)) {
      const pairs = numericPairs(xi, yi);
      if (pairs.length < 3) return alert(T.errPaired(pairs.length));
      const A = pairs.map(p => p[0]), B = pairs.map(p => p[1]);
      res = t === 't_paired' ? S.tTestPaired(A, B) : S.wilcoxon(A, B);
      labels.groups = [labels.x, labels.y];
      labels.paired = true;
      res._paired = { A, B };

    } else {
      const g = grouped(), names = Object.keys(g), arr = names.map(n => g[n]);
      labels.groups = names;
      if (!arr.length) return alert(T.errNoNum(labels.y));
      if (arr.some(a => a.length < 2)) return alert(T.errMin2);
      if (['t_indep', 'mann'].includes(t) && arr.length !== 2)
        return alert(T.errNeed2(arr.length, names.join(', '), labels.x));
      if (['anova', 'kruskal'].includes(t) && arr.length < 3)
        return alert(T.errNeed3(arr.length));
      res = t === 't_indep' ? S.tTestIndependent(arr[0], arr[1])
          : t === 'mann' ? S.mannWhitney(arr[0], arr[1])
          : t === 'anova' ? S.anovaOneWay(arr, names)
          : S.kruskalWallis(arr, names);
      res._groups = g;
    }
  } catch (e) {
    console.error(e);
    return alert(T.errCalc + e.message);
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
  const th = TH();
  const fg = th.fg, muted = th.muted, grid = th.grid;
  const testLabel = tTest(res.test);
  const isSpearman = res.test === 'Correlação de Spearman';

  /* --- métricas --- */
  const cards = [];
  const push = (k, v) => cards.push(
    `<div class="metric"><div class="metric-k">${k}</div><div class="metric-v">${v}</div></div>`);
  push(T.mTest, testLabel);
  if (res.t !== undefined) push('t', S.br(res.t, 3));
  if (res.df !== undefined) push(T.mDf, typeof res.df === 'number' ? S.br(res.df, res.df % 1 ? 1 : 0) : res.df);
  if (res.F !== undefined) push('F', S.br(res.F, 3));
  if (res.H !== undefined) push('H', S.br(res.H, 3));
  if (res.U !== undefined) push('U', S.br(res.U, 1));
  if (res.T !== undefined) push('T', S.br(res.T, 1));
  if (res.z !== undefined) push('z', S.br(res.z, 3));
  if (res.r !== undefined) push(isSpearman ? 'ρ' : 'r', S.br(res.r, 3));
  if (res.r2 !== undefined) push('R²', S.br(res.r2, 3));
  push(T.mP, `<span class="${res.p < 0.05 ? 'p-sig' : 'p-ns'}">${S.fmtP(res.p)}</span>`);
  if (res.effect) push(tEff(res.effect.name),
    `${S.br(res.effect.value, 3)} (${tLbl(res.effect.label)})`);
  if (res.slope) push(T.mSlope, S.br(res.slope.b, 4));
  if (res.intercept) push(T.mIntercept, S.br(res.intercept.b, 4));
  $('statsGrid').innerHTML = cards.join('');

  /* --- tabela --- */
  let head, body, note = '';
  const effTxt = res.effect
    ? `. ${tEff(res.effect.name)} = ${S.br(res.effect.value, 3)} (${tLbl(res.effect.label)})`
    : '';

  if (res._scatter) {
    head = [T.thVar, T.thN, T.thM, T.thSD, T.thMd, T.thRange];
    const dx = S.describe(res._scatter.map(p => p.x));
    const dy = S.describe(res._scatter.map(p => p.y));
    body = [[labels.x, dx], [labels.y, dy]].map(([nm, s]) =>
      [nm, s.n, S.br(s.mean), S.br(s.sd), S.br(s.median), `${S.br(s.min)}–${S.br(s.max)}`]);
    note = res.r !== undefined
      ? `${testLabel}. ${isSpearman ? 'ρ' : 'r'} = ${S.br(res.r, 3)}; `
        + `${S.fmtP(res.p)}; n = ${dx.n}. ${T.noteAbbrShort}`
      : T.regNote(S.br(res.r2, 3),
                  res.r2adj !== undefined ? S.br(res.r2adj, 3) : null,
                  S.fmtP(res.p), res.equation || '—');

  } else if (res._paired) {
    head = [T.thMoment, T.thN, T.thM, T.thSD, T.thMd, T.thCI];
    const dA = S.describe(res._paired.A), dB = S.describe(res._paired.B);
    const dD = S.describe(res._paired.B.map((v, i) => v - res._paired.A[i]));
    body = [[labels.x, dA], [labels.y, dB], [T.diffLabel, dD]].map(([nm, s]) =>
      [nm, s.n, S.br(s.mean), S.br(s.sd), S.br(s.median),
       `[${S.br(s.ci95[0])}; ${S.br(s.ci95[1])}]`]);
    note = `${testLabel} ${T.pairedSuffix}. ${S.fmtP(res.p)}${effTxt}. ${T.noteAbbr}`;

  } else {
    head = [T.thGroup, T.thN, T.thM, T.thSD, T.thMd, T.thCI];
    const names = labels.groups || res.groups.map((_, i) => `${T.groupWord} ${i + 1}`);
    body = res.groups.map((s, i) => [names[i], s.n, S.br(s.mean), S.br(s.sd), S.br(s.median),
      `[${S.br(s.ci95[0])}; ${S.br(s.ci95[1])}]`]);
    note = `${testLabel}. ${S.fmtP(res.p)}${effTxt}. ${T.noteAbbr}`;
  }

  $('tableWrap').innerHTML =
    `<p class="tbl-title">${T.tableTitle}</p>
     <table class="apa" id="apaTable">
       <thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
       <tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
       <tfoot><tr><td colspan="${head.length}">${T.note} ${note}</td></tr></tfoot>
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
          { type: 'scatter', label: T.obs, data: res._scatter,
            backgroundColor: th.dot, pointRadius: 4 },
          { type: 'line', label: T.fitLine(S.br(lr.r2, 3)), pointRadius: 0,
            borderColor: th.fit, borderWidth: 2,
            data: [{ x: mn, y: lr.intercept.b + lr.slope.b * mn },
                   { x: mx, y: lr.intercept.b + lr.slope.b * mx }] }
        ]
      },
      plugins: [bgPlugin]
    };
  } else {
    const sds = res.groups.map(s => s.sd);
    const names = res._paired
      ? [labels.x, labels.y]
      : (labels.groups || res.groups.map((_, i) => `${T.groupWord} ${i + 1}`));
    cfg = {
      data: {
        labels: names,
        datasets: [{
          type: 'bar',
          label: res._paired ? T.mean : labels.y,
          data: res.groups.map(s => s.mean),
          backgroundColor: th.bar,
          borderColor: th.barBorder, borderWidth: 1,
          _sd: sds
        }]
      },
      plugins: [bgPlugin, errorBarPlugin]
    };
  }

  const xTitle = res._scatter ? labels.x : (res._paired ? T.axisMoment : labels.x);
  const yTitle = res._paired ? T.axisScore : labels.y;
  cfg.options = {
    responsive: true, maintainAspectRatio: false, devicePixelRatio: Math.min(4, Math.max(3, 300 / 96)), animation: false,
    layout: { padding: { top: 8, right: 12, bottom: 4, left: 4 } },
    plugins: {
      legend: { labels: { color: fg, font: { size: 11 } } },
      title: {
        display: true, color: fg, font: { size: 13, weight: '600' },
        text: res._scatter ? T.chartRel(labels.x, labels.y) : T.chartMean(yTitle, xTitle)
      },
      subtitle: !res._scatter ? {
        display: true, color: muted, font: { size: 10, style: 'italic' },
        text: T.errBarNote, padding: { bottom: 6 }
      } : { display: false },
      tooltip: { enabled: true }
    },
    scales: {
      x: { type: res._scatter ? 'linear' : 'category',
           title: { display: true, text: xTitle, color: fg, font: { size: 11 } },
           ticks: { color: muted }, grid: { color: grid, borderColor: grid } },
      y: { title: { display: true, text: yTitle, color: fg, font: { size: 11 } },
           ticks: { color: muted }, grid: { color: grid, borderColor: grid } }
    }
  };
  chart = new Chart(ctx, cfg);

  const rep = buildReport(res, labels);
  $('reportBox').innerHTML = rep.html;
  last.reportText = rep.text;
}

/* ============ redação do parágrafo ============ */
function buildReport(res, labels) {
  if (IS_EN) {
    try {
      const r = reportEn(res, labels);
      if (r.html && !/undefined|NaN/.test(r.text)) {
        if (discarded > 0) {
          const add = T.rep.excluded(discarded);
          return { html: r.html + add, text: r.text + add };
        }
        return r;
      }
    } catch (e) { console.warn('reportEn:', e); }
  } else {
    try {
      let txt = S.report(res, labels) || '';
      if (txt && !/undefined|NaN/.test(txt)) {
        if (discarded > 0) txt += T.rep.excluded(discarded);
        return { html: txt, text: txt };
      }
    } catch (_) {}
  }

  /* fallback bilíngue */
  const R = T.rep, sig = res.p < 0.05, testLabel = tTest(res.test);
  const eff = res.effect
    ? R.effSuffix(tEff(res.effect.name), S.br(res.effect.value, 3), tLbl(res.effect.label))
    : '';
  let out;
  if (res._scatter && res.r !== undefined) {
    const a = Math.abs(res.r);
    const mag = a < .3 ? R.magWeak : a < .5 ? R.magMod : a < .7 ? R.magModStrong : R.magStrong;
    out = R.corr(testLabel, res.r > 0 ? R.dirPos : R.dirNeg, mag, sig,
      res.test === 'Correlação de Spearman' ? 'ρ' : 'r',
      S.br(res.r, 3), S.fmtP(res.p), labels.x, labels.y);
  } else if (res._scatter) {
    out = R.reg(sig, S.fmtP(res.p), S.br((res.r2 || 0) * 100, 1), S.br(res.r2, 3), res.equation || '—');
  } else {
    const gs = (res.groups || []).map((s, i) =>
      R.grpDesc((labels.groups || [])[i] || `${T.groupWord} ${i + 1}`,
        S.br(s.mean), S.br(s.sd), s.n));
    out = R.cmp(sig, gs.join(R.and), testLabel, S.fmtP(res.p), eff);
  }
  if (discarded > 0) out += R.excluded(discarded);
  return { html: out, text: out };
}

/* ============ tema ============ */
function setTheme(toLight) {
  light = toLight;
  const area = $('exportArea');
  area.classList.toggle('light', light);
  area.dataset.theme = light ? 'light' : 'dark';
  $('btnTheme').textContent = light ? T.themeDark : T.themeLight;
  if (last) render();
}

$('btnTheme').onclick = () => setTheme(!light);
setTheme(false);

/* ============ exportar PNG ============ */
const nextFrames = n => new Promise(r => {
  const step = k => k ? requestAnimationFrame(() => step(k - 1)) : r();
  step(n);
});

$('btnPng').onclick = async () => {
  if (!last) return;
  const was = light;
  if (!was) setTheme(true);
  await nextFrames(3);
  await new Promise(r => setTimeout(r, 120));
  chartToPNG(chart, T.figFile, 300);
  if (!was) { await new Promise(r => setTimeout(r, 400)); setTheme(false); }
};

/* ============ COPIAR FIGURA (bitmap para o clipboard) ============ */
async function copyChart(btn) {
  if (!chart) return;
  const src = $('chart');
  // recompõe em canvas offscreen com fundo sólido e escala 3x
  const scale = 3;
  const off = document.createElement('canvas');
  off.width = src.width; off.height = src.height;
  const g = off.getContext('2d');
  g.fillStyle = TH().bg;
  g.fillRect(0, 0, off.width, off.height);
  g.drawImage(src, 0, 0);

  try {
    const blob = await new Promise(r => off.toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    flash(btn, T.copied || 'copiado', T.copyFig || 'Copiar figura');
  } catch (e) {
    // fallback: abre a imagem para salvar manualmente
    const url = off.toDataURL('image/png');
    const w = window.open('');
    if (w) w.document.write(`<img src="${url}" style="max-width:100%">`);
  }
}

/* ============ COPIAR TABELA (HTML + TSV) ============ */
function tableHtmlForWord() {
  const { head, body, note } = last.table;
  const S1 = "font-family:'Times New Roman',serif;font-size:11pt;color:#000";
  const th = `${S1};border-bottom:1px solid #000;padding:4px 8px;text-align:left;font-weight:bold`;
  const td = `${S1};padding:4px 8px;text-align:left`;
  return `<table style="border-collapse:collapse;${S1}">
  <thead>
    <tr><th colspan="${head.length}" style="${S1};border-top:1px solid #000;border-bottom:none;padding:4px 8px;text-align:left">${T.tableTitle}</th></tr>
    <tr>${head.map(h => `<th style="${th}">${h}</th>`).join('')}</tr>
  </thead>
  <tbody>${body.map(r => `<tr>${r.map(c => `<td style="${td}">${c}</td>`).join('')}</tr>`).join('')}</tbody>
  <tfoot><tr><td colspan="${head.length}" style="${S1};border-top:1px solid #000;padding:6px 8px;font-size:10pt;font-style:italic">${T.note} ${note}</td></tr></tfoot>
</table>`;
}

function tableTsv() {
  const { head, body, note } = last.table;
  return [head.join('\t'), ...body.map(r => r.join('\t')), '', `${T.note} ${note}`].join('\n');
}

async function copyTable(btn) {
  if (!last?.table) return alert(T.errExportFirst);
  const html = tableHtmlForWord(), tsv = tableTsv();
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([tsv], { type: 'text/plain' })
    })]);
  } catch (_) {
    // fallback universal: seleção invisível + execCommand
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff';
    holder.innerHTML = html;
    document.body.appendChild(holder);
    const rng = document.createRange();
    rng.selectNodeContents(holder);
    const sel = getSelection();
    sel.removeAllRanges(); sel.addRange(rng);
    document.execCommand('copy');
    sel.removeAllRanges();
    holder.remove();
  }
  flash(btn, T.copied || 'copiado', T.copyTable || 'Copiar tabela');
}

function flash(btn, done, back) {
  if (!btn) return;
  btn.textContent = done;
  setTimeout(() => { btn.textContent = back; }, 1600);
}

/* injeta os dois botões ao lado dos existentes, sem tocar no HTML */
(function mountCopyActions() {
  const ref = $('btnDocx') || $('btnPng');
  if (!ref?.parentElement) return;
  const mk = (id, txt, fn) => {
    if ($(id)) return $(id);
    const b = document.createElement('button');
    b.id = id; b.type = 'button';
    b.className = ref.className;
    b.textContent = txt;
    b.onclick = () => fn(b);
    ref.parentElement.insertBefore(b, ref.nextSibling);
    return b;
  };
  mk('btnCopyTable', T.copyTable || (IS_EN ? 'Copy table' : 'Copiar tabela'), copyTable);
  mk('btnCopyChart', T.copyFig || (IS_EN ? 'Copy figure' : 'Copiar figura'), copyChart);
})();

/* ============ ações restantes ============ */
$('btnDocx').onclick = async () => {
  if (!last?.table) { alert(T.errExportFirst); return; }
  const button = $('btnDocx');
  const originalText = button.textContent;
  try {
    button.disabled = true;
    button.textContent = T.genDocx;
    await tableToDocx({
      title: T.tableTitle,
      headers: last.table.head,
      rows: last.table.body,
      note: last.table.note,
      noteLabel: T.note,
      lang: T.locale,
      reportText: last.reportText || ''
    });
  } catch (error) {
    console.error('DOCX error:', error);
    alert(T.errDocx(error.message));
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
};

$('btnShare').onclick = e => {
  if (!last) return alert(T.errRunFirst);
  if (rows.length > 60) return alert(T.errShareLimit);
  copyShareLink({
    t: last.t, xi: +$('colX').value, yi: +$('colY').value,
    obj: $('objective').value, pair: $('pairing').value, data: rows
  }, e.target);
};

$('btnCopyRep').onclick = e => navigator.clipboard.writeText(last?.reportText || '')
  .then(() => { e.target.textContent = T.copied;
                setTimeout(() => e.target.textContent = T.copy, 1500); });

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
