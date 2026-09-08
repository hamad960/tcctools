// js/dist.js — funções especiais e distribuições (sem dependências)
// Correções: regularização da beta incompleta, erf de alta precisão,
// tInv robusto, guardas numéricas.

export const SQRT2PI = Math.sqrt(2 * Math.PI);
const EPS = 2.220446049250313e-16;
const TINY = 1e-300;

// ---------- Gamma ----------
const G_COF = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7
];

export function logGamma(z) {
  if (!Number.isFinite(z)) return NaN;

  // 🔧 CORREÇÃO 7: polo em inteiros não positivos
  if (z <= 0 && Number.isInteger(z)) return Infinity;

  if (z < 0.5) {
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - logGamma(1 - z);
  }

  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < 8; i++) x += G_COF[i] / (z + i + 1);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

export const gammaFn = z => Math.exp(logGamma(z));

// log da função beta
export const logBeta = (a, b) => logGamma(a) + logGamma(b) - logGamma(a + b);

// ---------- Beta incompleta regularizada I_x(a,b) ----------

// Núcleo: fração continuada de Lentz. Converge rápido para x < (a+1)/(a+b+2).
function betacf(x, a, b) {
  const qab = a + b, qap = a + 1, qam = a - 1;

  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;

  let h = d;

  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;

    // passo par
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;

    // passo ímpar
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;

    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < 3e-16) break;
  }

  return h;
}

// 🔧 CORREÇÃO 1 e 3: regularização correta + estabilidade nas bordas
export function incBeta(x, a, b) {
  if (!(a > 0) || !(b > 0)) return NaN;
  if (!Number.isFinite(x)) return NaN;

  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const lnFront =
    a * Math.log(x) + b * Math.log1p(-x) - logBeta(a, b);

  // simetria: I_x(a,b) = 1 - I_{1-x}(b,a)
  if (x < (a + 1) / (a + b + 2)) {
    return Math.exp(lnFront) * betacf(x, a, b) / a;
  }
  return 1 - Math.exp(lnFront) * betacf(1 - x, b, a) / b;
}

// ---------- Normal ----------
export function normPdf(z) {
  return Math.exp(-0.5 * z * z) / SQRT2PI;
}

// 🔧 CORREÇÃO 2: erfc de dupla precisão (Numerical Recipes, ~1e-16)
function erfcCheb(x) {
  const cof = [
    -1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2,
    -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4,
    4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6,
    1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8,
    6.529054439e-9, 5.059343495e-9, -9.91364156e-10,
    -2.27365122e-10, 9.6467911e-11, 2.394038e-12,
    -6.886027e-12, 8.94487e-13, 3.13092e-13,
    -1.12708e-13, 3.81e-16, 7.106e-15
  ];

  const z = Math.abs(x);
  const t = 2 / (2 + z);
  const ty = 4 * t - 2;

  let d = 0, dd = 0;
  for (let j = cof.length - 1; j > 0; j--) {
    const tmp = d;
    d = ty * d - dd + cof[j];
    dd = tmp;
  }

  const ans = t * Math.exp(-z * z + 0.5 * (cof[0] + ty * d) - dd);
  return x >= 0 ? ans : 2 - ans;
}

export const erf = x => 1 - erfcCheb(x);
export const erfc = x => erfcCheb(x);

export function normCdf(z) {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  return 0.5 * erfcCheb(-z / Math.SQRT2);
}

// cauda superior com precisão preservada (evita cancelamento em 1 - Φ)
export const normSf = z => 0.5 * erfcCheb(z / Math.SQRT2);

export function normInv(p) { // quantil (Acklam + refino de Halley)
  if (!(p > 0)) return -Infinity;
  if (!(p < 1)) return Infinity;

  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416];

  const pl = 0.02425;
  let x, q, r;

  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
        ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p > 1 - pl) {
    q = Math.sqrt(-2 * Math.log1p(-p));
    x = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
         ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else {
    q = p - 0.5; r = q * q;
    x = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
        (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }

  // 🔧 refino: eleva a precisão de ~1e-9 para ~1e-15
  const e = normCdf(x) - p;
  const u = e * SQRT2PI * Math.exp(x * x / 2);
  return x - u / (1 + x * u / 2);
}

// ---------- t de Student ----------
export function tCdf(t, df) {
  if (!(df > 0)) return NaN;
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;

  const x = df / (df + t * t);
  const p = 0.5 * incBeta(x, df / 2, 0.5);
  return t > 0 ? 1 - p : p;
}

export const tPdf = (t, df) =>
  Math.exp(logGamma((df + 1) / 2) - logGamma(df / 2)) /
  Math.sqrt(df * Math.PI) * Math.pow(1 + t * t / df, -(df + 1) / 2);

// p bicaudal calculado direto na cauda (sem 1 - CDF)
export function tTwoTailed(t, df) {
  if (!(df > 0)) return NaN;
  if (!Number.isFinite(t)) return 0;
  const a = Math.abs(t);
  const p = incBeta(df / (df + a * a), df / 2, 0.5);
  return Math.min(1, Math.max(0, p));
}

// 🔧 CORREÇÃO 4: intervalo adaptativo + Newton
export function tInv(p, df) {
  if (!(df > 0)) return NaN;
  if (!(p > 0)) return -Infinity;
  if (!(p < 1)) return Infinity;
  if (p === 0.5) return 0;

  // chute inicial: normal corrigida (Cornish-Fisher)
  const z = normInv(p);
  let x = z + (z ** 3 + z) / (4 * df)
        + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df * df);

  // Newton com salvaguarda
  for (let i = 0; i < 60; i++) {
    const f = tCdf(x, df) - p;
    const fp = tPdf(x, df);
    if (!Number.isFinite(f) || !Number.isFinite(fp) || fp < 1e-300) break;
    const step = f / fp;
    x -= step;
    if (Math.abs(step) < 1e-12 * (1 + Math.abs(x))) return x;
  }

  // fallback: bissecção com limites expandidos dinamicamente
  let lo = -1, hi = 1;
  while (tCdf(lo, df) > p && lo > -1e12) lo *= 2;
  while (tCdf(hi, df) < p && hi < 1e12) hi *= 2;
  for (let i = 0; i < 300; i++) {
    const m = (lo + hi) / 2;
    if (tCdf(m, df) < p) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

// ---------- F ----------
// 🔧 CORREÇÃO 6: formulação estável
export function fCdf(f, d1, d2) {
  if (!(d1 > 0) || !(d2 > 0)) return NaN;
  if (!(f > 0)) return 0;
  if (!Number.isFinite(f)) return 1;
  const x = d1 * f / (d1 * f + d2);
  return incBeta(x, d1 / 2, d2 / 2);
}

export function fPvalue(f, d1, d2) {
  if (!(d1 > 0) || !(d2 > 0)) return NaN;
  if (!(f > 0)) return 1;
  if (!Number.isFinite(f)) return 0;
  // cauda direta: I_{d2/(d2+d1 f)}(d2/2, d1/2)
  const p = incBeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
  return Math.min(1, Math.max(0, p));
}

export function fInv(p, d1, d2) {
  if (!(p > 0) || !(p < 1)) return NaN;
  let lo = 1e-10, hi = 1e10;
  for (let i = 0; i < 300; i++) {
    const m = Math.sqrt(lo * hi);
    if (fCdf(m, d1, d2) < p) lo = m; else hi = m;
  }
  return Math.sqrt(lo * hi);
}

// ---------- Gama incompleta e Chi-quadrado ----------
// P(a,x) por série
function gammaPSeries(a, x) {
  const lnG = logGamma(a);
  let ap = a, sum = 1 / a, del = sum;
  for (let n = 1; n <= 1000; n++) {
    ap++;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnG);
}

// Q(a,x) por fração continuada (melhor para x > a+1)
function gammaQCf(a, x) {
  const lnG = logGamma(a);
  let b = x + 1 - a, c = 1 / TINY, d = 1 / b, h = d;
  for (let i = 1; i <= 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;  if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnG) * h;
}

export function gammaP(a, x) { // regularizada inferior
  if (!(a > 0) || x < 0) return NaN;
  if (x === 0) return 0;
  return x < a + 1 ? gammaPSeries(a, x) : 1 - gammaQCf(a, x);
}

export function gammaQ(a, x) { // regularizada superior
  if (!(a > 0) || x < 0) return NaN;
  if (x === 0) return 1;
  return x < a + 1 ? 1 - gammaPSeries(a, x) : gammaQCf(a, x);
}

export function chi2Cdf(x, k) {
  if (!(k > 0)) return NaN;
  if (!(x > 0)) return 0;
  if (!Number.isFinite(x)) return 1;
  return gammaP(k / 2, x / 2);
}

export function chi2Pvalue(x, k) {
  if (!(k > 0)) return NaN;
  if (!(x > 0)) return 1;
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, gammaQ(k / 2, x / 2)));
}

export function chi2Inv(p, k) {
  if (!(p > 0) || !(p < 1)) return NaN;
  let lo = 0, hi = Math.max(100, 4 * k + 100);
  while (chi2Cdf(hi, k) < p && hi < 1e12) hi *= 2;
  for (let i = 0; i < 300; i++) {
    const m = (lo + hi) / 2;
    if (chi2Cdf(m, k) < p) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}
