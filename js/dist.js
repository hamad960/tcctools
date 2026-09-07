// js/dist.js — funções especiais e distribuições (sem dependências)
export const SQRT2PI = Math.sqrt(2 * Math.PI);

// ---------- Gamma / Beta ----------
const G_COF = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7];

export function logGamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < 8; i++) x += G_COF[i] / (z + i + 1);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// Regularized incomplete beta I_x(a,b) — Lentz continued fraction
export function incBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
  let f = 1, c = 1, d = 0;
  for (let i = 0; i <= 300; i++) {
    const m = Math.floor(i / 2);
    let num;
    if (i === 0) num = 1;
    else if (i % 2 === 0) num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else num = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    const cd = c * d; f *= cd;
    if (Math.abs(1 - cd) < 1e-12) break;
  }
  const res = front * (f - 1);
  return a > (a + b) * x ? res : 1 - res; // (regularização padrão)
}

// ---------- Normal ----------
export function normPdf(z) { return Math.exp(-0.5 * z * z) / SQRT2PI; }

export function normCdf(z) {
  // Abramowitz-Stegun 7.1.26 via erf
  const s = z < 0 ? -1 : 1; const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + s * erf);
}

export function normInv(p) { // quantil (Acklam)
  if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416];
  const pl = 0.02425;
  let q, r;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (p > 1 - pl) return -normInv(1 - p);
  q = p - 0.5; r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
         (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

// ---------- t de Student ----------
export function tCdf(t, df) {
  const x = df / (df + t * t);
  const p = 0.5 * incBeta(x, df / 2, 0.5);
  return t > 0 ? 1 - p : p;
}
export const tTwoTailed = (t, df) => 2 * (1 - tCdf(Math.abs(t), df));

export function tInv(p, df) { // busca binária (estável e suficiente)
  let lo = -1e3, hi = 1e3;
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (tCdf(m, df) < p) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

// ---------- F ----------
export function fCdf(f, d1, d2) {
  if (f <= 0) return 0;
  return incBeta((d1 * f) / (d1 * f + d2), d1 / 2, d2 / 2);
}
export const fPvalue = (f, d1, d2) => 1 - fCdf(f, d1, d2);

// ---------- Chi-quadrado (série de Gauss) ----------
export function chi2Cdf(x, k) {
  if (x <= 0) return 0;
  const a = k / 2, xh = x / 2;
  let sum = 0, term = 1 / a, n = 0;
  while (Math.abs(term) > 1e-14 && n < 1000) {
    sum += term; n++;
    term *= xh / (a + n);
  }
  return Math.exp(-xh + a * Math.log(xh) - logGamma(a)) * sum;
}
export const chi2Pvalue = (x, k) => 1 - chi2Cdf(x, k);
