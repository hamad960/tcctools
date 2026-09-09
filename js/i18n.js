// js/i18n.js — internacionalização central
export const LANG = document.documentElement.lang.startsWith('en') ? 'en' : 'pt';
export const IS_EN = LANG === 'en';

const DICT = {
  pt: {
    brand: 'Estatística&nbsp;TCC', locale: 'pt-BR',
    nav: [
      ['/calculadora', 'Calculadora estatística'],
      ['/normalidade', 'Teste de normalidade'],
      ['/amostra', 'Tamanho da amostra'],
      ['/citacao', 'Gerador de citação'],
      ['/buscador', 'Buscador de artigos'],
      ['/r-latex', 'R → LaTeX'],
      ['/guias/qual-teste-estatistico-usar', 'Guias']
    ],
    footTools: 'Ferramentas', footInst: 'Institucional', footNotice: 'Aviso',
    inst: [['/sobre','Sobre e metodologia'],['/privacidade','Política de privacidade'],
           ['/termos','Termos de uso'],['/contato','Contato']],
    privacyNote: 'Todos os cálculos são executados localmente no seu navegador. Nenhum arquivo ou dado de pesquisa é enviado ou armazenado em servidores.',
    cookie: 'Usamos cookies para análise de tráfego e exibição de anúncios personalizados (Google AdSense). Veja a',
    cookieLink: 'política de privacidade', accept: 'Aceitar', reject: 'Rejeitar',
    switchTo: 'EN', switchHref: '/en/',

    /* ---- UI estática da página (usada por data-i18n) ---- */
    ui: {
      step1: '1. Seus dados',
      step2: '2. Pressupostos (verificados automaticamente)',
      step3: '3. Objetivo da análise',
      btnFile: 'Escolher arquivo',
      noFile: 'Nenhum arquivo selecionado',
      btnDemo: 'Usar dados de exemplo',
      btnPaste: 'Colar do Excel',
      pastePlaceholder: 'Cole aqui (Ctrl+V) as colunas copiadas do Excel, com o cabeçalho na primeira linha',
      assumpHint: 'Carregue os dados para testar normalidade (Shapiro-Wilk) e homogeneidade das variâncias (Levene).',
      goalLabel: 'Objetivo',
      objCompare2: 'Comparar 2 grupos',
      objCompare3: 'Comparar 3 ou mais grupos',
      objCorrelate: 'Correlacionar variáveis',
      objRegression: 'Prever (regressão)',
      pairingLabel: 'Pareamento',
      pairIndep: 'Independentes',
      pairPaired: 'Pareados (mesmo grupo, pré/pós)',
      testLabel: 'Teste (sugerido automaticamente)',
      optTIndep: 'Teste t independente',
      optTPaired: 'Teste t pareado',
      optMann: 'Mann-Whitney (U)',
      optWilcoxon: 'Wilcoxon',
      optAnova: 'ANOVA one-way',
      optKruskal: 'Kruskal-Wallis',
      optPearson: 'Correlação de Pearson',
      optSpearman: 'Correlação de Spearman',
      optReg: 'Regressão linear simples',
      btnRun: 'Calcular',
      btnTheme: 'Tema claro (exportação)',
      btnPng: 'Baixar figura PNG 300 dpi',
      btnDocx: 'Baixar tabela .docx',
      btnShare: 'Copiar link compartilhável',
      figTitleDefault: 'Figura 1 — Resultado da análise',
      statsTitle: 'Resultados estatísticos',
      repTitle: 'Parágrafo pronto (ABNT / APA)',
      btnCopyRep: 'Copiar',
      disclaimer: 'Revise sempre com seu orientador. Esta ferramenta não substitui julgamento estatístico profissional.'
    },

    colWord: 'Coluna', groupWord: 'Grupo', unlabeled: 'Sem rótulo',
    rowsLoaded: (r,c) => `${r} linhas × ${c} colunas carregadas.`,
    discarded: n => `${n} linha(s) descartada(s) por valor ausente ou não numérico.`,
    labGroup: 'Coluna de grupo (categórica)',
    labOutcome: 'Variável desfecho (numérica)',
    labPre: 'Momento 1 — pré (coluna numérica)',
    labPos: 'Momento 2 — pós (coluna numérica)',
    labPredX: 'Variável preditora X (numérica)',
    labPredY: 'Variável desfecho Y (numérica)',
    labVarX: 'Variável X (numérica)', labVarY: 'Variável Y (numérica)',

    okTag: 'OK', violatedTag: 'VIOLADO',
    swDiff: (y,x,n) => `Shapiro-Wilk das diferenças (${y} − ${x}), n = ${n}`,
    swVar: (lab,nm,n) => `Shapiro-Wilk ${lab} — ${nm} (n = ${n})`,
    swGroup: (nm,n) => `Shapiro-Wilk — ${nm} (n = ${n})`,
    swResid: 'Shapiro-Wilk dos resíduos do modelo',
    leveneLab: 'Levene — homogeneidade das variâncias',
    insufficient: 'Dados insuficientes para testar pressupostos (n mínimo = 3 por grupo).',

    errRead: 'Não foi possível ler o arquivo: ',
    errEmpty: 'Planilha vazia ou sem linha de cabeçalho.',
    errLoadFirst: 'Carregue seus dados primeiro.',
    errSameCol: 'Selecione duas colunas diferentes.',
    errCalc: 'Erro no cálculo: ',
    errPairs: n => `São necessários pelo menos 4 pares numéricos válidos. Encontrei ${n}. Verifique se as duas colunas selecionadas contêm números.`,
    errPaired: n => `Testes pareados exigem DUAS colunas numéricas (ex.: Pré e Pós), com os valores do mesmo participante na mesma linha. Encontrei ${n} pares válidos.`,
    errNoNum: y => `Nenhum valor numérico válido na coluna "${y}".`,
    errMin2: 'Todo grupo precisa de ao menos 2 observações válidas.',
    errNeed2: (n,names,x) => `Este teste exige exatamente 2 grupos. Encontrei ${n} (${names}) na coluna "${x}". Para 3 ou mais grupos, use ANOVA ou Kruskal-Wallis.`,
    errNeed3: n => `ANOVA e Kruskal-Wallis pressupõem 3 ou mais grupos. Encontrei ${n}. Com 2 grupos, use teste t ou Mann-Whitney.`,
    errRunFirst: 'Execute uma análise antes de compartilhar.',
    errExportFirst: 'Execute uma análise antes de exportar.',
    errShareLimit: 'O link compartilhável suporta até 60 linhas de dados. Para conjuntos maiores, utilize a exportação em .docx ou .png.',
    errDocx: m => `Não foi possível gerar o arquivo DOCX: ${m}`,

    mTest: 'Teste', mDf: 'gl', mP: 'p-valor',
    mSlope: 'β (inclinação)', mIntercept: 'Intercepto',

    tableTitle: 'Tabela 1 — Estatística descritiva e inferencial',
    figTitle: 'Figura 1', figFile: 'figura1.png',
    thGroup:'Grupo', thMoment:'Momento', thVar:'Variável', thN:'n',
    thM:'M', thSD:'DP', thMd:'Md', thCI:'IC 95%', thRange:'Mín–Máx',
    note: 'Nota.',
    noteAbbr: 'M = média; DP = desvio-padrão; Md = mediana; IC = intervalo de confiança.',
    noteAbbrShort: 'M = média; DP = desvio-padrão; Md = mediana.',
    diffLabel: 'Diferença (pós − pré)',
    pairedSuffix: 'para amostras pareadas',
    regNote: (r2, r2adj, p, eq) => `Regressão linear simples. R² = ${r2}${r2adj ? `; R² ajustado = ${r2adj}` : ''}; ${p}. Equação: ${eq}.`,

    obs: 'Observações', mean: 'Média',
    fitLine: r2 => `Reta de ajuste (R² = ${r2})`,
    axisMoment: 'Momento da avaliação', axisScore: 'Escore',
    chartRel: (x,y) => `Relação entre ${x} e ${y}`,
    chartMean: (y,x) => `Média de ${y} por ${x}`,
    errBarNote: 'Barras de erro representam ±1 desvio-padrão.',

    copy: 'Copiar', copied: 'Copiado!',
    themeLight: 'Tema claro (exportação)', themeDark: 'Tema escuro',
    genDocx: 'Gerando DOCX...', linkCopied: 'Link copiado!',
    promptCopy: 'Copie o link:',

    testName: {
      'Teste t de Student independente': 'Teste t de Student independente',
      'Teste t de Welch (variâncias desiguais)': 'Teste t de Welch (variâncias desiguais)',
      'Teste t pareado': 'Teste t pareado',
      'Teste U de Mann-Whitney': 'Teste U de Mann-Whitney',
      'Teste de Wilcoxon (postos sinalizados)': 'Teste de Wilcoxon (postos sinalizados)',
      'ANOVA one-way': 'ANOVA one-way',
      'Kruskal-Wallis': 'Kruskal-Wallis',
      'Correlação de Pearson': 'Correlação de Pearson',
      'Correlação de Spearman': 'Correlação de Spearman',
      'Regressão linear simples': 'Regressão linear simples',
      'Chi-quadrado de independência': 'Chi-quadrado de independência'
    },
    effName: {
      'd de Cohen': 'd de Cohen', 'd de Cohen (dz)': 'd de Cohen (dz)',
      'r (rank-biserial)': 'r (rank-biserial)', 'r': 'r', 'ρ': 'ρ',
      'η² (eta quadrado)': 'η² (eta quadrado)',
      'ε² (epsilon quadrado)': 'ε² (epsilon quadrado)',
      'V de Cramér': 'V de Cramér'
    },
    effLabel: {
      'desprezível':'desprezível','pequeno':'pequeno','médio':'médio','grande':'grande',
      'moderado':'moderado','forte':'forte','muito forte':'muito forte'
    },

    rep: {
      excluded: n => ` Foram excluídas ${n} observação(ões) por ausência de dados.`,
      corr: (test, dir, mag, sig, sym, r, p, x, y) =>
        `A ${test} indicou correlação ${dir} ${mag}${sig ? ' e estatisticamente significativa' : ', sem significância estatística,'} entre ${x} e ${y} (${sym} = ${r}; ${p}). Ressalta-se que a correlação observada não permite inferência de causalidade.`,
      dirPos: 'positiva', dirNeg: 'negativa',
      magWeak: 'fraca', magMod: 'moderada', magModStrong: 'moderada a forte', magStrong: 'forte',
      reg: (sig, p, pct, r2, eq) =>
        `A regressão linear simples ${sig ? 'mostrou-se estatisticamente significativa' : 'não alcançou significância estatística'} (${p}), explicando ${pct}% da variância do desfecho (R² = ${r2}). A equação estimada foi ${eq}.`,
      grpDesc: (nm,m,s,n) => `${nm} (M = ${m}; DP = ${s}; n = ${n})`,
      cmp: (sig, groups, test, p, eff) =>
        `${sig ? 'Observou-se diferença estatisticamente significativa' : 'Não foi observada diferença estatisticamente significativa'} entre ${groups}, conforme o ${test} (${p}).${eff}${sig ? '' : ' Ressalta-se que a ausência de significância não permite afirmar equivalência entre os grupos.'}`,
      effSuffix: (name,val,label) => ` ${name} = ${val}, indicando efeito de magnitude ${label}.`,
      and: ' e '
    },
    cookiePrefs: 'Preferências de cookies',
    cookieLabel: 'Aviso de cookies',
  },

  en: {
    brand: 'StatsFor&nbsp;Thesis', locale: 'en-US',
    nav: [
      ['/en/calculator', 'Statistics calculator'],
      ['/en/normality', 'Normality test'],
      ['/en/sample-size', 'Sample size'],
      ['/en/citation', 'Citation generator'],
      ['/en/search', 'Paper search'],
      ['/en/r-to-latex', 'R → LaTeX'],
      ['/en/guides/which-statistical-test', 'Guides']
    ],
    footTools: 'Tools', footInst: 'Company', footNotice: 'Notice',
    inst: [['/en/about','About & methodology'],['/en/privacy','Privacy policy'],
           ['/en/terms','Terms of use'],['/en/contact','Contact']],
    privacyNote: 'All calculations run locally in your browser. No file or research data is ever uploaded or stored on a server.',
    cookie: 'We use cookies for traffic analytics and personalized advertising (Google AdSense). See our',
    cookieLink: 'privacy policy', accept: 'Accept', reject: 'Reject',
    switchTo: 'PT', switchHref: '/',

        ui: {
      step1: '1. Your data',
      step2: '2. Assumptions (checked automatically)',
      step3: '3. Analysis goal',
      btnFile: 'Choose file',
      noFile: 'No file selected',
      btnDemo: 'Load sample data',
      btnPaste: 'Paste from Excel',
      pastePlaceholder: 'Paste (Ctrl+V) the columns copied from Excel, with the header in the first row',
      assumpHint: 'Load your data to test normality (Shapiro-Wilk) and homogeneity of variance (Levene).',
      goalLabel: 'Goal',
      objCompare2: 'Compare 2 groups',
      objCompare3: 'Compare 3 or more groups',
      objCorrelate: 'Correlate two variables',
      objRegression: 'Predict (regression)',
      pairingLabel: 'Design',
      pairIndep: 'Independent samples',
      pairPaired: 'Paired / repeated measures (pre–post)',
      testLabel: 'Test (auto-suggested)',
      optTIndep: 'Independent-samples t-test',
      optTPaired: 'Paired-samples t-test',
      optMann: 'Mann-Whitney U',
      optWilcoxon: 'Wilcoxon signed-rank',
      optAnova: 'One-way ANOVA',
      optKruskal: 'Kruskal-Wallis H',
      optPearson: 'Pearson correlation',
      optSpearman: 'Spearman correlation',
      optReg: 'Simple linear regression',
      btnRun: 'Calculate',
      btnTheme: 'Light theme (for export)',
      btnPng: 'Download 300 dpi PNG',
      btnDocx: 'Download .docx table',
      btnShare: 'Copy shareable link',
      figTitleDefault: 'Figure 1 — Analysis output',
      statsTitle: 'Statistical results',
      repTitle: 'Ready-to-paste paragraph (APA 7)',
      btnCopyRep: 'Copy',
      disclaimer: 'Always review with your advisor. This tool does not replace professional statistical judgement.'
    },


    colWord: 'Column', groupWord: 'Group', unlabeled: 'Unlabeled',
    rowsLoaded: (r,c) => `${r} rows × ${c} columns loaded.`,
    discarded: n => `${n} row(s) dropped due to missing or non-numeric values.`,
    labGroup: 'Grouping column (categorical)',
    labOutcome: 'Outcome variable (numeric)',
    labPre: 'Time 1 — pre (numeric column)',
    labPos: 'Time 2 — post (numeric column)',
    labPredX: 'Predictor X (numeric)',
    labPredY: 'Outcome Y (numeric)',
    labVarX: 'Variable X (numeric)', labVarY: 'Variable Y (numeric)',

    okTag: 'OK', violatedTag: 'VIOLATED',
    swDiff: (y,x,n) => `Shapiro-Wilk on differences (${y} − ${x}), n = ${n}`,
    swVar: (lab,nm,n) => `Shapiro-Wilk ${lab} — ${nm} (n = ${n})`,
    swGroup: (nm,n) => `Shapiro-Wilk — ${nm} (n = ${n})`,
    swResid: 'Shapiro-Wilk on model residuals',
    leveneLab: "Levene's test — homogeneity of variance",
    insufficient: 'Not enough data to test assumptions (minimum n = 3 per group).',

    errRead: 'Could not read the file: ',
    errEmpty: 'The spreadsheet is empty or has no header row.',
    errLoadFirst: 'Load your data first.',
    errSameCol: 'Please select two different columns.',
    errCalc: 'Calculation error: ',
    errPairs: n => `At least 4 valid numeric pairs are required. Found ${n}. Check that both selected columns contain numbers.`,
    errPaired: n => `Paired tests require TWO numeric columns (e.g. Pre and Post), with each participant's values on the same row. Found ${n} valid pairs.`,
    errNoNum: y => `No valid numeric values in column "${y}".`,
    errMin2: 'Every group needs at least 2 valid observations.',
    errNeed2: (n,names,x) => `This test requires exactly 2 groups. Found ${n} (${names}) in column "${x}". For 3 or more groups, use ANOVA or Kruskal-Wallis.`,
    errNeed3: n => `ANOVA and Kruskal-Wallis require 3 or more groups. Found ${n}. With 2 groups, use a t-test or Mann-Whitney.`,
    errRunFirst: 'Run an analysis before sharing.',
    errExportFirst: 'Run an analysis before exporting.',
    errShareLimit: 'Shareable links support up to 60 rows of data. For larger datasets, use the .docx or .png export.',
    errDocx: m => `Could not generate the DOCX file: ${m}`,

    mTest: 'Test', mDf: 'df', mP: 'p value',
    mSlope: 'β (slope)', mIntercept: 'Intercept',

    tableTitle: 'Table 1 — Descriptive and inferential statistics',
    figTitle: 'Figure 1', figFile: 'figure1.png',
    thGroup:'Group', thMoment:'Time point', thVar:'Variable', thN:'n',
    thM:'M', thSD:'SD', thMd:'Mdn', thCI:'95% CI', thRange:'Min–Max',
    note: 'Note.',
    noteAbbr: 'M = mean; SD = standard deviation; Mdn = median; CI = confidence interval.',
    noteAbbrShort: 'M = mean; SD = standard deviation; Mdn = median.',
    diffLabel: 'Difference (post − pre)',
    pairedSuffix: 'for paired samples',
    regNote: (r2, r2adj, p, eq) => `Simple linear regression. R² = ${r2}${r2adj ? `; adjusted R² = ${r2adj}` : ''}; ${p}. Equation: ${eq}.`,

    obs: 'Observations', mean: 'Mean',
    fitLine: r2 => `Fitted line (R² = ${r2})`,
    axisMoment: 'Time point', axisScore: 'Score',
    chartRel: (x,y) => `Relationship between ${x} and ${y}`,
    chartMean: (y,x) => `Mean ${y} by ${x}`,
    errBarNote: 'Error bars represent ±1 standard deviation.',

    copy: 'Copy', copied: 'Copied!',
    themeLight: 'Light theme (for export)', themeDark: 'Dark theme',
    genDocx: 'Generating DOCX...', linkCopied: 'Link copied!',
    promptCopy: 'Copy the link:',

    testName: {
      'Teste t de Student independente': 'independent-samples t test',
      'Teste t de Welch (variâncias desiguais)': "Welch's t test",
      'Teste t pareado': 'paired-samples t test',
      'Teste U de Mann-Whitney': 'Mann-Whitney U test',
      'Teste de Wilcoxon (postos sinalizados)': 'Wilcoxon signed-rank test',
      'ANOVA one-way': 'one-way ANOVA',
      'Kruskal-Wallis': 'Kruskal-Wallis H test',
      'Correlação de Pearson': 'Pearson correlation',
      'Correlação de Spearman': 'Spearman rank-order correlation',
      'Regressão linear simples': 'simple linear regression',
      'Chi-quadrado de independência': 'chi-square test of independence'
    },
    effName: {
      'd de Cohen': "Cohen's d", 'd de Cohen (dz)': "Cohen's dz",
      'r (rank-biserial)': 'r (rank-biserial)', 'r': 'r', 'ρ': 'ρ',
      'η² (eta quadrado)': 'η² (eta squared)',
      'ε² (epsilon quadrado)': 'ε² (epsilon squared)',
      'V de Cramér': "Cramér's V"
    },
    effLabel: {
      'desprezível':'negligible','pequeno':'small','médio':'medium','grande':'large',
      'moderado':'moderate','forte':'strong','muito forte':'very strong'
    },

    rep: {
      excluded: n => ` ${n} observation(s) were excluded due to missing data.`,
      corr: (test, dir, mag, sig, sym, r, p, x, y) =>
        `A ${test} revealed a ${mag} ${dir}${sig ? ', statistically significant' : ', non-significant'} association between ${x} and ${y}, ${sym} = ${r}, ${p}. Correlation does not license causal inference.`,
      dirPos: 'positive', dirNeg: 'negative',
      magWeak: 'weak', magMod: 'moderate', magModStrong: 'moderate-to-strong', magStrong: 'strong',
      reg: (sig, p, pct, r2, eq) =>
        `The simple linear regression model was ${sig ? 'statistically significant' : 'not statistically significant'}, ${p}, accounting for ${pct}% of the variance in the outcome (R² = ${r2}). The estimated equation was ${eq}.`,
      grpDesc: (nm,m,s,n) => `${nm} (M = ${m}, SD = ${s}, n = ${n})`,
      cmp: (sig, groups, test, p, eff) =>
        `${sig ? 'A statistically significant difference was observed' : 'No statistically significant difference was observed'} between ${groups}, as assessed by the ${test}, ${p}.${eff}${sig ? '' : ' Note that the absence of significance does not establish equivalence between groups.'}`,
      effSuffix: (name,val,label) => ` ${name} = ${val}, indicating a ${label} effect.`,
      and: ' and '
    },
    cookiePrefs: 'Cookie preferences',
    cookieLabel: 'Cookie notice',
  }
};

export const T = DICT[LANG];

export const tTest = k => T.testName[k] || k;
export const tEff  = k => T.effName[k]  || k;
export const tLbl  = k => T.effLabel[k] || k;

/* ============================================================
   Tradutor de DOM. Marque o HTML uma vez:
     <h2 data-i18n="step1">1. Seus dados</h2>
     <input data-i18n-ph="pastePlaceholder">
   Chame applyI18n() após mountShell().
   ============================================================ */
export function applyI18n(root = document) {
  const U = T.ui;
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const v = U[el.dataset.i18n];
    if (v != null) el.innerHTML = v;
  });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const v = U[el.dataset.i18nPh];
    if (v != null) el.placeholder = v;
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const v = U[el.dataset.i18nTitle];
    if (v != null) el.title = v;
  });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const v = U[el.dataset.i18nAria];
    if (v != null) el.setAttribute('aria-label', v);
  });
}
