// js/export.js

// ============================================================
// PNG a partir de um Chart.js já renderizado
// ============================================================

export function chartToPNG(chart, filename = 'figura1.png', dpi = 300) {
  if (!chart?.canvas) {
    throw new Error('Gráfico não encontrado para exportação.');
  }

  const src = chart.canvas;

  // src.width JÁ inclui o devicePixelRatio aplicado pelo Chart.js.
  // Reescalar aqui apenas interpolaria pixels e degradaria a nitidez.
  // Copiamos 1:1 e garantimos apenas o fundo opaco.
  const off = document.createElement('canvas');
  off.width = src.width;
  off.height = src.height;

  const ctx = off.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, off.width, off.height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0);

  // aviso de densidade: mede a resolução realmente obtida
  const cssWidth = src.clientWidth || src.width;
  const effectiveDpi = Math.round((src.width / cssWidth) * 96);

  if (effectiveDpi < dpi) {
    console.warn(
      `[export] Densidade efetiva de ${effectiveDpi} dpi (alvo: ${dpi} dpi). ` +
      `Eleve devicePixelRatio na configuração do Chart.js.`
    );
  }

  off.toBlob(blob => {
    if (!blob) {
      throw new Error('Não foi possível gerar a imagem PNG.');
    }
    download(blob, filename);
  }, 'image/png');
}


// Re-renderização do gráfico com alta densidade de pixels
export function highResChartConfig(baseConfig, ratio = 3) {
  return {
    ...baseConfig,
    options: {
      ...baseConfig.options,
      devicePixelRatio: ratio,
      animation: false
    }
  };
}


// ============================================================
// Exportação DOCX real via WordprocessingML + JSZip
// ============================================================

export async function tableToDocx({
  title,
  headers,
  rows,
  note,
  reportText,
  noteLabel = 'Nota.',
  lang = 'pt-BR',
}) {
  if (typeof JSZip === 'undefined') {
    throw new Error(
      'A biblioteca JSZip não foi carregada. Verifique o script JSZip no HTML.'
    );
  }

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const safeText = value => esc(value);

  const paragraph = (text, options = {}) => {
    const {
      bold = false,
      italic = false,
      size = 24,
      align = null
    } = options;

    const alignment = align
      ? `<w:jc w:val="${align}"/>`
      : '';

    const boldXml = bold ? '<w:b/>' : '';
    const italicXml = italic ? '<w:i/>' : '';

    return `
      <w:p>
        <w:pPr>
          ${alignment}
          <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            ${boldXml}
            ${italicXml}
            <w:rFonts
              w:ascii="Times New Roman"
              w:hAnsi="Times New Roman"
              w:cs="Times New Roman"/>
            <w:sz w:val="${size}"/>
            <w:szCs w:val="${size}"/>
          </w:rPr>
          <w:t xml:space="preserve">${safeText(text)}</w:t>
        </w:r>
      </w:p>
    `;
  };

  const tableCell = (value, options = {}) => {
    const {
      bold = false,
      width = 1800,
      align = 'center',
      borderBottom = false
    } = options;

    const boldXml = bold ? '<w:b/>' : '';

    // APA 7: a tabela tem três linhas horizontais — topo, sob o cabeçalho
    // e base. Como insideH está "nil" em tblBorders, a linha sob o cabeçalho
    // precisa ser declarada célula por célula.
    const cellBorders = borderBottom
      ? `<w:tcBorders>
           <w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>
         </w:tcBorders>`
      : '';

    return `
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="${width}" w:type="dxa"/>
          ${cellBorders}
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:jc w:val="${align}"/>
            <w:spacing w:after="0"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              ${boldXml}
              <w:rFonts
                w:ascii="Times New Roman"
                w:hAnsi="Times New Roman"
                w:cs="Times New Roman"/>
              <w:sz w:val="20"/>
              <w:szCs w:val="20"/>
            </w:rPr>
            <w:t xml:space="preserve">${safeText(value)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    `;
  };

  const tableRow = (cells, options = {}) => {
    const {
      header = false,
      widths = []
    } = options;

    return `
      <w:tr>
        <w:trPr>
          ${header ? '<w:tblHeader/>' : ''}
          <w:cantSplit/>
        </w:trPr>
        ${cells.map((cell, index) => tableCell(cell, {
          bold: header,
          width: widths[index] || 1800,
          align: index === 0 ? 'left' : 'center',
          borderBottom: header
        })).join('')}
      </w:tr>
    `;
  };

  const numberOfColumns = headers.length;

  // Largura aproximada das colunas em twips.
  // A primeira coluna fica um pouco maior para comportar nomes de grupos.
  const widths = Array.from(
    { length: numberOfColumns },
    (_, index) => index === 0 ? 2400 : 1500
  );

  const gridColumns = widths
    .map(width => `<w:gridCol w:w="${width}"/>`)
    .join('');

  const tableRows = [
    tableRow(headers, {
      header: true,
      widths
    }),
    ...rows.map(row => tableRow(row, { widths }))
  ].join('');

  const noteParagraph = note
    ? paragraph(`${noteLabel} ${note}`, {
        italic: true,
        size: 20
      })
    : '';

  const reportParagraph = reportText
    ? paragraph(reportText, {
        size: 22
      })
    : '';

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  mc:Ignorable="w14">

  <w:body>

    ${paragraph(title || 'Tabela', {
      bold: true,
      size: 24
    })}

    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblLayout w:type="fixed"/>

        <w:tblBorders>
          <w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>
          <w:left w:val="nil"/>
          <w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>
          <w:right w:val="nil"/>
          <w:insideH w:val="nil"/>
          <w:insideV w:val="nil"/>
        </w:tblBorders>

        <w:tblCellMar>
          <w:top w:w="80" w:type="dxa"/>
          <w:left w:w="100" w:type="dxa"/>
          <w:bottom w:w="80" w:type="dxa"/>
          <w:right w:w="100" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>

      <w:tblGrid>
        ${gridColumns}
      </w:tblGrid>

      ${tableRows}
    </w:tbl>

    ${noteParagraph}
    ${reportParagraph}

    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar
        w:top="1701"
        w:right="1134"
        w:bottom="1134"
        w:left="1701"
        w:header="708"
        w:footer="708"
        w:gutter="0"/>
    </w:sectPr>

  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">

  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts
          w:ascii="Times New Roman"
          w:hAnsi="Times New Roman"
          w:cs="Times New Roman"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:lang w:val="${lang}"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>

  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts
        w:ascii="Times New Roman"
        w:hAnsi="Times New Roman"
        w:cs="Times New Roman"/>
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default
    Extension="rels"
    ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default
    Extension="xml"
    ContentType="application/xml"/>

  <Override
    PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>

  <Override
    PartName="/word/styles.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rootRelationshipsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships
  xmlns="http://schemas.openxmlformats.org/package/2006/relationships">

  <Relationship
    Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`;

  const documentRelationshipsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships
  xmlns="http://schemas.openxmlformats.org/package/2006/relationships">

  <Relationship
    Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
    Target="styles.xml"/>
</Relationships>`;

  const zip = new JSZip();

  zip.file('[Content_Types].xml', contentTypesXml);
  zip.folder('_rels').file('.rels', rootRelationshipsXml);

  const wordFolder = zip.folder('word');
  wordFolder.file('document.xml', documentXml);
  wordFolder.file('styles.xml', stylesXml);

  wordFolder
    .folder('_rels')
    .file('document.xml.rels', documentRelationshipsXml);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE'
  });

  const baseName = String(title || 'tabela')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'tabela';

  download(blob, `${baseName}.docx`);
}


// ============================================================
// Exportação CSV
// ============================================================

export function toCSV(
  headers,
  rows,
  filename = 'dados.csv'
) {
  const quote = value =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  const csv = '\uFEFF' + [
    headers,
    ...rows
  ]
    .map(row => row.map(quote).join(';'))
    .join('\r\n');

  download(
    new Blob([csv], {
      type: 'text/csv;charset=utf-8'
    }),
    filename
  );
}


// ============================================================
// Download genérico
// ============================================================

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = name;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}
