/**
 * Gera documento .docx com lista de débitos (modelo legado).
 * Usa a biblioteca `docx` (browser).
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const BORDER_THIN = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: '000000',
};

const BORDERS_CELL = {
  top: BORDER_THIN,
  bottom: BORDER_THIN,
  left: BORDER_THIN,
  right: BORDER_THIN,
};

function cellParagraph(text, { bold = false, color = '000000', sizeHalfPt = 18, align = AlignmentType.LEFT } = {}) {
  return new TableCell({
    borders: BORDERS_CELL,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text: String(text ?? ''), bold, color, size: sizeHalfPt, font: 'Calibri' })],
      }),
    ],
  });
}

function headerCell(text) {
  return new TableCell({
    borders: BORDERS_CELL,
    shading: { fill: '000000', type: ShadingType.CLEAR, color: '000000' },
    margins: { top: 80, bottom: 80, left: 60, right: 60 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: String(text ?? ''), bold: true, color: 'FFFFFF', size: 16, font: 'Calibri' })],
      }),
    ],
  });
}

/**
 * @param {object} params
 * @param {string} params.tituloPrincipal — ex.: "Lista de Débitos - Cálculo atualizado até 24/12/2023"
 * @param {string} params.linhaCliente — ex.: "Cliente: 00000001"
 * @param {string} params.linhaProcesso — ex.: "Processo: 4"
 * @param {string} params.linhaMeta — ex.: "Data-base do cálculo: … | Índice monetário: INPC"
 * @param {string} params.colunaAtualizacaoTitulo — ex.: "Atualização Monetária (INPC)"
 * @param {Array<{
 *   devedor: string,
 *   valor: string,
 *   dataInicialJuros: string,
 *   taxaJuros: string,
 *   valorJuros: string,
 *   taxaMulta: string,
 *   multa: string,
 *   atualizacaoMonetaria: string,
 *   dataAtualMonet: string,
 *   encargosContratuais: string,
 *   total: string,
 * }>} params.linhas
 * @param {object} params.totais
 * @param {string} params.totais.principal
 * @param {string} params.totais.juros
 * @param {string} params.totais.multa
 * @param {string} params.totais.encargos
 * @param {string} params.totais.geral
 */
export async function gerarDocumentoListaDebitosWord(params) {
  const {
    tituloPrincipal,
    linhaCliente,
    linhaProcesso,
    linhaMeta,
    colunaAtualizacaoTitulo,
    linhas,
    totais,
  } = params;

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell('Devedor'),
      headerCell('Valor'),
      headerCell('Data Inicial\nJuros'),
      headerCell('Taxa\nJuros'),
      headerCell('Valor\nJuros'),
      headerCell('Taxa\nMulta'),
      headerCell('Multa'),
      headerCell(colunaAtualizacaoTitulo),
      headerCell('Data Atual.\nMonet.'),
      headerCell('Encargos\nContratuais'),
      headerCell('TOTAL'),
    ],
  });

  const dataRows = (linhas || []).map(
    (l) =>
      new TableRow({
        children: [
          cellParagraph(l.devedor, { align: AlignmentType.LEFT }),
          cellParagraph(l.valor, { align: AlignmentType.RIGHT }),
          cellParagraph(l.dataInicialJuros, { align: AlignmentType.CENTER }),
          cellParagraph(l.taxaJuros, { align: AlignmentType.CENTER }),
          cellParagraph(l.valorJuros, { align: AlignmentType.RIGHT }),
          cellParagraph(l.taxaMulta, { align: AlignmentType.CENTER }),
          cellParagraph(l.multa, { align: AlignmentType.RIGHT }),
          cellParagraph(l.atualizacaoMonetaria, { align: AlignmentType.RIGHT }),
          cellParagraph(l.dataAtualMonet, { align: AlignmentType.CENTER }),
          cellParagraph(l.encargosContratuais, { align: AlignmentType.RIGHT }),
          cellParagraph(l.total, { bold: true, align: AlignmentType.RIGHT }),
        ],
      })
  );

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            shading: { fill: 'D9D9D9', type: ShadingType.CLEAR, color: 'D9D9D9' },
            spacing: { after: 200, before: 0 },
            children: [
              new TextRun({
                text: tituloPrincipal,
                bold: true,
                size: 26,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: linhaCliente, size: 20, font: 'Calibri' })],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: linhaProcesso, size: 20, font: 'Calibri' })],
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [new TextRun({ text: linhaMeta, size: 20, font: 'Calibri' })],
          }),
          table,
          new Paragraph({ text: '', spacing: { after: 200 } }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Totalização geral', bold: true, size: 22, font: 'Calibri' }),
            ],
            spacing: { after: 120 },
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: `Total principal: `, bold: true, size: 20, font: 'Calibri' }),
              new TextRun({ text: totais.principal, size: 20, font: 'Calibri' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: `Total juros: `, bold: true, size: 20, font: 'Calibri' }),
              new TextRun({ text: totais.juros, size: 20, font: 'Calibri' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: `Total multa: `, bold: true, size: 20, font: 'Calibri' }),
              new TextRun({ text: totais.multa, size: 20, font: 'Calibri' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: `Total encargos contratuais: `, bold: true, size: 20, font: 'Calibri' }),
              new TextRun({ text: totais.encargos, size: 20, font: 'Calibri' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: `Total geral: `, bold: true, size: 24, font: 'Calibri' }),
              new TextRun({ text: totais.geral, bold: true, size: 24, font: 'Calibri' }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

/**
 * Baixa o blob como arquivo .docx (e tenta abrir em nova aba quando o navegador permitir).
 */
export function baixarBlobDocx(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo.endsWith('.docx') ? nomeArquivo : `${nomeArquivo}.docx`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
