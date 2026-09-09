// js/report-en.js — write-up em APA 7 (11 casos)
// Retorna { html, text }. O HTML usa <em> nos símbolos estatísticos.
import { br, fmtP } from './stats.js';

const em = s => `<em>${s}</em>`;
const strip = h => h.replace(/<\/?em>/g, '');

// APA: sem zero à esquerda em r, R², p, d? (d mantém zero: d = 0.45 é aceito)
const noLead = s => String(s).replace(/(^|[\s[(=])0\./g, '$1.');

const sigWord = p => (Number.isFinite(p) && p < 0.05) ? 'was' : 'was not';

const magD = d => { const a = Math.abs(d);
  return a < 0.2 ? 'negligible' : a < 0.5 ? 'small' : a < 0.8 ? 'medium' : 'large'; };
const magR = r => { const a = Math.abs(r);
  return a < 0.1 ? 'negligible' : a < 0.3 ? 'small' : a < 0.5 ? 'moderate'
       : a < 0.7 ? 'strong' : 'very strong'; };
const magEta = e => e < 0.01 ? 'negligible' : e < 0.06 ? 'small'
       : e < 0.14 ? 'medium' : 'large';

// IC em APA: 95% CI [lo, lo] — vírgula, não ponto e vírgula
const ci = (a, b, d = 2) => `95% CI [${br(a, d)}, ${br(b, d)}]`;

export function reportEn(res, labels = {}) {
  const X = labels.x || 'variable X', Y = labels.y || 'variable Y';
  const g = labels.groups || res.groupNames || ['Group 1', 'Group 2'];
  let html = '';

  switch (res.test) {

    /* ---------- 1 & 2. t independente / Welch ---------- */
    case 'Teste t de Student independente':
    case 'Teste t de Welch (variâncias desiguais)': {
      const [a, b] = res.groups;
      const welch = res.test.includes('Welch');
      const hi = a.mean >= b.mean ? 0 : 1, lo = 1 - hi;
      const D = [a, b], N = [g[0], g[1]];
      const sig = res.p < 0.05;
      const lev = res.levene;

      html = `An ${welch ? "unequal-variances (Welch) " : ""}independent-samples `
        + `${em('t')} test was conducted to compare ${Y} between ${N[0]} and ${N[1]}. `;

      if (welch && lev && Number.isFinite(lev.p)) {
        html += `Levene's test indicated unequal variances, `
          + `${em('F')}(${lev.df1}, ${lev.df2}) = ${br(lev.F)}, ${em(fmtP(lev.p))}, `
          + `so degrees of freedom were adjusted using the Welch–Satterthwaite correction. `;
      } else if (lev && Number.isFinite(lev.p)) {
        html += `The homogeneity-of-variance assumption was met, `
          + `${em('F')}(${lev.df1}, ${lev.df2}) = ${br(lev.F)}, ${em(fmtP(lev.p))}. `;
      }

      html += sig
        ? `${Y} was significantly higher in ${N[hi]} (${em('M')} = ${br(D[hi].mean)}, `
          + `${em('SD')} = ${br(D[hi].sd)}, ${em('n')} = ${D[hi].n}) than in ${N[lo]} `
          + `(${em('M')} = ${br(D[lo].mean)}, ${em('SD')} = ${br(D[lo].sd)}, ${em('n')} = ${D[lo].n}), `
        : `There was no significant difference between ${N[0]} (${em('M')} = ${br(a.mean)}, `
          + `${em('SD')} = ${br(a.sd)}, ${em('n')} = ${a.n}) and ${N[1]} `
          + `(${em('M')} = ${br(b.mean)}, ${em('SD')} = ${br(b.sd)}, ${em('n')} = ${b.n}), `;

      html += `${em('t')}(${br(res.df, welch ? 2 : 0)}) = ${br(res.t, 2)}, ${em(fmtP(res.p))}. `
        + `The mean difference was ${br(res.diff)}, ${ci(res.ciDiff[0], res.ciDiff[1])}. `
        + `The effect size was ${em('d')} = ${br(Math.abs(res.effect.value))}, `
        + `indicating a ${magD(res.effect.value)} effect`;

      if (Number.isFinite(res.hedgesG))
        html += ` (Hedges's ${em('g')} = ${br(Math.abs(res.hedgesG))})`;
      html += `.`;

      if (!sig) html += ` A non-significant result does not establish equivalence between groups.`;
      break;
    }

    /* ---------- 3. t pareado ---------- */
    case 'Teste t pareado': {
      const [a, b] = res.groups;
      const sig = res.p < 0.05;
      const dir = res.diff >= 0 ? 'increase' : 'decrease';

      html = `A paired-samples ${em('t')} test was conducted to compare ${Y} `
        + `between Time 1 (${em('M')} = ${br(a.mean)}, ${em('SD')} = ${br(a.sd)}) and `
        + `Time 2 (${em('M')} = ${br(b.mean)}, ${em('SD')} = ${br(b.sd)}), ${em('N')} = ${res.n}. `
        + `The change ${sigWord(res.p)} statistically significant, `
        + `${em('t')}(${res.df}) = ${br(res.t, 2)}, ${em(fmtP(res.p))}, `
        + `with a mean ${dir} of ${br(Math.abs(res.diff))} points `
        + `(${em('SD')} of differences = ${br(res.sdDiff)}), `
        + `${ci(res.ciDiff[0], res.ciDiff[1])}. `
        + `The standardised effect size was ${em('d')}${'\u2082'.replace('\u2082','')}`
        + `${em('z')} = ${br(Math.abs(res.effect.value))}, `
        + `a ${magD(res.effect.value)} effect.`;
      if (!sig) html += ` The absence of significance does not demonstrate the absence of change.`;
      break;
    }

    /* ---------- 4. Mann-Whitney ---------- */
    case 'Teste U de Mann-Whitney': {
      const [a, b] = res.groups;
      const sig = res.p < 0.05;
      html = `Because the normality assumption was not satisfied, a Mann-Whitney `
        + `${em('U')} test was used to compare ${Y} between the two groups. `
        + `Median ${Y} ${sig ? 'differed significantly' : 'did not differ significantly'} between `
        + `${g[0]} (${em('Mdn')} = ${br(a.median)}, ${em('IQR')} = ${br(a.q1)}–${br(a.q3)}, `
        + `${em('n')} = ${a.n}) and ${g[1]} (${em('Mdn')} = ${br(b.median)}, `
        + `${em('IQR')} = ${br(b.q1)}–${br(b.q3)}, ${em('n')} = ${b.n}), `
        + `${em('U')} = ${br(res.U, 1)}, ${em('z')} = ${br(res.z, 2)}, ${em(fmtP(res.p))}. `
        + `The rank-biserial correlation was ${em('r')} = ${br(res.rankBiserial)}, `
        + `indicating a ${magR(res.rankBiserial)} effect.`;
      break;
    }

    /* ---------- 5. Wilcoxon ---------- */
    case 'Teste de Wilcoxon (postos sinalizados)': {
      const [a, b] = res.groups;
      const sig = res.p < 0.05;
      html = `A Wilcoxon signed-rank test was conducted because the differences `
        + `were not normally distributed (${em('N')} = ${res.n}`
        + `${res.zeros ? `; ${res.zeros} tied pair(s) with zero difference were excluded` : ''}). `
        + `Scores ${sig ? 'changed significantly' : 'did not change significantly'} from `
        + `Time 1 (${em('Mdn')} = ${br(a.median)}) to Time 2 (${em('Mdn')} = ${br(b.median)}), `
        + `${em('T')} = ${br(res.T, 1)}, ${em('z')} = ${br(res.z, 2)}, ${em(fmtP(res.p))}, `
        + `${em('r')} = ${br(res.effect.value)} (${magR(res.effect.value)} effect).`;
      break;
    }

    /* ---------- 6. ANOVA ---------- */
    case 'ANOVA one-way': {
      const nm = res.groupNames || labels.groups || [];
      const desc = res.groups.map((s, i) =>
        `${nm[i] || `Group ${i + 1}`} (${em('M')} = ${br(s.mean)}, `
        + `${em('SD')} = ${br(s.sd)}, ${em('n')} = ${s.n})`).join('; ');
      const sig = res.p < 0.05;
      const lev = res.levene;
      const post = (res.posthoc || []).filter(t => t.sig)
        .map(t => `${t.pair} (${fmtP(t.p)})`).join('; ');

      html = `A one-way analysis of variance was conducted to compare ${Y} across `
        + `${res.groups.length} groups: ${desc}. `;
      if (lev && Number.isFinite(lev.p)) {
        html += `Levene's test ${lev.p > 0.05 ? 'supported' : 'indicated a violation of'} `
          + `the homogeneity-of-variance assumption, ${em('F')}(${lev.df1}, ${lev.df2}) = `
          + `${br(lev.F)}, ${em(fmtP(lev.p))}. `;
      }
      html += `The effect of group ${sigWord(res.p)} statistically significant, `
        + `${em('F')}(${res.df1}, ${res.df2}) = ${br(res.F, 2)}, ${em(fmtP(res.p))}, `
        + `${em('η²')} = ${br(res.effect.value, 3)}, indicating a `
        + `${magEta(res.effect.value)} effect`;
      if (Number.isFinite(res.omega2)) html += ` (${em('ω²')} = ${br(res.omega2, 3)})`;
      html += `. `;
      html += sig
        ? `Post hoc pairwise comparisons with Bonferroni correction indicated: `
          + `${post || 'no pair remained significant after correction'}.`
        : `Post hoc comparisons were therefore not conducted.`;
      break;
    }

    /* ---------- 7. Kruskal-Wallis ---------- */
    case 'Kruskal-Wallis': {
      const nm = res.groupNames || labels.groups || [];
      const desc = res.groups.map((s, i) =>
        `${nm[i] || `Group ${i + 1}`} (${em('Mdn')} = ${br(s.median)}, `
        + `${em('IQR')} = ${br(s.q1)}–${br(s.q3)}, ${em('n')} = ${s.n})`).join('; ');
      html = `Because the normality assumption was violated, a Kruskal-Wallis `
        + `${em('H')} test was conducted to compare ${Y} across ${res.groups.length} `
        + `independent groups: ${desc}. The distributions ${res.p < 0.05
          ? 'differed significantly' : 'did not differ significantly'}, `
        + `${em('H')}(${res.df}) = ${br(res.H, 2)}, ${em(fmtP(res.p))}, `
        + `${em('ε²')} = ${br(res.effect.value, 3)}, a ${magEta(res.effect.value)} effect.`;
      break;
    }

    /* ---------- 8. Pearson ---------- */
    case 'Correlação de Pearson': {
      const sig = res.p < 0.05;
      html = `A Pearson product-moment correlation was computed to assess the linear `
        + `relationship between ${X} and ${Y} (${em('n')} = ${res.n}). There was a `
        + `${magR(res.r)} ${res.r > 0 ? 'positive' : 'negative'} correlation, which `
        + `${sigWord(res.p)} statistically significant, `
        + `${em('r')}(${res.df}) = ${noLead(br(res.r, 2))}, ${em(fmtP(res.p))}, `
        + `${ci(res.ci95[0], res.ci95[1], 2)}. `
        + `The coefficient of determination indicated that ${br(res.r2 * 100, 1)}% of the `
        + `variance was shared between the two variables (${em('R²')} = ${noLead(br(res.r2, 2))}). `
        + `Correlation does not imply causation.`;
      break;
    }

    /* ---------- 9. Spearman ---------- */
    case 'Correlação de Spearman': {
      html = `A Spearman rank-order correlation was computed because the assumption of `
        + `normality was not met (${em('n')} = ${res.n}). There was a ${magR(res.r)} `
        + `${res.r > 0 ? 'positive' : 'negative'} monotonic association between ${X} and ${Y}, `
        + `which ${sigWord(res.p)} statistically significant, `
        + `${em('r')}${'\u209B'} = ${noLead(br(res.r, 2))}, ${em(fmtP(res.p))}. `
        + `Correlation does not imply causation.`;
      break;
    }

    /* ---------- 10. Regressão ---------- */
    case 'Regressão linear simples': {
      const sig = (res.pF ?? res.p) < 0.05;
      const s = res.slope;
      html = `A simple linear regression was calculated to predict ${Y} from ${X} `
        + `(${em('n')} = ${res.n}). The model ${sigWord(res.pF ?? res.p)} statistically `
        + `significant, ${em('F')}(${res.dfF[0]}, ${res.dfF[1]}) = ${br(res.F, 2)}, `
        + `${em(fmtP(res.pF ?? res.p))}, and accounted for ${br(res.r2 * 100, 1)}% of the `
        + `variance in ${Y} (${em('R²')} = ${noLead(br(res.r2, 2))}, adjusted `
        + `${em('R²')} = ${noLead(br(res.r2adj, 2))}). `
        + `${X} was a ${sig ? 'significant' : 'non-significant'} predictor, `
        + `${em('B')} = ${br(s.b, 3)}, ${em('SE')} = ${br(s.se, 3)}, `
        + `${em('t')}(${res.df}) = ${br(s.t, 2)}, ${em(fmtP(s.p))}, `
        + `${ci(s.ci[0], s.ci[1], 3)}. `
        + `For every one-unit increase in ${X}, ${Y} ${s.b >= 0 ? 'increased' : 'decreased'} `
        + `by ${br(Math.abs(s.b), 3)} units on average. `
        + `The regression equation was ${Y} = ${br(res.intercept.b, 3)} `
        + `${s.b >= 0 ? '+' : '−'} ${br(Math.abs(s.b), 3)} × ${X}.`;
      break;
    }

    /* ---------- 11. Chi-quadrado ---------- */
    case 'Chi-quadrado de independência': {
      html = `A chi-square test of independence was performed to examine the relation `
        + `between the two categorical variables (${em('N')} = ${res.n}). The relation `
        + `${sigWord(res.p)} significant, ${em('χ²')}(${res.df}, ${em('N')} = ${res.n}) = `
        + `${br(res.chi2, 2)}, ${em(fmtP(res.p))}, Cramér's ${em('V')} = `
        + `${noLead(br(res.effect.value, 2))} (${magR(res.effect.value)} association).`;
      if (res.warning)
        html += ` One or more cells had an expected frequency below 5; results should be `
          + `interpreted with caution and Fisher's exact test considered.`;
      break;
    }

    default:
      return { html: '', text: '' };
  }

  return { html, text: strip(html) };
}
