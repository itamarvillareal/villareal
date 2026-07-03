/**
 * Geração do PDF "Relatório de Cálculo" (memória de cálculo) a partir de uma lista de
 * títulos já calculados. Função pura (não depende do estado de nenhum componente) para
 * ser reusada tanto pela tela de Cálculos quanto pela tela de Gerar Documento.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calcularTotalTituloGrade } from './calculosDebitosTitulos.js';

/** Nome padrão do arquivo: `Calculo_Processo_{codigo}_{AAAAMMDD}.pdf`. */
export function nomeArquivoRelatorioCalculoPdf(codigoCliente) {
  const hoje = new Date();
  const yyyy = String(hoje.getFullYear());
  const mm = String(hoje.getMonth() + 1).padStart(2, '0');
  const dd = String(hoje.getDate()).padStart(2, '0');
  return `Calculo_Processo_${codigoCliente}_${yyyy}${mm}${dd}.pdf`;
}

/**
 * Constrói (sem salvar) o documento jsPDF do relatório de cálculo.
 * @param {object} params
 * @param {Array<object>} params.titulos — títulos com valores já calculados
 * @param {object} params.resumo — saída de `calcularResumoTitulosGrade`
 * @param {object} params.cabecalho — `{ autor, reu, unidade? }`
 * @returns {import('jspdf').jsPDF}
 */
export function construirRelatorioCalculoPdf({
  titulos,
  resumo,
  cabecalho,
  codigoCliente,
  proc,
  dataCalculo,
  juros,
  multa,
  honorariosTipo,
  honorariosValor,
  indice,
  planoPagamento,
}) {
  const lista = Array.isArray(titulos) ? titulos : [];
  const cab = cabecalho || {};
  const res = resumo || {};

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margemX = 12;
  const dataGeracao = new Date().toLocaleString('pt-BR');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Relatório de Cálculo', margemX, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const linhasCabecalho = [
    `Cliente (código): ${codigoCliente}`,
    `Processo: ${proc}`,
  ];
  const unidade = String(cab?.unidade ?? '').trim();
  if (unidade) {
    linhasCabecalho.push(`Unidade: ${unidade}`);
  }
  linhasCabecalho.push(
    `Parte Cliente: ${cab?.autor || '—'}`,
    `Parte Oposta: ${cab?.reu || '—'}`,
    `Data do cálculo: ${dataCalculo}`,
  );

  let yCab = 20;
  for (const linha of linhasCabecalho) {
    doc.text(linha, margemX, yCab);
    yCab += 5;
  }

  const yParametros = yCab + 3;
  doc.setFont('helvetica', 'bold');
  doc.text('Parâmetros do cálculo', margemX, yParametros);
  doc.setFont('helvetica', 'normal');
  doc.text(`Juros: ${juros}   |   Multa: ${multa}`, margemX, yParametros + 5);
  doc.text(`Honorários: ${honorariosTipo} (${honorariosValor})   |   Índice: ${indice}`, margemX, yParametros + 10);

  const startYTable = yParametros + 15;

  const linhasTitulos = lista
    .map((t, idx) => ({
      n: String(idx + 1).padStart(3, '0'),
      dataVencimento: t?.dataVencimento || '',
      valorInicial: t?.valorInicial || '',
      atualizacaoMonetaria: t?.atualizacaoMonetaria || '',
      diasAtraso: t?.diasAtraso || '',
      juros: t?.juros || '',
      multa: t?.multa || '',
      honorarios: t?.honorarios || '',
      total: t?.total || calcularTotalTituloGrade(t),
    }))
    .filter((t) => String(t?.valorInicial ?? '').trim() !== '');

  autoTable(doc, {
    startY: startYTable,
    head: [['Nº', 'Vencimento', 'Valor Inicial', 'Atualização', 'Dias', 'Juros', 'Multa', 'Honorários', 'Total']],
    body: linhasTitulos.map((l) => [
      l.n,
      l.dataVencimento,
      l.valorInicial,
      l.atualizacaoMonetaria,
      l.diasAtraso,
      l.juros,
      l.multa,
      l.honorarios,
      l.total,
    ]),
    foot: [
      [
        { content: res.qtd || 'Total', colSpan: 2, styles: { halign: 'left' } },
        res.valorInicial || '',
        res.atualizacao || '',
        res.diasAtraso || '',
        res.juros || '',
        res.multa || '',
        res.honorarios || '',
        res.total || '',
      ],
    ],
    styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 20 },
    },
    margin: { left: margemX, right: margemX },
    didDrawPage: () => {
      const totalPaginasDoc = doc.getNumberOfPages();
      const largura = doc.internal.pageSize.getWidth();
      const altura = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.text(`Gerado em: ${dataGeracao}`, margemX, altura - 5);
      doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}/${totalPaginasDoc}`, largura - 28, altura - 5);
    },
  });

  const yResumo = (doc.lastAutoTable?.finalY || startYTable) + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Resumo financeiro (todos os títulos da dimensão)', margemX, yResumo);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Quantidade de títulos: ${res.qtd}`, margemX, yResumo + 5);
  doc.text(`Valor inicial total: ${res.valorInicial}`, margemX, yResumo + 10);
  doc.text(`Atualização monetária: ${res.atualizacao}`, margemX, yResumo + 15);
  doc.text(`Dias de atraso (soma): ${res.diasAtraso}`, margemX, yResumo + 20);
  doc.text(`Juros: ${res.juros}`, margemX, yResumo + 25);
  doc.text(`Multa: ${res.multa}`, margemX, yResumo + 30);
  doc.text(`Honorários: ${res.honorarios}`, margemX, yResumo + 35);
  doc.text(`Total geral: ${res.total}`, margemX, yResumo + 40);

  if (planoPagamento?.linhas?.length) {
    const yPlano = yResumo + 48;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Plano de pagamento', margemX, yPlano);
    autoTable(doc, {
      startY: yPlano + 4,
      head: [['', 'Vencimento', 'Valor', 'Honor. Parc.', 'Total linha']],
      body: planoPagamento.linhas.map((l) => {
        const vp = String(l.valorParcela ?? '');
        const hp = String(l.honorariosParcela ?? '');
        return [
          l.rotulo ?? '',
          l.dataVencimento ?? '',
          vp,
          hp,
          l.totalLinha ?? '',
        ];
      }),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      margin: { left: margemX, right: margemX },
    });
  }

  return doc;
}
