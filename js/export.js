// js/export.js
// PNG em alta resolução a partir de um Chart.js já renderizado
export function chartToPNG(chart, filename = 'figura1.png', dpi = 300) {
  const src = chart.canvas;
  const scale = dpi / 96;
  const off = document.createElement('canvas');
  off.width = src.width * scale;
  off.height = src.height * scale;
  const ctx = off.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, off.width, off.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, off.width, off.height);
  off.toBlob(b => download(b, filename), 'image/png');
}

// Melhor qualidade: re-renderiza o gráfico em devicePixelRatio alto antes de exportar
export function highResChartConfig(baseConfig, ratio = 3) {
  return { ...baseConfig, options: { ...baseConfig.options, devicePixelRatio: ratio, animation: false } };
}

// .DOCX nativo via WordprocessingML (abre no Word, Google Docs e LibreOffice)
export function tableToDocx({ title, headers, rows, note, reportText, imgDataUrl }) {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cell = (t, bold) => `<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>
    <w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr>${bold ? '<w:b/>' : ''}
    <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="20"/></w:rPr>
    <w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p></w:tc>`;
  const tr = (cells, bold) => `<w:tr>${cells.map(c => cell(c, bold)).join('')}</w:tr>`;
  const p = (t, opts = {}) => `<w:p><w:pPr>${opts.center ? '<w:jc w:val="center"/>' : ''}
    <w:spacing w:line="360" w:lineRule="auto"/></w:pPr><w:r><w:rPr>
    ${opts.bold ? '<w:b/>' : ''}${opts.italic ? '<w:i/>' : ''}
    <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${opts.sz || 24}"/></w:rPr>
    <w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${p(title, { bold: true })}
<w:tbl><w:tblPr><w:tblBorders>
  <w:top w:val="single" w:sz="8" w:color="000000"/>
  <w:bottom w:val="single" w:sz="8" w:color="000000"/>
  <w:insideH w:val="none"/><w:insideV w:val="none"/>
  <w:left w:val="none"/><w:right w:val="none"/>
</w:tblBorders><w:tblW w:w="5000" w:type="pct"/></w:tblPr>
${tr(headers, true)}
${rows.map(r => tr(r, false)).join('')}
</w:tbl>
${note ? p(`Nota. ${note}`, { italic: true, sz: 20 }) : ''}
${reportText ? p('') + p(reportText) : ''}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1701" w:right="1134" w:bottom="1134" w:left="1701"/></w:sectPr>
</w:body></w:document>`;

  download(new Blob([xml], { type: 'application/vnd.ms-word' }),
    (title || 'tabela').replace(/[^\w]+/g, '_') + '.doc');
}

export function toCSV(headers, rows, filename = 'dados.csv') {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(q).join(';')).join('\r\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
