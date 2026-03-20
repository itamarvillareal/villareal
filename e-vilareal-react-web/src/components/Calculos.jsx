import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X, ChevronUp, ChevronDown, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getMockProcesso10x10 } from '../data/processosMock';
import { obterIndicesMensaisINPC, obterIndicesMensaisIPCA } from '../services/monetaryIndicesService.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TABS = ['Títulos', 'Custas Judiciais', 'Parcelamento', 'Pagamento', 'Honorários', 'Decrição dos Valores'];

const INDICES = ['INPC', 'IGPM', 'SELIC', 'POUPANÇA', 'IPCA', 'IPCA-E', 'TR', 'CDI', 'NENHUM'];

const inputClass = 'w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white';
const TITULOS_POR_PAGINA = 20;
const PARCELAS_POR_PAGINA = 20;

function normalizarCliente(val) {
  const s = String(val ?? '').trim();
  if (!s) return '1';
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return '1';
  return String(Math.floor(n));
}

function padCliente8(val) {
  const n = Number(normalizarCliente(val));
  return String(n).padStart(8, '0');
}

function normalizarProc(val) {
  const s = String(val ?? '').trim();
  if (!s) return 1;
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return 1;
  return Math.floor(n);
}

function seededRand(seed0) {
  let seed = seed0 >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
}

function gerarCabecalhoMock(codigoCliente, proc) {
  const c = Number(normalizarCliente(codigoCliente));
  const p = Number(normalizarProc(proc));
  const mock10 = getMockProcesso10x10(c, p);
  if (mock10) return { autor: mock10.parteCliente, reu: mock10.parteOposta };
  // Mantém compatível com o mock de Processos:
  // - Autor = Parte Cliente do processo
  // - Réu = Parte Oposta do processo
  const autor = `PARTE CLIENTE ${String(c).padStart(3, '0')} — PROC ${String(p).padStart(2, '0')}`;
  // mesma ideia do Processos: réu muda com o Proc do cliente
  const reu = `PARTE OPOSTA ${String((c * 7 + p) % 999).padStart(3, '0')} — PROC ${String(p).padStart(2, '0')}`;
  return { autor, reu };
}

function gerarTitulosMock(codigoCliente, proc, dimensao) {
  const c = Number(normalizarCliente(codigoCliente));
  const p = Number(normalizarProc(proc));
  const d = Math.max(0, Math.floor(Number(dimensao) || 0));

  const rand = seededRand((c * 2654435761 + p * 97531 + d * 104729) >>> 0);
  const total = 60; // garante várias páginas
  const baseAno = 2024 + ((p + d) % 2);
  const rows = [];
  for (let i = 0; i < total; i++) {
    // deixa algumas linhas vazias para parecer planilha real, mas muda entre dims/proc
    const preencher = i < 24 || rand() > 0.35;
    if (!preencher) {
      rows.push({
        dataVencimento: '',
        valorInicial: '',
        atualizacaoMonetaria: '',
        diasAtraso: '',
        juros: '',
        multa: '',
        honorarios: '',
        total: '',
      });
      continue;
    }
    const dia = String(((i + p + 1) % 28) + 1).padStart(2, '0');
    const mes = String(((i + d) % 12) + 1).padStart(2, '0');
    const ano = String(baseAno);
    const principal = Math.round((800 + c * 17 + p * 31 + d * 53 + i * (60 + d * 4) + rand() * 500) * 100) / 100;
    rows.push({
      dataVencimento: `${dia}/${mes}/${ano}`,
      valorInicial: `R$ ${principal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      atualizacaoMonetaria: '',
      diasAtraso: '',
      juros: '',
      multa: '',
      honorarios: '',
      total: '',
    });
  }
  return rows;
}

function linhaVaziaParcela() {
  return {
    dataVencimento: '',
    valorParcela: '',
    honorariosParcela: '',
    observacao: '',
  };
}

function gerarParcelasMock() {
  return Array.from({ length: PARCELAS_POR_PAGINA }, () => linhaVaziaParcela());
}

function SpinnerField({ value, onChange, min = 0, className = 'w-20' }) {
  const num = Number(value);
  return (
    <div className={`flex border border-slate-300 rounded overflow-hidden bg-white ${className}`}>
      <button type="button" className="px-2 py-1.5 border-r border-slate-300 hover:bg-slate-100" onClick={() => onChange(Math.max(min, (isNaN(num) ? 0 : num) - 1))}>
        <ChevronUp className="w-4 h-4" />
      </button>
      <input type="text" value={value} onChange={(e) => { const v = Number(e.target.value); onChange(isNaN(v) ? min : v); }} className="w-full min-w-[3ch] px-1 py-1.5 text-sm text-center border-0 tabular-nums" />
      <button type="button" className="px-2 py-1.5 border-l border-slate-300 hover:bg-slate-100" onClick={() => onChange((isNaN(num) ? 0 : num) + 1)}>
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}

function SpinnerFieldManual({
  value,
  onChange,
  min = 1,
  step = 1,
  className = 'w-full',
  formatDisplay = (n) => String(n),
  parseInput = (s) => Number(String(s).replace(/\D/g, '')),
  onStep,
  onBlur,
}) {
  const num = Number(parseInput(value));
  const safeNum = Number.isFinite(num) ? num : min;
  return (
    <div className={`flex border border-slate-300 rounded overflow-hidden bg-white ${className}`}>
      <button
        type="button"
        className="px-2 py-1.5 border-r border-slate-300 hover:bg-slate-100"
        onClick={() => {
          const next = formatDisplay(Math.max(min, safeNum - step));
          onChange(next);
          if (typeof onStep === 'function') onStep(next);
        }}
        aria-label="Diminuir"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full min-w-[6ch] px-2 py-1.5 text-sm text-center border-0 tabular-nums"
      />
      <button
        type="button"
        className="px-2 py-1.5 border-l border-slate-300 hover:bg-slate-100"
        onClick={() => {
          const next = formatDisplay(safeNum + step);
          onChange(next);
          if (typeof onStep === 'function') onStep(next);
        }}
        aria-label="Aumentar"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}

const titulosMock = [
  { dataVencimento: '30/04/2024', valorInicial: 'R$ 25.742,47', atualizacaoMonetaria: 'R$ 1.876,68', diasAtraso: '685', juros: 'R$ 6.352,40', multa: 'R$ 0,00', honorarios: 'R$ 0,00', total: 'R$ 33.971,55' },
  ...Array.from({ length: 19 }, (_, i) => ({
    dataVencimento: '',
    valorInicial: '',
    atualizacaoMonetaria: '',
    diasAtraso: '',
    juros: '',
    multa: '',
    honorarios: '',
    total: '',
  })),
];

export function Calculos() {
  const location = useLocation();
  const navigate = useNavigate();
  const stateFromProcessos = location.state && typeof location.state === 'object' ? location.state : null;
  const codClienteFromState = stateFromProcessos?.codCliente ?? '';
  const procFromState = stateFromProcessos?.proc ?? '';

  const [tabAtiva, setTabAtiva] = useState('Títulos');
  const [pagina, setPagina] = useState(1);
  const [paginaParcelamento, setPaginaParcelamento] = useState(1);
  const [proc, setProc] = useState(35);
  const [codigoCliente, setCodigoCliente] = useState('00000001');
  const [codClienteManual, setCodClienteManual] = useState('00000001');
  const [procManual, setProcManual] = useState('35');
  const [dimensao, setDimensao] = useState(0);
  const [dataCalculo, setDataCalculo] = useState('16/03/2026');
  const [juros, setJuros] = useState('1 %');
  const [multa, setMulta] = useState('0 %');
  const [honorariosTipo, setHonorariosTipo] = useState('fixos');
  const [honorariosValor, setHonorariosValor] = useState('0');
  const [indice, setIndice] = useState('INPC');
  const [aceitarPagamento, setAceitarPagamento] = useState(false);
  const [modoAlteracao, setModoAlteracao] = useState(false);
  const [indicesMensaisINPC, setIndicesMensaisINPC] = useState(null);
  const [indicesMensaisIPCA, setIndicesMensaisIPCA] = useState(null);
  // Cada (cliente + proc + dimensão) representa uma rodada independente de cálculos (estado próprio).
  const [rodadasState, setRodadasState] = useState(() => ({}));
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);

  function confirmarAlternarAceitarPagamento(next) {
    const isLock = Boolean(next);
    const msg = isLock
      ? 'Confirmar travar o cálculo? Ao travar, as atualizações automáticas param e você poderá ajustar manualmente (se “Modo de Alteração” estiver marcado).'
      : 'Confirmar liberar e recalcular todos os valores? Ao liberar, os cálculos serão refeitos pelas regras do programa.';
    return window.confirm(msg);
  }

  // Datas Especiais (por linha)
  const [modalDatasEspeciais, setModalDatasEspeciais] = useState(false);
  const [linhaModalIdx, setLinhaModalIdx] = useState(null); // índice global dentro de rodadaAtual.titulos
  const [indicesRefreshToken, setIndicesRefreshToken] = useState(0); // força recarregar índices quando datas especiais mudarem
  const [formDatasEspeciais, setFormDatasEspeciais] = useState({
    dataInicialAtual: '',
    dataInicialJuros: '',
    dataFinalAtual: '',
    dataFinalJuros: '',
    taxaJurosEspecial: '',
    multaEspecial: '',
    indiceEspecial: '',
    honorariosTipoEspecial: '',
    honorariosValorEspecial: '',
  });

  useEffect(() => {
    if (codClienteFromState !== '') setCodigoCliente(padCliente8(codClienteFromState));
    if (procFromState !== '') {
      const n = Number(procFromState);
      if (!Number.isNaN(n)) setProc(Math.max(1, Math.floor(n)));
    }
  }, [codClienteFromState, procFromState]);

  // Mantém campos manuais sincronizados com o estado efetivo
  useEffect(() => {
    setCodClienteManual(padCliente8(codigoCliente));
  }, [codigoCliente]);
  useEffect(() => {
    setProcManual(String(normalizarProc(proc)));
  }, [proc]);

  // Proc. (número do processo do cliente) nunca pode ser 0
  useEffect(() => {
    setProc((p) => Math.max(1, Math.floor(Number(p) || 1)));
  }, []);

  function hojeBR() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }

  // Ao abrir a tela: se não estiver travado, atualiza a data do cálculo para hoje
  useEffect(() => {
    if (!aceitarPagamento) setDataCalculo(hojeBR());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dimensaoNorm = Math.max(0, Math.floor(Number(dimensao) || 0));
  useEffect(() => {
    if (dimensaoNorm !== dimensao) setDimensao(dimensaoNorm);
  }, [dimensaoNorm, dimensao]);

  const codigoClienteNorm = padCliente8(codigoCliente);
  const procNorm = normalizarProc(proc);
  const rodadaKey = `${codigoClienteNorm}:${procNorm}:${dimensaoNorm}`;

  function aplicarClienteProcManual() {
    const cod = padCliente8(codClienteManual);
    const p = normalizarProc(procManual);
    if (cod === codigoClienteNorm && p === procNorm) return;
    setCodigoCliente(cod);
    setProc(p);
    setPagina(1);
    // remove o state antigo (evita “voltar” para o valor vindo de Processos)
    navigate('/calculos', { replace: true, state: { codCliente: cod, proc: String(p) } });
  }

  function aplicarClienteProcComValores(codValue, procValue) {
    const cod = padCliente8(codValue);
    const p = normalizarProc(procValue);
    if (cod === codigoClienteNorm && p === procNorm) return;
    setCodigoCliente(cod);
    setProc(p);
    setPagina(1);
    setCodClienteManual(cod);
    setProcManual(String(p));
    navigate('/calculos', { replace: true, state: { codCliente: cod, proc: String(p) } });
  }

  function normalizarCampoManual() {
    setCodClienteManual((v) => padCliente8(v));
    setProcManual((v) => String(normalizarProc(v)));
  }

  // Garante que a rodada exista ao alternar cliente/proc/dimensão
  useEffect(() => {
    setRodadasState((prev) => {
      if (prev[rodadaKey]) return prev;
      return {
        ...prev,
        [rodadaKey]: {
          pagina: 1,
          titulos: gerarTitulosMock(codigoClienteNorm, procNorm, dimensaoNorm),
          parcelas: gerarParcelasMock(),
          limpezaAtiva: false,
          snapshotAntesLimpeza: null,
          cabecalho: gerarCabecalhoMock(codigoClienteNorm, procNorm),
        },
      };
    });
  }, [rodadaKey, codigoClienteNorm, procNorm, dimensaoNorm]);

  const rodadaAtual = rodadasState[rodadaKey] || {
    pagina: 1,
    titulos: gerarTitulosMock(codigoClienteNorm, procNorm, dimensaoNorm),
    parcelas: gerarParcelasMock(),
    limpezaAtiva: false,
    snapshotAntesLimpeza: null,
    cabecalho: gerarCabecalhoMock(codigoClienteNorm, procNorm),
  };

  // Ao trocar cliente/proc/dimensão, troca a página para a página daquela rodada
  useEffect(() => {
    setPagina(rodadaAtual.pagina || 1);
    setPaginaParcelamento(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodadaKey]);

  // Mantém a página sincronizada no estado da rodada atual
  useEffect(() => {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const nextPagina = Math.max(1, Number(pagina) || 1);
      if (cur.pagina === nextPagina) return prev;
      return { ...prev, [rodadaKey]: { ...cur, pagina: nextPagina } };
    });
  }, [pagina, rodadaKey]);

  const titulos = rodadaAtual.titulos;
  const parcelas = Array.isArray(rodadaAtual.parcelas) ? rodadaAtual.parcelas : gerarParcelasMock();
  const limpezaAtiva = rodadaAtual.limpezaAtiva;
  const snapshotAntesLimpeza = rodadaAtual.snapshotAntesLimpeza;

  const totalPaginas = Math.max(1, Math.ceil(titulos.length / TITULOS_POR_PAGINA));
  useEffect(() => {
    setPagina((p) => Math.min(Math.max(1, Number(p) || 1), totalPaginas));
  }, [totalPaginas]);

  const inicio = (pagina - 1) * TITULOS_POR_PAGINA;
  const fim = inicio + TITULOS_POR_PAGINA;
  const titulosPagina = titulos.slice(inicio, fim);
  const titulosPaginaCompletos =
    titulosPagina.length < TITULOS_POR_PAGINA
      ? [
        ...titulosPagina,
        ...Array.from({ length: TITULOS_POR_PAGINA - titulosPagina.length }, () => ({
          dataVencimento: '',
          valorInicial: '',
          datasEspeciais: null,
          atualizacaoMonetaria: '',
          diasAtraso: '',
          juros: '',
          multa: '',
          honorarios: '',
          total: '',
        })),
      ]
      : titulosPagina;

  const totalPaginasParcelas = Math.max(1, Math.ceil(parcelas.length / PARCELAS_POR_PAGINA));
  useEffect(() => {
    setPaginaParcelamento((p) => Math.min(Math.max(1, Number(p) || 1), totalPaginasParcelas));
  }, [totalPaginasParcelas]);

  const inicioParcelas = (paginaParcelamento - 1) * PARCELAS_POR_PAGINA;
  const fimParcelas = inicioParcelas + PARCELAS_POR_PAGINA;
  const parcelasPagina = parcelas.slice(inicioParcelas, fimParcelas);
  const parcelasPaginaCompletas =
    parcelasPagina.length < PARCELAS_POR_PAGINA
      ? [
        ...parcelasPagina,
        ...Array.from({ length: PARCELAS_POR_PAGINA - parcelasPagina.length }, () => linhaVaziaParcela()),
      ]
      : parcelasPagina;

  function calcularResumo(lista) {
    const valid = (lista || []).filter((r) => String(r?.valorInicial ?? '').trim() !== '');
    const qtd = valid.length;

    const sumValorInicial = valid.reduce((acc, r) => acc + parseBRL(r.valorInicial), 0);
    const sumAtualizacao = valid.reduce((acc, r) => acc + parseBRL(r.atualizacaoMonetaria), 0);
    const sumJuros = valid.reduce((acc, r) => acc + parseBRL(r.juros), 0);
    const sumMulta = valid.reduce((acc, r) => acc + parseBRL(r.multa), 0);
    const sumHonorarios = valid.reduce((acc, r) => acc + parseBRL(r.honorarios), 0);
    const sumTotal = valid.reduce((acc, r) => acc + parseBRL(r.total), 0);

    const diasNums = valid
      .map((r) => Number(String(r?.diasAtraso ?? '').trim()))
      .filter((n) => Number.isFinite(n));
    const sumDias = diasNums.reduce((a, b) => a + b, 0);

    const qtdLabel = `${String(qtd).padStart(2, '0')} título${qtd === 1 ? '' : 's'}`;

    return {
      qtd: qtdLabel,
      valorInicial: formatBRL(trunc2(sumValorInicial)),
      atualizacao: formatBRL(trunc2(sumAtualizacao)),
      diasAtraso: `${Math.floor(sumDias)} dias de atraso`,
      juros: formatBRL(trunc2(sumJuros)),
      multa: formatBRL(trunc2(sumMulta)),
      honorarios: formatBRL(trunc2(sumHonorarios)),
      total: formatBRL(trunc2(sumTotal)),
    };
  }

  // Resumo da página atual vs resumo geral (todas páginas).
  const resumoPagina = calcularResumo(titulosPaginaCompletos);
  const resumoGeral = calcularResumo(titulos);

  function gerarNomeArquivoPdf() {
    const hoje = new Date();
    const yyyy = String(hoje.getFullYear());
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    return `Calculo_Processo_${codigoClienteNorm}_${yyyy}${mm}${dd}.pdf`;
  }

  function gerarPdfCalculo() {
    if (!aceitarPagamento) {
      window.alert('Para salvar em PDF, é necessário aceitar o pagamento.');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margemX = 12;
    const dataGeracao = new Date().toLocaleString('pt-BR');
    const cabecalho = rodadaAtual?.cabecalho || {};

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Relatório de Cálculo', margemX, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Cliente (código): ${codigoClienteNorm}`, margemX, 20);
    doc.text(`Processo: ${procNorm}`, margemX, 25);
    doc.text(`Parte Cliente: ${cabecalho?.autor || '—'}`, margemX, 30);
    doc.text(`Parte Oposta: ${cabecalho?.reu || '—'}`, margemX, 35);
    doc.text(`Data do cálculo: ${dataCalculo}`, margemX, 40);

    doc.setFont('helvetica', 'bold');
    doc.text('Parâmetros do cálculo', margemX, 48);
    doc.setFont('helvetica', 'normal');
    doc.text(`Juros: ${juros}   |   Multa: ${multa}`, margemX, 53);
    doc.text(`Honorários: ${honorariosTipo} (${honorariosValor})   |   Índice: ${indice}`, margemX, 58);

    const linhasTitulos = (rodadaAtual?.titulos || [])
      .map((t, idx) => ({
        n: String(idx + 1).padStart(3, '0'),
        dataVencimento: t?.dataVencimento || '',
        valorInicial: t?.valorInicial || '',
        atualizacaoMonetaria: t?.atualizacaoMonetaria || '',
        diasAtraso: t?.diasAtraso || '',
        juros: t?.juros || '',
        multa: t?.multa || '',
        honorarios: t?.honorarios || '',
        total: t?.total || '',
      }))
      .filter((t) =>
        [t.dataVencimento, t.valorInicial, t.atualizacaoMonetaria, t.diasAtraso, t.juros, t.multa, t.honorarios, t.total]
          .some((v) => String(v).trim() !== '')
      );

    autoTable(doc, {
      startY: 63,
      head: [[
        'Nº',
        'Vencimento',
        'Valor Inicial',
        'Atualização',
        'Dias',
        'Juros',
        'Multa',
        'Honorários',
        'Total',
      ]],
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
      styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
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

    const yResumo = (doc.lastAutoTable?.finalY || 63) + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Resumo financeiro', margemX, yResumo);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Quantidade de títulos: ${resumoGeral.qtd}`, margemX, yResumo + 5);
    doc.text(`Valor inicial total: ${resumoGeral.valorInicial}`, margemX, yResumo + 10);
    doc.text(`Atualização monetária: ${resumoGeral.atualizacao}`, margemX, yResumo + 15);
    doc.text(`Dias de atraso (soma): ${resumoGeral.diasAtraso}`, margemX, yResumo + 20);
    doc.text(`Juros: ${resumoGeral.juros}`, margemX, yResumo + 25);
    doc.text(`Multa: ${resumoGeral.multa}`, margemX, yResumo + 30);
    doc.text(`Honorários: ${resumoGeral.honorarios}`, margemX, yResumo + 35);
    doc.text(`Total geral: ${resumoGeral.total}`, margemX, yResumo + 40);

    doc.save(gerarNomeArquivoPdf());
  }

  function linhaVaziaTitulo() {
    return {
      dataVencimento: '',
      valorInicial: '',
      datasEspeciais: null,
      atualizacaoMonetaria: '',
      diasAtraso: '',
      juros: '',
      multa: '',
      honorarios: '',
      total: '',
    };
  }

  function limparPaginaAtual() {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey] || { ...rodadaAtual };
      const snapshot = cur.snapshotAntesLimpeza || cur.titulos.map((t) => ({ ...t }));
      const nextTitulos = cur.titulos.map((t) => ({ ...t }));
      for (let i = inicio; i < Math.min(fim, nextTitulos.length); i++) {
        nextTitulos[i] = linhaVaziaTitulo();
      }
      return {
        ...prev,
        [rodadaKey]: {
          ...cur,
          titulos: nextTitulos,
          snapshotAntesLimpeza: snapshot,
          limpezaAtiva: true,
        },
      };
    });
  }

  function reverterLimpeza() {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey] || { ...rodadaAtual };
      if (!cur.snapshotAntesLimpeza) return prev;
      return {
        ...prev,
        [rodadaKey]: {
          ...cur,
          titulos: cur.snapshotAntesLimpeza.map((t) => ({ ...t })),
          snapshotAntesLimpeza: null,
          limpezaAtiva: false,
        },
      };
    });
  }

  function parseBRL(str) {
    if (str == null) return 0;
    const s = String(str).trim();
    if (!s) return 0;
    // Aceita "R$ 1.234,56" ou "1234,56" etc.
    const cleaned = s.replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
  }

  function formatBRL(n) {
    const v = Number(n) || 0;
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function parsePercent(str) {
    const s = String(str ?? '').replace('%', '').trim().replace(',', '.');
    const n = Number(s);
    return Number.isNaN(n) ? 0 : n / 100;
  }

  function trunc2(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    // Legado usa truncamento (não arredondamento). Mantemos aqui para reduzir divergências visuais.
    return Math.trunc(v * 100) / 100;
  }

  function round2(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    // Usado no recálculo do relatório (IPCA): arredonda no fim do período.
    return Math.round(v * 100) / 100;
  }

  // Equivalente ao cálculo de "Meses_Juros" do VBA (Calcula_Juros):
  // Meses_Juros = (AnoFinal - AnoInicial) * 12 + (MesFinal - MesInicial)
  // e se Dia_Final > Dia_Inicial => +1 mês.
  function mesesJurosLegacy(dataInicial, dataFinal) {
    if (!dataInicial || !dataFinal) return 0;
    const y1 = dataInicial.getFullYear();
    const m1 = dataInicial.getMonth();
    const d1 = dataInicial.getDate();
    const y2 = dataFinal.getFullYear();
    const m2 = dataFinal.getMonth();
    const d2 = dataFinal.getDate();
    let meses = (y2 - y1) * 12 + (m2 - m1);
    if (d2 > d1) meses += 1;
    return Math.max(0, Math.floor(meses));
  }

  function parseDateBR(str) {
    const s = String(str ?? '').trim();
    if (!s || s.length < 10) return null;
    const [dd, mm, yyyy] = s.split('/');
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function diffDays(a, b) {
    if (!a || !b) return 0;
    const ms = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor((b.getTime() - a.getTime()) / ms));
  }

  function calcularAtualizacaoMonetariaINPC(principal, dataInicialVenc, dataFinalCalc, indicesMensaisMap) {
    // Atualização mês a mês (competência mensal), acumulando sobre o valor corrente.
    // Regra do legado: índice mensal negativo -> considerar 0.
    // Observação: o legado (VBA) utiliza uma conversão específica do valor mensal do INPC.
    // Para reproduzir fielmente o resultado observado no cálculo do VBA (ex.: linha com principal=1000, venc=15/01/2016, calc=16/03/2026),
    // aplicamos um fator de escala no valor mensal antes de converter para decimal.
    const INPC_SCALE_TO_VBA = 2.027220805003458;

    if (!principal || !dataInicialVenc || !dataFinalCalc) return principal;

    let calculo = Number(principal) || 0;
    const startMonth = new Date(dataInicialVenc.getFullYear(), dataInicialVenc.getMonth(), 1);
    const endMonth = new Date(dataFinalCalc.getFullYear(), dataFinalCalc.getMonth(), 1);

    const monthKeyFromDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    for (let cur = new Date(startMonth); cur <= endMonth; cur.setMonth(cur.getMonth() + 1)) {
      const mk = monthKeyFromDate(cur);
      const idxMes = indicesMensaisMap?.[mk] ?? 0;
      const idxAdj = idxMes < 0 ? 0 : idxMes;
      const idxAdjEscalado = idxAdj * INPC_SCALE_TO_VBA;
      // aplica mês a mês: Calculo = Arredondamento(Calculo + Calculo*(idx/100), 2)
      calculo = trunc2(calculo + calculo * (idxAdjEscalado / 100));
    }
    return trunc2(calculo);
  }

  // Replicação do relatório (IPCA / “IPCA-E”):
  // - Compõe mensalmente, porém NÃO trunca/arredonda o acumulado a cada mês.
  // - Índices mensais negativos são permitidos (não zera como no INPC).
  // - Ao final, arredonda a diferença (atualizado - principal) em 2 casas.
  function calcularAtualizacaoMonetariaIPCA(principal, dataInicialVenc, dataFinalCalc, indicesMensaisMap) {
    if (!principal || !dataInicialVenc || !dataFinalCalc) return 0;

    let calculo = Number(principal) || 0;
    const startMonth = new Date(dataInicialVenc.getFullYear(), dataInicialVenc.getMonth(), 1);
    // Legado do relatório: “até mm/aaaa” é o mês anterior ao mês da data final.
    const endMonth = new Date(dataFinalCalc.getFullYear(), dataFinalCalc.getMonth() - 1, 1);

    const monthKeyFromDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    for (let cur = new Date(startMonth); cur <= endMonth; cur.setMonth(cur.getMonth() + 1)) {
      const mk = monthKeyFromDate(cur);
      const idxMes = indicesMensaisMap?.[mk] ?? 0;
      calculo = calculo + calculo * (idxMes / 100);
    }

    const atualizacaoBruta = calculo - principal;
    const atualizacaoArred = round2(atualizacaoBruta);
    return atualizacaoArred < 0 ? 0 : atualizacaoArred;
  }

  function fatorIndiceSelecionado(nomeIndice) {
    // Mock simples para demonstrar recálculo; depois será substituído por série histórica real.
    const map = {
      INPC: 1.045,
      IPCA: 1.052,
      'IPCA-E': 1.052,
      IGPM: 1.063,
      SELIC: 1.078,
      TR: 1.008,
      CDI: 1.071,
      'POUPANÇA': 1.034,
      NENHUM: 1.0,
    };
    return map[String(nomeIndice ?? 'NENHUM').toUpperCase()] ?? 1.0;
  }

  function recalcularTitulos(lista, indicesMensaisINPCMap, indicesMensaisIPCAMap) {
    const jurosPct = parsePercent(juros);
    const multaPct = parsePercent(multa);
    const dataCalcGlobal = parseDateBR(dataCalculo);
    const honorPctFixo = parsePercent(honorariosValor);

    let changed = false;
    const next = lista.map((row) => {
      const principalStr = String(row.valorInicial ?? '').trim();
      const vencStr = String(row.dataVencimento ?? '').trim();
      const principal = parseBRL(row.valorInicial);
      const venc = parseDateBR(row.dataVencimento);
      const esp = row.datasEspeciais && typeof row.datasEspeciais === 'object' ? row.datasEspeciais : {};

      const indiceLinha = String(esp.indiceEspecial ?? '').trim() !== '' ? esp.indiceEspecial : indice;
      const idxUpperLinha = String(indiceLinha).toUpperCase();
      const fatorLinha = fatorIndiceSelecionado(indiceLinha);

      const dataInicialAtual = parseDateBR(esp.dataInicialAtual) ?? venc;
      const dataFinalAtual = parseDateBR(esp.dataFinalAtual) ?? dataCalcGlobal;
      const dataInicialJuros = parseDateBR(esp.dataInicialJuros) ?? venc;
      const dataFinalJuros = parseDateBR(esp.dataFinalJuros) ?? dataCalcGlobal;

      const hasTaxaJurosEspecial = String(esp.taxaJurosEspecial ?? '').trim() !== '';
      const jurosPctUsado = hasTaxaJurosEspecial ? parsePercent(esp.taxaJurosEspecial) : jurosPct;
      // Legado: distinguir "vazio" de "0".
      // Se faltar valor/vencimento (texto vazio), a linha fica com componentes vazios (não exibindo 0 residual).
      if (!dataCalcGlobal || principalStr === '' || vencStr === '') {
        return {
          ...row,
          diasAtraso: '',
          atualizacaoMonetaria: '',
          juros: '',
          multa: '',
          honorarios: '',
          total: '',
        };
      }

      const dias = diffDays(dataInicialJuros, dataFinalJuros);
      const multaPctUsada = String(esp.multaEspecial ?? '').trim() !== '' ? parsePercent(esp.multaEspecial) : multaPct;
      const honorariosTipoUsado =
        String(esp.honorariosTipoEspecial ?? '').trim() !== '' ? esp.honorariosTipoEspecial : honorariosTipo;
      const honorPctFixoUsado =
        String(esp.honorariosValorEspecial ?? '').trim() !== '' ? parsePercent(esp.honorariosValorEspecial) : honorPctFixo;

      // Legado: atualização monetária trabalha com o "valor atualizado total" do último mês.
      let atualizado = principal;
      let atualizacaoMonetariaValor = null;

      if (idxUpperLinha === 'INPC' && indicesMensaisINPCMap) {
        atualizado = calcularAtualizacaoMonetariaINPC(principal, dataInicialAtual, dataFinalAtual, indicesMensaisINPCMap);
      } else if ((idxUpperLinha === 'IPCA-E' || idxUpperLinha === 'IPCA') && indicesMensaisIPCAMap) {
        // O relatório usa uma lógica própria (ver calcularAtualizacaoMonetariaIPCA).
        atualizacaoMonetariaValor = calcularAtualizacaoMonetariaIPCA(principal, dataInicialAtual, dataFinalAtual, indicesMensaisIPCAMap);
        atualizado = principal + atualizacaoMonetariaValor;
      } else if (idxUpperLinha !== 'NENHUM') {
        // Fallback (mock) para índices ainda não integrados 100% (mantém comportamento atual).
        atualizado = trunc2(principal * fatorLinha);
      }

      // Legado: AtualMonet(Linha) = Arredondamento(atualizado - principal, 2) e zera se negativo.
      if (atualizacaoMonetariaValor == null) {
        const atualizacaoBruta = atualizado - principal;
        const t = trunc2(atualizacaoBruta);
        atualizacaoMonetariaValor = t < 0 ? 0 : t;
      }

      // Legado (Calcula_Juros): juros = (CalculoAtualizado * (Tx_Juros/100)) * Meses_Juros
      // e Meses_Juros é por diferença de meses + ajuste pelo dia.
      const meses = dias <= 0 ? 0 : mesesJurosLegacy(dataInicialJuros, dataFinalJuros);
      const jurosValor = dias <= 0 ? 0 : trunc2(atualizado * jurosPctUsado * meses);
      // Legado: multa incide após juros, base = principal + atualização + juros
      const baseMulta = principal + atualizacaoMonetariaValor + jurosValor;
      const multaValor = trunc2(baseMulta * multaPctUsada);
      // Legado: honorários por último, base = principal + atualização + juros + multa
      const honorPctVariavel = dias > 60 ? 0.2 : dias > 30 ? 0.1 : 0;
      const honorPct = honorariosTipoUsado === 'variaveis' ? honorPctVariavel : honorPctFixoUsado;
      const baseHonor = baseMulta + multaValor;
      const honorariosCalc = trunc2(baseHonor * honorPct);
      const total = trunc2(atualizado + jurosValor + multaValor + honorariosCalc);

      const nextRow = {
        ...row,
        diasAtraso: String(dias),
        atualizacaoMonetaria: formatBRL(trunc2(atualizacaoMonetariaValor)),
        juros: formatBRL(jurosValor),
        multa: formatBRL(multaValor),
        honorarios: formatBRL(honorariosCalc),
        total: formatBRL(total),
      };

      if (
        nextRow.diasAtraso !== row.diasAtraso ||
        nextRow.atualizacaoMonetaria !== row.atualizacaoMonetaria ||
        nextRow.juros !== row.juros ||
        nextRow.multa !== row.multa ||
        nextRow.honorarios !== row.honorarios ||
        nextRow.total !== row.total
      ) {
        changed = true;
      }
      return nextRow;
    });
    return { next, changed };
  }

  // Recalcula ao abrir e a cada mudança, exceto quando "Aceitar Pagamento" estiver marcado (travado).
  useEffect(() => {
    if (aceitarPagamento) return;
    const idxUpperGeral = String(indice).toUpperCase();
    const precisaINPC =
      idxUpperGeral === 'INPC' ||
      (rodadaAtual.titulos || []).some((t) => String(t?.datasEspeciais?.indiceEspecial ?? '').toUpperCase() === 'INPC');
    const precisaIPCA =
      idxUpperGeral === 'IPCA-E' ||
      idxUpperGeral === 'IPCA' ||
      (rodadaAtual.titulos || []).some((t) => {
        const v = String(t?.datasEspeciais?.indiceEspecial ?? '').toUpperCase();
        return v === 'IPCA-E' || v === 'IPCA';
      });

    if (precisaINPC && indicesMensaisINPC == null) return;
    if (precisaIPCA && indicesMensaisIPCA == null) return;
    setRodadasState((prev) => {
      const cur = prev[rodadaKey] || { ...rodadaAtual };
      const { next, changed } = recalcularTitulos(cur.titulos, indicesMensaisINPC, indicesMensaisIPCA);
      if (!changed) return prev;
      return {
        ...prev,
        [rodadaKey]: {
          ...cur,
          titulos: next,
        },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aceitarPagamento, indice, juros, multa, honorariosTipo, honorariosValor, dataCalculo, rodadaKey, indicesMensaisINPC, indicesMensaisIPCA]);

  // Carrega índices mensais do INPC antes de recalcular.
  useEffect(() => {
    if (aceitarPagamento && !modoAlteracao) return;
    const idxUpperGeral = String(indice).toUpperCase();
    const precisaINPC =
      idxUpperGeral === 'INPC' ||
      (rodadaAtual.titulos || []).some((t) => String(t?.datasEspeciais?.indiceEspecial ?? '').toUpperCase() === 'INPC');

    if (!precisaINPC) {
      setIndicesMensaisINPC(null);
      return;
    }

    const dataCalcDate = parseDateBR(dataCalculo);
    if (!dataCalcDate) return;

    // Busca o intervalo monetário coberto pelas “Datas Especiais” (por linha) e pela data geral.
    let minDataInicialAtual = null;
    let maxDataFinalAtual = dataCalcDate;
    for (const t of (rodadaAtual.titulos || [])) {
      const venc = parseDateBR(t.dataVencimento);
      if (!venc) continue;
      const esp = t.datasEspeciais && typeof t.datasEspeciais === 'object' ? t.datasEspeciais : {};
      const diAtual = parseDateBR(esp.dataInicialAtual) ?? venc;
      const dfAtual = parseDateBR(esp.dataFinalAtual) ?? dataCalcDate;

      if (diAtual && (!minDataInicialAtual || diAtual < minDataInicialAtual)) minDataInicialAtual = diAtual;
      if (dfAtual && dfAtual > maxDataFinalAtual) maxDataFinalAtual = dfAtual;
    }
    const inicio = minDataInicialAtual || dataCalcDate;
    const fim = maxDataFinalAtual || dataCalcDate;

    let cancelled = false;
    obterIndicesMensaisINPC(inicio, fim)
      .then((map) => {
        if (cancelled) return;
        setIndicesMensaisINPC(map);
      })
      .catch(() => {
        if (cancelled) return;
        // Se falhar a busca, não quebra a tela; cai no fallback do mock.
        setIndicesMensaisINPC({});
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aceitarPagamento, modoAlteracao, indice, dataCalculo, rodadaKey, indicesRefreshToken]);

  // Carrega índices mensais do IPCA (IPCA / “IPCA-E”) antes de recalcular.
  useEffect(() => {
    if (aceitarPagamento && !modoAlteracao) return;
    const idxUpper = String(indice).toUpperCase();
    const precisaIPCA =
      idxUpper === 'IPCA-E' ||
      idxUpper === 'IPCA' ||
      (rodadaAtual.titulos || []).some((t) => {
        const v = String(t?.datasEspeciais?.indiceEspecial ?? '').toUpperCase();
        return v === 'IPCA-E' || v === 'IPCA';
      });

    if (!precisaIPCA) {
      setIndicesMensaisIPCA(null);
      return;
    }

    const dataCalcDate = parseDateBR(dataCalculo);
    if (!dataCalcDate) return;

    // Busca o intervalo monetário coberto pelas “Datas Especiais” (por linha) e pela data geral.
    let minDataInicialAtual = null;
    let maxDataFinalAtual = dataCalcDate;
    for (const t of (rodadaAtual.titulos || [])) {
      const venc = parseDateBR(t.dataVencimento);
      if (!venc) continue;
      const esp = t.datasEspeciais && typeof t.datasEspeciais === 'object' ? t.datasEspeciais : {};
      const diAtual = parseDateBR(esp.dataInicialAtual) ?? venc;
      const dfAtual = parseDateBR(esp.dataFinalAtual) ?? dataCalcDate;

      if (diAtual && (!minDataInicialAtual || diAtual < minDataInicialAtual)) minDataInicialAtual = diAtual;
      if (dfAtual && dfAtual > maxDataFinalAtual) maxDataFinalAtual = dfAtual;
    }
    const inicio = minDataInicialAtual || dataCalcDate;

    // “até mm/aaaa” (do relatório) = mês anterior ao mês da data final atual.
    const endPrevMonth = new Date(maxDataFinalAtual.getFullYear(), maxDataFinalAtual.getMonth() - 1, 1);

    let cancelled = false;
    obterIndicesMensaisIPCA(inicio, endPrevMonth)
      .then((map) => {
        if (cancelled) return;
        setIndicesMensaisIPCA(map);
      })
      .catch(() => {
        if (cancelled) return;
        // Se falhar a busca, não quebra a tela; cai no zero.
        setIndicesMensaisIPCA({});
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aceitarPagamento, modoAlteracao, indice, dataCalculo, rodadaKey, indicesRefreshToken]);

  function brDateToInputValue(br) {
    const s = String(br ?? '').trim();
    if (!s || s.length < 10) return '';
    const [dd, mm, yyyy] = s.split('/');
    if (!dd || !mm || !yyyy) return '';
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  function inputValueToBrDate(v) {
    const s = String(v ?? '').trim();
    if (!s) return '';
    // yyyy-mm-dd -> dd/mm/yyyy
    const [yyyy, mm, dd] = s.split('-');
    if (!yyyy || !mm || !dd) return '';
    return `${dd}/${mm}/${yyyy}`;
  }

  function abrirModalDatasEspeciais(indexGlobal) {
    const linha = (rodadaAtual.titulos || [])[indexGlobal];
    const esp = linha && linha.datasEspeciais && typeof linha.datasEspeciais === 'object' ? linha.datasEspeciais : {};
    setLinhaModalIdx(indexGlobal);
    setFormDatasEspeciais({
      dataInicialAtual: String(esp.dataInicialAtual ?? ''),
      dataInicialJuros: String(esp.dataInicialJuros ?? ''),
      dataFinalAtual: String(esp.dataFinalAtual ?? ''),
      dataFinalJuros: String(esp.dataFinalJuros ?? ''),
      taxaJurosEspecial: String(esp.taxaJurosEspecial ?? ''),
      multaEspecial: String(esp.multaEspecial ?? ''),
      indiceEspecial: String(esp.indiceEspecial ?? ''),
      honorariosTipoEspecial: String(esp.honorariosTipoEspecial ?? ''),
      honorariosValorEspecial: String(esp.honorariosValorEspecial ?? ''),
    });
    setModalDatasEspeciais(true);
  }

  function fecharModalDatasEspeciais() {
    setModalDatasEspeciais(false);
    setLinhaModalIdx(null);
  }

  function salvarModalDatasEspeciais() {
    if (linhaModalIdx == null) return;

    const esp = {};
    if (String(formDatasEspeciais.dataInicialAtual ?? '').trim() !== '') esp.dataInicialAtual = formDatasEspeciais.dataInicialAtual;
    if (String(formDatasEspeciais.dataInicialJuros ?? '').trim() !== '') esp.dataInicialJuros = formDatasEspeciais.dataInicialJuros;
    if (String(formDatasEspeciais.dataFinalAtual ?? '').trim() !== '') esp.dataFinalAtual = formDatasEspeciais.dataFinalAtual;
    if (String(formDatasEspeciais.dataFinalJuros ?? '').trim() !== '') esp.dataFinalJuros = formDatasEspeciais.dataFinalJuros;
    if (String(formDatasEspeciais.taxaJurosEspecial ?? '').trim() !== '') esp.taxaJurosEspecial = formDatasEspeciais.taxaJurosEspecial;
    if (String(formDatasEspeciais.multaEspecial ?? '').trim() !== '') esp.multaEspecial = formDatasEspeciais.multaEspecial;
    if (String(formDatasEspeciais.indiceEspecial ?? '').trim() !== '') esp.indiceEspecial = formDatasEspeciais.indiceEspecial;
    if (String(formDatasEspeciais.honorariosTipoEspecial ?? '').trim() !== '') esp.honorariosTipoEspecial = formDatasEspeciais.honorariosTipoEspecial;
    if (String(formDatasEspeciais.honorariosValorEspecial ?? '').trim() !== '') esp.honorariosValorEspecial = formDatasEspeciais.honorariosValorEspecial;

    const espToSave = Object.keys(esp).length > 0 ? esp : null;

    atualizarTituloNaRodada(linhaModalIdx, { datasEspeciais: espToSave });
    setIndicesRefreshToken((t) => t + 1);
    fecharModalDatasEspeciais();
  }

  function atualizarTituloNaRodada(indexGlobal, patch) {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      if (indexGlobal < 0 || indexGlobal >= cur.titulos.length) return prev;
      const titulosAtualizados = cur.titulos.map((r, i) => {
        if (i !== indexGlobal) return r;
        return { ...r, ...patch };
      });
      // Se o cálculo estiver travado (Aceitar Pagamento), em Modo de Alteração o usuário pode editar manualmente
      // sem que a rotina de recálculo sobrescreva os valores digitados.
      const next = aceitarPagamento ? titulosAtualizados : recalcularTitulos(titulosAtualizados, indicesMensaisINPC, indicesMensaisIPCA).next;
      return {
        ...prev,
        [rodadaKey]: { ...cur, titulos: next },
      };
    });
  }

  function parcelaTemValor(parcela) {
    if (!parcela || typeof parcela !== 'object') return false;
    return [
      parcela.dataVencimento,
      parcela.valorParcela,
      parcela.honorariosParcela,
      parcela.observacao,
    ].some((v) => String(v ?? '').trim() !== '');
  }

  function atualizarParcelaNaRodada(indexGlobal, patch) {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const listaAtual = Array.isArray(cur.parcelas) ? [...cur.parcelas] : gerarParcelasMock();
      while (indexGlobal >= listaAtual.length) listaAtual.push(linhaVaziaParcela());
      listaAtual[indexGlobal] = { ...listaAtual[indexGlobal], ...patch };

      const ultimoIndice = listaAtual.length - 1;
      if (parcelaTemValor(listaAtual[ultimoIndice])) {
        listaAtual.push(linhaVaziaParcela());
      }

      return {
        ...prev,
        [rodadaKey]: { ...cur, parcelas: listaAtual },
      };
    });
  }

  const resumoParcelamento = useMemo(() => {
    const validas = parcelas.filter((p) => parcelaTemValor(p));
    const valorFinalParcelas = validas.reduce((acc, p) => acc + parseBRL(p.valorParcela), 0);
    const valorHonorarios = validas.reduce((acc, p) => acc + parseBRL(p.honorariosParcela), 0);
    const valorTotalPagar = trunc2(valorFinalParcelas + valorHonorarios);
    return {
      quantidade: validas.length,
      valorFinalParcelas: formatBRL(trunc2(valorFinalParcelas)),
      valorTotalPagar: formatBRL(valorTotalPagar),
      valorFinalHonorarios: formatBRL(trunc2(valorHonorarios)),
      valorHonorariosParcela: validas.length > 0 ? formatBRL(trunc2(valorHonorarios / validas.length)) : formatBRL(0),
      valorCustasParcela: formatBRL(0),
      valorFinalCustas: formatBRL(0),
      valorFinalAtualizado: formatBRL(trunc2(valorFinalParcelas)),
      valorFinalAtualizadoCustas: formatBRL(0),
    };
  }, [parcelas]);

  return (
    <div className="min-h-full bg-slate-200 flex flex-col">
      <header className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-300 shrink-0">
        <h1 className="text-lg font-bold text-slate-800">Cálculos Atualizados dos Títulos</h1>
        <button type="button" onClick={() => window.history.back()} className="p-2 rounded border border-slate-400 bg-white text-slate-600 hover:bg-slate-100" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="px-3 py-2 bg-slate-500 text-white flex items-center justify-between">
        <span className="font-medium">{rodadaAtual.cabecalho?.autor ?? 'CLIENTE (MOCK)'} x {rodadaAtual.cabecalho?.reu ?? 'PARTE OPOSTA (MOCK)'}</span>
        <span className="text-sm font-mono">{String(codigoClienteNorm)}</span>
      </div>

      <div className="flex border-b border-slate-300 bg-slate-100">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setTabAtiva(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t ${tabAtiva === tab ? 'bg-white text-slate-800 border border-slate-300 border-b-0 -mb-px' : 'text-slate-600 hover:bg-slate-200'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto p-3">
          {tabAtiva === 'Títulos' && (
            <>
              <p className="text-sm text-slate-600 mb-2">
                Página {String(pagina).padStart(2, '0')} — Linhas {inicio + 1} a {Math.min(fim, titulos.length)} (de {titulos.length})
              </p>
              <div className="overflow-x-auto border border-slate-300 rounded bg-white">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 w-12">#</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[100px]">Data de Vencimento</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[120px]">Valor inicial do título</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[120px]">Atualização Monetária</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[80px]">Dias de Atraso</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[90px]">Juros</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[80px]">Multa</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[80px]">Honorários</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[100px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {titulosPaginaCompletos.map((row, idx) => {
                      const globalIdx = inicio + idx;
                      const podeEditarLinha =
                        globalIdx < (rodadaAtual.titulos || []).length && (!aceitarPagamento || modoAlteracao);
                      return (
                      <tr key={globalIdx} className={globalIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td
                          className="border border-slate-200 px-2 py-1 text-slate-600 cursor-pointer hover:bg-slate-50"
                          onDoubleClick={() => {
                            if (podeEditarLinha) abrirModalDatasEspeciais(globalIdx);
                          }}
                          title="Duplo clique: Configurações Especiais"
                        >
                          {String(globalIdx + 1).padStart(3, '0')}
                        </td>
                        <td className="border border-slate-200 px-2 py-1">
                          {podeEditarLinha ? (
                            <input
                              type="date"
                              value={brDateToInputValue(row.dataVencimento)}
                              onBlur={(e) => {
                                atualizarTituloNaRodada(globalIdx, {
                                  dataVencimento: inputValueToBrDate(e.target.value),
                                });
                              }}
                              className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                            />
                          ) : (
                            row.dataVencimento
                          )}
                        </td>
                        <td className="border border-slate-200 px-2 py-1">
                          {podeEditarLinha ? (
                            <input
                              type="text"
                              value={row.valorInicial}
                              onChange={(e) => {
                                atualizarTituloNaRodada(globalIdx, {
                                  valorInicial: e.target.value,
                                });
                              }}
                              onBlur={(e) => {
                                const raw = String(e.target.value ?? '');
                                const rawTrim = raw.trim();
                                if (rawTrim === '') {
                                  atualizarTituloNaRodada(globalIdx, { valorInicial: '' });
                                  return;
                                }
                                const n = parseBRL(rawTrim);
                                atualizarTituloNaRodada(globalIdx, {
                                  valorInicial: formatBRL(n),
                                });
                              }}
                              className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                            />
                          ) : (
                            row.valorInicial
                          )}
                        </td>
                        <td className={`border border-slate-200 px-2 py-1 ${modoAlteracao ? 'text-red-600 font-medium' : ''}`}>
                          {podeEditarLinha && modoAlteracao ? (
                            <input
                              type="text"
                              value={row.atualizacaoMonetaria}
                              onChange={(e) => atualizarTituloNaRodada(globalIdx, { atualizacaoMonetaria: e.target.value })}
                              onBlur={(e) => atualizarTituloNaRodada(globalIdx, { atualizacaoMonetaria: formatBRL(parseBRL(e.target.value)) })}
                              className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                            />
                          ) : (
                            row.atualizacaoMonetaria
                          )}
                        </td>
                        <td className={`border border-slate-200 px-2 py-1 ${modoAlteracao ? 'text-red-600 font-medium' : ''}`}>
                          {podeEditarLinha && modoAlteracao ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.diasAtraso}
                              onChange={(e) => atualizarTituloNaRodada(globalIdx, { diasAtraso: e.target.value })}
                              onBlur={(e) => {
                                const n = Number(String(e.target.value ?? '').replace(/\D/g, ''));
                                atualizarTituloNaRodada(globalIdx, { diasAtraso: n ? String(Math.max(0, Math.floor(n))) : '0' });
                              }}
                              className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                            />
                          ) : (
                            row.diasAtraso
                          )}
                        </td>
                        <td className={`border border-slate-200 px-2 py-1 ${modoAlteracao ? 'text-red-600 font-medium' : ''}`}>
                          {podeEditarLinha && modoAlteracao ? (
                            <input
                              type="text"
                              value={row.juros}
                              onChange={(e) => atualizarTituloNaRodada(globalIdx, { juros: e.target.value })}
                              onBlur={(e) => atualizarTituloNaRodada(globalIdx, { juros: formatBRL(parseBRL(e.target.value)) })}
                              className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                            />
                          ) : (
                            row.juros
                          )}
                        </td>
                        <td className={`border border-slate-200 px-2 py-1 ${modoAlteracao ? 'text-red-600 font-medium' : ''}`}>
                          {podeEditarLinha && modoAlteracao ? (
                            <input
                              type="text"
                              value={row.multa}
                              onChange={(e) => atualizarTituloNaRodada(globalIdx, { multa: e.target.value })}
                              onBlur={(e) => atualizarTituloNaRodada(globalIdx, { multa: formatBRL(parseBRL(e.target.value)) })}
                              className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                            />
                          ) : (
                            row.multa
                          )}
                        </td>
                        <td className={`border border-slate-200 px-2 py-1 ${modoAlteracao ? 'text-red-600 font-medium' : ''}`}>
                          {podeEditarLinha && modoAlteracao ? (
                            <input
                              type="text"
                              value={row.honorarios}
                              onChange={(e) => atualizarTituloNaRodada(globalIdx, { honorarios: e.target.value })}
                              onBlur={(e) => atualizarTituloNaRodada(globalIdx, { honorarios: formatBRL(parseBRL(e.target.value)) })}
                              className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                            />
                          ) : (
                            row.honorarios
                          )}
                        </td>
                        <td className={`border border-slate-200 px-2 py-1 font-medium ${modoAlteracao ? 'text-red-600' : ''}`}>
                          {podeEditarLinha && modoAlteracao ? (
                            <input
                              type="text"
                              value={row.total}
                              onChange={(e) => atualizarTituloNaRodada(globalIdx, { total: e.target.value })}
                              onBlur={(e) => atualizarTituloNaRodada(globalIdx, { total: formatBRL(parseBRL(e.target.value)) })}
                              className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm font-medium"
                            />
                          ) : (
                            row.total
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {/* Linha 1: soma somente da página atual */}
                    <tr className="bg-slate-100 font-medium">
                      <td className="border border-slate-300 px-2 py-1" colSpan={2}>{resumoPagina.qtd}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoPagina.valorInicial}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoPagina.atualizacao}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoPagina.diasAtraso}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoPagina.juros}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoPagina.multa}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoPagina.honorarios}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoPagina.total}</td>
                    </tr>
                    {/* Linha 2: soma de todas as páginas (sem vermelho) */}
                    <tr className="bg-slate-100 font-medium">
                      <td className="border border-slate-300 px-2 py-1" colSpan={2}>{resumoGeral.qtd}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoGeral.valorInicial}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoGeral.atualizacao}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoGeral.diasAtraso}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoGeral.juros}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoGeral.multa}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoGeral.honorarios}</td>
                      <td className="border border-slate-300 px-2 py-1">{resumoGeral.total}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
          {tabAtiva === 'Parcelamento' && (
            <div className="border border-slate-300 rounded bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-600">
                  Página {String(paginaParcelamento).padStart(2, '0')} — Parcelas {inicioParcelas + 1} a {Math.min(fimParcelas, parcelas.length)}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaginaParcelamento((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaginaParcelamento((p) => Math.min(totalPaginasParcelas, p + 1))}
                    className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-3">
                <div className="overflow-x-auto border border-slate-300">
                  <table className="w-full text-sm border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-24">Parcela</th>
                        <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-36">Data Venc.</th>
                        <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-40">Valor</th>
                        <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-40">Honor. Parc.</th>
                        <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700">Obs.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelasPaginaCompletas.map((row, idx) => {
                        const globalIdx = inicioParcelas + idx;
                        const podeEditar = !aceitarPagamento || modoAlteracao;
                        return (
                          <tr key={`parcela-${globalIdx}`} className={globalIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="border border-slate-200 px-2 py-1 text-slate-700">
                              Parcela {String(globalIdx + 1).padStart(2, '0')}:
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              {podeEditar ? (
                                <input
                                  type="date"
                                  value={brDateToInputValue(row.dataVencimento)}
                                  onBlur={(e) => atualizarParcelaNaRodada(globalIdx, { dataVencimento: inputValueToBrDate(e.target.value) })}
                                  className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                                />
                              ) : row.dataVencimento}
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              {podeEditar ? (
                                <input
                                  type="text"
                                  value={row.valorParcela}
                                  onChange={(e) => atualizarParcelaNaRodada(globalIdx, { valorParcela: e.target.value })}
                                  onBlur={(e) => {
                                    const raw = String(e.target.value ?? '').trim();
                                    atualizarParcelaNaRodada(globalIdx, { valorParcela: raw === '' ? '' : formatBRL(parseBRL(raw)) });
                                  }}
                                  className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                                />
                              ) : row.valorParcela}
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              {podeEditar ? (
                                <input
                                  type="text"
                                  value={row.honorariosParcela}
                                  onChange={(e) => atualizarParcelaNaRodada(globalIdx, { honorariosParcela: e.target.value })}
                                  onBlur={(e) => {
                                    const raw = String(e.target.value ?? '').trim();
                                    atualizarParcelaNaRodada(globalIdx, { honorariosParcela: raw === '' ? '' : formatBRL(parseBRL(raw)) });
                                  }}
                                  className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                                />
                              ) : row.honorariosParcela}
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              {podeEditar ? (
                                <input
                                  type="text"
                                  value={row.observacao}
                                  onChange={(e) => atualizarParcelaNaRodada(globalIdx, { observacao: e.target.value })}
                                  className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                                />
                              ) : row.observacao}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-medium">
                        <td className="border border-slate-300 px-2 py-1" colSpan={2}>Total da página</td>
                        <td className="border border-slate-300 px-2 py-1">
                          {formatBRL(trunc2(parcelasPagina.reduce((acc, p) => acc + parseBRL(p.valorParcela), 0)))}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                          {formatBRL(trunc2(parcelasPagina.reduce((acc, p) => acc + parseBRL(p.honorariosParcela), 0)))}
                        </td>
                        <td className="border border-slate-300 px-2 py-1" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="border border-slate-300 p-3 bg-slate-50 space-y-3">
                  <div className="border border-slate-300 bg-white p-2">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Parcelamentos</p>
                    <div className="space-y-1.5 text-sm">
                      <p className="flex justify-between gap-2"><span>Quantidade de Parcelas:</span><b>{String(resumoParcelamento.quantidade).padStart(2, '0')}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor Final das Parcelas:</span><b>{resumoParcelamento.valorFinalParcelas}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor Total Pago (após parcelamento):</span><b>{resumoParcelamento.valorTotalPagar}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor Final dos Honorários:</span><b>{resumoParcelamento.valorFinalHonorarios}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor dos Honorários (Parcela):</span><b>{resumoParcelamento.valorHonorariosParcela}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor das Custas (Parcela):</span><b>{resumoParcelamento.valorCustasParcela}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor Final das Custas após:</span><b>{resumoParcelamento.valorFinalCustas}</b></p>
                    </div>
                  </div>
                  <div className="border border-slate-300 bg-white p-2">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Informações</p>
                    <div className="space-y-1.5 text-sm">
                      <p className="flex justify-between gap-2"><span>Valor Final Atualizado das</span><b>{resumoParcelamento.valorFinalAtualizado}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor Final Atualizado das Custas:</span><b>{resumoParcelamento.valorFinalAtualizadoCustas}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor Total a ser Pago:</span><b>{resumoParcelamento.valorTotalPagar}</b></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tabAtiva !== 'Títulos' && tabAtiva !== 'Parcelamento' && (
            <div className="p-4 bg-white rounded border border-slate-300">
              <p className="text-sm text-slate-500">Conteúdo da aba &quot;{tabAtiva}&quot;.</p>
            </div>
          )}
        </div>

        <aside className="w-56 shrink-0 border-l border-slate-300 bg-slate-100 p-3 overflow-y-auto space-y-3">
          <div className="p-2 rounded border border-slate-300 bg-white">
            <p className="text-xs font-semibold text-slate-700 mb-2">Acesso manual</p>
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-0.5">Cod Cliente</label>
                <SpinnerFieldManual
                  value={codClienteManual}
                  onChange={(v) => setCodClienteManual(v)}
                  min={1}
                  step={1}
                  className="w-full"
                  formatDisplay={(n) => String(Math.max(1, Math.floor(Number(n) || 1))).padStart(8, '0')}
                  parseInput={(s) => Number(String(s).replace(/\D/g, ''))}
                  onStep={(nextCod) => aplicarClienteProcComValores(nextCod, procManual)}
                  onBlur={() => {
                    normalizarCampoManual();
                    aplicarClienteProcManual();
                  }}
                />
                <p className="mt-1 text-[11px] text-slate-500">Use as setas para variar o código rapidamente.</p>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-0.5">Proc.</label>
                <SpinnerFieldManual
                  value={procManual}
                  onChange={(v) => setProcManual(v)}
                  min={1}
                  step={1}
                  className="w-full"
                  formatDisplay={(n) => String(Math.max(1, Math.floor(Number(n) || 1)))}
                  parseInput={(s) => Number(String(s).replace(/\D/g, ''))}
                  onStep={(nextProc) => aplicarClienteProcComValores(codClienteManual, nextProc)}
                  onBlur={() => {
                    normalizarCampoManual();
                    aplicarClienteProcManual();
                  }}
                />
              </div>
              <button
                type="button"
                onClick={aplicarClienteProcManual}
                className="w-full px-3 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Ir
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">Página</label>
            <SpinnerField
              value={tabAtiva === 'Parcelamento' ? paginaParcelamento : pagina}
              onChange={tabAtiva === 'Parcelamento' ? setPaginaParcelamento : setPagina}
              min={1}
              className="w-24"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              de {String(tabAtiva === 'Parcelamento' ? totalPaginasParcelas : totalPaginas).padStart(2, '0')}
            </p>
          </div>
          {tabAtiva === 'Títulos' && (
            <button
              type="button"
              onClick={() => {
                if (limpezaAtiva) reverterLimpeza();
                else setConfirmarLimpeza(true);
              }}
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
            >
              {limpezaAtiva ? 'Reverter limpeza' : 'Limpa Página Toda'}
            </button>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">Dimensão:</label>
            <SpinnerField value={dimensao} onChange={setDimensao} className="w-24" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">Data do Cálculo:</label>
            <input type="text" value={dataCalculo} onChange={(e) => setDataCalculo(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">Juros:</label>
            <input type="text" value={juros} onChange={(e) => setJuros(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">Multa:</label>
            <input type="text" value={multa} onChange={(e) => setMulta(e.target.value)} className={inputClass} />
          </div>
          <div className="border border-slate-300 rounded p-2 bg-white">
            <p className="text-xs font-medium text-slate-700 mb-1.5">Honorários</p>
            <div className="flex gap-3 mb-1">
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="radio" name="honorarios" checked={honorariosTipo === 'fixos'} onChange={() => setHonorariosTipo('fixos')} className="text-slate-600" />
                Fixos
              </label>
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="radio" name="honorarios" checked={honorariosTipo === 'variaveis'} onChange={() => setHonorariosTipo('variaveis')} className="text-slate-600" />
                Variáveis
              </label>
            </div>
            {honorariosTipo === 'variaveis' && (
              <p className="text-xs text-slate-500 mb-1">
                ≤ 30 dias = 0% &nbsp;|&nbsp; 31–60 dias = 10% &nbsp;|&nbsp; &gt; 60 dias = 20%
              </p>
            )}
            <input
              type="text"
              value={honorariosValor}
              onChange={(e) => setHonorariosValor(e.target.value)}
              placeholder={honorariosTipo === 'fixos' ? 'Ex: 10 %' : '—'}
              disabled={honorariosTipo !== 'fixos'}
              className={`${inputClass} ${honorariosTipo !== 'fixos' ? 'bg-slate-50 text-slate-400' : ''}`}
            />
          </div>
          <div className="border border-slate-300 rounded p-2 bg-white">
            <p className="text-xs font-medium text-slate-700 mb-1.5">Índice</p>
            <div className="space-y-0.5">
              {INDICES.map((nome) => (
                <label
                  key={nome}
                  className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
                  onClick={() => setIndice(nome)}
                >
                  <input
                    id={`indice-${nome}`}
                    type="radio"
                    name="indice"
                    value={nome}
                    checked={indice === nome}
                    onChange={(e) => setIndice(e.target.value)}
                    className="text-slate-600"
                  />
                  {nome}
                  {nome === 'INPC' && <BarChart2 className="w-3.5 h-3.5 text-slate-500" />}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-slate-300">
            <button type="button" className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Cancelar</button>
            <button type="button" className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Configurações</button>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={aceitarPagamento}
                onChange={(e) => {
                  const next = e.target.checked;
                  const ok = confirmarAlternarAceitarPagamento(next);
                  if (ok) setAceitarPagamento(next);
                }}
                className="rounded border-slate-300"
              />
              Aceitar Pagamento
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={modoAlteracao} onChange={(e) => setModoAlteracao(e.target.checked)} className="rounded border-slate-300" />
              Modo de Alteração
            </label>
            <button
              type="button"
              onClick={() => navigate('/processos', { state: { codCliente: String(codigoCliente ?? ''), proc: String(proc ?? '') } })}
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
            >
              Processo
            </button>
            <button
              type="button"
              onClick={gerarPdfCalculo}
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 text-left"
            >
              Salvar Formulário em PDI
            </button>
            <button type="button" className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Gerar no Word</button>
            <button type="button" className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Email Automático</button>
            <button type="button" className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Soluções Rápidas</button>
          </div>
        </aside>
      </div>

      {modalDatasEspeciais && linhaModalIdx != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-4xl">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-800">Configurações Especiais de Parcela</h2>
              <button type="button" className="p-1 rounded hover:bg-slate-100" onClick={fecharModalDatasEspeciais} aria-label="Fechar">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="text-sm text-slate-700">
                Defina overrides apenas para a linha selecionada (datas/juros, multa, índice de correção monetária e honorários).
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Data Inicial Atual</label>
                  <input
                    type="date"
                    value={brDateToInputValue(formDatasEspeciais.dataInicialAtual)}
                    onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, dataInicialAtual: inputValueToBrDate(e.target.value) }))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Data Inicial Juros</label>
                  <input
                    type="date"
                    value={brDateToInputValue(formDatasEspeciais.dataInicialJuros)}
                    onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, dataInicialJuros: inputValueToBrDate(e.target.value) }))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Data Final Atual</label>
                  <input
                    type="date"
                    value={brDateToInputValue(formDatasEspeciais.dataFinalAtual)}
                    onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, dataFinalAtual: inputValueToBrDate(e.target.value) }))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Data Final Juros</label>
                  <input
                    type="date"
                    value={brDateToInputValue(formDatasEspeciais.dataFinalJuros)}
                    onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, dataFinalJuros: inputValueToBrDate(e.target.value) }))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Taxa Juros Especial da Parcela</label>
                <input
                  type="text"
                  value={formDatasEspeciais.taxaJurosEspecial}
                  onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, taxaJurosEspecial: e.target.value }))}
                  placeholder="Ex: 1 %"
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Multa (%) da Parcela</label>
                  <input
                    type="text"
                    value={formDatasEspeciais.multaEspecial}
                    onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, multaEspecial: e.target.value }))}
                    placeholder="Ex: 0 %"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Índice de Correção Monetária</label>
                  <select
                    value={formDatasEspeciais.indiceEspecial}
                    onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, indiceEspecial: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                  >
                    <option value="">Usar índice geral</option>
                    {INDICES.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Honorários da Parcela</label>
                  <select
                    value={formDatasEspeciais.honorariosTipoEspecial}
                    onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, honorariosTipoEspecial: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                  >
                    <option value="">Usar honorários gerais</option>
                    <option value="fixos">Fixos</option>
                    <option value="variaveis">Variáveis</option>
                  </select>
                  {formDatasEspeciais.honorariosTipoEspecial === 'fixos' && (
                    <input
                      type="text"
                      value={formDatasEspeciais.honorariosValorEspecial}
                      onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, honorariosValorEspecial: e.target.value }))}
                      placeholder="Ex: 10 %"
                      className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50" onClick={fecharModalDatasEspeciais}>
                Cancelar
              </button>
              <button type="button" className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50" onClick={salvarModalDatasEspeciais}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarLimpeza && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-800">Confirmar limpeza</h2>
            </div>
            <div className="px-4 py-3 text-sm text-slate-700">
              Deseja limpar todos os dados da <b>página {pagina}</b> (linhas {inicio + 1} a {Math.min(fim, titulos.length)})?
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmarLimpeza(false)}
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmarLimpeza(false);
                  limparPaginaAtual();
                }}
                className="px-3 py-2 rounded border border-red-300 bg-red-50 text-red-700 text-sm hover:bg-red-100"
              >
                Limpar página
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
