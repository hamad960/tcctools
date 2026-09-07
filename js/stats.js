// js/stats.js
import { normCdf, normInv, normPdf, tTwoTailed, tInv, fPvalue, chi2Pvalue } from './dist.js';

// >>> CORREÇÃO: re-exporta as primitivas de distribuição para as páginas que as consomem
export { normCdf, normInv, normPdf, tTwoTailed, tInv, fPvalue, chi2Pvalue };

// ================= utilitários =================
export const clean = arr => arr
  .map(v => (typeof v === 'string' ? v.replace(',', '.').trim() : v))
  .map(Number)
  .filter(v => Number.isFinite(v));

export const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
export const variance = a => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1); };
export const sd = a => Math.sqrt(variance(a));
export const sem = a => sd(a) / Math.sqrt(a.length);

export function median(a) {
  const s = [...a].sort((x, y) => x - y), n = s.length, h = n >> 1;
  return n % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
export function quantile(a, q) {
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
export function ranks(a) { // ranks médios com correção de empates
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const r = new Array(a.length); let i = 0;
  const ties = [];
  while (i < idx.length) {
    let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    if (j > i) ties.push(j - i + 1);
    i = j + 1;
  }
  return { r, ties };
}
export const describe = a => ({
  n: a.length, mean: mean(a), sd: sd(a), sem: sem(a),
  median: median(a), min: Math.min(...a), max: Math.max(...a),
  q1: quantile(a, 0.25), q3: quantile(a, 0.75),
  skew: skewness(a), kurt: kurtosis(a),
  ci95: ciMean(a)
});
export function ciMean(a, conf = 0.95) {
  const t = tInv(1 - (1 - conf) / 2, a.length - 1), m = mean(a), e = t * sem(a);
  return [m - e, m + e];
}
export function skewness(a) {
  const n = a.length, m = mean(a), s = sd(a);
  return (n / ((n - 1) * (n - 2))) * a.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
}
export function kurtosis(a) {
  const n = a.length, m = mean(a), s = sd(a);
  const g2 = a.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0) * n * (n + 1) / ((n - 1) * (n - 2) * (n - 3));
  return g2 - 3 * (n - 1) ** 2 / ((n - 2) * (n - 3));
}

// ================= SHAPIRO-WILK (Royston 1995) =================
export function shapiroWilk(data) {
  const x = [...data].sort((a, b) => a - b), n = x.length;
  if (n < 3) return { error: 'n mínimo = 3' };
  if (n > 5000) return { error: 'n máximo = 5000' };

  const m = [];
  for (let i = 1; i <= n; i++) m.push(normInv((i - 0.375) / (n + 0.25)));
  const ssm = m.reduce((s, v) => s + v * v, 0);
  const c = m.map(v => v / Math.sqrt(ssm));
  const a = [...c];
  const u = 1 / Math.sqrt(n);

  if (n > 5) {
    const an = -2.706056*u**5 + 4.434685*u**4 - 2.071190*u**3 - 0.147981*u**2 + 0.221157*u + c[n-1];
    const an1 = -3.582633*u**5 + 5.682633*u**4 - 1.752461*u**3 - 0.293762*u**2 + 0.042981*u + c[n-2];
    const phi = (ssm - 2*m[n-1]**2 - 2*m[n-2]**2) / (1 - 2*an**2 - 2*an1**2);
    a[n-1] = an; a[0] = -an; a[n-2] = an1; a[1] = -an1;
    for (let i = 2; i < n - 2; i++) a[i] = m[i] / Math.sqrt(phi);
  } else {
    const an = -2.706056*u**5 + 4.434685*u**4 - 2.071190*u**3 - 0.147981*u**2 + 0.221157*u + c[n-1];
    const phi = (ssm - 2*m[n-1]**2) / (1 - 2*an**2);
    a[n-1] = an; a[0] = -an;
    for (let i = 1; i < n - 1; i++) a[i] = m[i] / Math.sqrt(phi);
  }

  const mx = mean(x);
  const num = a.reduce((s, ai, i) => s + ai * x[i], 0) ** 2;
  const den = x.reduce((s, v) => s + (v - mx) ** 2, 0);
  const W = num / den;

  // p-valor (Royston)
  let p, mu, sigma;
  const ln = Math.log(n);
  if (n === 3) {
    p = Math.max(0, Math.min(1, (6 / Math.PI) * (Math.asin(Math.sqrt(W)) - Math.asin(Math.sqrt(0.75)))));
  } else if (n <= 11) {
    const g = -2.273 + 0.459 * n;
    mu = 0.5440 - 0.39978*n + 0.025054*n**2 - 0.0006714*n**3;
    sigma = Math.exp(1.3822 - 0.77857*n + 0.062767*n**2 - 0.0020322*n**3);
    const y = -Math.log(g - Math.log(1 - W));
    p = 1 - normCdf((y - mu) / sigma);
  } else {
    mu = -1.5861 - 0.31082*ln - 0.083751*ln**2 + 0.0038915*ln**3;
    sigma = Math.exp(-0.4803 - 0.082676*ln + 0.0030302*ln**2);
    const y = Math.log(1 - W);
    p = 1 - normCdf((y - mu) / sigma);
  }
  return { W, p, n, normal: p > 0.05 };
}

export function qqPlotData(data) {
  const x = [...data].sort((a, b) => a - b), n = x.length;
  const m = mean(x), s = sd(x);
  const pts = x.map((v, i) => ({ x: normInv((i + 1 - 0.375) / (n + 0.25)), y: v }));
  const th = pts.map(p => p.x);
  return {
    points: pts,
    line: [{ x: Math.min(...th), y: m + s * Math.min(...th) },
           { x: Math.max(...th), y: m + s * Math.max(...th) }]
  };
}

// Levene (centrado na média) — homocedasticidade
export function levene(groups) {
  const k = groups.length, N = groups.reduce((s, g) => s + g.length, 0);
  const z = groups.map(g => { const mg = mean(g); return g.map(v => Math.abs(v - mg)); });
  const zbar = z.map(mean), zTot = mean(z.flat());
  const num = z.reduce((s, zi, i) => s + zi.length * (zbar[i] - zTot) ** 2, 0) * (N - k);
  const den = z.reduce((s, zi, i) => s + zi.reduce((a, v) => a + (v - zbar[i]) ** 2, 0), 0) * (k - 1);
  const F = num / den;
  return { F, df1: k - 1, df2: N - k, p: fPvalue(F, k - 1, N - k) };
}

// ================= TESTES =================
export function tTestIndependent(a, b, { welch = 'auto' } = {}) {
  const n1 = a.length, n2 = b.length, m1 = mean(a), m2 = mean(b);
  const v1 = variance(a), v2 = variance(b);
  const lev = levene([a, b]);
  const useWelch = welch === true || (welch === 'auto' && lev.p < 0.05);
  let t, df;
  if (useWelch) {
    t = (m1 - m2) / Math.sqrt(v1 / n1 + v2 / n2);
    df = (v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
  } else {
    const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
    t = (m1 - m2) / Math.sqrt(sp2 * (1 / n1 + 1 / n2));
    df = n1 + n2 - 2;
  }
  const sp = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  const d = (m1 - m2) / sp;
  const seDiff = Math.abs((m1 - m2) / t);
  const tc = tInv(0.975, df);
  return {
    test: useWelch ? "Teste t de Welch (variâncias desiguais)" : "Teste t de Student independente",
    t, df, p: tTwoTailed(t, df), diff: m1 - m2,
    ciDiff: [(m1 - m2) - tc * seDiff, (m1 - m2) + tc * seDiff],
    effect: { name: "d de Cohen", value: d, label: effectD(d) },
    levene: lev, groups: [describe(a), describe(b)]
  };
}

export function tTestPaired(a, b) {
  const d = a.map((v, i) => v - b[i]).filter(Number.isFinite);
  const n = d.length, md = mean(d), sdd = sd(d);
  const t = md / (sdd / Math.sqrt(n)), df = n - 1;
  const tc = tInv(0.975, df), e = tc * sdd / Math.sqrt(n);
  const dz = md / sdd;
  return {
    test: "Teste t pareado", t, df, p: tTwoTailed(t, df), diff: md,
    ciDiff: [md - e, md + e],
    effect: { name: "d de Cohen (dz)", value: dz, label: effectD(dz) },
    groups: [describe(a), describe(b)]
  };
}

export function mannWhitney(a, b) {
  const all = [...a, ...b], { r, ties } = ranks(all);
  const n1 = a.length, n2 = b.length;
  const R1 = r.slice(0, n1).reduce((s, v) => s + v, 0);
  const U1 = R1 - n1 * (n1 + 1) / 2, U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);
  const mu = n1 * n2 / 2;
  const N = n1 + n2;
  const tieCorr = ties.reduce((s, t) => s + (t ** 3 - t), 0);
  const sigma = Math.sqrt((n1 * n2 / 12) * ((N + 1) - tieCorr / (N * (N - 1))));
  const z = (U - mu) / sigma;
  const p = 2 * (1 - normCdf(Math.abs(z)));
  const rEff = Math.abs(z) / Math.sqrt(N);
  return {
    test: "Teste U de Mann-Whitney", U, U1, U2, z, p,
    effect: { name: "r (rank-biserial aprox.)", value: rEff, label: effectR(rEff) },
    groups: [describe(a), describe(b)]
  };
}

export function wilcoxon(a, b) {
  const diffs = a.map((v, i) => v - b[i]).filter(d => Number.isFinite(d) && d !== 0);
  const n = diffs.length;
  const { r, ties } = ranks(diffs.map(Math.abs));
  let Wp = 0, Wn = 0;
  diffs.forEach((d, i) => d > 0 ? Wp += r[i] : Wn += r[i]);
  const T = Math.min(Wp, Wn);
  const mu = n * (n + 1) / 4;
  const tieCorr = ties.reduce((s, t) => s + (t ** 3 - t), 0) / 48;
  const sigma = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - tieCorr);
  const z = (T - mu) / sigma;
  const p = 2 * (1 - normCdf(Math.abs(z)));
  const rEff = Math.abs(z) / Math.sqrt(n);
  return {
    test: "Teste de Wilcoxon (postos sinalizados)", T, z, p, n,
    effect: { name: "r", value: rEff, label: effectR(rEff) },
    groups: [describe(a), describe(b)]
  };
}

export function anovaOneWay(groups) {
  const k = groups.length, N = groups.reduce((s, g) => s + g.length, 0);
  const grand = mean(groups.flat());
  const SSB = groups.reduce((s, g) => s + g.length * (mean(g) - grand) ** 2, 0);
  const SSW = groups.reduce((s, g) => { const m = mean(g); return s + g.reduce((a, v) => a + (v - m) ** 2, 0); }, 0);
  const df1 = k - 1, df2 = N - k;
  const F = (SSB / df1) / (SSW / df2);
  const eta2 = SSB / (SSB + SSW);
  const omega2 = (SSB - df1 * (SSW / df2)) / (SSB + SSW + (SSW / df2));
  return {
    test: "ANOVA one-way", F, df1, df2, p: fPvalue(F, df1, df2),
    SSB, SSW, MSB: SSB / df1, MSW: SSW / df2,
    effect: { name: "η² (eta quadrado)", value: eta2, label: effectEta(eta2) },
    omega2, levene: levene(groups),
    posthoc: tukeyHSD(groups, SSW / df2, df2),
    groups: groups.map(describe)
  };
}

// Tukey HSD com aproximação de q via t de Bonferroni-Šidák (prático e conservador)
function tukeyHSD(groups, MSW, dfW) {
  const out = [];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const ni = groups[i].length, nj = groups[j].length;
      const diff = mean(groups[i]) - mean(groups[j]);
      const se = Math.sqrt(MSW * (1 / ni + 1 / nj));
      const t = diff / se;
      const nComp = groups.length * (groups.length - 1) / 2;
      const pRaw = tTwoTailed(t, dfW);
      out.push({
        pair: `G${i + 1} vs G${j + 1}`, diff, se, t,
        p: Math.min(1, pRaw * nComp), // Bonferroni
        sig: Math.min(1, pRaw * nComp) < 0.05
      });
    }
  }
  return out;
}

export function kruskalWallis(groups) {
  const all = groups.flat(), N = all.length;
  const { r, ties } = ranks(all);
  let off = 0, H = 0;
  groups.forEach(g => {
    const Ri = r.slice(off, off + g.length).reduce((s, v) => s + v, 0);
    H += (Ri ** 2) / g.length; off += g.length;
  });
  H = (12 / (N * (N + 1))) * H - 3 * (N + 1);
  const tieCorr = 1 - ties.reduce((s, t) => s + (t ** 3 - t), 0) / (N ** 3 - N);
  H = H / (tieCorr || 1);
  const df = groups.length - 1;
  const eps2 = H / (N - 1);
  return {
    test: "Kruskal-Wallis", H, df, p: chi2Pvalue(H, df),
    effect: { name: "ε² (epsilon quadrado)", value: eps2, label: effectEta(eps2) },
    groups: groups.map(describe)
  };
}

export function pearson(x, y) {
  const n = x.length, mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i]-mx)*(y[i]-my); sxx += (x[i]-mx)**2; syy += (y[i]-my)**2; }
  const r = sxy / Math.sqrt(sxx * syy);
  const df = n - 2, t = r * Math.sqrt(df / (1 - r * r));
  // IC de Fisher
  const z = 0.5 * Math.log((1 + r) / (1 - r)), se = 1 / Math.sqrt(n - 3);
  const lo = Math.tanh(z - 1.96 * se), hi = Math.tanh(z + 1.96 * se);
  return {
    test: "Correlação de Pearson", r, r2: r * r, df, t, p: tTwoTailed(t, df),
    ci95: [lo, hi], n,
    effect: { name: "r", value: r, label: effectR(Math.abs(r)) },
    x: describe(x), y: describe(y)
  };
}

export function spearman(x, y) {
  const rx = ranks(x).r, ry = ranks(y).r;
  const res = pearson(rx, ry);
  return { ...res, test: "Correlação de Spearman", rho: res.r, effect: { name: "ρ", value: res.r, label: effectR(Math.abs(res.r)) } };
}

export function linearRegression(x, y) {
  const n = x.length, mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i]-mx)*(y[i]-my); sxx += (x[i]-mx)**2; }
  const b1 = sxy / sxx, b0 = my - b1 * mx;
  const pred = x.map(v => b0 + b1 * v);
  const resid = y.map((v, i) => v - pred[i]);
  const SSE = resid.reduce((s, e) => s + e * e, 0);
  const SST = y.reduce((s, v) => s + (v - my) ** 2, 0);
  const SSR = SST - SSE;
  const df = n - 2, mse = SSE / df;
  const seB1 = Math.sqrt(mse / sxx);
  const seB0 = Math.sqrt(mse * (1 / n + mx * mx / sxx));
  const tB1 = b1 / seB1, tB0 = b0 / seB0;
  const r2 = SSR / SST;
  const tc = tInv(0.975, df);
  return {
    test: "Regressão linear simples",
    intercept: { b: b0, se: seB0, t: tB0, p: tTwoTailed(tB0, df), ci: [b0 - tc*seB0, b0 + tc*seB0] },
    slope: { b: b1, se: seB1, t: tB1, p: tTwoTailed(tB1, df), ci: [b1 - tc*seB1, b1 + tc*seB1] },
    r2, r2adj: 1 - (1 - r2) * (n - 1) / df,
    F: (SSR / 1) / mse, dfF: [1, df], pF: fPvalue((SSR / 1) / mse, 1, df),
    rse: Math.sqrt(mse), n, df,
    equation: `Y = ${b0.toFixed(4)} ${b1 >= 0 ? '+' : '-'} ${Math.abs(b1).toFixed(4)}·X`,
    residuals: resid, predicted: pred
  };
}

export function chiSquareIndep(table) { // matriz [linhas][colunas]
  const rows = table.length, cols = table[0].length;
  const rt = table.map(r => r.reduce((s,v)=>s+v,0));
  const ct = Array.from({length: cols}, (_,j) => table.reduce((s,r)=>s+r[j],0));
  const N = rt.reduce((s,v)=>s+v,0);
  let chi = 0, minExp = Infinity;
  const exp = table.map((r,i) => r.map((_,j) => {
    const e = rt[i]*ct[j]/N; minExp = Math.min(minExp, e);
    chi += (table[i][j]-e)**2/e; return e;
  }));
  const df = (rows-1)*(cols-1);
  const V = Math.sqrt(chi / (N * Math.min(rows-1, cols-1)));
  return { test: "Chi-quadrado de independência", chi2: chi, df, p: chi2Pvalue(chi, df),
    expected: exp, minExpected: minExp, warning: minExp < 5,
    effect: { name: "V de Cramér", value: V, label: effectR(V) } };
}

// ================= TAMANHO AMOSTRAL =================
export const sampleSize = {
  // Proporção em população finita (levantamentos / TCC)
  survey({ N = Infinity, p = 0.5, e = 0.05, conf = 0.95 }) {
    const z = normInv(1 - (1 - conf) / 2);
    const n0 = (z ** 2 * p * (1 - p)) / (e ** 2);
    const n = Number.isFinite(N) ? n0 / (1 + (n0 - 1) / N) : n0;
    return { n0: Math.ceil(n0), n: Math.ceil(n), z };
  },
  // Duas médias independentes
  twoMeans({ d = 0.5, alpha = 0.05, power = 0.8, ratio = 1 }) {
    const za = normInv(1 - alpha / 2), zb = normInv(power);
    const n1 = Math.ceil(((1 + 1 / ratio) * (za + zb) ** 2) / (d ** 2));
    return { perGroup: n1, group2: Math.ceil(n1 / ratio), total: n1 + Math.ceil(n1 / ratio) };
  },
  // Duas proporções
  twoProps({ p1 = 0.5, p2 = 0.7, alpha = 0.05, power = 0.8 }) {
    const za = normInv(1 - alpha / 2), zb = normInv(power);
    const pb = (p1 + p2) / 2;
    const n = ((za * Math.sqrt(2 * pb * (1 - pb)) + zb * Math.sqrt(p1*(1-p1)+p2*(1-p2))) ** 2) / (p1 - p2) ** 2;
    return { perGroup: Math.ceil(n), total: 2 * Math.ceil(n) };
  },
  // Correlação
  correlation({ r = 0.3, alpha = 0.05, power = 0.8 }) {
    const za = normInv(1 - alpha / 2), zb = normInv(power);
    const z = 0.5 * Math.log((1 + r) / (1 - r));
    return { n: Math.ceil(((za + zb) / z) ** 2 + 3) };
  },
  // Poder observado (post-hoc) para 2 médias
  powerTwoMeans({ n, d, alpha = 0.05 }) {
    const za = normInv(1 - alpha / 2);
    const ncp = d * Math.sqrt(n / 2);
    return Math.max(0, Math.min(1, 1 - normCdf(za - ncp) + normCdf(-za - ncp)));
  }
};

// ================= interpretação =================
const effectD = d => { const a = Math.abs(d);
  return a < 0.2 ? "desprezível" : a < 0.5 ? "pequeno" : a < 0.8 ? "médio" : "grande"; };
const effectR = r => r < 0.1 ? "desprezível" : r < 0.3 ? "pequeno" : r < 0.5 ? "moderado" : r < 0.7 ? "forte" : "muito forte";
const effectEta = e => e < 0.01 ? "desprezível" : e < 0.06 ? "pequeno" : e < 0.14 ? "médio" : "grande";

export const fmtP = p => p < 0.001 ? "p < 0,001" : `p = ${p.toFixed(3).replace('.', ',')}`;
export const br = (v, dec = 2) => Number(v).toFixed(dec).replace('.', ',');

// ================= RELATÓRIO ABNT/APA =================
export function report(res, labels = {}) {
  const X = labels.x || "Variável X", Y = labels.y || "Variável Y";
  const g = labels.groups || ["Grupo 1", "Grupo 2"];
  const sig = p => p < 0.05 ? "estatisticamente significativa" : "não significativa";

  switch (res.test) {
    case "Teste t de Student independente":
    case "Teste t de Welch (variâncias desiguais)": {
      const [a, b] = res.groups;
      return `Os dados apresentaram distribuição normal e foram comparados pelo ${res.test.toLowerCase()}. ` +
        `O ${g[0]} (M = ${br(a.mean)}; DP = ${br(a.sd)}; n = ${a.n}) e o ${g[1]} (M = ${br(b.mean)}; DP = ${br(b.sd)}; n = ${b.n}) ` +
        `apresentaram diferença ${sig(res.p)}, t(${br(res.df, 1)}) = ${br(res.t)}, ${fmtP(res.p)}, ` +
        `IC 95% [${br(res.ciDiff[0])}; ${br(res.ciDiff[1])}], d de Cohen = ${br(res.effect.value)} (efeito ${res.effect.label}).`;
    }
    case "Teste t pareado": {
      const [a, b] = res.groups;
      return `A comparação intragrupo pelo teste t pareado indicou variação ${sig(res.p)} entre o pré-teste ` +
        `(M = ${br(a.mean)}; DP = ${br(a.sd)}) e o pós-teste (M = ${br(b.mean)}; DP = ${br(b.sd)}), ` +
        `t(${res.df}) = ${br(res.t)}, ${fmtP(res.p)}, Δ = ${br(res.diff)} IC 95% [${br(res.ciDiff[0])}; ${br(res.ciDiff[1])}], ` +
        `d = ${br(res.effect.value)} (efeito ${res.effect.label}).`;
    }
    case "Teste U de Mann-Whitney": {
      const [a, b] = res.groups;
      return `Como os dados não atenderam ao pressuposto de normalidade, aplicou-se o teste U de Mann-Whitney. ` +
        `O ${g[0]} (Md = ${br(a.median)}; IIQ = ${br(a.q1)}–${br(a.q3)}; n = ${a.n}) diferiu de forma ${sig(res.p)} ` +
        `do ${g[1]} (Md = ${br(b.median)}; IIQ = ${br(b.q1)}–${br(b.q3)}; n = ${b.n}), U = ${br(res.U, 1)}, ` +
        `z = ${br(res.z)}, ${fmtP(res.p)}, r = ${br(res.effect.value)} (efeito ${res.effect.label}).`;
    }
    case "Teste de Wilcoxon (postos sinalizados)":
      return `Aplicou-se o teste de Wilcoxon para amostras pareadas (n = ${res.n}), que indicou variação ${sig(res.p)}, ` +
        `T = ${br(res.T, 1)}, z = ${br(res.z)}, ${fmtP(res.p)}, r = ${br(res.effect.value)} (efeito ${res.effect.label}).`;
    case "ANOVA one-way":
      return `A ANOVA one-way revelou diferença ${sig(res.p)} entre os ${res.groups.length} grupos, ` +
        `F(${res.df1}, ${res.df2}) = ${br(res.F)}, ${fmtP(res.p)}, η² = ${br(res.effect.value, 3)} (efeito ${res.effect.label}). ` +
        `A homogeneidade das variâncias foi verificada pelo teste de Levene (F = ${br(res.levene.F)}; ${fmtP(res.levene.p)}). ` +
        (res.p < 0.05
          ? `O pós-teste indicou: ${res.posthoc.filter(t => t.sig).map(t => `${t.pair} (${fmtP(t.p)})`).join('; ') || 'nenhum par significativo após correção'}.`
          : `Não foram realizadas comparações múltiplas.`);
    case "Kruskal-Wallis":
      return `O teste de Kruskal-Wallis apontou diferença ${sig(res.p)} entre os grupos, ` +
        `H(${res.df}) = ${br(res.H)}, ${fmtP(res.p)}, ε² = ${br(res.effect.value, 3)} (efeito ${res.effect.label}).`;
    case "Correlação de Pearson":
      return `Verificou-se correlação ${res.r > 0 ? 'positiva' : 'negativa'} ${res.effect.label} e ${sig(res.p)} ` +
        `entre ${X} e ${Y}, r(${res.df}) = ${br(res.r, 3)}, ${fmtP(res.p)}, IC 95% [${br(res.ci95[0], 3)}; ${br(res.ci95[1], 3)}], ` +
        `com coeficiente de determinação R² = ${br(res.r2, 3)}, indicando que ${br(res.r2 * 100, 1)}% da variância é compartilhada.`;
    case "Correlação de Spearman":
      return `A correlação de Spearman indicou associação ${res.rho > 0 ? 'positiva' : 'negativa'} ${res.effect.label} e ${sig(res.p)} ` +
        `entre ${X} e ${Y}, ρ(${res.df}) = ${br(res.rho, 3)}, ${fmtP(res.p)}.`;
    case "Regressão linear simples":
      return `A regressão linear simples com ${X} como preditora de ${Y} mostrou-se ${sig(res.pF)} ` +
        `(F(${res.dfF[0]}, ${res.dfF[1]}) = ${br(res.F)}; ${fmtP(res.pF)}), explicando ${br(res.r2 * 100, 1)}% da variância ` +
        `(R² = ${br(res.r2, 3)}; R² ajustado = ${br(res.r2adj, 3)}). O coeficiente angular foi β = ${br(res.slope.b, 4)} ` +
        `(EP = ${br(res.slope.se, 4)}; t = ${br(res.slope.t)}; ${fmtP(res.slope.p)}; IC 95% [${br(res.slope.ci[0], 4)}; ${br(res.slope.ci[1], 4)}]), ` +
        `resultando na equação ${res.equation}.`;
    case "Chi-quadrado de independência":
      return `A associação entre as variáveis categóricas foi ${sig(res.p)}, χ²(${res.df}) = ${br(res.chi2)}, ${fmtP(res.p)}, ` +
        `V de Cramér = ${br(res.effect.value, 3)} (efeito ${res.effect.label}).` +
        (res.warning ? ` Ressalta-se que houve célula com frequência esperada inferior a 5, recomendando-se cautela (considerar o teste exato de Fisher).` : ``);
    default: return "";
  }
}
