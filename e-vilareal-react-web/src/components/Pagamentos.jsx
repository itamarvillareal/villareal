import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  ClipboardList,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { listarUsuarios } from '../repositories/usuariosRepository.js';
import {
  anexarBoletoPagamento,
  anexarComprovantePagamento,
  atualizarPagamento,
  baixarAnexoPagamento,
  buscarPagamento,
  cancelarPagamento,
  carregarAlertasPagamentos,
  carregarDashboardPagamentos,
  criarPagamento,
  excluirPagamento,
  listarHistoricoPagamento,
  listarPagamentos,
  marcarPagamentoAgendado,
  marcarPagamentoPago,
  substituirPagamento,
} from '../repositories/pagamentosRepository.js';
import { featureFlags } from '../config/featureFlags.js';
import { getApiUsuarioSessao } from '../data/usuarioPermissoesStorage.js';
import { formatBRL } from '../data/relatorioCalculosData.js';

const CATEGORIAS = [
  'CONDOMINIO',
  'ALUGUEL',
  'TRIBUTO',
  'IMPOSTO',
  'ACORDO',
  'PARCELAMENTO',
  'CLIENTE',
  'FORNECEDOR',
  'PROCESSO_JUDICIAL',
  'FUNCIONARIO',
  'ENERGIA',
  'AGUA',
  'INTERNET',
  'SISTEMA_SOFTWARE',
  'ESCRITORIO',
  'VEICULO',
  'OBRA_REFORMA',
  'OUTROS',
];

const FORMAS_PAGAMENTO = [
  'BOLETO',
  'PIX',
  'TRANSFERENCIA',
  'TED_DOC',
  'CARTAO',
  'DEBITO_AUTOMATICO',
  'GUIA_JUDICIAL',
  'DEPOSITO_JUDICIAL',
  'DARF',
  'DAE',
  'GPS',
  'GRU',
  'OUTRO',
];

const STATUS_LIST = [
  'PENDENTE',
  'AGENDADO',
  'PAGO_CONFIRMADO',
  'PAGO_SEM_COMPROVANTE',
  'CONFERENCIA_PENDENTE',
  'VENCIDO',
  'CANCELADO',
  'SUBSTITUIDO',
];

const PRIORIDADES = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'];

const ROTULO_STATUS = {
  PENDENTE: 'Pendente',
  AGENDADO: 'Agendado',
  PAGO_CONFIRMADO: 'Pago confirmado',
  PAGO_SEM_COMPROVANTE: 'Pago sem comprovante',
  CONFERENCIA_PENDENTE: 'Conferência pendente',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
  SUBSTITUIDO: 'Substituído',
};

const ROTULO_ALERTA = {
  vencidos: 'Vencidos (não quitados)',
  vencendoHoje: 'Vencendo hoje',
  proximos3Dias: 'Próximos 3 dias',
  proximos7Dias: 'Próximos 7 dias',
  agendadosAguardandoConfirmacao: 'Agendados aguardando confirmação',
  conferenciaPendente: 'Conferência pendente',
  pagoSemComprovante: 'Pagos sem comprovante',
  altoValor: 'Alto valor (≥ R$ 10.000)',
  urgentes: 'Prioridade urgente',
};

function fmtData(iso) {
  if (iso == null || iso === '') return '—';
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function hojeIsoLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function addMeses(iso, meses) {
  const base = String(iso || '').slice(0, 10);
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) return hojeIsoLocal();
  d.setMonth(d.getMonth() + meses);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function classeLinhaStatus(st) {
  switch (st) {
    case 'PAGO_CONFIRMADO':
      return 'bg-emerald-50/90 dark:bg-emerald-950/35';
    case 'PAGO_SEM_COMPROVANTE':
      return 'bg-lime-50/90 dark:bg-lime-950/25';
    case 'AGENDADO':
      return 'bg-sky-50/90 dark:bg-sky-950/30';
    case 'CONFERENCIA_PENDENTE':
      return 'bg-orange-50/90 dark:bg-orange-950/30';
    case 'VENCIDO':
      return 'bg-red-50/90 dark:bg-red-950/35';
    case 'CANCELADO':
      return 'bg-slate-100/90 dark:bg-slate-800/50';
    case 'SUBSTITUIDO':
      return 'bg-violet-100/80 dark:bg-violet-950/40';
    default:
      return '';
  }
}

function valorNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function defaultForm() {
  return {
    dataCadastro: hojeIsoLocal(),
    dataAgendamento: '',
    dataVencimento: hojeIsoLocal(),
    codigoBarras: '',
    valor: '',
    descricao: '',
    categoria: 'OUTROS',
    formaPagamento: 'BOLETO',
    responsavelUsuarioId: '',
    status: 'PENDENTE',
    prioridade: 'NORMAL',
    origem: '',
    dataPagamentoEfetivo: '',
    observacoes: '',
    clienteId: '',
    processoId: '',
    imovelId: '',
    condominioTexto: '',
    contratoLocacaoId: '',
    fornecedorTexto: '',
    recorrente: false,
    recorrenciaTipo: 'MENSAL',
    recorrenciaQuantidadeParcelas: '',
    recorrenciaParcelaAtual: '',
    recorrenciaValorFixo: true,
    recorrenciaDescricaoPadrao: '',
    recorrenciaPagamentoOrigemId: '',
  };
}

function mapApiParaForm(p) {
  const f = defaultForm();
  if (!p) return f;
  f.dataCadastro = p.dataCadastro ? String(p.dataCadastro).slice(0, 10) : f.dataCadastro;
  f.dataAgendamento = p.dataAgendamento ? String(p.dataAgendamento).slice(0, 10) : '';
  f.dataVencimento = p.dataVencimento ? String(p.dataVencimento).slice(0, 10) : f.dataVencimento;
  f.codigoBarras = p.codigoBarras ?? '';
  f.valor = p.valor != null ? String(p.valor) : '';
  f.descricao = p.descricao ?? '';
  f.categoria = p.categoria ?? 'OUTROS';
  f.formaPagamento = p.formaPagamento ?? 'BOLETO';
  f.responsavelUsuarioId = p.responsavelUsuarioId != null ? String(p.responsavelUsuarioId) : '';
  f.status = p.status ?? 'PENDENTE';
  f.prioridade = p.prioridade ?? 'NORMAL';
  f.origem = p.origem ?? '';
  f.dataPagamentoEfetivo = p.dataPagamentoEfetivo ? String(p.dataPagamentoEfetivo).slice(0, 10) : '';
  f.observacoes = p.observacoes ?? '';
  f.clienteId = p.clienteId != null ? String(p.clienteId) : '';
  f.processoId = p.processoId != null ? String(p.processoId) : '';
  f.imovelId = p.imovelId != null ? String(p.imovelId) : '';
  f.condominioTexto = p.condominioTexto ?? '';
  f.contratoLocacaoId = p.contratoLocacaoId != null ? String(p.contratoLocacaoId) : '';
  f.fornecedorTexto = p.fornecedorTexto ?? '';
  f.recorrente = !!p.recorrente;
  f.recorrenciaTipo = p.recorrenciaTipo || 'MENSAL';
  f.recorrenciaQuantidadeParcelas =
    p.recorrenciaQuantidadeParcelas != null ? String(p.recorrenciaQuantidadeParcelas) : '';
  f.recorrenciaParcelaAtual = p.recorrenciaParcelaAtual != null ? String(p.recorrenciaParcelaAtual) : '';
  f.recorrenciaValorFixo = p.recorrenciaValorFixo !== false;
  f.recorrenciaDescricaoPadrao = p.recorrenciaDescricaoPadrao ?? '';
  f.recorrenciaPagamentoOrigemId =
    p.recorrenciaPagamentoOrigemId != null ? String(p.recorrenciaPagamentoOrigemId) : '';
  return f;
}

function montarPayloadWrite(f) {
  const vn = valorNum(f.valor);
  const parseOptLong = (s) => {
    const x = String(s ?? '').trim();
    if (x === '') return null;
    const n = Math.floor(Number(x));
    return Number.isFinite(n) && n >= 1 ? n : null;
  };
  const parseOptInt = (s) => {
    const x = String(s ?? '').trim();
    if (x === '') return null;
    const n = parseInt(x, 10);
    return Number.isFinite(n) ? n : null;
  };
  return {
    dataCadastro: f.dataCadastro || null,
    dataAgendamento: f.dataAgendamento ? f.dataAgendamento : null,
    dataVencimento: f.dataVencimento,
    codigoBarras: f.codigoBarras?.trim() || null,
    valor: vn,
    descricao: String(f.descricao || '').trim(),
    categoria: String(f.categoria || '').trim(),
    formaPagamento: String(f.formaPagamento || '').trim(),
    responsavelUsuarioId: parseOptLong(f.responsavelUsuarioId),
    status: String(f.status || '').trim(),
    prioridade: f.prioridade || 'NORMAL',
    origem: f.origem?.trim() || null,
    dataPagamentoEfetivo: f.dataPagamentoEfetivo ? f.dataPagamentoEfetivo : null,
    observacoes: f.observacoes?.trim() || null,
    clienteId: parseOptLong(f.clienteId),
    processoId: parseOptLong(f.processoId),
    imovelId: parseOptLong(f.imovelId),
    condominioTexto: f.condominioTexto?.trim() || null,
    contratoLocacaoId: parseOptLong(f.contratoLocacaoId),
    fornecedorTexto: f.fornecedorTexto?.trim() || null,
    recorrente: !!f.recorrente,
    recorrenciaTipo: f.recorrente ? f.recorrenciaTipo || null : null,
    recorrenciaQuantidadeParcelas: f.recorrente ? parseOptInt(f.recorrenciaQuantidadeParcelas) : null,
    recorrenciaParcelaAtual: f.recorrente ? parseOptInt(f.recorrenciaParcelaAtual) : null,
    recorrenciaValorFixo: f.recorrente ? !!f.recorrenciaValorFixo : null,
    recorrenciaDescricaoPadrao: f.recorrente ? f.recorrenciaDescricaoPadrao?.trim() || null : null,
    recorrenciaPagamentoOrigemId: parseOptLong(f.recorrenciaPagamentoOrigemId),
  };
}

export function Pagamentos() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [alertas, setAlertas] = useState({});
  const [usuarios, setUsuarios] = useState([]);

  const [filtros, setFiltros] = useState(() => ({
    descricao: '',
    codigoBarras: '',
    valor: '',
    status: '',
    categoria: '',
    responsavelUsuarioId: '',
    formaPagamento: '',
    prioridade: '',
    origem: '',
    vencimentoDe: '',
    vencimentoAte: '',
    agendamentoDe: '',
    agendamentoAte: '',
    clienteId: '',
    processoId: '',
    imovelId: '',
    condominio: '',
    somenteVencidos: false,
    somenteConferenciaPendente: false,
    proximos7Dias: false,
    mesAtual: false,
    somenteSemComprovante: false,
    altoValor: false,
  }));

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(() => defaultForm());
  const [salvando, setSalvando] = useState(false);

  const [histAberto, setHistAberto] = useState(false);
  const [histLinhas, setHistLinhas] = useState([]);
  const [histTitulo, setHistTitulo] = useState('');

  const [pagoModal, setPagoModal] = useState(null);
  const [pagoData, setPagoData] = useState(() => hojeIsoLocal());
  const [pagoSemComp, setPagoSemComp] = useState(false);

  const fileRef = useRef(null);
  const [uploadCtx, setUploadCtx] = useState(null);

  const apiUsuario = getApiUsuarioSessao();
  const podeExcluirLiberal =
    apiUsuario?.id === '1' ||
    (!featureFlags.requiresApiAuth && String(apiUsuario?.id || 'itamar') === 'itamar');

  const mesRefDashboard = useMemo(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  }, []);

  const montarQueryLista = useCallback(() => {
    const q = {};
    const trim = (s) => String(s ?? '').trim();
    if (trim(filtros.descricao)) q.descricao = trim(filtros.descricao);
    if (trim(filtros.codigoBarras)) q.codigoBarras = trim(filtros.codigoBarras);
    const vv = valorNum(filtros.valor);
    if (vv != null && vv > 0) q.valor = vv;
    if (trim(filtros.status)) q.status = trim(filtros.status);
    if (trim(filtros.categoria)) q.categoria = trim(filtros.categoria);
    const ru = trim(filtros.responsavelUsuarioId);
    if (ru && Number(ru) >= 1) q.responsavelUsuarioId = Number(ru);
    if (trim(filtros.formaPagamento)) q.formaPagamento = trim(filtros.formaPagamento);
    if (trim(filtros.prioridade)) q.prioridade = trim(filtros.prioridade);
    if (trim(filtros.origem)) q.origem = trim(filtros.origem);
    if (trim(filtros.vencimentoDe)) q.vencimentoDe = trim(filtros.vencimentoDe);
    if (trim(filtros.vencimentoAte)) q.vencimentoAte = trim(filtros.vencimentoAte);
    if (trim(filtros.agendamentoDe)) q.agendamentoDe = trim(filtros.agendamentoDe);
    if (trim(filtros.agendamentoAte)) q.agendamentoAte = trim(filtros.agendamentoAte);
    const cid = trim(filtros.clienteId);
    if (cid && Number(cid) >= 1) q.clienteId = Number(cid);
    const pid = trim(filtros.processoId);
    if (pid && Number(pid) >= 1) q.processoId = Number(pid);
    const iid = trim(filtros.imovelId);
    if (iid && Number(iid) >= 1) q.imovelId = Number(iid);
    if (trim(filtros.condominio)) q.condominio = trim(filtros.condominio);
    if (filtros.somenteVencidos) q.somenteVencidos = true;
    if (filtros.somenteConferenciaPendente) q.somenteConferenciaPendente = true;
    if (filtros.proximos7Dias) q.proximos7Dias = true;
    if (filtros.mesAtual) q.mesAtual = true;
    if (filtros.somenteSemComprovante) q.somenteSemComprovante = true;
    if (filtros.altoValor) q.altoValor = true;
    return q;
  }, [filtros]);

  const recarregarTudo = useCallback(async () => {
    setErro('');
    setCarregando(true);
    try {
      const q = montarQueryLista();
      const [rows, dash, al, us] = await Promise.all([
        listarPagamentos(q),
        carregarDashboardPagamentos(mesRefDashboard.ano, mesRefDashboard.mes),
        carregarAlertasPagamentos(),
        listarUsuarios(),
      ]);
      setLista(Array.isArray(rows) ? rows : []);
      setDashboard(dash || null);
      setAlertas(al && typeof al === 'object' ? al : {});
      setUsuarios(Array.isArray(us) ? us : []);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar pagamentos.');
    } finally {
      setCarregando(false);
    }
  }, [montarQueryLista, mesRefDashboard.ano, mesRefDashboard.mes]);

  useEffect(() => {
    void recarregarTudo();
  }, [recarregarTudo]);

  function abrirNovo() {
    setEditandoId(null);
    setForm(defaultForm());
    setModalAberto(true);
  }

  async function abrirEditar(id) {
    setErro('');
    try {
      const p = await buscarPagamento(id);
      setEditandoId(id);
      setForm(mapApiParaForm(p));
      setModalAberto(true);
    } catch (e) {
      setErro(e?.message || 'Não foi possível abrir o pagamento.');
    }
  }

  async function salvarModal() {
    const payload = montarPayloadWrite(form);
    if (
      !payload.descricao ||
      !payload.categoria ||
      !payload.formaPagamento ||
      !payload.status ||
      !payload.dataVencimento
    ) {
      setErro('Preencha descrição, categoria, forma de pagamento, status e vencimento.');
      return;
    }
    if (payload.valor == null || payload.valor <= 0) {
      setErro('Informe um valor maior que zero.');
      return;
    }
    if (payload.dataAgendamento && payload.dataVencimento && payload.dataAgendamento > payload.dataVencimento) {
      const ok = window.confirm(
        'A data de agendamento é posterior ao vencimento. Deseja continuar mesmo assim?',
      );
      if (!ok) return;
    }
    setSalvando(true);
    setErro('');
    try {
      if (editandoId) {
        await atualizarPagamento(editandoId, payload);
      } else {
        await criarPagamento(payload);
      }
      setModalAberto(false);
      await recarregarTudo();
    } catch (e) {
      setErro(e?.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function copiarBarras(txt) {
    const s = String(txt ?? '').trim();
    if (!s) return;
    try {
      await navigator.clipboard.writeText(s);
    } catch {
      setErro('Não foi possível copiar para a área de transferência.');
    }
  }

  async function acaoMarcarAgendado(id) {
    setErro('');
    try {
      await marcarPagamentoAgendado(id);
      await recarregarTudo();
    } catch (e) {
      setErro(e?.message || 'Falha ao marcar como agendado.');
    }
  }

  function acaoAbrirPago(row) {
    setPagoModal(row.id);
    setPagoData(row.dataPagamentoEfetivo ? String(row.dataPagamentoEfetivo).slice(0, 10) : hojeIsoLocal());
    setPagoSemComp(false);
  }

  async function acaoConfirmarPago() {
    if (!pagoModal) return;
    setErro('');
    try {
      await marcarPagamentoPago(pagoModal, {
        dataPagamentoEfetivo: pagoData,
        semComprovante: pagoSemComp,
      });
      setPagoModal(null);
      await recarregarTudo();
    } catch (e) {
      setErro(e?.message || 'Falha ao marcar como pago.');
    }
  }

  async function acaoCancelar(row) {
    const obs = window.prompt('Observação do cancelamento (opcional):') ?? '';
    setErro('');
    try {
      await cancelarPagamento(row.id, obs);
      await recarregarTudo();
    } catch (e) {
      setErro(e?.message || 'Falha ao cancelar.');
    }
  }

  async function acaoSubstituir(id) {
    const raw = window.prompt('Informe o ID do novo pagamento que substitui este registro:');
    if (raw == null) return;
    const novoId = Math.floor(Number(String(raw).trim()));
    if (!Number.isFinite(novoId) || novoId < 1) {
      setErro('ID inválido.');
      return;
    }
    setErro('');
    try {
      await substituirPagamento(id, novoId);
      await recarregarTudo();
    } catch (e) {
      setErro(e?.message || 'Falha ao substituir.');
    }
  }

  async function acaoExcluir(row) {
    if (['PAGO_CONFIRMADO', 'PAGO_SEM_COMPROVANTE'].includes(row.status) && !podeExcluirLiberal) {
      setErro('Apenas administrador pode excluir pagamento já pago.');
      return;
    }
    if (
      !window.confirm(
        `Excluir o pagamento #${row.id} (${row.descricao?.slice(0, 80) || ''})? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setErro('');
    try {
      await excluirPagamento(row.id);
      await recarregarTudo();
    } catch (e) {
      setErro(e?.message || 'Falha ao excluir.');
    }
  }

  async function acaoHistorico(row) {
    setErro('');
    try {
      const h = await listarHistoricoPagamento(row.id);
      setHistLinhas(Array.isArray(h) ? h : []);
      setHistTitulo(`Histórico — #${row.id} ${row.descricao || ''}`);
      setHistAberto(true);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar histórico.');
    }
  }

  function dispararUpload(id, tipo) {
    setUploadCtx({ id, tipo });
    requestAnimationFrame(() => fileRef.current?.click());
  }

  async function onFileSelecionado(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file || !uploadCtx) return;
    setErro('');
    try {
      if (uploadCtx.tipo === 'boleto') {
        await anexarBoletoPagamento(uploadCtx.id, file);
      } else {
        await anexarComprovantePagamento(uploadCtx.id, file);
      }
      setUploadCtx(null);
      await recarregarTudo();
    } catch (e) {
      setErro(e?.message || 'Falha no upload.');
    }
  }

  async function baixar(tipo, id) {
    setErro('');
    try {
      const blob = await baixarAnexoPagamento(id, tipo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = tipo === 'comprovante' ? `comprovante-${id}` : `boleto-${id}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e?.message || 'Falha ao baixar arquivo.');
    }
  }

  function exportarCsv() {
    const cols = [
      'id',
      'dataCadastro',
      'dataAgendamento',
      'dataVencimento',
      'descricao',
      'categoria',
      'formaPagamento',
      'valor',
      'codigoBarras',
      'status',
      'responsavelNome',
      'prioridade',
      'origem',
      'dataPagamentoEfetivo',
      'clienteCodigo',
      'processoNumeroInterno',
      'condominioTexto',
      'imovelNumeroPlanilha',
      'contratoLocacaoId',
      'observacoes',
      'temBoletoAnexo',
      'temComprovanteAnexo',
    ];
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const linhas = [cols.join(',')];
    for (const p of lista) {
      const row = cols.map((c) => escape(p[c]));
      linhas.push(row.join(','));
    }
    const blob = new Blob([linhas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagamentos_${hojeIsoLocal()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportarExcel() {
    try {
      const XLSX = await import('xlsx');
      const cols = [
        'id',
        'dataCadastro',
        'dataAgendamento',
        'dataVencimento',
        'descricao',
        'categoria',
        'formaPagamento',
        'valor',
        'codigoBarras',
        'status',
        'responsavelNome',
        'prioridade',
        'origem',
        'dataPagamentoEfetivo',
        'clienteCodigo',
        'processoNumeroInterno',
        'condominioTexto',
        'imovelNumeroPlanilha',
        'contratoLocacaoId',
        'observacoes',
        'temBoletoAnexo',
        'temComprovanteAnexo',
      ];
      const data = [
        cols,
        ...lista.map((p) => cols.map((c) => (p[c] == null ? '' : p[c]))),
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pagamentos');
      XLSX.writeFile(wb, `pagamentos_${hojeIsoLocal()}.xlsx`);
    } catch (e) {
      setErro(e?.message || 'Falha ao gerar Excel.');
    }
  }

  function gerarProximaParcelaTemplate(row) {
    const parcelaAtual = Number(row.recorrenciaParcelaAtual) || 1;
    const total = row.recorrenciaQuantidadeParcelas != null ? Number(row.recorrenciaQuantidadeParcelas) : null;
    if (total != null && Number.isFinite(total) && parcelaAtual >= total) {
      setErro('Quantidade de parcelas já atingida.');
      return;
    }
    const origemId = row.recorrenciaPagamentoOrigemId || row.id;
    const tipo = row.recorrenciaTipo || 'MENSAL';
    const meses = tipo === 'SEMANAL' ? 0 : tipo === 'ANUAL' ? 12 : 1;
    let proxVenc = String(row.dataVencimento || '').slice(0, 10);
    if (tipo === 'SEMANAL') {
      const d = new Date(`${proxVenc}T12:00:00`);
      d.setDate(d.getDate() + 7);
      proxVenc = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else {
      proxVenc = addMeses(proxVenc, meses || 1);
    }
    const descBase =
      row.recorrenciaDescricaoPadrao?.trim() ||
      row.descricao?.trim() ||
      `Parcela ${parcelaAtual + 1}`;
    setEditandoId(null);
    setForm({
      ...defaultForm(),
      dataVencimento: proxVenc,
      valor: row.valor != null ? String(row.valor) : '',
      descricao: descBase,
      categoria: row.categoria || 'OUTROS',
      formaPagamento: row.formaPagamento || 'BOLETO',
      codigoBarras: '',
      responsavelUsuarioId: row.responsavelUsuarioId != null ? String(row.responsavelUsuarioId) : '',
      status: 'PENDENTE',
      prioridade: row.prioridade || 'NORMAL',
      origem: row.origem || '',
      clienteId: row.clienteId != null ? String(row.clienteId) : '',
      processoId: row.processoId != null ? String(row.processoId) : '',
      imovelId: row.imovelId != null ? String(row.imovelId) : '',
      condominioTexto: row.condominioTexto || '',
      contratoLocacaoId: row.contratoLocacaoId != null ? String(row.contratoLocacaoId) : '',
      fornecedorTexto: row.fornecedorTexto || '',
      recorrente: true,
      recorrenciaTipo: tipo,
      recorrenciaQuantidadeParcelas:
        row.recorrenciaQuantidadeParcelas != null ? String(row.recorrenciaQuantidadeParcelas) : '',
      recorrenciaParcelaAtual: String(parcelaAtual + 1),
      recorrenciaValorFixo: row.recorrenciaValorFixo !== false,
      recorrenciaDescricaoPadrao: row.recorrenciaDescricaoPadrao || descBase,
      recorrenciaPagamentoOrigemId: String(origemId),
    });
    setModalAberto(true);
  }

  const cartoesDash = dashboard
    ? [
        { k: 'totalAPagarMes', label: 'Total a pagar no mês', v: dashboard.totalAPagarMes },
        { k: 'totalPagoMes', label: 'Total pago no mês', v: dashboard.totalPagoMes },
        { k: 'totalPendente', label: 'Total pendente', v: dashboard.totalPendente },
        { k: 'totalAgendado', label: 'Total agendado', v: dashboard.totalAgendado },
        { k: 'totalVencido', label: 'Total vencido', v: dashboard.totalVencido },
        { k: 'totalConferenciaPendente', label: 'Conferência pendente', v: dashboard.totalConferenciaPendente },
        { k: 'totalPagoSemComprovante', label: 'Pago sem comprovante', v: dashboard.totalPagoSemComprovante },
      ]
    : [];

  return (
    <div className="flex-1 flex flex-col min-h-0 min-h-full p-4 md:p-6 bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d]">
      <input ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={onFileSelecionado} />

      <header className="flex flex-wrap items-start gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/20">
          <Wallet className="w-7 h-7" aria-hidden />
        </div>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-800 to-teal-800 dark:from-emerald-200 dark:to-teal-200 bg-clip-text text-transparent">
            Pagamentos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Contas a pagar operacional: boletos, guias, conferência pós-vencimento e comprovantes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void recarregarTudo()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </button>
          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" />
            Novo pagamento
          </button>
          <button
            type="button"
            onClick={exportarCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            <FileText className="w-4 h-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => void exportarExcel()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
        </div>
      </header>

      {erro ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {erro}
        </div>
      ) : null}

      {cartoesDash.length > 0 ? (
        <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 mb-4">
          {cartoesDash.map((c) => (
            <div
              key={c.k}
              className="rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
            >
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">{c.label}</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                {formatBRL(Number(c.v ?? 0))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {dashboard?.porCategoria && Object.keys(dashboard.porCategoria).length > 0 ? (
        <section className="grid md:grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900/80">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Por categoria (valor)
            </h2>
            <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
              {Object.entries(dashboard.porCategoria).map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300 truncate">{k}</span>
                  <span className="font-medium tabular-nums">{formatBRL(Number(v ?? 0))}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900/80">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              Por responsável (valor)
            </h2>
            <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
              {Object.entries(dashboard.porResponsavel || {}).map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300 truncate">{k}</span>
                  <span className="font-medium tabular-nums">{formatBRL(Number(v ?? 0))}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-amber-200/80 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/25 p-3 mb-4">
        <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Alertas e indicadores
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(alertas).map(([k, n]) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-amber-950 ring-1 ring-amber-200 dark:bg-slate-900/90 dark:text-amber-100 dark:ring-amber-800"
            >
              {ROTULO_ALERTA[k] || k}: <strong>{n}</strong>
            </span>
          ))}
          {Object.keys(alertas).length === 0 ? <span className="text-xs text-amber-900/80">Sem dados.</span> : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/85 p-3 mb-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filtros
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Descrição</span>
            <input
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.descricao}
              onChange={(e) => setFiltros((f) => ({ ...f, descricao: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Código de barras</span>
            <input
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.codigoBarras}
              onChange={(e) => setFiltros((f) => ({ ...f, codigoBarras: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Valor exato</span>
            <input
              type="number"
              step="0.01"
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.valor}
              onChange={(e) => setFiltros((f) => ({ ...f, valor: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Status</span>
            <select
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.status}
              onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">Todos</option>
              {STATUS_LIST.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_STATUS[s] || s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Categoria</span>
            <select
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.categoria}
              onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value }))}
            >
              <option value="">Todas</option>
              {CATEGORIAS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Responsável</span>
            <select
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.responsavelUsuarioId}
              onChange={(e) => setFiltros((f) => ({ ...f, responsavelUsuarioId: e.target.value }))}
            >
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.nome || u.login || u.id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Forma de pagamento</span>
            <select
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.formaPagamento}
              onChange={(e) => setFiltros((f) => ({ ...f, formaPagamento: e.target.value }))}
            >
              <option value="">Todas</option>
              {FORMAS_PAGAMENTO.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Prioridade</span>
            <select
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.prioridade}
              onChange={(e) => setFiltros((f) => ({ ...f, prioridade: e.target.value }))}
            >
              <option value="">Todas</option>
              {PRIORIDADES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Origem (texto livre)</span>
            <input
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.origem}
              onChange={(e) => setFiltros((f) => ({ ...f, origem: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Vencimento de</span>
            <input
              type="date"
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.vencimentoDe}
              onChange={(e) => setFiltros((f) => ({ ...f, vencimentoDe: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Vencimento até</span>
            <input
              type="date"
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.vencimentoAte}
              onChange={(e) => setFiltros((f) => ({ ...f, vencimentoAte: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Agendamento de</span>
            <input
              type="date"
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.agendamentoDe}
              onChange={(e) => setFiltros((f) => ({ ...f, agendamentoDe: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Agendamento até</span>
            <input
              type="date"
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.agendamentoAte}
              onChange={(e) => setFiltros((f) => ({ ...f, agendamentoAte: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Cliente id</span>
            <input
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.clienteId}
              onChange={(e) => setFiltros((f) => ({ ...f, clienteId: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Processo id</span>
            <input
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.processoId}
              onChange={(e) => setFiltros((f) => ({ ...f, processoId: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Imóvel id</span>
            <input
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.imovelId}
              onChange={(e) => setFiltros((f) => ({ ...f, imovelId: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Condomínio (texto)</span>
            <input
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
              value={filtros.condominio}
              onChange={(e) => setFiltros((f) => ({ ...f, condominio: e.target.value }))}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-xs">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filtros.somenteVencidos}
              onChange={(e) => setFiltros((f) => ({ ...f, somenteVencidos: e.target.checked }))}
            />
            Só vencidos
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filtros.somenteConferenciaPendente}
              onChange={(e) => setFiltros((f) => ({ ...f, somenteConferenciaPendente: e.target.checked }))}
            />
            Conferência pendente
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filtros.proximos7Dias}
              onChange={(e) => setFiltros((f) => ({ ...f, proximos7Dias: e.target.checked }))}
            />
            Próximos 7 dias
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filtros.mesAtual}
              onChange={(e) => setFiltros((f) => ({ ...f, mesAtual: e.target.checked }))}
            />
            Mês atual
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filtros.somenteSemComprovante}
              onChange={(e) => setFiltros((f) => ({ ...f, somenteSemComprovante: e.target.checked }))}
            />
            Sem comprovante
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filtros.altoValor}
              onChange={(e) => setFiltros((f) => ({ ...f, altoValor: e.target.checked }))}
            />
            Alto valor
          </label>
          <button
            type="button"
            onClick={() => void recarregarTudo()}
            className="inline-flex items-center gap-1 rounded-md bg-slate-800 text-white px-2 py-1 hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900"
          >
            <Search className="w-3.5 h-3.5" />
            Aplicar
          </button>
        </div>
      </section>

      <div className="flex-1 min-h-0 rounded-xl border border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/85 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 min-h-0">
          <table className="min-w-[1100px] w-full text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-left">
              <tr>
                <th className="px-2 py-2 font-semibold">Vencimento</th>
                <th className="px-2 py-2 font-semibold">Agendamento</th>
                <th className="px-2 py-2 font-semibold">Descrição</th>
                <th className="px-2 py-2 font-semibold">Categoria</th>
                <th className="px-2 py-2 font-semibold">Valor</th>
                <th className="px-2 py-2 font-semibold">Código</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold">Resp.</th>
                <th className="px-2 py-2 font-semibold">Pri.</th>
                <th className="px-2 py-2 font-semibold">Boleto</th>
                <th className="px-2 py-2 font-semibold">Comp.</th>
                <th className="px-2 py-2 font-semibold w-[260px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((row) => (
                <tr key={row.id} className={`border-t border-slate-200 dark:border-slate-700 ${classeLinhaStatus(row.status)}`}>
                  <td className="px-2 py-1.5 whitespace-nowrap">{fmtData(row.dataVencimento)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{fmtData(row.dataAgendamento)}</td>
                  <td className="px-2 py-1.5 max-w-[220px]">
                    <span className="line-clamp-2" title={row.descricao}>
                      {row.descricao}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">{row.categoria}</td>
                  <td className="px-2 py-1.5 tabular-nums font-medium">{formatBRL(Number(row.valor ?? 0))}</td>
                  <td className="px-2 py-1.5 max-w-[140px] truncate font-mono text-[11px]" title={row.codigoBarras}>
                    {row.codigoBarras || '—'}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{ROTULO_STATUS[row.status] || row.status}</td>
                  <td className="px-2 py-1.5 max-w-[100px] truncate" title={row.responsavelNome}>
                    {row.responsavelNome || '—'}
                  </td>
                  <td className="px-2 py-1.5">{row.prioridade}</td>
                  <td className="px-2 py-1.5">{row.temBoletoAnexo ? 'Sim' : 'Não'}</td>
                  <td className="px-2 py-1.5">{row.temComprovanteAnexo ? 'Sim' : 'Não'}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        title="Editar"
                        className="rounded border border-slate-300 px-1 py-0.5 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                        onClick={() => void abrirEditar(row.id)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Marcar agendado"
                        className="rounded border border-slate-300 px-1 py-0.5 hover:bg-slate-100 dark:border-slate-600"
                        onClick={() => void acaoMarcarAgendado(row.id)}
                      >
                        <CalendarClock className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Marcar pago"
                        className="rounded border border-emerald-300 px-1 py-0.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        onClick={() => acaoAbrirPago(row)}
                      >
                        <Banknote className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Copiar linha digitável"
                        className="rounded border border-slate-300 px-1 py-0.5 hover:bg-slate-100"
                        onClick={() => void copiarBarras(row.codigoBarras)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Anexar boleto"
                        className="rounded border border-slate-300 px-1 py-0.5 hover:bg-slate-100"
                        onClick={() => dispararUpload(row.id, 'boleto')}
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Anexar comprovante"
                        className="rounded border border-slate-300 px-1 py-0.5 hover:bg-slate-100"
                        onClick={() => dispararUpload(row.id, 'comprovante')}
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      {row.temBoletoAnexo ? (
                        <button
                          type="button"
                          title="Baixar boleto"
                          className="rounded border border-slate-300 px-1 py-0.5 hover:bg-slate-100"
                          onClick={() => void baixar('boleto', row.id)}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                      {row.temComprovanteAnexo ? (
                        <button
                          type="button"
                          title="Baixar comprovante"
                          className="rounded border border-slate-300 px-1 py-0.5 hover:bg-slate-100"
                          onClick={() => void baixar('comprovante', row.id)}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        title="Cancelar"
                        className="rounded border border-slate-300 px-1 py-0.5 hover:bg-slate-100"
                        onClick={() => void acaoCancelar(row)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Substituir"
                        className="rounded border border-violet-300 px-1 py-0.5 hover:bg-violet-50"
                        onClick={() => void acaoSubstituir(row.id)}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Histórico"
                        className="rounded border border-slate-300 px-1 py-0.5 hover:bg-slate-100"
                        onClick={() => void acaoHistorico(row)}
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      {row.recorrente ? (
                        <button
                          type="button"
                          title="Gerar próxima parcela"
                          className="rounded border border-teal-300 px-1 py-0.5 hover:bg-teal-50 text-[10px] font-semibold"
                          onClick={() => gerarProximaParcelaTemplate(row)}
                        >
                          +1
                        </button>
                      ) : null}
                      <button
                        type="button"
                        title="Excluir"
                        disabled={
                          ['PAGO_CONFIRMADO', 'PAGO_SEM_COMPROVANTE'].includes(row.status) && !podeExcluirLiberal
                        }
                        className="rounded border border-red-300 px-1 py-0.5 hover:bg-red-50 disabled:opacity-40"
                        onClick={() => void acaoExcluir(row)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!carregando && lista.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">Nenhum pagamento encontrado.</p>
          ) : null}
        </div>
      </div>

      {modalAberto ? (
        <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="mt-8 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                {editandoId ? `Editar pagamento #${editandoId}` : 'Novo pagamento'}
              </h2>
              <button
                type="button"
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setModalAberto(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 grid sm:grid-cols-2 gap-3 text-xs max-h-[min(70vh,720px)] overflow-y-auto">
              <label className="flex flex-col gap-0.5 sm:col-span-1">
                <span>Data cadastro</span>
                <input
                  type="date"
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.dataCadastro}
                  onChange={(e) => setForm((f) => ({ ...f, dataCadastro: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Data agendamento</span>
                <input
                  type="date"
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.dataAgendamento}
                  onChange={(e) => setForm((f) => ({ ...f, dataAgendamento: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Data vencimento *</span>
                <input
                  type="date"
                  required
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.dataVencimento}
                  onChange={(e) => setForm((f) => ({ ...f, dataVencimento: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Valor *</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5 sm:col-span-2">
                <span>Descrição *</span>
                <input
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Código de barras / linha digitável</span>
                <input
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 font-mono text-[11px]"
                  value={form.codigoBarras}
                  onChange={(e) => setForm((f) => ({ ...f, codigoBarras: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Categoria *</span>
                <select
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Forma de pagamento *</span>
                <select
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.formaPagamento}
                  onChange={(e) => setForm((f) => ({ ...f, formaPagamento: e.target.value }))}
                >
                  {FORMAS_PAGAMENTO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Responsável</span>
                <select
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.responsavelUsuarioId}
                  onChange={(e) => setForm((f) => ({ ...f, responsavelUsuarioId: e.target.value }))}
                >
                  <option value="">—</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.nome || u.login}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Status *</span>
                <select
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {STATUS_LIST.map((c) => (
                    <option key={c} value={c}>
                      {ROTULO_STATUS[c] || c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Prioridade</span>
                <select
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.prioridade}
                  onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
                >
                  {PRIORIDADES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Origem</span>
                <input
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.origem}
                  onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Data pagamento efetivo</span>
                <input
                  type="date"
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.dataPagamentoEfetivo}
                  onChange={(e) => setForm((f) => ({ ...f, dataPagamentoEfetivo: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5 sm:col-span-2">
                <span>Observações</span>
                <textarea
                  rows={2}
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Cliente id</span>
                <input
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.clienteId}
                  onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Processo id</span>
                <input
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.processoId}
                  onChange={(e) => setForm((f) => ({ ...f, processoId: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Imóvel id</span>
                <input
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.imovelId}
                  onChange={(e) => setForm((f) => ({ ...f, imovelId: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Condomínio (texto)</span>
                <input
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.condominioTexto}
                  onChange={(e) => setForm((f) => ({ ...f, condominioTexto: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Contrato locação id</span>
                <input
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.contratoLocacaoId}
                  onChange={(e) => setForm((f) => ({ ...f, contratoLocacaoId: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-0.5 sm:col-span-2">
                <span>Fornecedor (texto)</span>
                <input
                  className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                  value={form.fornecedorTexto}
                  onChange={(e) => setForm((f) => ({ ...f, fornecedorTexto: e.target.value }))}
                />
              </label>
              <label className="inline-flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.recorrente}
                  onChange={(e) => setForm((f) => ({ ...f, recorrente: e.target.checked }))}
                />
                Pagamento recorrente
              </label>
              {form.recorrente ? (
                <>
                  <label className="flex flex-col gap-0.5">
                    <span>Tipo recorrência</span>
                    <select
                      className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                      value={form.recorrenciaTipo}
                      onChange={(e) => setForm((f) => ({ ...f, recorrenciaTipo: e.target.value }))}
                    >
                      <option value="SEMANAL">Semanal</option>
                      <option value="MENSAL">Mensal</option>
                      <option value="ANUAL">Anual</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span>Qtd. parcelas</span>
                    <input
                      className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                      value={form.recorrenciaQuantidadeParcelas}
                      onChange={(e) => setForm((f) => ({ ...f, recorrenciaQuantidadeParcelas: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span>Parcela atual</span>
                    <input
                      className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                      value={form.recorrenciaParcelaAtual}
                      onChange={(e) => setForm((f) => ({ ...f, recorrenciaParcelaAtual: e.target.value }))}
                    />
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!form.recorrenciaValorFixo}
                      onChange={(e) => setForm((f) => ({ ...f, recorrenciaValorFixo: e.target.checked }))}
                    />
                    Valor fixo
                  </label>
                  <label className="flex flex-col gap-0.5 sm:col-span-2">
                    <span>Descrição padrão</span>
                    <input
                      className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                      value={form.recorrenciaDescricaoPadrao}
                      onChange={(e) => setForm((f) => ({ ...f, recorrenciaDescricaoPadrao: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span>Pagamento origem (id)</span>
                    <input
                      className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                      value={form.recorrenciaPagamentoOrigemId}
                      onChange={(e) => setForm((f) => ({ ...f, recorrenciaPagamentoOrigemId: e.target.value }))}
                    />
                  </label>
                </>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
                onClick={() => setModalAberto(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                onClick={() => void salvarModal()}
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pagoModal ? (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <h3 className="text-sm font-bold mb-3">Confirmar pagamento</h3>
            <label className="flex flex-col gap-1 text-xs mb-2">
              <span>Data do pagamento efetivo</span>
              <input
                type="date"
                className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
                value={pagoData}
                onChange={(e) => setPagoData(e.target.value)}
              />
            </label>
            <label className="inline-flex items-center gap-2 text-xs mb-4">
              <input type="checkbox" checked={pagoSemComp} onChange={(e) => setPagoSemComp(e.target.checked)} />
              Pago sem comprovante (mantém alerta até anexar)
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-3 py-1 text-sm" onClick={() => setPagoModal(null)}>
                Voltar
              </button>
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-semibold text-white"
                onClick={() => void acaoConfirmarPago()}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {histAberto ? (
        <div className="fixed inset-0 z-[210] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="mt-10 w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h3 className="text-sm font-bold truncate pr-2">{histTitulo}</h3>
              <button type="button" onClick={() => setHistAberto(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto text-xs divide-y dark:divide-slate-700">
              {histLinhas.map((h) => (
                <li key={h.id} className="px-4 py-2 space-y-0.5">
                  <div className="font-semibold">
                    {fmtData(String(h.criadoEm ?? '').slice(0, 10))}{' '}
                    {String(h.criadoEm ?? '').length > 12 ? String(h.criadoEm).slice(11, 19) : ''} —{' '}
                    {h.usuarioNome || h.usuarioId}
                  </div>
                  <div>
                    <span className="text-slate-500">Ação:</span> {h.acao}{' '}
                    {h.statusAnterior || h.statusNovo ? (
                      <span className="text-slate-600">
                        ({h.statusAnterior || '—'} → {h.statusNovo || '—'})
                      </span>
                    ) : null}
                  </div>
                  {h.observacao ? <div className="text-slate-600">{h.observacao}</div> : null}
                  {h.dadosAlteradosJson ? (
                    <pre className="text-[10px] bg-slate-50 dark:bg-slate-950 p-1 rounded overflow-x-auto">{h.dadosAlteradosJson}</pre>
                  ) : null}
                </li>
              ))}
              {histLinhas.length === 0 ? <li className="px-4 py-6 text-center text-slate-500">Sem histórico.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
