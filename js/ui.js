// js/ui.js
const NAV = [
  ['/calculadora', 'Calculadora estatística'],
  ['/normalidade', 'Teste de normalidade'],
  ['/amostra', 'Tamanho da amostra'],
  ['/citacao', 'Gerador de citação'],
  ['/buscador', 'Buscador de artigos'],
  ['/r-latex', 'R → LaTeX'],
  ['/guias/qual-teste-estatistico-usar', 'Guias']
];

export function mountShell() {
  const path = location.pathname.replace(/\.html$/, '');
  const h = document.getElementById('site-header');
  if (h) h.innerHTML = `
  <header class="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
    <div class="max-w-6xl mx-auto px-6 py-3 flex flex-col md:flex-row md:items-center gap-3 justify-between">
      <a href="/" class="font-bold text-slate-100">Estatística&nbsp;TCC<span class="text-blue-400">.</span></a>
      <nav class="flex flex-wrap gap-1.5 text-xs">
        ${NAV.map(([u, t]) => `<a href="${u}" class="px-2.5 py-1.5 rounded-lg ${path.startsWith(u) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">${t}</a>`).join('')}
      </nav>
    </div>
  </header>`;

  const f = document.getElementById('site-footer');
  if (f) f.innerHTML = `
  <footer class="border-t border-slate-800 bg-slate-900 mt-12">
    <div class="max-w-6xl mx-auto px-6 py-8 grid md:grid-cols-3 gap-6 text-xs text-slate-400">
      <div><p class="font-bold text-slate-200 mb-2">Ferramentas</p>
        ${NAV.slice(0, 6).map(([u, t]) => `<a href="${u}" class="block hover:text-blue-400 py-0.5">${t}</a>`).join('')}</div>
      <div><p class="font-bold text-slate-200 mb-2">Institucional</p>
        <a href="/sobre" class="block hover:text-blue-400 py-0.5">Sobre e metodologia</a>
        <a href="/privacidade" class="block hover:text-blue-400 py-0.5">Política de privacidade</a>
        <a href="/termos" class="block hover:text-blue-400 py-0.5">Termos de uso</a>
        <a href="/contato" class="block hover:text-blue-400 py-0.5">Contato</a></div>
      <div><p class="font-bold text-slate-200 mb-2">Aviso</p>
        <p>Todos os cálculos são executados localmente no seu navegador. Nenhum arquivo ou dado de pesquisa é enviado ou armazenado em servidores.</p>
        <p class="mt-2">© ${new Date().getFullYear()} Estatística TCC.</p></div>
    </div>
  </footer>`;

  consent();
}

function consent() {
  if (localStorage.getItem('consent')) return;
  const d = document.createElement('div');
  d.className = 'fixed bottom-0 inset-x-0 z-[100] bg-slate-900 border-t border-slate-700 p-4 text-xs text-slate-300';
  d.innerHTML = `<div class="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-3 justify-between">
    <p>Usamos cookies para análise de tráfego e exibição de anúncios personalizados (Google AdSense).
      Veja a <a href="/privacidade" class="text-blue-400 underline">política de privacidade</a>.</p>
    <div class="flex gap-2 shrink-0">
      <button id="cRej" class="px-3 py-1.5 rounded border border-slate-600">Rejeitar</button>
      <button id="cAcc" class="px-4 py-1.5 rounded bg-blue-600 text-white">Aceitar</button>
    </div></div>`;
  document.body.appendChild(d);
  const set = v => { localStorage.setItem('consent', v); d.remove(); };
  d.querySelector('#cAcc').onclick = () => set('all');
  d.querySelector('#cRej').onclick = () => set('none');
}
