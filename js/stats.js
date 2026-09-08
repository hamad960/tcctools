// js/stats.js — TCC Tools (versão corrigida)
import { normCdf, normInv, normPdf, tTwoTailed, tInv, fPvalue, chi2Pvalue } from './dist.js';

export { normCdf, normInv, normPdf, tTwoTailed, tInv, fPvalue, chi2Pvalue };

// ================= utilitários =================

// 🔧 CORREÇÃO 8: trata separador de milhar e vírgula decimal
export const toNumber = v => {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return NaN;
  let s = String(v).trim();
  if (!s) return NaN;
  // remove espaços, NBSP e símbolos comuns
  s = s.replace(/[\s\u00A0%]/g, '');
  // 1.234,56 → 1234.56 | 1,234.56 → 1234.56
  if (/,\d{1,3}$/.test(s) && /\./.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/,/.test(s) && !/\./.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

export const clean = arr => arr.map(toNumber).filter(v => Number.isFinite(v));

const assertN = (a, min, fn) => {
  if (!Array.isArray(a) || a.length < min)
    throw new Error(`${fn}: são necessárias ao menos ${min} observações válidas (recebidas: ${a?.length ?? 0}).`);
};

export const mean = a => a.reduce((s, v) => s + v, 0) / a.length;

export const variance = a => {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1);
};

export const sd = a => Math.sqrt(variance(a));
export const sem = a => sd(a) / Math.sqrt(a.length);

export function median(a) {
  const s = [...a].sort((x, y) => x - y), n = s.length, h = n >> 1;
  if (!n) return NaN;
  return n % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

export function quantile(a, q) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function ranks(a) { // ranks médios com correção de empates
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const r = new Array(a.length);
  const ties = [];
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    if (j > i) ties.push(j - i + 1);
    i = j + 1;
  }
  return { r, ties };
}

// 🔧 CORREÇÃO 5: guardas para n pequeno
export function skewness(a) {
  const n = a.length, s = sd(a);
  if (n < 3 || !Number.isFinite(s) || s === 0) return NaN;
  const m = mean(a);
  return (n / ((n - 1) * (n - 2))) * a.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
}

export function kurtosis(a) {
  const n = a.length, s = sd(a);
  if (n < 4 || !Number.isFinite(s) || s === 0) return NaN;
  const m = mean(a);
  const g2 = a.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0)
    * n * (n + 1) / ((n - 1) * (n - 2) * (n - 3));
  return g2 - 3 * (n - 1) ** 2 / ((n - 2) * (n - 3));
}

export function ciMean(a, conf = 0.95) {
  const n = a.length, m = mean(a);
  if (n < 2) return [NaN, NaN];
  const t = tInv(1 - (1 - conf) / 2, n - 1), e = t * sem(a);
  return [m - e, m + e];
}

export const describe = a => {
  assertN(a, 1, 'describe');
  return {
    n: a.length,
    mean: mean(a),
    sd: sd(a),
    sem: sem(a),
    median: median(a),
    min: Math.min(...a),
    max: Math.max(...a),
    q1: quantile(a, 0.25),
    q3: quantile(a, 0.75),
    iqr: quantile(a, 0.75) - quantile(a, 0.25),
    skew: skewness(a),
    kurt: kurtosis(a),
    ci95: ciMean(a)
  };
};

// ================= SHAPIRO-WILK (Royston 1995) =================
export function shapiroWilk(data) {
  const x = clean(data).sort((a, b) => a - b), n = x.length;
  if (n < 3) return { error: 'n mínimo = 3', normal: true, W: NaN, p: NaN, n };
  if (n > 5000) return { error: 'n máximo = 5000', normal: true, W: NaN, p: NaN, n };

  const den0 = x.reduce((s, v) => s + (v - mean(x)) ** 2, 0);
  if (den0 === 0) return { error: 'variância nula', normal: true, W: NaN, p: NaN, n };

  const m = [];
  for (let i = 1; i <= n; i++) m.push(normInv((i - 0.375) / (n + 0.25)));
  const ssm = m.reduce((s, v) => s + v * v, 0);
  const c = m.map(v => v / Math.sqrt(ssm));
  const a = [...c];
  const u = 1 / Math.sqrt(n);

  if (n > 5) {
    const an  = -2.706056*u**5 + 4.434685*u**4 - 2.071190*u**3 - 0.147981*u**2 + 0.221157*u + c[n-1];
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
  let W = num / den;
  W = Math.min(1, Math.max(0, W)); // 🔧 estabilidade numérica

  let p;
  const ln = Math.log(n);
  if (n === 3) {
    p = Math.max(0, Math.min(1,
      (6 / Math.PI) * (Math.asin(Math.sqrt(W)) - Math.asin(Math.sqrt(0.75)))));
  } else if (n <= 11) {
    const g = -2.273 + 0.459 * n;
    const mu = 0.5440 - 0.39978*n + 0.025054*n**2 - 0.0006714*n**3;
    const sigma = Math.exp(1.3822 - 0.77857*n + 0.062767*n**2 - 0.0020322*n**3);
    const arg = g - Math.log(1 - W);
    p = arg <= 0 ? 1 : 1 - normCdf((-Math.log(arg) - mu) / sigma);
  } else {
    const mu = -1.5861 - 0.31082*ln - 0.083751*ln**2 + 0.0038915*ln**3;
    const sigma = Math.exp(-0.4803 - 0.082676*ln + 0.0030302*ln**2);
    p = 1 - normCdf((Math.log(1 - W) - mu) / sigma);
  }

  p = Math.max(0, Math.min(1, p));
  return { W, p, n, normal: p > 0.05 };
}

export function qqPlotData(data) {
  const x = clean(data).sort((a, b) => a - b), n = x.length;
  const m = mean(x), s = sd(x);
  const pts = x.map((v, i) => ({ x: normInv((i + 1 - 0.375) / (n + 0.25)), y: v }));
  const th = pts.map(p => p.x);
  return {
    points: pts,
    line: [{ x: Math.min(...th), y: m + s * Math.min(...th) },
           { x: Math.max(...th), y: m + s * Math.max(...th) }]
  };
}

// 🔧 CORREÇÃO 10: Levene protegido contra grupos degenerados
export function levene(groups) {
  const g = groups.filter(x => Array.isArray(x) && x.length >= 2);
  const k = g.length;
  if (k < 2) return { F: NaN, df1: NaN, df2: NaN, p: NaN, error: 'grupos insuficientes' };

  const N = g.reduce((s, x) => s + x.length, 0);
  const z = g.map(x => { const mg = mean(x); return x.map(v => Math.abs(v - mg)); });
  const zbar = z.map(mean), zTot = mean(z.flat());

  const num = z.reduce((s, zi, i) => s + zi.length * (zbar[i] - zTot) ** 2, 0) * (N - k);
  const den = z.reduce((s, zi, i) => s + zi.reduce((a, v) => a + (v - zbar[i]) ** 2, 0), 0) * (k - 1);

  if (den === 0) return { F: NaN, df1: k - 1, df2: N - k, p: NaN, error: 'variância residual nula' };

  const F = num / den;
  return { F, df1: k - 1, df2: N - k, p: fPvalue(F, k - 1, N - k) };
}

// ================= TESTES =================
export function tTestIndependent(a, b, { welch = 'auto' } = {}) {
  assertN(a, 2, 'Teste t independente');
  assertN(b, 2, 'Teste t independente');

  const n1 = a.length, n2 = b.length, m1 = mean(a), m2 = mean(b);
  const v1 = variance(a), v2 = variance(b);
  const lev = levene([a, b]);
  const useWelch = welch === true || (welch === 'auto' && Number.isFinite(lev.p) && lev.p < 0.05);

  let t, df, seDiff;
  if (useWelch) {
    seDiff = Math.sqrt(v1 / n1 + v2 / n2);                        // 🔧 CORREÇÃO 3
    df = (v1 / n1 + v2 / n2) ** 2 /
         ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
  } else {
    const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
    seDiff = Math.sqrt(sp2 * (1 / n1 + 1 / n2));
    df = n1 + n2 - 2;
  }

  const diff = m1 - m2;
  t = seDiff === 0 ? 0 : diff / seDiff;

  const sp = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  const d = sp === 0 ? 0 : diff / sp;
  // Hedges g (correção para amostras pequenas)
  const gHedges = d * (1 - 3 / (4 * (n1 + n2) - 9));
  const tc = tInv(0.975, df);

  return {
    test: useWelch ? 'Teste t de Welch (variâncias desiguais)' : 'Teste t de Student independente',
    t, df, p: tTwoTailed(t, df),
    diff, seDiff,
    ciDiff: [diff - tc * seDiff, diff + tc * seDiff],
    effect: { name: 'd de Cohen', value: d, label: effectD(d) },
    hedgesG: gHedges,
    levene: lev,
    groups: [describe(a), describe(b)]
  };
}

// 🔧 CORREÇÃO 1: diferença = pós − pré (b − a)
export function tTestPaired(a, b) {
  const pairs = a.map((v, i) => [v, b[i]])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  assertN(pairs, 2, 'Teste t pareado');

  const A = pairs.map(p => p[0]), B = pairs.map(p => p[1]);
  const d = pairs.map(([x, y]) => y - x);

  const n = d.length, md = mean(d), sdd = sd(d);
  const seD = sdd / Math.sqrt(n);
  const t = seD === 0 ? 0 : md / seD;
  const df = n - 1;
  const tc = tInv(0.975, df), e = tc * seD;
  const dz = sdd === 0 ? 0 : md / sdd;

  return {
    test: 'Teste t pareado',
    t, df, p: tTwoTailed(t, df),
    n, diff: md, sdDiff: sdd, seDiff: seD,
    ciDiff: [md - e, md + e],
    effect: { name: 'd de Cohen (dz)', value: dz, label: effectD(dz) },
    groups: [describe(A), describe(B)],
    diffs: d
  };
}

// 🔧 CORREÇÃO 11: correção de continuidade
export function mannWhitney(a, b) {
  assertN(a, 2, 'Mann-Whitney');
  assertN(b, 2, 'Mann-Whitney');

  const all = [...a, ...b], { r, ties } = ranks(all);
  const n1 = a.length, n2 = b.length, N = n1 + n2;

  const R1 = r.slice(0, n1).reduce((s, v) => s + v, 0);
  const U1 = R1 - n1 * (n1 + 1) / 2, U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);

  const mu = n1 * n2 / 2;
  const tieCorr = ties.reduce((s, t) => s + (t ** 3 - t), 0);
  const sigma = Math.sqrt((n1 * n2 / 12) * ((N + 1) - tieCorr / (N * (N - 1))));

  const z = sigma === 0 ? 0
    : (U - mu + 0.5 * Math.sign(mu - U)) / sigma;   // continuidade
  const p = Math.min(1, 2 * (1 - normCdf(Math.abs(z))));

  const rEff = Math.abs(z) / Math.sqrt(N);
  // rank-biserial exato
  const rbc = 1 - (2 * U) / (n1 * n2);

  return {
    test: 'Teste U de Mann-Whitney',
    U, U1, U2, z, p, n1, n2,
    rankBiserial: rbc,
    effect: { name: 'r (rank-biserial)', value: Math.abs(rbc), label: effectR(Math.abs(rbc)) },
    groups: [describe(a), describe(b)]
  };
}

// 🔧 CORREÇÃO 2: diferença = pós − pré + continuidade
export function wilcoxon(a, b) {
  const pairs = a.map((v, i) => [v, b[i]])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const A = pairs.map(p => p[0]), B = pairs.map(p => p[1]);

  const diffs = pairs.map(([x, y]) => y - x).filter(d => d !== 0);
  const n = diffs.length;
  assertN(diffs, 2, 'Wilcoxon');

  const { r, ties } = ranks(diffs.map(Math.abs));
  let Wp = 0, Wn = 0;
  diffs.forEach((d, i) => { if (d > 0) Wp += r[i]; else Wn += r[i]; });

  const T = Math.min(Wp, Wn);
  const mu = n * (n + 1) / 4;
  const tieCorr = ties.reduce((s, t) => s + (t ** 3 - t), 0) / 48;
  const sigma = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - tieCorr);

  const z = sigma === 0 ? 0 : (T - mu + 0.5 * Math.sign(mu - T)) / sigma;
  const p = Math.min(1, 2 * (1 - normCdf(Math.abs(z))));
  const rEff = Math.abs(z) / Math.sqrt(n);

  return {
    test: 'Teste de Wilcoxon (postos sinalizados)',
    T, Wpos: Wp, Wneg: Wn, z, p, n,
    zeros: pairs.length - n,
    effect: { name: 'r', value: rEff, label: effectR(rEff) },
    groups: [describe(A), describe(B)],
    diffs
  };
}

// 🔧 CORREÇÃO 9: pós-teste com rótulos reais dos grupos
export function anovaOneWay(groups, names = null) {
  if (!Array.isArray(groups) || groups.length < 3)
    throw new Error('ANOVA one-way requer 3 ou mais grupos.');
  groups.forEach(g => assertN(g, 2, 'ANOVA one-way'));

  const k = groups.length, N = groups.reduce((s, g) => s + g.length, 0);
  const grand = mean(groups.flat());

  const SSB = groups.reduce((s, g) => s + g.length * (mean(g) - grand) ** 2, 0);
  const SSW = groups.reduce((s, g) => {
    const m = mean(g);
    return s + g.reduce((a, v) => a + (v - m) ** 2, 0);
  }, 0);

  const df1 = k - 1, df2 = N - k;
  const MSW = SSW / df2;
  const F = MSW === 0 ? Infinity : (SSB / df1) / MSW;
  const eta2 = SSB / (SSB + SSW);
  const omega2 = (SSB - df1 * MSW) / (SSB + SSW + MSW);

  return {
    test: 'ANOVA one-way',
    F, df1, df2, p: fPvalue(F, df1, df2),
    SSB, SSW, MSB: SSB / df1, MSW,
    effect: { name: 'η² (eta quadrado)', value: eta2, label: effectEta(eta2) },
    omega2,
    levene: levene(groups),
    posthoc: pairwiseBonferroni(groups, MSW, df2, names),
    groupNames: names,
    groups: groups.map(describe)
  };
}

// Comparações múltiplas com correção de Bonferroni (conservador)
function pairwiseBonferroni(groups, MSW, dfW, names = null) {
  const label = i => (names && names[i]) || `Grupo ${i + 1}`;
  const nComp = groups.length * (groups.length - 1) / 2;
  const out = [];

  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const ni = groups[i].length, nj = groups[j].length;
      const diff = mean(groups[i]) - mean(groups[j]);
      const se = Math.sqrt(MSW * (1 / ni + 1 / nj));
      const t = se === 0 ? 0 : diff / se;
      const pAdj = Math.min(1, tTwoTailed(t, dfW) * nComp);

      out.push({
        pair: `${label(i)} vs ${label(j)}`,
        diff, se, t,
        pRaw: tTwoTailed(t, dfW),
        p: pAdj,
        sig: pAdj < 0.05
      });
    }
  }
  return out;
}

export function kruskalWallis(groups, names = null) {
  if (!Array.isArray(groups) || groups.length < 3)
    throw new Error('Kruskal-Wallis requer 3 ou mais grupos.');
  groups.forEach(g => assertN(g, 2, 'Kruskal-Wallis'));

  const all = groups.flat(), N = all.length;
  const { r, ties } = ranks(all);

  let off = 0, H = 0;
  groups.forEach(g => {
    const Ri = r.slice(off, off + g.length).reduce((s, v) => s + v, 0);
    H += (Ri ** 2) / g.length;
    off += g.length;
  });

  H = (12 / (N * (N + 1))) * H - 3 * (N + 1);
  const tieCorr = 1 - ties.reduce((s, t) => s + (t ** 3 - t), 0) / (N ** 3 - N);
  H = H / (tieCorr || 1);

  const df = groups.length - 1;
  const eps2 = H / (N - 1);

  return {
    test: 'Kruskal-Wallis',
    H, df, p: chi2Pvalue(H, df), n: N,
    effect: { name: 'ε² (epsilon quadrado)', value: eps2, label: effectEta(eps2) },
    groupNames: names,
    groups: groups.map(describe)
  };
}

// 🔧 CORREÇÃO 4: guarda para r = ±1 e n < 4
export function pearson(x, y) {
  assertN(x, 3, 'Correlação de Pearson');
  if (x.length !== y.length) throw new Error('Pearson: X e Y devem ter o mesmo tamanho.');

  const n = x.length, mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }

  if (sxx === 0 || syy === 0)
    throw new Error('Pearson: uma das variáveis é constante (variância nula).');

  let r = sxy / Math.sqrt(sxx * syy);
  r = Math.max(-1, Math.min(1, r));

  const df = n - 2;
  const t = Math.abs(r) >= 1 ? Infinity : r * Math.sqrt(df / (1 - r * r));
  const p = Math.abs(r) >= 1 ? 0 : tTwoTailed(t, df);

  let ci95 = [NaN, NaN];
  if (n > 3 && Math.abs(r) < 1) {
    const z = 0.5 * Math.log((1 + r) / (1 - r));
    const se = 1 / Math.sqrt(n - 3);
    ci95 = [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)];
  }

  return {
    test: 'Correlação de Pearson',
    r, r2: r * r, df, t, p, ci95, n,
    effect: { name: 'r', value: r, label: effectR(Math.abs(r)) },
    x: describe(x), y: describe(y)
  };
}

export function spearman(x, y) {
  assertN(x, 3, 'Correlação de Spearman');
  const rx = ranks(x).r, ry = ranks(y).r;
  const res = pearson(rx, ry);

  return {
    ...res,
    test: 'Correlação de Spearman',
    rho: res.r,
    r: res.r,
    ci95: res.ci95, // IC aproximado via Fisher sobre os postos
    effect: { name: 'ρ', value: res.r, label: effectR(Math.abs(res.r)) },
    x: describe(x), y: describe(y)
  };
}

// 🔧 CORREÇÃO 6: expõe p (igual a pF) diretamente
export function linearRegression(x, y) {
  assertN(x, 3, 'Regressão linear');
  if (x.length !== y.length) throw new Error('Regressão: X e Y devem ter o mesmo tamanho.');

  const n = x.length, mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  if (sxx === 0) throw new Error('Regressão: a variável preditora é constante.');

  const b1 = sxy / sxx, b0 = my - b1 * mx;
  const pred = x.map(v => b0 + b1 * v);
  const resid = y.map((v, i) => v - pred[i]);

  const SSE = resid.reduce((s, e) => s + e * e, 0);
  const SST = y.reduce((s, v) => s + (v - my) ** 2, 0);
  const SSR = SST - SSE;

  const df = n - 2, mse = SSE / df;
  const seB1 = Math.sqrt(mse / sxx);
  const seB0 = Math.sqrt(mse * (1 / n + mx * mx / sxx));
  const tB1 = seB1 === 0 ? 0 : b1 / seB1;
  const tB0 = seB0 === 0 ? 0 : b0 / seB0;

  const r2 = SST === 0 ? NaN : SSR / SST;
  const tc = tInv(0.975, df);
  const F = mse === 0 ? Infinity : SSR / mse;
  const pF = fPvalue(F, 1, df);

  return {
    test: 'Regressão linear simples',
    intercept: {
      b: b0, se: seB0, t: tB0, p: tTwoTailed(tB0, df),
      ci: [b0 - tc * seB0, b0 + tc * seB0]
    },
    slope: {
      b: b1, se: seB1, t: tB1, p: tTwoTailed(tB1, df),
      ci: [b1 - tc * seB1, b1 + tc * seB1]
    },
    r: Math.sign(b1) * Math.sqrt(Math.max(0, r2)),
    r2,
    r2adj: 1 - (1 - r2) * (n - 1) / df,
    F, dfF: [1, df],
    pF,
    p: pF,                                   // 🔧 dispensa o remendo no calculadora.js
    SSR, SSE, SST,
    rse: Math.sqrt(mse), n, df,
    equation: `Y = ${b0.toFixed(4)} ${b1 >= 0 ? '+' : '-'} ${Math.abs(b1).toFixed(4)}·X`,
    residuals: resid, predicted: pred
  };
}

export function chiSquareIndep(table) {
  const rows = table.length, cols = table[0].length;
  const rt = table.map(r => r.reduce((s, v) => s + v, 0));
  const ct = Array.from({ length: cols }, (_, j) => table.reduce((s, r) => s + r[j], 0));
  const N = rt.reduce((s, v) => s + v, 0);
  if (!N) throw new Error('Chi-quadrado: tabela vazia.');

  let chi = 0, minExp = Infinity;
  const exp = table.map((r, i) => r.map((_, j) => {
    const e = rt[i] * ct[j] / N;
    minExp = Math.min(minExp, e);
    if (e > 0) chi += (table[i][j] - e) ** 2 / e;
    return e;
  }));

  const df = (rows - 1) * (cols - 1);
  const V = Math.sqrt(chi / (N * Math.min(rows - 1, cols - 1)));

  return {
    test: 'Chi-quadrado de independência',
    chi2: chi, df, p: chi2Pvalue(chi, df), n: N,
    expected: exp, minExpected: minExp, warning: minExp < 5,
    effect: { name: 'V de Cramér', value: V, label: effectR(V) }
  };
}

// ================= TAMANHO AMOSTRAL =================
export const sampleSize = {
  survey({ N = Infinity, p = 0.5, e = 0.05, conf = 0.95 }) {
    const z = normInv(1 - (1 - conf) / 2);
    const n0 = (z ** 2 * p * (1 - p)) / (e ** 2);
    const n = Number.isFinite(N) ? n0 / (1 + (n0 - 1) / N) : n0;
    return { n0: Math.ceil(n0), n: Math.ceil(n), z };
  },
  twoMeans({ d = 0.5, alpha = 0.05, power = 0.8, ratio = 1 }) {
    const za = normInv(1 - alpha / 2), zb = normInv(power);
    const n1 = Math.ceil(((1 + 1 / ratio) * (za + zb) ** 2) / (d ** 2));
    return { perGroup: n1, group2: Math.ceil(n1 / ratio), total: n1 + Math.ceil(n1 / ratio) };
  },
  twoProps({ p1 = 0.5, p2 = 0.7, alpha = 0.05, power = 0.8 }) {
    if (p1 === p2) throw new Error('As proporções devem ser diferentes.');
    const za = normInv(1 - alpha / 2), zb = normInv(power);
    const pb = (p1 + p2) / 2;
    const n = ((za * Math.sqrt(2 * pb * (1 - pb))
      + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2) / (p1 - p2) ** 2;
    return { perGroup: Math.ceil(n), total: 2 * Math.ceil(n) };
  },
  correlation({ r = 0.3, alpha = 0.05, power = 0.8 }) {
    if (Math.abs(r) >= 1 || r === 0) throw new Error('Informe 0 < |r| < 1.');
    const za = normInv(1 - alpha / 2), zb = normInv(power);
    const z = 0.5 * Math.log((1 + r) / (1 - r));
    return { n: Math.ceil(((za + zb) / z) ** 2 + 3) };
  },
  powerTwoMeans({ n, d, alpha = 0.05 }) {
    const za = normInv(1 - alpha / 2);
    const ncp = d * Math.sqrt(n / 2);
    return Math.max(0, Math.min(1, 1 - normCdf(za - ncp) + normCdf(-za - ncp)));
  }
};

// ================= interpretação =================
const effectD = d => {
  const a = Math.abs(d);
  return a < 0.2 ? 'desprezível' : a < 0.5 ? 'pequeno' : a < 0.8 ? 'médio' : 'grande';
};
const effectR = r => r < 0.1 ? 'desprezível' : r < 0.3 ? 'pequeno'
  : r < 0.5 ? 'moderado' : r < 0.7 ? 'forte' : 'muito forte';
const effectEta = e => e < 0.01 ? 'desprezível' : e < 0.06 ? 'pequeno'
  : e < 0.14 ? 'médio' : 'grande';

// 🔧 CORREÇÃO 7: formatadores à prova de NaN
export const fmtP = p => {
  if (!Number.isFinite(p)) return 'p não estimável';
  if (p < 0.001) return 'p < 0,001';
  if (p > 0.999) return 'p > 0,999';
  return `p = ${p.toFixed(3).replace('.', ',')}`;
};

export const br = (v, dec = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(dec).replace('.', ',');
};

// ================= RELATÓRIO ABNT/APA =================
export function report(res, labels = {}) {
  const X = labels.x || 'Variável X', Y = labels.y || 'Variável Y';
  const g = labels.groups || ['Grupo 1', 'Grupo 2'];
  const sig = p => (Number.isFinite(p) && p < 0.05)
    ? 'estatisticamente significativa' : 'não significativa';

  switch (res.test) {
    case 'Teste t de Student independente':
    case 'Teste t de Welch (variâncias desiguais)': {
      const [a, b] = res.groups;
      return `Os dados apresentaram distribuição aproximadamente normal e foram comparados pelo ${res.test.toLowerCase()}. `
        + `O grupo ${g[0]} (M = ${br(a.mean)}; DP = ${br(a.sd)}; n = ${a.n}) e o grupo ${g[1]} `
        + `(M = ${br(b.mean)}; DP = ${br(b.sd)}; n = ${b.n}) apresentaram diferença ${sig(res.p)}, `
        + `t(${br(res.df, 1)}) = ${br(res.t)}, ${fmtP(res.p)}, `
        + `diferença média = ${br(res.diff)} IC 95% [${br(res.ciDiff[0])}; ${br(res.ciDiff[1])}], `
        + `d de Cohen = ${br(res.effect.value)} (efeito ${res.effect.label}).`;
    }

    case 'Teste t pareado': {
      const [a, b] = res.groups;
      const dir = res.diff >= 0 ? 'aumento' : 'redução';
      return `A comparação intragrupo pelo teste t pareado (n = ${res.n}) indicou variação ${sig(res.p)} `
        + `entre o primeiro momento (M = ${br(a.mean)}; DP = ${br(a.sd)}) e o segundo momento `
        + `(M = ${br(b.mean)}; DP = ${br(b.sd)}), com ${dir} médio de ${br(Math.abs(res.diff))} pontos, `
        + `t(${res.df}) = ${br(res.t)}, ${fmtP(res.p)}, `
        + `IC 95% da diferença [${br(res.ciDiff[0])}; ${br(res.ciDiff[1])}], `
        + `d = ${br(res.effect.value)} (efeito ${res.effect.label}).`;
    }

    case 'Teste U de Mann-Whitney': {
      const [a, b] = res.groups;
      return `Como os dados não atenderam ao pressuposto de normalidade, aplicou-se o teste U de Mann-Whitney. `
        + `O grupo ${g[0]} (Md = ${br(a.median)}; IIQ = ${br(a.q1)}–${br(a.q3)}; n = ${a.n}) diferiu de forma ${sig(res.p)} `
        + `do grupo ${g[1]} (Md = ${br(b.median)}; IIQ = ${br(b.q1)}–${br(b.q3)}; n = ${b.n}), `
        + `U = ${br(res.U, 1)}, z = ${br(res.z)}, ${fmtP(res.p)}, `
        + `r = ${br(res.effect.value)} (efeito ${res.effect.label}).`;
    }

    case 'Teste de Wilcoxon (postos sinalizados)': {
      const [a, b] = res.groups;
      return `Aplicou-se o teste de Wilcoxon para amostras pareadas (n = ${res.n}`
        + `${res.zeros ? `; ${res.zeros} par(es) com diferença nula foram excluídos` : ''}), `
        + `que indicou variação ${sig(res.p)} entre os momentos avaliados `
        + `(Md₁ = ${br(a.median)}; Md₂ = ${br(b.median)}), `
        + `T = ${br(res.T, 1)}, z = ${br(res.z)}, ${fmtP(res.p)}, `
        + `r = ${br(res.effect.value)} (efeito ${res.effect.label}).`;
    }

    case 'ANOVA one-way': {
      const nomes = res.groupNames || labels.groups;
      const desc = res.groups.map((s, i) =>
        `${(nomes && nomes[i]) || `Grupo ${i + 1}`} (M = ${br(s.mean)}; DP = ${br(s.sd)}; n = ${s.n})`).join('; ');
      const post = res.posthoc.filter(t => t.sig).map(t => `${t.pair} (${fmtP(t.p)})`).join('; ');
      return `A ANOVA de uma via revelou diferença ${sig(res.p)} entre os ${res.groups.length} grupos — ${desc} —, `
        + `F(${res.df1}, ${res.df2}) = ${br(res.F)}, ${fmtP(res.p)}, `
        + `η² = ${br(res.effect.value, 3)} (efeito ${res.effect.label}). `
        + `A homogeneidade das variâncias foi avaliada pelo teste de Levene `
        + `(F = ${br(res.levene.F)}; ${fmtP(res.levene.p)}). `
        + (Number.isFinite(res.p) && res.p < 0.05
          ? `As comparações múltiplas com correção de Bonferroni indicaram: ${post || 'nenhum par significativo após a correção'}.`
          : `Não foram realizadas comparações múltiplas.`);
    }

    case 'Kruskal-Wallis': {
      const nomes = res.groupNames || labels.groups;
      const desc = res.groups.map((s, i) =>
        `${(nomes && nomes[i]) || `Grupo ${i + 1}`} (Md = ${br(s.median)}; IIQ = ${br(s.q1)}–${br(s.q3)}; n = ${s.n})`).join('; ');
      return `Diante da violação da normalidade, empregou-se o teste de Kruskal-Wallis, que apontou diferença ${sig(res.p)} `
        + `entre os grupos — ${desc} —, H(${res.df}) = ${br(res.H)}, ${fmtP(res.p)}, `
        + `ε² = ${br(res.effect.value, 3)} (efeito ${res.effect.label}).`;
    }

    case 'Correlação de Pearson':
      return `Verificou-se correlação ${res.r > 0 ? 'positiva' : 'negativa'} ${res.effect.label} e ${sig(res.p)} `
        + `entre ${X} e ${Y}, r(${res.df}) = ${br(res.r, 3)}, ${fmtP(res.p)}, `
        + `IC 95% [${br(res.ci95[0], 3)}; ${br(res.ci95[1], 3)}], n = ${res.n}, `
        + `com coeficiente de determinação R² = ${br(res.r2, 3)}, indicando que ${br(res.r2 * 100, 1)}% `
        + `da variância é compartilhada entre as variáveis. `
        + `Ressalta-se que a correlação não autoriza inferência de causalidade.`;

    case 'Correlação de Spearman':
      return `A correlação de Spearman indicou associação ${res.rho > 0 ? 'positiva' : 'negativa'} ${res.effect.label} `
        + `e ${sig(res.p)} entre ${X} e ${Y}, ρ(${res.df}) = ${br(res.rho, 3)}, ${fmtP(res.p)}, n = ${res.n}. `
        + `Ressalta-se que a correlação não autoriza inferência de causalidade.`;

    case 'Regressão linear simples':
      return `A regressão linear simples, com ${X} como preditora de ${Y}, mostrou-se ${sig(res.pF)} `
        + `(F(${res.dfF[0]}, ${res.dfF[1]}) = ${br(res.F)}; ${fmtP(res.pF)}), explicando ${br(res.r2 * 100, 1)}% `
        + `da variância do desfecho (R² = ${br(res.r2, 3)}; R² ajustado = ${br(res.r2adj, 3)}). `
        + `O coeficiente angular foi β = ${br(res.slope.b, 4)} (EP = ${br(res.slope.se, 4)}; `
        + `t = ${br(res.slope.t)}; ${fmtP(res.slope.p)}; `
        + `IC 95% [${br(res.slope.ci[0], 4)}; ${br(res.slope.ci[1], 4)}]), `
        + `resultando na equação ${res.equation}.`;

    case 'Chi-quadrado de independência':
      return `A associação entre as variáveis categóricas foi ${sig(res.p)}, `
        + `χ²(${res.df}) = ${br(res.chi2)}, ${fmtP(res.p)}, n = ${res.n}, `
        + `V de Cramér = ${br(res.effect.value, 3)} (efeito ${res.effect.label}).`
        + (res.warning ? ` Houve célula com frequência esperada inferior a 5, recomendando-se cautela e a consideração do teste exato de Fisher.` : '');

    default:
      return '';
  }
}
