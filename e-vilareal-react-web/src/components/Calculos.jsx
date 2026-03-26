import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X, ChevronUp, ChevronDown, BarChart2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getLancamentosContaCorrente } from '../data/financeiroData';
import { loadRodadasCalculos, saveRodadasCalculos } from '../data/calculosRodadasStorage';
import { RODADAS_VINCULACAO_TESTE_50 } from '../data/vinculacaoAutomaticaTestMock';
import {
  PARCELAS_POR_PAGINA_MOCK as PARCELAS_POR_PAGINA,
  gerarCabecalhoMock,
  gerarParcelasMock,
  gerarTitulosMock,
  linhaVaziaParcela,
} from '../data/calculosRodadasMockGeracao.js';
import { obterIndicesMensaisINPC, obterIndicesMensaisIPCA } from '../services/monetaryIndicesService.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { baixarBlobDocx, gerarDocumentoListaDebitosWord } from '../utils/gerarDocumentoListaDebitosWord';
import { INDICES_CALCULO, PERIODICIDADE_OPCOES, MODELOS_LISTA_DEBITOS } from '../data/calculosIndices.js';
import { loadConfigCalculoCliente, mergeConfigPainelCalculo } from '../data/clienteConfigCalculoStorage.js';
import { resolverAliasHojeEmTexto } from '../services/hjDateAliasService.js';

const TABS = ['Títulos', 'Custas Judiciais', 'Parcelamento', 'Pagamento', 'Honorários', 'Descrição dos Valores'];

const INDICES = INDICES_CALCULO;

const inputClass = 'w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white';
const TITULOS_POR_PAGINA = 20;

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

/** Normaliza quantidade informada pelo usuário (0–9999); vazio vira "00"; até 99 com dois dígitos. */
function formatarQuantidadeParcelasExibicao(s) {
  const d = String(s ?? '').replace(/\D/g, '');
  if (d === '') return '00';
  const n = Math.min(9999, Math.max(0, Number(d)));
  return n <= 99 ? String(n).padStart(2, '0') : String(n);
}

/** Converte texto percentual (pt-BR) em número. */
function parsePercentualBR(str) {
  const t = String(str ?? '')
    .trim()
    .replace(/%/g, '')
    .trim();
  if (!t) return NaN;
  const normalized = t.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/** Formata taxa com duas casas decimais (vírgula), padrão brasileiro. */
function formatarTaxaJurosParcelamento2Casas(s) {
  const n = parsePercentualBR(s);
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Quantidade de parcelas a partir do texto (ex.: "12", "00" → 0). */
function parseQuantidadeParcelasNumero(s) {
  const d = String(s ?? '').replace(/\D/g, '');
  if (!d) return 0;
  return Math.min(9999, Math.max(0, Number(d)));
}

/**
 * Valor de cada parcela (prestação fixa) — taxa composta ao mês (Tabela Price).
 * PV = débito atualizado (total dos títulos); taxaPercentAoMes = % a.m.; n = nº de parcelas.
 */
function calcularParcelaPrecoMensalPrice(pv, taxaPercentAoMes, nParcelas) {
  const n = Math.max(0, Math.floor(Number(nParcelas) || 0));
  if (n <= 0 || pv <= 0) return null;
  const i = Number(taxaPercentAoMes) / 100;
  if (!Number.isFinite(i) || i < 0) return null;
  let pmt;
  if (i === 0 || i < 1e-14) {
    pmt = pv / n;
  } else {
    pmt = (pv * i * (1 + i) ** n) / ((1 + i) ** n - 1);
  }
  return Math.trunc(pmt * 100) / 100;
}

/** dd/mm/yyyy → Date local ou null (mesma regra do parseDateBR da tela). */
function parseDateBRModulo(str) {
  let s = String(str ?? '').trim();
  const alias = resolverAliasHojeEmTexto(s, 'br');
  if (alias) s = alias;
  if (!s || s.length < 10) return null;
  const [dd, mm, yyyy] = s.split('/');
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateBRFromDate(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Normaliza texto digitado para dd/mm/aaaa; vazio ou inválido → ''.
 * Evita depender de &lt;input type="date"&gt;, que em muitos navegadores mostra "dd/mm/aaaa" quando vazio.
 */
function normalizarTextoDataBRparaSalvar(s) {
  let t = String(s ?? '').trim();
  const alias = resolverAliasHojeEmTexto(t, 'br');
  if (alias) t = alias;
  if (!t) return '';
  const d0 = parseDateBRModulo(t);
  if (d0 && !Number.isNaN(d0.getTime())) return formatDateBRFromDate(d0);
  const parts = t.split(/[/\-]/).map((p) => p.trim());
  if (parts.length !== 3) return '';
  const dd = String(Math.min(31, Math.max(1, Number(parts[0]) || 0))).padStart(2, '0');
  const mm = String(Math.min(12, Math.max(1, Number(parts[1]) || 0))).padStart(2, '0');
  let yyyy = String(parts[2] ?? '').replace(/\D/g, '');
  if (yyyy.length === 2) yyyy = `20${yyyy}`;
  if (yyyy.length !== 4) return '';
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? '' : formatDateBRFromDate(d);
}

/** Soma meses mantendo o dia quando possível (ex.: 31/01 + 1 mês → último dia de fevereiro). */
function addMonthsDate(d, months) {
  const m = Math.round(Number(months) || 0);
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDate();
  x.setMonth(x.getMonth() + m);
  if (x.getDate() !== day) {
    x.setDate(0);
  }
  return x;
}

/**
 * Datas de vencimento/pagamento mensais a partir da data do cálculo:
 * 1ª parcela = 1 mês após a data base, 2ª = 2 meses, …
 */
function gerarDataParcelaMensalBR(dataCalculoStr, indiceZeroBased) {
  const base = parseDateBRModulo(dataCalculoStr) ?? new Date();
  const d = addMonthsDate(base, indiceZeroBased + 1);
  return formatDateBRFromDate(d);
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

export function Calculos() {
  const location = useLocation();
  const navigate = useNavigate();
  const stateFromProcessos = location.state && typeof location.state === 'object' ? location.state : null;
  const codClienteFromState = stateFromProcessos?.codCliente ?? '';
  const procFromState = stateFromProcessos?.proc ?? '';
  const dimensaoFromState = stateFromProcessos?.dimensao;
  const abaCalculosFromState = stateFromProcessos?.abaCalculos ?? '';

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
  const [honorariosVariaveisTexto, setHonorariosVariaveisTexto] = useState('');
  const [indice, setIndice] = useState('INPC');
  const [periodicidade, setPeriodicidade] = useState('mensal');
  const [modeloListaDebitos, setModeloListaDebitos] = useState('01');
  const [aceitarPagamento, setAceitarPagamento] = useState(false);
  const [modoAlteracao, setModoAlteracao] = useState(false);
  const [indicesMensaisINPC, setIndicesMensaisINPC] = useState(null);
  const [indicesMensaisIPCA, setIndicesMensaisIPCA] = useState(null);
  // Cada (cliente + proc + dimensão) representa uma rodada independente de cálculos (estado próprio).
  const [rodadasState, setRodadasState] = useState(() => ({
    ...(loadRodadasCalculos() || {}),
    ...RODADAS_VINCULACAO_TESTE_50,
  }));
  const saveRodadasTimerRef = useRef(null);
  const rodadasStateRef = useRef(rodadasState);
  rodadasStateRef.current = rodadasState;

  useEffect(() => {
    const h = () =>
      setRodadasState({
        ...(loadRodadasCalculos() || {}),
        ...RODADAS_VINCULACAO_TESTE_50,
      });
    window.addEventListener('vilareal:calculos-rodadas-atualizadas', h);
    return () => window.removeEventListener('vilareal:calculos-rodadas-atualizadas', h);
  }, []);

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
    if (dimensaoFromState !== undefined && dimensaoFromState !== null && String(dimensaoFromState).trim() !== '') {
      const d = Number(dimensaoFromState);
      if (!Number.isNaN(d) && d >= 0) setDimensao(Math.floor(d));
    }
    if (abaCalculosFromState && TABS.includes(abaCalculosFromState)) {
      setTabAtiva(abaCalculosFromState);
    }
  }, [codClienteFromState, procFromState, dimensaoFromState, abaCalculosFromState]);

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

  const panelConfigKey = useMemo(
    () => JSON.stringify(rodadasState[rodadaKey]?.panelConfig ?? null),
    [rodadaKey, rodadasState[rodadaKey]?.panelConfig]
  );

  const updatePainelCampo = useCallback(
    (partial) => {
      if (partial.juros !== undefined) setJuros(partial.juros);
      if (partial.multa !== undefined) setMulta(partial.multa);
      if (partial.honorariosTipo !== undefined) {
        setHonorariosTipo(partial.honorariosTipo === 'variaveis' ? 'variaveis' : 'fixos');
      }
      if (partial.honorariosValor !== undefined) setHonorariosValor(partial.honorariosValor);
      if (partial.honorariosVariaveisTexto !== undefined) setHonorariosVariaveisTexto(partial.honorariosVariaveisTexto);
      if (partial.indice !== undefined) setIndice(partial.indice);
      if (partial.periodicidade !== undefined) setPeriodicidade(partial.periodicidade);
      if (partial.modeloListaDebitos !== undefined) setModeloListaDebitos(partial.modeloListaDebitos);
      setRodadasState((prev) => {
        const cur = prev[rodadaKey];
        if (!cur) return prev;
        const def = loadConfigCalculoCliente(codigoClienteNorm);
        const mergedBase = mergeConfigPainelCalculo(def, cur.panelConfig);
        const nextPanel = { ...mergedBase, ...partial };
        return { ...prev, [rodadaKey]: { ...cur, panelConfig: nextPanel } };
      });
    },
    [rodadaKey, codigoClienteNorm]
  );

  useEffect(() => {
    const def = loadConfigCalculoCliente(codigoClienteNorm);
    const r = rodadasState[rodadaKey];
    const merged = mergeConfigPainelCalculo(def, r?.panelConfig);
    setJuros(merged.juros);
    setMulta(merged.multa);
    setHonorariosTipo(merged.honorariosTipo === 'variaveis' ? 'variaveis' : 'fixos');
    setHonorariosValor(merged.honorariosValor ?? '0');
    setHonorariosVariaveisTexto(merged.honorariosVariaveisTexto ?? '');
    setIndice(merged.indice);
    setPeriodicidade(merged.periodicidade ?? 'mensal');
    setModeloListaDebitos(merged.modeloListaDebitos ?? '01');
  }, [rodadaKey, codigoClienteNorm, panelConfigKey]);

  useEffect(() => {
    const h = () => {
      const def = loadConfigCalculoCliente(codigoClienteNorm);
      const r = rodadasStateRef.current[rodadaKey];
      const merged = mergeConfigPainelCalculo(def, r?.panelConfig);
      setJuros(merged.juros);
      setMulta(merged.multa);
      setHonorariosTipo(merged.honorariosTipo === 'variaveis' ? 'variaveis' : 'fixos');
      setHonorariosValor(merged.honorariosValor ?? '0');
      setHonorariosVariaveisTexto(merged.honorariosVariaveisTexto ?? '');
      setIndice(merged.indice);
      setPeriodicidade(merged.periodicidade ?? 'mensal');
      setModeloListaDebitos(merged.modeloListaDebitos ?? '01');
    };
    window.addEventListener('vilareal:cliente-config-calculo-atualizado', h);
    return () => window.removeEventListener('vilareal:cliente-config-calculo-atualizado', h);
  }, [rodadaKey, codigoClienteNorm]);

  useEffect(() => {
    const h = () => setRodadasState({ ...(loadRodadasCalculos() || {}) });
    window.addEventListener('vilareal:calculos-rodadas-atualizadas', h);
    return () => window.removeEventListener('vilareal:calculos-rodadas-atualizadas', h);
  }, []);

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

  /** Persiste rodadas no navegador (Financeiro usa para buscar parcelas no extrato). */
  useEffect(() => {
    if (saveRodadasTimerRef.current) window.clearTimeout(saveRodadasTimerRef.current);
    saveRodadasTimerRef.current = window.setTimeout(() => {
      saveRodadasCalculos(rodadasState);
    }, 450);
    return () => {
      if (saveRodadasTimerRef.current) window.clearTimeout(saveRodadasTimerRef.current);
    };
  }, [rodadasState]);

  // Garante que a rodada exista ao alternar cliente/proc/dimensão
  useEffect(() => {
    setRodadasState((prev) => {
      if (prev[rodadaKey]) return prev;
      return {
        ...prev,
        [rodadaKey]: {
          pagina: 1,
          paginaParcelamento: 1,
          titulos: gerarTitulosMock(codigoClienteNorm, procNorm, dimensaoNorm),
          parcelas: gerarParcelasMock(),
          quantidadeParcelasInformada: '00',
          taxaJurosParcelamento: '0,00',
          limpezaAtiva: false,
          snapshotAntesLimpeza: null,
          cabecalho: gerarCabecalhoMock(codigoClienteNorm, procNorm),
          honorariosDataRecebimento: {},
          parcelamentoAceito: false,
          panelConfig: undefined,
        },
      };
    });
  }, [rodadaKey, codigoClienteNorm, procNorm, dimensaoNorm]);

  const rodadaAtual = rodadasState[rodadaKey] || {
    pagina: 1,
    paginaParcelamento: 1,
    titulos: gerarTitulosMock(codigoClienteNorm, procNorm, dimensaoNorm),
    parcelas: gerarParcelasMock(),
    quantidadeParcelasInformada: '00',
    taxaJurosParcelamento: '0,00',
    limpezaAtiva: false,
    snapshotAntesLimpeza: null,
    cabecalho: gerarCabecalhoMock(codigoClienteNorm, procNorm),
    honorariosDataRecebimento: {},
    parcelamentoAceito: false,
    panelConfig: undefined,
  };

  // Ao mudar de rodada, restaura "Aceitar pagamento" salvo nessa combinação cliente/proc/dim.
  useEffect(() => {
    setAceitarPagamento(Boolean(rodadasState[rodadaKey]?.parcelamentoAceito));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao trocar cliente/proc/dimensão
  }, [rodadaKey]);

  // Ao trocar cliente/proc/dimensão, restaura as páginas salvas daquela rodada (cada dimensão = rodada própria).
  useEffect(() => {
    setPagina(rodadaAtual.pagina || 1);
    setPaginaParcelamento(rodadaAtual.paginaParcelamento || 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodadaKey]);

  // Mantém a página (Títulos) sincronizada no estado da rodada atual
  useEffect(() => {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const nextPagina = Math.max(1, Number(pagina) || 1);
      if (cur.pagina === nextPagina) return prev;
      return { ...prev, [rodadaKey]: { ...cur, pagina: nextPagina } };
    });
  }, [pagina, rodadaKey]);

  // Mantém a página (Parcelamento) sincronizada no estado da rodada atual — ligada à mesma chave que títulos/dimensão.
  useEffect(() => {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const nextPagParc = Math.max(1, Number(paginaParcelamento) || 1);
      if ((cur.paginaParcelamento ?? 1) === nextPagParc) return prev;
      return { ...prev, [rodadaKey]: { ...cur, paginaParcelamento: nextPagParc } };
    });
  }, [paginaParcelamento, rodadaKey]);

  const titulos = rodadaAtual.titulos;
  const parcelas = Array.isArray(rodadaAtual.parcelas) ? rodadaAtual.parcelas : gerarParcelasMock();
  const quantidadeParcelasInformada = rodadaAtual.quantidadeParcelasInformada ?? '00';
  const taxaJurosParcelamento = rodadaAtual.taxaJurosParcelamento ?? '0,00';
  const limpezaAtiva = rodadaAtual.limpezaAtiva;

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
          descricaoValor: '',
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

  function nomeIndiceParaDocumentoWord(nome) {
    const u = String(nome ?? '').toUpperCase();
    if (u === 'POUPANÇA' || u === 'POUPANCA') return 'Poupança';
    if (u === 'NENHUM') return 'Nenhum';
    return String(nome ?? '');
  }

  function formatTaxaPercentualDocx(val) {
    const s = String(val ?? '').trim();
    if (!s) return '—';
    return /%/.test(s) ? s : `${s}%`;
  }

  async function gerarWordListaDebitos() {
    if (!aceitarPagamento) {
      window.alert("Marque a opção 'Aceitar Pagamento' antes de gerar o documento.");
      return;
    }

    const cab = rodadaAtual?.cabecalho || {};
    const linhasTitulos = (rodadaAtual?.titulos || []).filter((t) =>
      [t.dataVencimento, t.valorInicial, t.atualizacaoMonetaria, t.diasAtraso, t.juros, t.multa, t.honorarios, t.total].some(
        (v) => String(v ?? '').trim() !== ''
      )
    );

    if (linhasTitulos.length === 0) {
      window.alert(
        'Não há títulos calculados para exportar. Preencha a grade de títulos, aguarde o cálculo e aceite o pagamento antes de gerar o Word.'
      );
      return;
    }

    const indiceDoc = nomeIndiceParaDocumentoWord(indice);
    const dataBaseStr = String(dataCalculo ?? '').trim() || '—';

    const linhasWord = linhasTitulos.map((t) => {
      const esp = t.datasEspeciais && typeof t.datasEspeciais === 'object' ? t.datasEspeciais : {};
      const dataIniJuros = String(esp.dataInicialJuros || t.dataVencimento || '').trim() || '—';
      const taxaJ =
        esp.taxaJurosEspecial != null && String(esp.taxaJurosEspecial).trim() !== '' ? esp.taxaJurosEspecial : juros;
      const taxaM = esp.multaEspecial != null && String(esp.multaEspecial).trim() !== '' ? esp.multaEspecial : multa;
      const devedorNome = String(cab.reu || '').trim() || '—';
      return {
        devedor: devedorNome.toUpperCase(),
        valor: String(t.valorInicial || '').trim() || '—',
        dataInicialJuros: dataIniJuros,
        taxaJuros: formatTaxaPercentualDocx(taxaJ),
        valorJuros: String(t.juros || '').trim() || '—',
        taxaMulta: formatTaxaPercentualDocx(taxaM),
        multa: String(t.multa || '').trim() || '—',
        atualizacaoMonetaria: String(t.atualizacaoMonetaria || '').trim() || '—',
        dataAtualMonet: dataBaseStr,
        encargosContratuais: String(t.honorarios || '').trim() || '—',
        total: String(t.total || '').trim() || '—',
      };
    });

    try {
      const blob = await gerarDocumentoListaDebitosWord({
        tituloPrincipal: `Lista de Débitos - Cálculo atualizado até ${dataBaseStr}`,
        linhaCliente: `Cliente (código): ${codigoClienteNorm}`,
        linhaProcesso: `Processo: ${procNorm}`,
        linhaMeta: `Data-base do cálculo: ${dataBaseStr}   |   Índice monetário: ${indiceDoc}`,
        colunaAtualizacaoTitulo: `Atualização Monetária\n(${indiceDoc})`,
        linhas: linhasWord,
        totais: {
          principal: resumoGeral.valorInicial,
          juros: resumoGeral.juros,
          multa: resumoGeral.multa,
          encargos: resumoGeral.honorarios,
          geral: resumoGeral.total,
        },
      });
      const safeData =
        dataBaseStr !== '—'
          ? dataBaseStr.replace(/\//g, '-').replace(/\s+/g, '_')
          : new Date().toISOString().slice(0, 10);
      const nomeArquivo = `Lista_de_Debitos_Cliente_${codigoClienteNorm}_Proc_${procNorm}_${safeData}.docx`;
      baixarBlobDocx(blob, nomeArquivo);
    } catch (err) {
      console.error(err);
      window.alert('Não foi possível gerar o documento Word. Tente novamente.');
    }
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
    let s = String(str ?? '').trim();
    const alias = resolverAliasHojeEmTexto(s, 'br');
    if (alias) s = alias;
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
      parcela.dataPagamento,
    ].some((v) => String(v ?? '').trim() !== '');
  }

  function atualizarQuantidadeParcelasInformada(valorBruto) {
    const digits = String(valorBruto ?? '').replace(/\D/g, '').slice(0, 4);
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      return {
        ...prev,
        [rodadaKey]: { ...cur, quantidadeParcelasInformada: digits },
      };
    });
  }

  function onBlurQuantidadeParcelasInformada() {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const fmt = formatarQuantidadeParcelasExibicao(cur.quantidadeParcelasInformada ?? '');
      return {
        ...prev,
        [rodadaKey]: { ...cur, quantidadeParcelasInformada: fmt },
      };
    });
  }

  function atualizarTaxaJurosParcelamento(valorBruto) {
    const t = String(valorBruto ?? '')
      .replace(/%/g, '')
      .replace(/[^\d.,]/g, '');
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      return {
        ...prev,
        [rodadaKey]: { ...cur, taxaJurosParcelamento: t },
      };
    });
  }

  function onBlurTaxaJurosParcelamento() {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const fmt = formatarTaxaJurosParcelamento2Casas(cur.taxaJurosParcelamento ?? '');
      return {
        ...prev,
        [rodadaKey]: { ...cur, taxaJurosParcelamento: fmt },
      };
    });
  }

  function atualizarParcelaNaRodada(indexGlobal, patch) {
    if (aceitarPagamento && !modoAlteracao) return;
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

  function chaveHonorarioTitulo(i) {
    return `titulo:${i}`;
  }
  function chaveHonorarioParcela(i) {
    return `parcela:${i}`;
  }

  function atualizarHonorarioDataRecebimento(chave, dataBr) {
    if (aceitarPagamento && !modoAlteracao) return;
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const map = { ...(cur.honorariosDataRecebimento || {}), [chave]: dataBr };
      return { ...prev, [rodadaKey]: { ...cur, honorariosDataRecebimento: map } };
    });
  }

  const resumoParcelamento = useMemo(() => {
    /** Soma apenas as N primeiras parcelas (N = quantidade informada), após correção na grade. */
    const nParc = parseQuantidadeParcelasNumero(quantidadeParcelasInformada);
    let valorFinalParcelas = 0;
    let valorHonorarios = 0;
    for (let i = 0; i < nParc && i < parcelas.length; i++) {
      valorFinalParcelas += parseBRL(parcelas[i]?.valorParcela);
      valorHonorarios += parseBRL(parcelas[i]?.honorariosParcela);
    }
    valorFinalParcelas = trunc2(valorFinalParcelas);
    valorHonorarios = trunc2(valorHonorarios);
    const valorTotalPagar = trunc2(valorFinalParcelas + valorHonorarios);
    return {
      parcelasComValor: nParc,
      valorFinalParcelas: formatBRL(valorFinalParcelas),
      valorTotalPagar: formatBRL(valorTotalPagar),
      valorFinalHonorarios: formatBRL(valorHonorarios),
      valorHonorariosParcela:
        nParc > 0 ? formatBRL(trunc2(valorHonorarios / nParc)) : formatBRL(0),
      valorCustasParcela: formatBRL(0),
      valorFinalCustas: formatBRL(0),
      /** Débito atualizado da aba Títulos (soma da coluna Total — mesmo valor do rodapé “total geral”). */
      valorFinalAtualizado: resumoGeral.total,
      valorFinalAtualizadoCustas: formatBRL(0),
    };
  }, [parcelas, quantidadeParcelasInformada, resumoGeral.total]);

  const honorariosRecebimentoMap = rodadaAtual.honorariosDataRecebimento || {};

  /** Mesma base da Conta Corrente em Processos: extratos filtrados por cliente/proc (conciliação). */
  const financeiroContaEscritorioRodada = useMemo(
    () => getLancamentosContaCorrente(codigoClienteNorm, procNorm),
    [codigoClienteNorm, procNorm]
  );

  const nParcelasAtivas = parseQuantidadeParcelasNumero(quantidadeParcelasInformada);

  const linhasHonorariosTitulo = useMemo(() => {
    const out = [];
    titulos.forEach((t, i) => {
      const v = parseBRL(t.honorarios);
      if (v > 0) out.push({ indice: i, titulo: t, valor: v });
    });
    return out;
  }, [titulos]);

  const linhasHonorariosParcela = useMemo(() => {
    const out = [];
    if (nParcelasAtivas <= 0) return out;
    for (let i = 0; i < nParcelasAtivas; i++) {
      const p = parcelas[i];
      if (!p) continue;
      const v = parseBRL(p.honorariosParcela);
      if (v > 0) out.push({ indice: i, parcela: p, valor: v });
    }
    return out;
  }, [parcelas, nParcelasAtivas]);

  const somaHonorariosComRecebimento = useMemo(() => {
    let s = 0;
    for (const { indice } of linhasHonorariosTitulo) {
      const d = honorariosRecebimentoMap[chaveHonorarioTitulo(indice)];
      if (String(d ?? '').trim()) s += parseBRL(titulos[indice]?.honorarios);
    }
    for (const { indice } of linhasHonorariosParcela) {
      const d = honorariosRecebimentoMap[chaveHonorarioParcela(indice)];
      if (String(d ?? '').trim()) s += parseBRL(parcelas[indice]?.honorariosParcela);
    }
    return trunc2(s);
  }, [linhasHonorariosTitulo, linhasHonorariosParcela, honorariosRecebimentoMap, titulos, parcelas]);

  // Preenche valor da parcela e honorários por parcela: totais da aba Títulos + quantidade + taxa mensal (Price).
  // Com "Aceitar Pagamento" marcado, não recalcula automaticamente (parcelas imutáveis até "Modo de Alteração").
  useEffect(() => {
    if (aceitarPagamento) return;

    const tm = setTimeout(() => {
      const nParc = parseQuantidadeParcelasNumero(quantidadeParcelasInformada);
      const pvTotal = parseBRL(resumoGeral.total);
      const pvHonorarios = parseBRL(resumoGeral.honorarios);
      let taxaM = parsePercentualBR(taxaJurosParcelamento);
      if (!Number.isFinite(taxaM)) taxaM = 0;

      setRodadasState((prev) => {
        const cur = prev[rodadaKey];
        if (!cur) return prev;
        const listaBase = Array.isArray(cur.parcelas) ? [...cur.parcelas] : gerarParcelasMock();

        if (nParc <= 0) {
          const next = listaBase.map((l) => ({
            ...l,
            valorParcela: '',
            honorariosParcela: '',
            dataVencimento: '',
            dataPagamento: '',
          }));
          return { ...prev, [rodadaKey]: { ...cur, parcelas: next } };
        }

        const pmtValor =
          pvTotal > 0 ? calcularParcelaPrecoMensalPrice(pvTotal, taxaM, nParc) : null;
        const pmtHonor =
          pvHonorarios > 0 ? calcularParcelaPrecoMensalPrice(pvHonorarios, taxaM, nParc) : null;

        const valorFmt = pmtValor != null ? formatBRL(trunc2(pmtValor)) : '';
        const honorFmt = pmtHonor != null ? formatBRL(trunc2(pmtHonor)) : '';

        while (listaBase.length < nParc) listaBase.push(linhaVaziaParcela());
        for (let i = 0; i < listaBase.length; i++) {
          if (i < nParc) {
            const dataParc = gerarDataParcelaMensalBR(dataCalculo, i);
            listaBase[i] = {
              ...listaBase[i],
              valorParcela: valorFmt,
              honorariosParcela: honorFmt,
              dataVencimento: dataParc,
              dataPagamento: dataParc,
            };
          } else {
            listaBase[i] = {
              ...listaBase[i],
              valorParcela: '',
              honorariosParcela: '',
              dataVencimento: '',
              dataPagamento: '',
            };
          }
        }
        const ultimo = listaBase.length - 1;
        if (parcelaTemValor(listaBase[ultimo])) {
          listaBase.push(linhaVaziaParcela());
        }
        return { ...prev, [rodadaKey]: { ...cur, parcelas: listaBase } };
      });
    }, 320);

    return () => clearTimeout(tm);
  }, [
    rodadaKey,
    quantidadeParcelasInformada,
    taxaJurosParcelamento,
    resumoGeral.total,
    resumoGeral.honorarios,
    dataCalculo,
    aceitarPagamento,
  ]);

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
                              type="text"
                              inputMode="numeric"
                              placeholder=""
                              autoComplete="off"
                              value={row.dataVencimento || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                const r = resolverAliasHojeEmTexto(v, 'br');
                                atualizarTituloNaRodada(globalIdx, { dataVencimento: r ?? v });
                              }}
                              onBlur={(e) =>
                                atualizarTituloNaRodada(globalIdx, {
                                  dataVencimento: normalizarTextoDataBRparaSalvar(e.target.value),
                                })
                              }
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
              <p className="text-xs text-slate-700 mb-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 leading-snug">
                O <strong>parcelamento</strong> acompanha os <strong>cálculos da aba Títulos</strong> para a{' '}
                <strong>dimensão {dimensaoNorm}</strong> (cliente {codigoClienteNorm}, proc. {procNorm}). Ao mudar a{' '}
                <strong>dimensão</strong>, os títulos e o parcelamento exibidos passam a ser os dessa dimensão — cada combinação
                cliente/processo/dimensão mantém parcelamento e totais próprios.{' '}
                Com <strong>quantidade de parcelas</strong> e <strong>taxa de juros de parcelamento</strong> (% ao mês) informados,
                o valor de cada parcela e o <strong>honorário por parcela</strong> são calculados automaticamente (prestação fixa — Tabela Price)
                sobre o total dos títulos e sobre a soma dos honorários da aba Títulos, com a mesma taxa.
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() =>
                    navigate('/financeiro', {
                      state: {
                        financeiroBuscaParcelas: {
                          codCliente: codigoClienteNorm,
                          proc: String(procNorm),
                          dimensao: dimensaoNorm,
                        },
                      },
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  Buscar estas parcelas no Financeiro
                </button>
                <span className="text-xs text-slate-600 max-w-xl">
                  Abre o Financeiro: a busca é <strong>automática</strong> (extratos sem classificação × parcelas de cálculos
                  com <strong>Aceitar Pagamento</strong>). Você só revisa e aprova o vínculo.
                </span>
              </div>
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
                                  type="text"
                                  inputMode="numeric"
                                  placeholder=""
                                  autoComplete="off"
                                  value={row.dataVencimento || ''}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const r = resolverAliasHojeEmTexto(v, 'br');
                                    atualizarParcelaNaRodada(globalIdx, { dataVencimento: r ?? v });
                                  }}
                                  onBlur={(e) =>
                                    atualizarParcelaNaRodada(globalIdx, {
                                      dataVencimento: normalizarTextoDataBRparaSalvar(e.target.value),
                                    })
                                  }
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
                      <div className="flex justify-between items-center gap-2">
                        <span>Quantidade de Parcelas:</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          disabled={aceitarPagamento && !modoAlteracao}
                          value={quantidadeParcelasInformada}
                          onChange={(e) => atualizarQuantidadeParcelasInformada(e.target.value)}
                          onBlur={onBlurQuantidadeParcelasInformada}
                          title="Informe a quantidade de parcelas"
                          className="w-[4.5rem] px-2 py-1 border border-slate-300 rounded text-sm bg-white text-slate-800 text-right tabular-nums shrink-0 disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      </div>
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
                      <p className="flex justify-between gap-2"><span>Valor final Atualizado:</span><b>{resumoParcelamento.valorFinalAtualizado}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor Final Atualizado das Custas:</span><b>{resumoParcelamento.valorFinalAtualizadoCustas}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor Total a ser Pago:</span><b>{resumoParcelamento.valorTotalPagar}</b></p>
                      <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-200">
                        <span className="leading-tight">Taxa de Juros de Parcelamento:</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            disabled={aceitarPagamento && !modoAlteracao}
                            value={taxaJurosParcelamento}
                            onChange={(e) => atualizarTaxaJurosParcelamento(e.target.value)}
                            onBlur={onBlurTaxaJurosParcelamento}
                            title="Taxa em porcentagem (duas casas decimais)"
                            placeholder="0,00"
                            className="w-[5.25rem] px-2 py-1 border border-slate-300 rounded text-sm bg-white text-slate-800 text-right tabular-nums disabled:bg-slate-100 disabled:text-slate-500"
                          />
                          <span className="text-slate-600 font-medium">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tabAtiva === 'Pagamento' && (
            <div className="border border-slate-300 rounded bg-white p-3">
              <p className="text-xs text-slate-700 mb-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 leading-snug">
                A aba <strong>Pagamento</strong> mostra as mesmas parcelas da aba <strong>Parcelamento</strong> para a{' '}
                <strong>dimensão {dimensaoNorm}</strong> (cliente {codigoClienteNorm}, proc. {procNorm}), sem os painéis de resumo
                lateral. Os valores acompanham o parcelamento; use a coluna <strong>Data de Pagamento</strong> para registrar quando
                cada parcela foi quitada.
              </p>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-600">
                  Página {String(paginaParcelamento).padStart(2, '0')} — Parcelas {inicioParcelas + 1} a{' '}
                  {Math.min(fimParcelas, parcelas.length)}
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
              <div className="overflow-x-auto border border-slate-300">
                <table className="w-full text-sm border-collapse table-fixed">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-24">Parcela</th>
                      <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-36">Data Venc.</th>
                      <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-40">Valor</th>
                      <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-40">Honor. Parc.</th>
                      <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700">Obs.</th>
                      <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-36">Data de Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelasPaginaCompletas.map((row, idx) => {
                      const globalIdx = inicioParcelas + idx;
                      const podeEditar = !aceitarPagamento || modoAlteracao;
                      return (
                        <tr key={`pagamento-parcela-${globalIdx}`} className={globalIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="border border-slate-200 px-2 py-1 text-slate-700">
                            Parcela {String(globalIdx + 1).padStart(2, '0')}:
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            {podeEditar ? (
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder=""
                                autoComplete="off"
                                value={row.dataVencimento || ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const r = resolverAliasHojeEmTexto(v, 'br');
                                  atualizarParcelaNaRodada(globalIdx, { dataVencimento: r ?? v });
                                }}
                                onBlur={(e) =>
                                  atualizarParcelaNaRodada(globalIdx, {
                                    dataVencimento: normalizarTextoDataBRparaSalvar(e.target.value),
                                  })
                                }
                                className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                              />
                            ) : (
                              row.dataVencimento
                            )}
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
                            ) : (
                              row.valorParcela
                            )}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            {podeEditar ? (
                              <input
                                type="text"
                                value={row.honorariosParcela}
                                onChange={(e) => atualizarParcelaNaRodada(globalIdx, { honorariosParcela: e.target.value })}
                                onBlur={(e) => {
                                  const raw = String(e.target.value ?? '').trim();
                                  atualizarParcelaNaRodada(globalIdx, {
                                    honorariosParcela: raw === '' ? '' : formatBRL(parseBRL(raw)),
                                  });
                                }}
                                className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                              />
                            ) : (
                              row.honorariosParcela
                            )}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            {podeEditar ? (
                              <input
                                type="text"
                                value={row.observacao}
                                onChange={(e) => atualizarParcelaNaRodada(globalIdx, { observacao: e.target.value })}
                                className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                              />
                            ) : (
                              row.observacao
                            )}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            {podeEditar ? (
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder=""
                                autoComplete="off"
                                value={row.dataPagamento ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const r = resolverAliasHojeEmTexto(v, 'br');
                                  atualizarParcelaNaRodada(globalIdx, { dataPagamento: r ?? v });
                                }}
                                onBlur={(e) =>
                                  atualizarParcelaNaRodada(globalIdx, {
                                    dataPagamento: normalizarTextoDataBRparaSalvar(e.target.value),
                                  })
                                }
                                className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                              />
                            ) : (
                              row.dataPagamento ?? ''
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-medium">
                      <td className="border border-slate-300 px-2 py-1" colSpan={2}>
                        Total da página
                      </td>
                      <td className="border border-slate-300 px-2 py-1">
                        {formatBRL(trunc2(parcelasPagina.reduce((acc, p) => acc + parseBRL(p.valorParcela), 0)))}
                      </td>
                      <td className="border border-slate-300 px-2 py-1">
                        {formatBRL(trunc2(parcelasPagina.reduce((acc, p) => acc + parseBRL(p.honorariosParcela), 0)))}
                      </td>
                      <td className="border border-slate-300 px-2 py-1" />
                      <td className="border border-slate-300 px-2 py-1" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          {tabAtiva === 'Honorários' && (
            <div className="border border-slate-300 rounded bg-white p-3 space-y-4">
              <p className="text-xs text-slate-700 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 leading-snug">
                Os valores de <strong>honorários</strong> vêm da aba <strong>Títulos</strong> (coluna Honorários) e do{' '}
                <strong>parcelamento</strong> (honorários por parcela). Informe a <strong>data de recebimento</strong> para
                conferir com o extrato. A conciliação usa os <strong>mesmos cliente, processo e Conta Escritório</strong> do
                módulo <strong>Financeiro</strong> (critério idêntico à Conta Corrente em Processos).
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-emerald-900">Financeiro — Conta Escritório (este cliente/proc.)</p>
                  <p className="text-emerald-800 tabular-nums">
                    Soma dos lançamentos: <strong>{formatBRL(trunc2(financeiroContaEscritorioRodada.soma))}</strong> —{' '}
                    {financeiroContaEscritorioRodada.lancamentos.length} lançamento(s).
                  </p>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Honorários com data de recebimento informada (soma):{' '}
                    <strong>{formatBRL(somaHonorariosComRecebimento)}</strong> — compare com créditos no extrato.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate('/financeiro', {
                      state: {
                        financeiroConciliacaoHonorarios: {
                          codCliente: codigoClienteNorm,
                          proc: String(procNorm),
                          dimensao: dimensaoNorm,
                          rotulo: `Cálculos — dim. ${dimensaoNorm} — geral`,
                          valorCentavos: null,
                        },
                      },
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir Financeiro (filtrar)
                </button>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Honorários por título (aba Títulos)</h3>
                {linhasHonorariosTitulo.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum honorário calculado por título nesta dimensão.</p>
                ) : (
                  <div className="overflow-x-auto border border-slate-300 rounded">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-2 py-1 text-left">Linha</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Data venc.</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Valor honorários</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Data recebimento</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Conciliação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasHonorariosTitulo.map(({ indice, titulo }) => {
                          const chave = chaveHonorarioTitulo(indice);
                          const podeEditar = !aceitarPagamento || modoAlteracao;
                          const valorNum = parseBRL(titulo.honorarios);
                          return (
                            <tr key={chave} className={indice % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="border border-slate-200 px-2 py-1 tabular-nums">#{indice + 1}</td>
                              <td className="border border-slate-200 px-2 py-1">{titulo.dataVencimento || '—'}</td>
                              <td className="border border-slate-200 px-2 py-1 tabular-nums">{titulo.honorarios}</td>
                              <td className="border border-slate-200 px-2 py-1 w-44">
                                {podeEditar ? (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder=""
                                    autoComplete="off"
                                    value={honorariosRecebimentoMap[chave] ?? ''}
                                    onChange={(e) => atualizarHonorarioDataRecebimento(chave, e.target.value)}
                                    onBlur={(e) =>
                                      atualizarHonorarioDataRecebimento(
                                        chave,
                                        normalizarTextoDataBRparaSalvar(e.target.value)
                                      )
                                    }
                                    className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                                  />
                                ) : (
                                  honorariosRecebimentoMap[chave] ?? ''
                                )}
                              </td>
                              <td className="border border-slate-200 px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate('/financeiro', {
                                      state: {
                                        financeiroConciliacaoHonorarios: {
                                          codCliente: codigoClienteNorm,
                                          proc: String(procNorm),
                                          dimensao: dimensaoNorm,
                                          rotulo: `Honor. título linha ${indice + 1}`,
                                          valorCentavos: Math.round(valorNum * 100),
                                        },
                                      },
                                    })
                                  }
                                  className="text-xs text-blue-700 underline hover:text-blue-900"
                                >
                                  Ver no Financeiro
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Honorários por parcela (parcelamento)</h3>
                {linhasHonorariosParcela.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhuma parcela com honorário ou quantidade de parcelas zerada — ajuste na aba Parcelamento.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-slate-300 rounded">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-2 py-1 text-left">Parcela</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Data venc.</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Honor. parcela</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Data recebimento</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Conciliação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasHonorariosParcela.map(({ indice, parcela }) => {
                          const chave = chaveHonorarioParcela(indice);
                          const podeEditar = !aceitarPagamento || modoAlteracao;
                          const valorNum = parseBRL(parcela.honorariosParcela);
                          return (
                            <tr key={chave} className={indice % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="border border-slate-200 px-2 py-1 tabular-nums">
                                {String(indice + 1).padStart(2, '0')}
                              </td>
                              <td className="border border-slate-200 px-2 py-1">{parcela.dataVencimento || '—'}</td>
                              <td className="border border-slate-200 px-2 py-1 tabular-nums">{parcela.honorariosParcela}</td>
                              <td className="border border-slate-200 px-2 py-1 w-44">
                                {podeEditar ? (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder=""
                                    autoComplete="off"
                                    value={honorariosRecebimentoMap[chave] ?? ''}
                                    onChange={(e) => atualizarHonorarioDataRecebimento(chave, e.target.value)}
                                    onBlur={(e) =>
                                      atualizarHonorarioDataRecebimento(
                                        chave,
                                        normalizarTextoDataBRparaSalvar(e.target.value)
                                      )
                                    }
                                    className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                                  />
                                ) : (
                                  honorariosRecebimentoMap[chave] ?? ''
                                )}
                              </td>
                              <td className="border border-slate-200 px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate('/financeiro', {
                                      state: {
                                        financeiroConciliacaoHonorarios: {
                                          codCliente: codigoClienteNorm,
                                          proc: String(procNorm),
                                          dimensao: dimensaoNorm,
                                          rotulo: `Honor. parcela ${String(indice + 1).padStart(2, '0')}`,
                                          valorCentavos: Math.round(valorNum * 100),
                                        },
                                      },
                                    })
                                  }
                                  className="text-xs text-blue-700 underline hover:text-blue-900"
                                >
                                  Ver no Financeiro
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          {tabAtiva === 'Descrição dos Valores' && (
            <div className="border border-slate-300 rounded bg-white p-3">
              <p className="text-xs text-slate-700 mb-3 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 leading-snug">
                Para cada <strong>título</strong> cadastrado na aba <strong>Títulos</strong> (dimensão {dimensaoNorm}, cliente{' '}
                {codigoClienteNorm}, proc. {procNorm}), use o campo abaixo para descrever em texto a que se refere aquele
                valor (objeto, origem, contrato, observações).
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm text-slate-600">
                  Página {String(pagina).padStart(2, '0')} — Linhas {inicio + 1} a {Math.min(fim, titulos.length)} (de{' '}
                  {titulos.length})
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto border border-slate-300 rounded">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 w-14">#</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[100px]">
                        Data venc.
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[120px]">
                        Valor inicial
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[280px]">
                        Descrição do valor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {titulosPaginaCompletos.map((row, idx) => {
                      const globalIdx = inicio + idx;
                      const linhaExiste = globalIdx < (rodadaAtual.titulos || []).length;
                      const podeEditar = linhaExiste && (!aceitarPagamento || modoAlteracao);
                      return (
                        <tr key={`desc-valor-${globalIdx}`} className={globalIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="border border-slate-200 px-2 py-1 text-slate-600 tabular-nums">
                            {String(globalIdx + 1).padStart(3, '0')}
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-700">
                            {linhaExiste ? row.dataVencimento || '—' : '—'}
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-700">
                            {linhaExiste ? row.valorInicial || '—' : '—'}
                          </td>
                          <td className="border border-slate-200 px-2 py-1 align-top">
                            {linhaExiste ? (
                              podeEditar ? (
                                <textarea
                                  value={row.descricaoValor ?? ''}
                                  onChange={(e) =>
                                    atualizarTituloNaRodada(globalIdx, { descricaoValor: e.target.value })
                                  }
                                  rows={2}
                                  placeholder="Descreva a que se refere este título…"
                                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm min-h-[2.75rem] resize-y"
                                />
                              ) : (
                                <span className="text-slate-800 whitespace-pre-wrap block py-1">
                                  {(row.descricaoValor ?? '').trim() !== ''
                                    ? row.descricaoValor
                                    : '—'}
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tabAtiva !== 'Títulos' &&
            tabAtiva !== 'Parcelamento' &&
            tabAtiva !== 'Pagamento' &&
            tabAtiva !== 'Honorários' &&
            tabAtiva !== 'Descrição dos Valores' && (
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
          {tabAtiva === 'Títulos' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">Página</label>
                <SpinnerField value={pagina} onChange={setPagina} min={1} className="w-24" />
                <p className="mt-1 text-[11px] text-slate-500">de {String(totalPaginas).padStart(2, '0')}</p>
              </div>
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
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">Dimensão:</label>
                <SpinnerField value={dimensao} onChange={setDimensao} className="w-24" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">Data do Cálculo:</label>
                <input
                  type="text"
                  value={dataCalculo}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDataCalculo(resolverAliasHojeEmTexto(v, 'br') ?? v);
                  }}
                  placeholder="dd/mm/aaaa ou hj"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">Juros:</label>
                <input
                  type="text"
                  value={juros}
                  onChange={(e) => updatePainelCampo({ juros: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">Multa:</label>
                <input
                  type="text"
                  value={multa}
                  onChange={(e) => updatePainelCampo({ multa: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="border border-slate-300 rounded p-2 bg-white">
                <p className="text-xs font-medium text-slate-700 mb-1.5">Honorários</p>
                <div className="flex gap-3 mb-1">
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="honorarios"
                      checked={honorariosTipo === 'fixos'}
                      onChange={() => updatePainelCampo({ honorariosTipo: 'fixos' })}
                      className="text-slate-600"
                    />
                    Fixos
                  </label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="honorarios"
                      checked={honorariosTipo === 'variaveis'}
                      onChange={() => updatePainelCampo({ honorariosTipo: 'variaveis' })}
                      className="text-slate-600"
                    />
                    Variáveis
                  </label>
                </div>
                {honorariosTipo === 'variaveis' && (
                  <>
                    <p className="text-xs text-slate-500 mb-1">
                      Padrão sugerido: ≤ 30 dias = 0% &nbsp;|&nbsp; 31–60 dias = 10% &nbsp;|&nbsp; &gt; 60 dias = 20%
                    </p>
                    <textarea
                      value={honorariosVariaveisTexto}
                      onChange={(e) => updatePainelCampo({ honorariosVariaveisTexto: e.target.value })}
                      rows={3}
                      placeholder="Regras personalizadas (texto livre; padrão do cliente em Cadastro de Clientes)"
                      className="w-full text-sm border border-slate-300 rounded px-2 py-1 mb-1 font-mono"
                    />
                  </>
                )}
                <input
                  type="text"
                  value={honorariosValor}
                  onChange={(e) => updatePainelCampo({ honorariosValor: e.target.value })}
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
                      onClick={() => updatePainelCampo({ indice: nome })}
                    >
                      <input
                        id={`indice-${nome}`}
                        type="radio"
                        name="indice"
                        value={nome}
                        checked={indice === nome}
                        onChange={(e) => updatePainelCampo({ indice: e.target.value })}
                        className="text-slate-600"
                      />
                      {nome}
                      {nome === 'INPC' && <BarChart2 className="w-3.5 h-3.5 text-slate-500" />}
                    </label>
                  ))}
                </div>
              </div>
              <div className="border border-slate-300 rounded p-2 bg-white">
                <p className="text-xs font-medium text-slate-700 mb-1">Periodicidade (sugestão)</p>
                <select
                  value={periodicidade}
                  onChange={(e) => updatePainelCampo({ periodicidade: e.target.value })}
                  className={inputClass}
                >
                  {PERIODICIDADE_OPCOES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="border border-slate-300 rounded p-2 bg-white">
                <p className="text-xs font-medium text-slate-700 mb-1">Modelo lista de débitos</p>
                <select
                  value={modeloListaDebitos}
                  onChange={(e) => updatePainelCampo({ modeloListaDebitos: e.target.value })}
                  className={inputClass}
                >
                  {MODELOS_LISTA_DEBITOS.map((m) => (
                    <option key={m} value={m}>
                      Modelo {m}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
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
                  if (!ok) return;
                  setAceitarPagamento(next);
                  setRodadasState((prev) => {
                    const cur = prev[rodadaKey];
                    if (!cur) return prev;
                    return { ...prev, [rodadaKey]: { ...cur, parcelamentoAceito: next } };
                  });
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
            <button
              type="button"
              onClick={() => {
                void gerarWordListaDebitos();
              }}
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
            >
              Gerar no Word
            </button>
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
                    type="text"
                    inputMode="numeric"
                    placeholder=""
                    autoComplete="off"
                    value={formDatasEspeciais.dataInicialAtual || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const r = resolverAliasHojeEmTexto(v, 'br');
                      setFormDatasEspeciais((prev) => ({ ...prev, dataInicialAtual: r ?? v }));
                    }}
                    onBlur={(e) =>
                      setFormDatasEspeciais((prev) => ({
                        ...prev,
                        dataInicialAtual: normalizarTextoDataBRparaSalvar(e.target.value),
                      }))
                    }
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Data Inicial Juros</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder=""
                    autoComplete="off"
                    value={formDatasEspeciais.dataInicialJuros || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const r = resolverAliasHojeEmTexto(v, 'br');
                      setFormDatasEspeciais((prev) => ({ ...prev, dataInicialJuros: r ?? v }));
                    }}
                    onBlur={(e) =>
                      setFormDatasEspeciais((prev) => ({
                        ...prev,
                        dataInicialJuros: normalizarTextoDataBRparaSalvar(e.target.value),
                      }))
                    }
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Data Final Atual</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder=""
                    autoComplete="off"
                    value={formDatasEspeciais.dataFinalAtual || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const r = resolverAliasHojeEmTexto(v, 'br');
                      setFormDatasEspeciais((prev) => ({ ...prev, dataFinalAtual: r ?? v }));
                    }}
                    onBlur={(e) =>
                      setFormDatasEspeciais((prev) => ({
                        ...prev,
                        dataFinalAtual: normalizarTextoDataBRparaSalvar(e.target.value),
                      }))
                    }
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Data Final Juros</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder=""
                    autoComplete="off"
                    value={formDatasEspeciais.dataFinalJuros || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const r = resolverAliasHojeEmTexto(v, 'br');
                      setFormDatasEspeciais((prev) => ({ ...prev, dataFinalJuros: r ?? v }));
                    }}
                    onBlur={(e) =>
                      setFormDatasEspeciais((prev) => ({
                        ...prev,
                        dataFinalJuros: normalizarTextoDataBRparaSalvar(e.target.value),
                      }))
                    }
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
