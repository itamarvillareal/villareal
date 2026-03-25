/**
 * Gera .docx simples a partir do caminho CONTRATOS → LOCAÇÃO e opções marcadas.
 * Download dispara abertura no Word (ou app padrão) no ambiente do usuário.
 */

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { baixarBlobDocx } from './gerarDocumentoListaDebitosWord.js';

/**
 * @param {{ pathLabels: string[], items: { id: string, label: string }[] }} payload
 * @returns {Promise<Blob>}
 */
export async function gerarBlobDocxTopicosLocacao(payload) {
  const caminho = (payload.pathLabels || []).join(' → ');
  const itens = payload.items || [];

  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 240 },
      children: [new TextRun({ text: 'Documento novo — Locação', bold: true, font: 'Calibri', size: 32 })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: 'Caminho: ', bold: true, font: 'Calibri', size: 22 }),
        new TextRun({ text: caminho || '—', font: 'Calibri', size: 22 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: 'Opções selecionadas:', bold: true, font: 'Calibri', size: 22 })],
    }),
  ];

  if (itens.length === 0) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: '(nenhuma opção selecionada)', italics: true, font: 'Calibri', size: 22, color: '666666' })],
      })
    );
  } else {
    for (const it of itens) {
      children.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: `• ${it.label}`, font: 'Calibri', size: 22 })],
        })
      );
    }
  }

  children.push(
    new Paragraph({
      spacing: { before: 280 },
      children: [
        new TextRun({
          text: `Gerado em ${new Date().toLocaleString('pt-BR')}`,
          italics: true,
          size: 18,
          font: 'Calibri',
          color: '666666',
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return Packer.toBlob(doc);
}

/**
 * @param {{ pathLabels: string[], items: { id: string, label: string }[] }} payload
 */
export async function gerarEBaixarDocxLocacao(payload) {
  const blob = await gerarBlobDocxTopicosLocacao(payload);
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  baixarBlobDocx(blob, `Locacao-topicos-${stamp}.docx`);
}
