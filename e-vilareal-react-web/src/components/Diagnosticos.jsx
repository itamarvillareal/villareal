import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ClipboardList, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { useUsuarioPerfil } from '../hooks/useUsuarioPerfil.js';
import { mensagemErroAmigavel } from '../utils/mensagemErroAmigavel.js';
import {
  formatBytesCompact,
  somaBytesArquivos,
  UPLOAD_P7S_LIMITE_BYTES,
  validarTamanhoLoteP7s,
} from '../domain/uploadP7sLimits.js';
import { buscarCliente, pesquisarCadastroPessoasPorNomeOuCpf } from '../api/clientesService.js';
import {
  listarConsultasARealizarPorData,
  listarHistoricoPorData,
  listarProcessosFaseAguardandoDocumentos,
  listarProcessosFaseAguardandoPeticionar,
  listarProcessosFaseAguardandoVerificacao,
  listarProcessosFaseAguardandoProtocolo,
  listarProcessosFaseAguardandoProvidencia,
  listarProcessosFaseProcedimentoAdministrativo,
  listarProcessosHistoricoLocalPorChaveNumeroProcesso,
  listarProcessosPorIdPessoa,
  listarProcessosPorPrazoFatal,
  listarAudienciasPendentes,
} from '../data/processosHistoricoData';
import {
  executarSincronizacaoAudienciasAgendaEProcessosCompleta,
  executarSincronizacaoAudienciasAgendaMesEProcessos,
} from '../services/sincronizacaoAudienciasAgendaProcessosService.js';
import { hojeDdMmYyyy, resolverAliasHojeEmTexto } from '../services/hjDateAliasService.js';
import { listarImoveisResumoPorPessoaDiagnostico } from '../services/listarImoveisPorPessoaDiagnostico.js';
import { listarCodigosClientePorIdPessoa } from '../data/clienteCodigoHelpers.js';
import { listarClientesIndiceCadastro } from '../repositories/clientesRepository.js';
import {
  listarProcessosPorNumeroProcessoDiagnostico,
  listarHistoricoPorDataDiagnostico,
  erroEndpointHistoricoDataIndisponivel,
  listarProcessosPorPrazoFatalDiagnostico,
  listarProcessosFaseAguardandoProtocoloDiagnostico,
  prepararAssinarAguardandoProtocolo,
  assinarAutomaticoAguardandoProtocolo,
  consultarLoteAssinaturaAguardandoProtocolo,
  reliberarLoteAssinaturaAguardandoProtocolo,
  baixarZipLoteAguardandoProtocolo,
  uploadAssinadosAguardandoProtocolo,
  listarProcessosVinculoPessoaDiagnostico,
} from '../repositories/processosRepository.js';
import { listarCredenciais } from '../api/peticoesProjudiApi.js';
import { padCliente8Nav } from './cadastro-pessoas/cadastroPessoasNavUtils.js';
import { agruparConsultasRealizadasPorProcesso } from '../domain/historicoTituloLegadoSistema.js';
import { featureFlags } from '../config/featureFlags.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';
import { getContextoAuditoriaUsuario, registrarAuditoria } from '../services/auditoriaCliente.js';
import { chaveNumeroProcessoBuscaDiagnostico } from '../domain/normalizarNumeroProcessoBuscaDiagnostico.js';
import { ModalResultadoHistoricoLista } from './diagnosticos/ModalResultadoHistoricoLista.jsx';
import { ModalResultadoPrazoFatal } from './diagnosticos/ModalResultadoPrazoFatal.jsx';

const ProcessoEmbedModal = lazy(() =>
  import('./ProcessoEmbedModal.jsx').then((m) => ({ default: m.ProcessoEmbedModal })),
);

/** Delay antes de chamar a API enquanto o usuário digita (ms). */
const DEBOUNCE_BUSCA_PESSOA_API_MS = 320;

/** Intervalo de polling do lote de assinatura automática (ms). */
const POLL_LOTE_ASSINATURA_MS = 2500;

const MSG_TOKEN_OCUPADO_ASSINADOR =
  'Token em uso por outro programa. Feche o sai.jar e tente novamente.';

function normalizarBuscaDiag(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function soDigitosDiag(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/** Normaliza item da lista «Aguardando Protocolo» (API usa codigoCliente/numeroInterno; embed usa codCliente/proc). */
function chavesClienteProcAguardandoProtocolo(item) {
  const codCliente = item?.codCliente ?? item?.codigoCliente;
  const proc = item?.proc ?? item?.numeroInterno;
  return { codCliente, proc };
}

function itemAguardandoProtocoloAbrivel(item) {
  const { codCliente, proc } = chavesClienteProcAguardandoProtocolo(item);
  if (codCliente == null || String(codCliente).trim() === '') return false;
  if (proc == null || String(proc).trim() === '') return false;
  return true;
}

function mapPessoaApiParaDiag(p) {
  return {
    id: Number(p.id),
    nome: String(p.nome ?? ''),
    cpf: String(p.cpf ?? ''),
    rg: '',
  };
}

/** API: id numérico (GET + lista), nome, CPF/CNPJ. RG não vem no filtro do backend. */
async function buscarPessoasApiPorTermo(termo) {
  const raw = String(termo ?? '').trim();
  if (!raw) return [];
  const compacto = raw.replace(/\s+/g, '');
  const pareceSoNumericoPuro = /^\d+$/.test(compacto);
  const idNum = Math.floor(Number(compacto));
  if (pareceSoNumericoPuro && Number.isFinite(idNum) && idNum >= 1) {
    try {
      const p = await buscarCliente(idNum);
      if (p?.id != null) return [mapPessoaApiParaDiag(p)];
    } catch {
      /* 404 ou erro: tenta lista abaixo */
    }
  }
  const arr = await pesquisarCadastroPessoasPorNomeOuCpf(raw, { apenasAtivos: false, limite: 150 });
  return (arr || []).map((p) => mapPessoaApiParaDiag(p));
}

function termoBuscaPessoaAtingeMinimoParaBuscar(raw) {
  const r = String(raw ?? '').trim();
  if (!r) return false;
  const t = normalizarBuscaDiag(r);
  const tDig = soDigitosDiag(r);
  const pareceSoCodigo = /^\d+$/.test(r.replace(/\s+/g, ''));
  return pareceSoCodigo || t.length >= 2 || tDig.length >= 3;
}

function chaveItemDiagBuscaPessoa(item) {
  const cod = String(item.codCliente ?? '').replace(/\D/g, '');
  const n = Math.floor(Number(cod || '1'));
  const cod8 = String(Number.isFinite(n) && n > 0 ? n : 1).padStart(8, '0');
  const pr = Math.floor(Number(String(item.proc ?? '').replace(/\D/g, '')) || 0);
  return `${cod8}-${pr}`;
}

/** API primeiro; entradas só no histórico local completam sem duplicar por código+proc. */
function mergeItensDiagnosticoBuscaPessoa(apiItens, locais) {
  const m = new Map();
  for (const x of apiItens) m.set(chaveItemDiagBuscaPessoa(x), x);
  for (const x of locais) {
    const k = chaveItemDiagBuscaPessoa(x);
    if (!m.has(k)) m.set(k, x);
  }
  return [...m.values()].sort((a, b) => chaveItemDiagBuscaPessoa(a).localeCompare(chaveItemDiagBuscaPessoa(b)));
}

/** @typedef {{ id: string, label: string, dica: string, emBreve?: boolean }} BotaoRelatorio */

/** @type {{ titulo: string, botoes: BotaoRelatorio[] }[]} */
const GRUPOS_RELATORIOS = [
  {
    titulo: 'Consultas e buscas',
    botoes: [
      {
        id: 'Consultas Realizadas',
        label: 'Consultas Realizadas',
        dica: 'Lista o que foi registrado no histórico do processo na data escolhida.',
      },
      {
        id: 'Consultas à Realizar',
        label: 'Consultas a Realizar',
        dica: 'Compromissos e consultas previstas para datas futuras.',
      },
      {
        id: 'Audiências pendentes',
        label: 'Audiências pendentes',
        dica: 'Audiências ainda não realizadas nos processos do escritório.',
      },
      {
        id: 'Prazo Fatal',
        label: 'Prazo Fatal',
        dica: 'Processos com prazo fatal na data informada.',
      },
      {
        id: 'Consultas Atrasadas',
        label: 'Consultas Atrasadas',
        dica: 'Consultas que passaram da data prevista (em breve).',
        emBreve: true,
      },
      {
        id: 'Publicações',
        label: 'Publicações',
        dica: 'Acesso rápido ao relatório de publicações do DJE.',
      },
      {
        id: 'Busca pessoa',
        label: 'Busca por pessoa',
        dica: 'Localiza processos vinculados a uma pessoa por nome, CPF ou código.',
      },
      {
        id: 'Busca por número',
        label: 'Busca por número',
        dica: 'Encontra processos pelo número CNJ ou número interno.',
      },
      {
        id: 'Réus por cliente (Excel)',
        label: 'Réus por cliente (Excel)',
        dica: 'Gera planilha Excel com os réus dos processos de um cliente.',
      },
    ],
  },
  {
    titulo: 'Situação dos processos',
    botoes: [
      {
        id: 'Aguardando Documentos',
        label: 'Aguardando Documentos',
        dica: 'Processos na fase em que faltam documentos do cliente.',
      },
      {
        id: 'Aguardando Peticionar',
        label: 'Aguardando Peticionar',
        dica: 'Processos prontos para elaborar e protocolar petição.',
      },
      {
        id: 'Aguardando Verificação',
        label: 'Aguardando Verificação',
        dica: 'Processos aguardando conferência interna antes do protocolo.',
      },
      {
        id: 'Aguardando Protocolo',
        label: 'Aguardando Protocolo',
        dica: 'Processos com petição pronta aguardando protocolo no tribunal.',
      },
      {
        id: 'Aguardando Providência',
        label: 'Aguardando Providência',
        dica: 'Processos que dependem de providência do escritório ou do cliente.',
      },
      {
        id: 'Proc. Administrativo',
        label: 'Processo Administrativo',
        dica: 'Processos em fase de procedimento administrativo.',
      },
      {
        id: 'Baixar Protocolos',
        label: 'Baixar Protocolos',
        dica: 'Download em lote de protocolos (em breve).',
        emBreve: true,
      },
    ],
  },
];

function diaSemanaPtBr(brDate) {
  const [dd, mm, yyyy] = String(brDate ?? '').split('/');
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { weekday: 'long' });
}

function pad2DiaMes(n) {
  return String(Math.trunc(n)).padStart(2, '0');
}

/**
 * Desloca uma data em formato dd/mm/aaaa (após resolver alias «hj» externamente).
 * @param {string} dataBr
 * @param {number} deltaDias
 * @returns {string | null} dd/mm/aaaa ou null se inválido
 */
function deslocarDataBrDias(dataBr, deltaDias) {
  const t = String(dataBr ?? '').trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mo = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mo) || !Number.isFinite(yyyy)) return null;
  const d = new Date(yyyy, mo - 1, dd);
  if (Number.isNaN(d.getTime()) || d.getFullYear() !== yyyy || d.getMonth() !== mo - 1 || d.getDate() !== dd) {
    return null;
  }
  d.setDate(d.getDate() + deltaDias);
  if (Number.isNaN(d.getTime())) return null;
  return `${pad2DiaMes(d.getDate())}/${pad2DiaMes(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function CampoDataBrComContador({ value, onChange, ariaLabel, placeholder = 'dd/mm/aaaa ou hj' }) {
  const shift = (delta) => {
    const bruto = String(value ?? '').trim();
    const base = resolverAliasHojeEmTexto(bruto, 'br') ?? bruto;
    onChange(deslocarDataBrDias(base, delta) ?? hojeDdMmYyyy());
  };

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="flex h-10 min-h-[2.5rem] overflow-hidden rounded border border-slate-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-slate-300 focus-within:ring-offset-0">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            onChange(resolverAliasHojeEmTexto(v, 'br') ?? v);
          }}
          className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm focus:outline-none focus:ring-0"
          aria-label={ariaLabel}
        />
        <div className="flex w-9 shrink-0 flex-col divide-y divide-slate-300 border-l border-slate-300 bg-slate-50">
          <button
            type="button"
            className="flex flex-1 items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200"
            aria-label="Avançar um dia"
            onClick={() => shift(1)}
          >
            <ChevronUp className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            className="flex flex-1 items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200"
            aria-label="Retroceder um dia"
            onClick={() => shift(-1)}
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm leading-none text-slate-700 min-h-[1.25rem]">{diaSemanaPtBr(value) || ' '}</p>
    </div>
  );
}

export function Diagnosticos() {
  const navigate = useNavigate();
  const { isAdmin } = useUsuarioPerfil();
  const [focado, setFocado] = useState('Consultas Realizadas');
  const [relatorioCarregando, setRelatorioCarregando] = useState(false);
  const [relatorioAviso, setRelatorioAviso] = useState('');
  const [modalConsultasRealizadasAberto, setModalConsultasRealizadasAberto] = useState(false);
  const [dataConsulta, setDataConsulta] = useState(() => hojeDdMmYyyy());
  const [modalResultadoAberto, setModalResultadoAberto] = useState(false);
  const [resultadoConsulta, setResultadoConsulta] = useState([]);
  const [rotuloResultadoConsulta, setRotuloResultadoConsulta] = useState('Histórico gravado na data');
  const [consultaHistoricoErro, setConsultaHistoricoErro] = useState('');
  const [modalPrazoFatalAberto, setModalPrazoFatalAberto] = useState(false);
  const [dataPrazoFatal, setDataPrazoFatal] = useState('');
  const [modalResultadoPrazoFatalAberto, setModalResultadoPrazoFatalAberto] = useState(false);
  const [processoEmbed, setProcessoEmbed] = useState(null);
  const [resultadoPrazoFatal, setResultadoPrazoFatal] = useState([]);
  const [modalConsultasARealizarAberto, setModalConsultasARealizarAberto] = useState(false);
  const [modalPublicacoesAberto, setModalPublicacoesAberto] = useState(false);
  const [modalBuscaPessoaAberto, setModalBuscaPessoaAberto] = useState(false);
  const [termoBuscaPessoa, setTermoBuscaPessoa] = useState('');
  const [candidatosBuscaPessoa, setCandidatosBuscaPessoa] = useState([]);
  const [buscaPessoaCarregando, setBuscaPessoaCarregando] = useState(false);
  const [buscaPessoaErro, setBuscaPessoaErro] = useState('');
  const buscaPessoaReqSeq = useRef(0);
  const [modalResultadoBuscaPessoaAberto, setModalResultadoBuscaPessoaAberto] = useState(false);
  const [resultadoBuscaPessoa, setResultadoBuscaPessoa] = useState([]);
  const [buscaPessoaProcessosCarregando, setBuscaPessoaProcessosCarregando] = useState(false);
  const [rotuloPessoaBusca, setRotuloPessoaBusca] = useState('');
  /** Pessoa escolhida na busca (para atalhos ao cadastro / clientes mesmo sem processos locais). */
  const [idPessoaBuscaDiag, setIdPessoaBuscaDiag] = useState(null);
  const [clientesCodigosLista, setClientesCodigosLista] = useState([]);
  /** Imóveis vinculados à pessoa (API de imóveis, quando ativa). */
  const [imoveisRelatorioBusca, setImoveisRelatorioBusca] = useState({ status: 'idle', itens: [] });
  const [modalResultadoAguardandoDocsAberto, setModalResultadoAguardandoDocsAberto] = useState(false);
  const [resultadoAguardandoDocs, setResultadoAguardandoDocs] = useState([]);
  const [modalResultadoAguardandoPeticionarAberto, setModalResultadoAguardandoPeticionarAberto] =
    useState(false);
  const [resultadoAguardandoPeticionar, setResultadoAguardandoPeticionar] = useState([]);
  const [modalResultadoAguardandoVerificacaoAberto, setModalResultadoAguardandoVerificacaoAberto] =
    useState(false);
  const [resultadoAguardandoVerificacao, setResultadoAguardandoVerificacao] = useState([]);
  const [modalResultadoAguardandoProtocoloAberto, setModalResultadoAguardandoProtocoloAberto] =
    useState(false);
  const [resultadoAguardandoProtocolo, setResultadoAguardandoProtocolo] = useState([]);
  const [aguardandoProtocoloBaixando, setAguardandoProtocoloBaixando] = useState(false);
  const [aguardandoProtocoloBaixarErro, setAguardandoProtocoloBaixarErro] = useState('');
  const [modalPrepararAssinarAberto, setModalPrepararAssinarAberto] = useState(false);
  const [prepararAssinarCredencialId, setPrepararAssinarCredencialId] = useState('');
  const [prepararAssinarCredenciais, setPrepararAssinarCredenciais] = useState([]);
  const [prepararAssinarErro, setPrepararAssinarErro] = useState('');
  const [prepararAssinarResultado, setPrepararAssinarResultado] = useState(null);
  const [modalAssinarAutomaticoAberto, setModalAssinarAutomaticoAberto] = useState(false);
  const [assinarAutomaticoAtivo, setAssinarAutomaticoAtivo] = useState(false);
  const [assinarAutomaticoLoteId, setAssinarAutomaticoLoteId] = useState(null);
  const [assinarAutomaticoFase, setAssinarAutomaticoFase] = useState('');
  const [assinarAutomaticoErro, setAssinarAutomaticoErro] = useState('');
  const [assinarAutomaticoErroCodigo, setAssinarAutomaticoErroCodigo] = useState('');
  const [assinarAutomaticoPeticaoCount, setAssinarAutomaticoPeticaoCount] = useState(0);
  const [assinarAutomaticoReliberando, setAssinarAutomaticoReliberando] = useState(false);
  const assinarAutomaticoPollRef = useRef(null);
  const [modalUploadAssinadosAberto, setModalUploadAssinadosAberto] = useState(false);
  const [uploadAssinadosArquivos, setUploadAssinadosArquivos] = useState([]);
  const [uploadAssinadosEnviando, setUploadAssinadosEnviando] = useState(false);
  const [uploadAssinadosErro, setUploadAssinadosErro] = useState('');
  const [uploadAssinadosResultado, setUploadAssinadosResultado] = useState(null);
  const inputUploadAssinadosRef = useRef(null);
  const [modalResultadoAguardandoProvidenciaAberto, setModalResultadoAguardandoProvidenciaAberto] =
    useState(false);
  const [resultadoAguardandoProvidencia, setResultadoAguardandoProvidencia] = useState([]);
  const [modalResultadoProcAdministrativoAberto, setModalResultadoProcAdministrativoAberto] =
    useState(false);
  const [resultadoProcAdministrativo, setResultadoProcAdministrativo] = useState([]);
  const [modalResultadoAudienciasPendentesAberto, setModalResultadoAudienciasPendentesAberto] =
    useState(false);
  const [resultadoAudienciasPendentes, setResultadoAudienciasPendentes] = useState([]);
  const [syncAgendaMes, setSyncAgendaMes] = useState(4);
  const [syncAgendaAno, setSyncAgendaAno] = useState(() => new Date().getFullYear());
  const [syncAgendaMsg, setSyncAgendaMsg] = useState('');
  const [modalReusClienteExcelAberto, setModalReusClienteExcelAberto] = useState(false);
  const [codigoClienteReusExcel, setCodigoClienteReusExcel] = useState('');
  const [reusExcelCarregando, setReusExcelCarregando] = useState(false);
  const [reusExcelProgresso, setReusExcelProgresso] = useState('');
  const [reusExcelErro, setReusExcelErro] = useState('');
  const [modalBuscaNumeroProcessoAberto, setModalBuscaNumeroProcessoAberto] = useState(false);
  const [termoBuscaNumeroProcesso, setTermoBuscaNumeroProcesso] = useState('');
  const [buscaNumeroProcessoCarregando, setBuscaNumeroProcessoCarregando] = useState(false);
  const [buscaNumeroProcessoErro, setBuscaNumeroProcessoErro] = useState('');
  const [resultadoBuscaNumeroProcesso, setResultadoBuscaNumeroProcesso] = useState([]);
  const [rotuloBuscaNumeroProcesso, setRotuloBuscaNumeroProcesso] = useState('');

  async function gerarExcelReusCliente() {
    const raw = String(codigoClienteReusExcel ?? '').replace(/\D/g, '');
    const n = Math.floor(Number(raw || '0'));
    if (!raw || !Number.isFinite(n) || n < 1) {
      setReusExcelErro('Informe o código do cliente (apenas números).');
      return;
    }
    setReusExcelErro('');
    setReusExcelProgresso('');
    setRelatorioCarregando(true);
    setReusExcelCarregando(true);
    try {
      const { exportarReusClienteParaExcel } = await import('../services/relatorioReusClienteExcel.js');
      const res = await exportarReusClienteParaExcel(raw, (ev) => {
        setReusExcelProgresso(`A processar… ${ev.atual} de ${ev.total}`);
      });
      const { usuarioNome } = getContextoAuditoriaUsuario();
      registrarAuditoria({
        modulo: 'Relatórios',
        tela: '/diagnosticos',
        tipoAcao: 'EXPORTACAO_EXCEL',
        descricao: `Excel de réus por cliente: ${res.linhas} linha(s), ficheiro ${res.nomeArquivo}. Utilizador: ${usuarioNome || '—'}.`,
      });
      setReusExcelProgresso(`Guardado: ${res.nomeArquivo} (${res.linhas} linhas).`);
    } catch (e) {
      setReusExcelErro(String(e?.message || e || 'Erro ao gerar o Excel.'));
    } finally {
      setReusExcelCarregando(false);
      setRelatorioCarregando(false);
    }
  }

  async function executarBuscaNumeroProcesso() {
    const raw = String(termoBuscaNumeroProcesso ?? '').trim();
    setBuscaNumeroProcessoErro('');
    setRotuloBuscaNumeroProcesso('');
    if (!raw) {
      setBuscaNumeroProcessoErro('Informe o número do processo (CNJ ou nº gravado).');
      return;
    }
    const chave = chaveNumeroProcessoBuscaDiagnostico(raw);
    if (!chave || chave.length < 7) {
      setBuscaNumeroProcessoErro('Informe ao menos 7 dígitos (número incompleto ou sem dígitos reconhecíveis).');
      return;
    }
    setRelatorioCarregando(true);
    setBuscaNumeroProcessoCarregando(true);
    setResultadoBuscaNumeroProcesso([]);
    try {
      const locais = listarProcessosHistoricoLocalPorChaveNumeroProcesso(raw);
      let itens = locais;
      if (featureFlags.useApiProcessos) {
        try {
          const apiRows = await listarProcessosPorNumeroProcessoDiagnostico(raw);
          itens = mergeItensDiagnosticoBuscaPessoa(apiRows, locais);
        } catch (e) {
          itens = locais;
          setBuscaNumeroProcessoErro(String(e?.message || 'Falha na API; exibindo só o histórico local.'));
        }
      }
      setResultadoBuscaNumeroProcesso(itens);
      setRotuloBuscaNumeroProcesso(
        `Comparação por dígitos: ${chave.length} dígito(s) — aceita entrada com ou sem «.» e «-».`
      );
    } finally {
      setBuscaNumeroProcessoCarregando(false);
      setRelatorioCarregando(false);
    }
  }

  async function consultarPorData() {
    const bruto = String(dataConsulta ?? '').trim();
    if (!bruto) return;
    const dataResolvida = resolverAliasHojeEmTexto(bruto, 'br') ?? bruto;
    setConsultaHistoricoErro('');
    try {
      const itens = await listarHistoricoPorDataDiagnostico(dataResolvida, { umaLinhaPorProcesso: true });
      setResultadoConsulta(itens);
    } catch (e) {
      const locais = listarHistoricoPorData(dataResolvida);
      setResultadoConsulta(agruparConsultasRealizadasPorProcesso(locais));
      if (locais.length === 0 && erroEndpointHistoricoDataIndisponivel(e)) {
        setConsultaHistoricoErro(
          'O backend em execução não expõe o relatório na API (imagem Docker desatualizada). Reinicie com: docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d --build backend',
        );
      } else if (locais.length === 0) {
        setConsultaHistoricoErro(String(e?.message || 'Falha ao consultar histórico na API.'));
      }
    }
    setRotuloResultadoConsulta('Histórico gravado na data');
    setModalConsultasRealizadasAberto(false);
    setModalResultadoAberto(true);
  }

  function consultarPorDataConsultasARealizar() {
    const data = String(dataConsulta ?? '').trim();
    if (!data) return;
    const itens = listarConsultasARealizarPorData(data);
    setResultadoConsulta(itens);
    setRotuloResultadoConsulta('Consultas a Realizar');
    setModalConsultasARealizarAberto(false);
    setModalResultadoAberto(true);
  }

  async function consultarPorDataPublicacoes() {
    const bruto = String(dataConsulta ?? '').trim();
    if (!bruto) return;
    const dataResolvida = resolverAliasHojeEmTexto(bruto, 'br') ?? bruto;
    try {
      const itens = await listarHistoricoPorDataDiagnostico(dataResolvida, { umaLinhaPorProcesso: false });
      setResultadoConsulta(itens);
    } catch {
      setResultadoConsulta(listarHistoricoPorData(dataResolvida));
    }
    setRotuloResultadoConsulta('Publicações');
    setModalPublicacoesAberto(false);
    setModalResultadoAberto(true);
  }

  async function consultarPrazoFatalPorData() {
    const bruto = String(dataPrazoFatal ?? '').trim();
    if (!bruto) return;
    const dataResolvida = resolverAliasHojeEmTexto(bruto, 'br') ?? bruto;
    try {
      const itens = await listarProcessosPorPrazoFatalDiagnostico(dataResolvida);
      setResultadoPrazoFatal(itens);
    } catch {
      setResultadoPrazoFatal(listarProcessosPorPrazoFatal(dataResolvida));
    }
    setModalPrazoFatalAberto(false);
    setModalResultadoPrazoFatalAberto(true);
  }

  useEffect(() => {
    if (!idPessoaBuscaDiag || clientesCodigosLista.length > 0) return;
    let c = true;
    void listarClientesIndiceCadastro()
      .then((list) => {
        if (c) setClientesCodigosLista(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (c) setClientesCodigosLista([]);
      });
    return () => {
      c = false;
    };
  }, [idPessoaBuscaDiag, clientesCodigosLista.length]);

  useEffect(() => {
    if (modalPrazoFatalAberto) setDataPrazoFatal(hojeDdMmYyyy());
  }, [modalPrazoFatalAberto]);

  useEffect(() => {
    if (modalConsultasRealizadasAberto || modalConsultasARealizarAberto || modalPublicacoesAberto) {
      setDataConsulta(hojeDdMmYyyy());
    }
  }, [modalConsultasRealizadasAberto, modalConsultasARealizarAberto, modalPublicacoesAberto]);

  async function abrirResultadoProcessosParaPessoa(pessoa) {
    const id = Number(pessoa.id);
    const nome = String(pessoa.nome ?? '').trim();
    const doc = pessoa.cpf ? ` — ${pessoa.cpf}` : '';
    const rg = pessoa.rg ? ` — RG ${pessoa.rg}` : '';
    setRotuloPessoaBusca(`${nome || '—'} (cód. ${id})${doc}${rg}`);
    setIdPessoaBuscaDiag(Number.isFinite(id) && id >= 1 ? id : null);
    setImoveisRelatorioBusca({ status: 'idle', itens: [] });
    setModalBuscaPessoaAberto(false);
    setCandidatosBuscaPessoa([]);
    setTermoBuscaPessoa('');
    setModalResultadoBuscaPessoaAberto(true);
    setBuscaPessoaProcessosCarregando(true);
    setResultadoBuscaPessoa([]);

    const locais = listarProcessosPorIdPessoa(String(id), nome || undefined);
    let itens = locais;
    if (featureFlags.useApiProcessos) {
      try {
        const apiRows = await listarProcessosVinculoPessoaDiagnostico(id);
        itens = mergeItensDiagnosticoBuscaPessoa(apiRows, locais);
      } catch {
        itens = locais;
      }
    }
    setResultadoBuscaPessoa(itens);
    setBuscaPessoaProcessosCarregando(false);
  }

  useEffect(() => {
    if (!modalResultadoBuscaPessoaAberto || idPessoaBuscaDiag == null) {
      setImoveisRelatorioBusca({ status: 'idle', itens: [] });
      return;
    }
    let cancel = false;
    setImoveisRelatorioBusca({ status: 'loading', itens: [] });
    void listarImoveisResumoPorPessoaDiagnostico(idPessoaBuscaDiag)
      .then((itens) => {
        if (cancel) return;
        setImoveisRelatorioBusca({ status: 'ok', itens: Array.isArray(itens) ? itens : [] });
      })
      .catch(() => {
        if (cancel) return;
        setImoveisRelatorioBusca({ status: 'erro', itens: [] });
      });
    return () => {
      cancel = true;
    };
  }, [modalResultadoBuscaPessoaAberto, idPessoaBuscaDiag]);

  useEffect(() => {
    return () => {
      if (assinarAutomaticoPollRef.current) {
        clearInterval(assinarAutomaticoPollRef.current);
        assinarAutomaticoPollRef.current = null;
      }
    };
  }, []);

  function pararPollingAssinarAutomatico() {
    if (assinarAutomaticoPollRef.current) {
      clearInterval(assinarAutomaticoPollRef.current);
      assinarAutomaticoPollRef.current = null;
    }
  }

  function fecharModalAssinarAutomatico() {
    if (assinarAutomaticoAtivo && assinarAutomaticoFase !== 'concluido' && assinarAutomaticoFase !== 'erro') {
      return;
    }
    pararPollingAssinarAutomatico();
    setModalAssinarAutomaticoAberto(false);
    setAssinarAutomaticoAtivo(false);
    setAssinarAutomaticoLoteId(null);
    setAssinarAutomaticoFase('');
    setAssinarAutomaticoErro('');
    setAssinarAutomaticoErroCodigo('');
    setAssinarAutomaticoPeticaoCount(0);
    setAssinarAutomaticoReliberando(false);
  }

  function irParaPeticionamentoProjudi() {
    fecharModalAssinarAutomatico();
    setModalResultadoAguardandoProtocoloAberto(false);
    navigate('/processos/peticionamento-projudi');
  }

  async function carregarCredenciaisPrepararAssinar() {
    const rows = await listarCredenciais();
    const lista = Array.isArray(rows) ? rows : [];
    setPrepararAssinarCredenciais(lista);
    if (!prepararAssinarCredencialId && lista.length > 0) {
      const preferida = lista.find((c) => String(c.cpfUsuario || '').endsWith('5190')) || lista[0];
      if (preferida?.id != null) {
        setPrepararAssinarCredencialId(String(preferida.id));
        return String(preferida.id);
      }
    }
    return String(prepararAssinarCredencialId || '').trim();
  }

    function aplicarStatusLoteAssinatura(status) {
    const st = String(status?.status ?? '').toUpperCase();
    if (st === 'PREPARANDO') {
      setAssinarAutomaticoFase('preparando');
      return false;
    }
    if (st === 'CONCLUIDO') {
      setAssinarAutomaticoFase('concluido');
      setAssinarAutomaticoPeticaoCount((prev) =>
        Array.isArray(status?.peticaoIds) && status.peticaoIds.length > 0
          ? status.peticaoIds.length
          : prev,
      );
      setAssinarAutomaticoAtivo(false);
      pararPollingAssinarAutomatico();
      return true;
    }
    if (st === 'ERRO') {
      setAssinarAutomaticoFase('erro');
      setAssinarAutomaticoErroCodigo(String(status?.erroCodigo ?? '').trim());
      setAssinarAutomaticoErro(
        status?.mensagemUsuario ||
          status?.erroMensagem ||
          'Não foi possível concluir a assinatura automática.',
      );
      setAssinarAutomaticoAtivo(false);
      pararPollingAssinarAutomatico();
      return true;
    }
    if (st === 'LIBERADO' || st === 'EM_ASSINATURA') {
      setAssinarAutomaticoFase('aguardando');
      if (Array.isArray(status?.peticaoIds) && status.peticaoIds.length > 0) {
        setAssinarAutomaticoPeticaoCount(status.peticaoIds.length);
      }
    }
    return false;
  }

  async function consultarLoteAssinaturaUmaVez(loteId) {
    const status = await consultarLoteAssinaturaAguardandoProtocolo(loteId);
    return aplicarStatusLoteAssinatura(status);
  }

  function iniciarPollingLoteAssinatura(loteId) {
    pararPollingAssinarAutomatico();
    void consultarLoteAssinaturaUmaVez(loteId);
    assinarAutomaticoPollRef.current = setInterval(() => {
      void consultarLoteAssinaturaUmaVez(loteId);
    }, POLL_LOTE_ASSINATURA_MS);
  }

  async function iniciarAssinarAutomatico() {
    if (!resultadoAguardandoProtocolo.length || assinarAutomaticoAtivo) return;
    setModalAssinarAutomaticoAberto(true);
    setAssinarAutomaticoFase('');
    setAssinarAutomaticoErro('');
    setAssinarAutomaticoErroCodigo('');
    setAssinarAutomaticoLoteId(null);
    setAssinarAutomaticoPeticaoCount(0);
    setAssinarAutomaticoAtivo(true);
    setAguardandoProtocoloBaixarErro('');
    pararPollingAssinarAutomatico();
    try {
      const credId = await carregarCredenciaisPrepararAssinar();
      if (!credId) {
        throw new Error('Nenhuma credencial PROJUDI disponível. Cadastre uma credencial antes de assinar.');
      }
      const resp = await assinarAutomaticoAguardandoProtocolo(resultadoAguardandoProtocolo, credId);
      const loteId = resp?.loteId;
      if (loteId == null) {
        throw new Error('Resposta inválida: loteId ausente.');
      }
      setAssinarAutomaticoLoteId(loteId);
      if (Array.isArray(resp?.peticaoIds) && resp.peticaoIds.length > 0) {
        setAssinarAutomaticoPeticaoCount(resp.peticaoIds.length);
      }
      iniciarPollingLoteAssinatura(loteId);
    } catch (e) {
      setAssinarAutomaticoFase('erro');
      setAssinarAutomaticoErro(mensagemErroAmigavel(e, 'iniciar a assinatura automática'));
      setAssinarAutomaticoAtivo(false);
      pararPollingAssinarAutomatico();
    }
  }

  async function tentarNovamenteAssinarAutomatico() {
    const loteId = assinarAutomaticoLoteId;
    if (loteId == null || assinarAutomaticoReliberando) return;
    setAssinarAutomaticoReliberando(true);
    setAssinarAutomaticoErro('');
    setAssinarAutomaticoErroCodigo('');
    setAssinarAutomaticoFase('aguardando');
    setAssinarAutomaticoAtivo(true);
    try {
      await reliberarLoteAssinaturaAguardandoProtocolo(loteId);
      iniciarPollingLoteAssinatura(loteId);
    } catch (e) {
      setAssinarAutomaticoFase('erro');
      setAssinarAutomaticoErro(mensagemErroAmigavel(e, 're-liberar o lote de assinatura'));
      setAssinarAutomaticoAtivo(false);
      pararPollingAssinarAutomatico();
    } finally {
      setAssinarAutomaticoReliberando(false);
    }
  }

  function abrirFluxoManualAssinar() {
    fecharModalAssinarAutomatico();
    void abrirModalPrepararAssinar();
  }

  useEffect(() => {
    if (!modalBuscaPessoaAberto) return;
    const seq = ++buscaPessoaReqSeq.current;
    const raw = String(termoBuscaPessoa ?? '').trim();

    function aplicarLista(lista) {
      if (seq !== buscaPessoaReqSeq.current) return;
      setCandidatosBuscaPessoa(lista);
      setBuscaPessoaCarregando(false);
      setBuscaPessoaErro('');
    }

    if (!raw) {
      aplicarLista([]);
      return;
    }
    if (!termoBuscaPessoaAtingeMinimoParaBuscar(raw)) {
      aplicarLista([]);
      return;
    }

    setBuscaPessoaCarregando(true);
    setBuscaPessoaErro('');

    const timer = setTimeout(() => {
      if (seq !== buscaPessoaReqSeq.current) return;
      void (async () => {
        try {
          const lista = await buscarPessoasApiPorTermo(raw);
          if (seq !== buscaPessoaReqSeq.current) return;
          setCandidatosBuscaPessoa(lista);
          setBuscaPessoaErro('');
        } catch (e) {
          if (seq !== buscaPessoaReqSeq.current) return;
          setCandidatosBuscaPessoa([]);
          setBuscaPessoaErro(e?.message || 'Falha ao buscar pessoas.');
        } finally {
          if (seq === buscaPessoaReqSeq.current) setBuscaPessoaCarregando(false);
        }
      })();
    }, DEBOUNCE_BUSCA_PESSOA_API_MS);

    return () => clearTimeout(timer);
  }, [termoBuscaPessoa, modalBuscaPessoaAberto]);

  /** Fecha modais de resultado e abre a tela Processos no cliente/processo indicados. */
  function abrirListaAguardandoDocumentos() {
    const itens = listarProcessosFaseAguardandoDocumentos();
    setResultadoAguardandoDocs(itens);
    setModalResultadoAguardandoDocsAberto(true);
  }

  function abrirListaAguardandoPeticionar() {
    const itens = listarProcessosFaseAguardandoPeticionar();
    setResultadoAguardandoPeticionar(itens);
    setModalResultadoAguardandoPeticionarAberto(true);
  }

  function abrirListaAguardandoVerificacao() {
    const itens = listarProcessosFaseAguardandoVerificacao();
    setResultadoAguardandoVerificacao(itens);
    setModalResultadoAguardandoVerificacaoAberto(true);
  }

  function abrirListaAguardandoProtocolo() {
    void (async () => {
      try {
        const itens = await listarProcessosFaseAguardandoProtocoloDiagnostico();
        setResultadoAguardandoProtocolo(itens);
      } catch {
        setResultadoAguardandoProtocolo(listarProcessosFaseAguardandoProtocolo());
      }
      setAguardandoProtocoloBaixarErro('');
      setModalResultadoAguardandoProtocoloAberto(true);
    })();
  }

  async function abrirModalPrepararAssinar() {
    if (!resultadoAguardandoProtocolo.length) return;
    setPrepararAssinarResultado(null);
    setPrepararAssinarErro('');
    setModalPrepararAssinarAberto(true);
    try {
      await carregarCredenciaisPrepararAssinar();
    } catch (e) {
      setPrepararAssinarErro(mensagemErroAmigavel(e, 'carregar credenciais PROJUDI'));
    }
  }

  async function confirmarPrepararEBaixar() {
    if (!resultadoAguardandoProtocolo.length) return;
    const credId = String(prepararAssinarCredencialId || '').trim();
    if (!credId) {
      setPrepararAssinarErro('Selecione a credencial PROJUDI.');
      return;
    }
    setAguardandoProtocoloBaixando(true);
    setPrepararAssinarErro('');
    setAguardandoProtocoloBaixarErro('');
    try {
      const preparado = await prepararAssinarAguardandoProtocolo(resultadoAguardandoProtocolo, credId);
      setPrepararAssinarResultado(preparado);
      const ids = Array.isArray(preparado?.peticaoIds) ? preparado.peticaoIds : [];
      try {
        await baixarZipLoteAguardandoProtocolo(ids);
      } catch (zipErr) {
        const msg = mensagemErroAmigavel(zipErr, 'gerar o ZIP para assinar');
        setPrepararAssinarErro(msg);
        setAguardandoProtocoloBaixarErro(msg);
      }
    } catch (prepErr) {
      const msg = mensagemErroAmigavel(prepErr, 'preparar os PDFs da pasta Assinar');
      setPrepararAssinarErro(msg);
      setAguardandoProtocoloBaixarErro(msg);
    } finally {
      setAguardandoProtocoloBaixando(false);
    }
  }

  async function abrirModalUploadAssinados() {
    if (!resultadoAguardandoProtocolo.length) return;
    setUploadAssinadosArquivos([]);
    setUploadAssinadosErro('');
    setUploadAssinadosResultado(null);
    setModalUploadAssinadosAberto(true);
  }

  function onSelecionarArquivosAssinados(e) {
    const files = [...(e.target.files || [])].filter((f) => f.name.toLowerCase().endsWith('.p7s'));
    if (!files.length) {
      setUploadAssinadosArquivos([]);
      setUploadAssinadosErro('Selecione arquivos .p7s assinados.');
      e.target.value = '';
      return;
    }
    const erroTamanho = validarTamanhoLoteP7s(files);
    setUploadAssinadosArquivos(files);
    setUploadAssinadosErro(erroTamanho);
    e.target.value = '';
  }

  async function enviarArquivosAssinados(substituir = false) {
    if (!uploadAssinadosArquivos.length) {
      setUploadAssinadosErro('Selecione ao menos um arquivo .p7s.');
      return;
    }
    const erroTamanho = validarTamanhoLoteP7s(uploadAssinadosArquivos);
    if (erroTamanho) {
      setUploadAssinadosErro(erroTamanho);
      return;
    }
    setUploadAssinadosEnviando(true);
    setUploadAssinadosErro('');
    try {
      const resp = await uploadAssinadosAguardandoProtocolo(uploadAssinadosArquivos, { substituir });
      setUploadAssinadosResultado(resp);
    } catch (e) {
      setUploadAssinadosErro(mensagemErroAmigavel(e, 'enviar os arquivos assinados'));
    } finally {
      setUploadAssinadosEnviando(false);
    }
  }

  function abrirListaAguardandoProvidencia() {
    const itens = listarProcessosFaseAguardandoProvidencia();
    setResultadoAguardandoProvidencia(itens);
    setModalResultadoAguardandoProvidenciaAberto(true);
  }

  function abrirListaProcAdministrativo() {
    const itens = listarProcessosFaseProcedimentoAdministrativo();
    setResultadoProcAdministrativo(itens);
    setModalResultadoProcAdministrativoAberto(true);
  }

  function abrirListaAudienciasPendentes() {
    const itens = listarAudienciasPendentes();
    setResultadoAudienciasPendentes(itens);
    setModalResultadoAudienciasPendentesAberto(true);
  }

  function mensagemResumoSincAgenda(r, prefixo = '') {
    if (r.reason === 'no-window') {
      return `${prefixo}Não foi possível executar (ambiente sem janela).`;
    }
    if (r.reason === 'mes-ano-invalido') {
      return `${prefixo}Mês ou ano inválidos.`;
    }
    if (!isAdmin) {
      const n = Number(r.processosAtualizados) || 0;
      return `${prefixo}${n > 0 ? `${n} processo(s) atualizado(s) com dados da agenda.` : 'Nenhum processo precisou de atualização neste período.'}`;
    }
    const apiFalhou = r.detalhe?.agendaApi?.reason === 'api-agenda-falha';
    const sufixoApi = apiFalhou
      ? ' — Aviso: falha ao listar compromissos na API (rede/sessão); só a agenda local foi usada nessa parte.'
      : '';
    const corpo =
      `Processos atualizados: ${r.processosAtualizados}. Eventos na agenda com vínculo (só storage local): ${r.eventosAgendaEnriquecidos}. ` +
      `Sem padrão/vínculo/CNJ: ${r.ignoradosSemPadraoCnj}. Sem correspondência na base: ${r.ignoradosSemMatchNaBase}. ` +
      `Ambíguos: ${r.ignoradosAmbiguos}. Sem registro após match: ${r.ignoradosSemRegistro}.`;
    return `${prefixo}${corpo}${sufixoApi}`;
  }

  function acionarRelatorio(btn) {
    const label = btn.id;
    setRelatorioAviso('');
    if (btn.emBreve) {
      setRelatorioAviso('Esta opção ainda não está disponível.');
      setFocado(label);
      return;
    }
    setFocado(label);
    if (label === 'Consultas Realizadas') {
      setModalConsultasRealizadasAberto(true);
    }
    if (label === 'Consultas à Realizar') {
      setModalConsultasARealizarAberto(true);
    }
    if (label === 'Audiências pendentes') {
      abrirListaAudienciasPendentes();
    }
    if (label === 'Prazo Fatal') {
      setModalPrazoFatalAberto(true);
    }
    if (label === 'Publicações') {
      setModalPublicacoesAberto(true);
    }
    if (label === 'Busca pessoa') {
      setCandidatosBuscaPessoa([]);
      setBuscaPessoaErro('');
      setBuscaPessoaCarregando(false);
      setTermoBuscaPessoa('');
      setModalBuscaPessoaAberto(true);
    }
    if (label === 'Busca por número') {
      setTermoBuscaNumeroProcesso('');
      setBuscaNumeroProcessoErro('');
      setBuscaNumeroProcessoCarregando(false);
      setResultadoBuscaNumeroProcesso([]);
      setRotuloBuscaNumeroProcesso('');
      setModalBuscaNumeroProcessoAberto(true);
    }
    if (label === 'Réus por cliente (Excel)') {
      setCodigoClienteReusExcel('');
      setReusExcelErro('');
      setReusExcelProgresso('');
      setReusExcelCarregando(false);
      setModalReusClienteExcelAberto(true);
    }
    if (label === 'Aguardando Documentos') {
      abrirListaAguardandoDocumentos();
    }
    if (label === 'Aguardando Peticionar') {
      abrirListaAguardandoPeticionar();
    }
    if (label === 'Aguardando Verificação') {
      abrirListaAguardandoVerificacao();
    }
    if (label === 'Aguardando Protocolo') {
      abrirListaAguardandoProtocolo();
    }
    if (label === 'Aguardando Providência') {
      abrirListaAguardandoProvidencia();
    }
    if (label === 'Proc. Administrativo') {
      abrirListaProcAdministrativo();
    }
  }

  async function executarSincronizacaoAudienciasAgendaProcessos() {
    setSyncAgendaMsg('Atualizando audiências…');
    try {
      const r = await executarSincronizacaoAudienciasAgendaMesEProcessos(syncAgendaMes, syncAgendaAno);
      setSyncAgendaMsg(mensagemResumoSincAgenda(r, `[${syncAgendaMes}/${syncAgendaAno}] `));
    } catch (e) {
      setSyncAgendaMsg(mensagemErroAmigavel(e, 'atualizar as audiências'));
    }
  }

  async function executarSincronizacaoTodaAgendaProcessos() {
    setSyncAgendaMsg('Atualizando audiências…');
    try {
      const r = await executarSincronizacaoAudienciasAgendaEProcessosCompleta();
      setSyncAgendaMsg(mensagemResumoSincAgenda(r, ''));
    } catch (e) {
      setSyncAgendaMsg(mensagemErroAmigavel(e, 'atualizar as audiências'));
    }
  }

  function abrirProcessoPorItem(item) {
    if (!item?.codCliente || item?.proc == null || item?.proc === '') return;
    setProcessoEmbed({
      revision: Date.now(),
      routerState: buildRouterStateChaveClienteProcesso(item.codCliente, item.proc),
    });
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/40 to-emerald-50/50 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-200/90 ring-1 ring-indigo-500/10 w-full max-w-2xl mx-auto overflow-hidden flex flex-col relative">
        {relatorioCarregando ? (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-[2px] rounded-2xl"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-hidden />
            <p className="text-sm font-medium text-slate-700">Gerando relatório…</p>
          </div>
        ) : null}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 shrink-0">
              <ClipboardList className="w-5 h-5 text-white" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate">Relatórios e Consultas</h2>
              <p className="text-xs text-white/80 truncate">Escolha o relatório que deseja gerar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="p-2 rounded-lg text-white/90 hover:bg-white/15 shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {GRUPOS_RELATORIOS.map((grupo) => (
            <div key={grupo.titulo} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-1">{grupo.titulo}</h3>
              {grupo.botoes.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  title={btn.dica}
                  disabled={relatorioCarregando}
                  onFocus={() => setFocado(btn.id)}
                  onClick={() => acionarRelatorio(btn)}
                  className={`px-4 py-2.5 rounded-xl border text-left text-sm font-medium transition-all ${
                    btn.emBreve ? 'opacity-60 cursor-not-allowed' : ''
                  } ${
                    focado === btn.id
                      ? 'border-indigo-400 border-2 bg-indigo-50/90 text-indigo-950 shadow-sm ring-2 ring-indigo-200/50'
                      : 'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 hover:border-indigo-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        {relatorioAviso ? (
          <p className="px-6 -mt-2 text-xs text-amber-800 text-center" role="status">
            {relatorioAviso}
          </p>
        ) : null}
        <div className="px-6 pb-4 space-y-3 border-t border-slate-100 pt-4 bg-slate-50/30">
          <div className="rounded-2xl border border-indigo-200/40 bg-gradient-to-br from-indigo-50/50 to-violet-50/30 p-4 space-y-2 shadow-sm">
            <p className="text-xs font-medium text-slate-700 text-center">
              Atualizar audiências nos processos a partir da agenda
            </p>
            <p className="text-[11px] text-slate-600 text-center leading-relaxed">
              {isAdmin
                ? 'Alinha compromissos da agenda com o histórico de audiência de cada processo (local + API quando ativa).'
                : 'Atualiza automaticamente as audiências dos processos com base nos compromissos da agenda. Escolha o mês ou toda a agenda.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <label className="flex items-center gap-1 text-xs text-slate-700">
                Mês
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={syncAgendaMes}
                  onChange={(e) => setSyncAgendaMes(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-14 px-1 py-0.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-700">
                Ano
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={syncAgendaAno}
                  onChange={(e) => setSyncAgendaAno(Number(e.target.value) || new Date().getFullYear())}
                  className="w-20 px-1 py-0.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
              </label>
              <button
                type="button"
                onClick={executarSincronizacaoAudienciasAgendaProcessos}
                className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-white text-xs font-medium text-indigo-900 hover:bg-indigo-50 shadow-sm"
              >
                Atualizar este mês
              </button>
              <button
                type="button"
                onClick={executarSincronizacaoTodaAgendaProcessos}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500"
              >
                Atualizar toda a agenda
              </button>
            </div>
            {syncAgendaMsg ? (
              <p className="text-[11px] text-slate-700 text-center leading-relaxed font-mono">{syncAgendaMsg}</p>
            ) : null}
          </div>
          <p className="text-xs text-slate-600 text-center leading-relaxed">
            {featureFlags.useApiProcessos
              ? '«Consultas Realizadas» lista um processo por linha na data do movimento (API + histórico local); se houver várias notas no mesmo dia, mostra a mais recente. Exclui «JUNTAR PETIÇÃO…» e «PETIÇÃO DA INF. ANTERIOR…».'
              : 'Os relatórios usam apenas os dados gravados neste navegador. «Consultas Realizadas» = linhas do histórico na data, exceto títulos automáticos do legado.'}
          </p>
        </div>
        <div className="px-6 pb-6 flex justify-center">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-8 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>

      {modalConsultasRealizadasAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 shrink-0">
              <h3 className="text-lg leading-none font-semibold text-white" title="Lista todas as linhas do histórico de processos gravadas na data">
                Consultas Realizadas
              </h3>
              <button
                type="button"
                onClick={() => setModalConsultasRealizadasAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] items-start gap-6">
                <p className="text-base md:text-xl leading-snug font-medium text-slate-800">
                  Informe o dia para listar todas as informações de histórico gravadas em processos:
                </p>
                <CampoDataBrComContador
                  value={dataConsulta}
                  onChange={setDataConsulta}
                  ariaLabel="Data do histórico gravado"
                />
              </div>

              <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void consultarPorData()}
                  className="min-w-[200px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
                >
                  Consultar
                </button>
                <button
                  type="button"
                  onClick={() => setModalConsultasRealizadasAberto(false)}
                  className="min-w-[160px] px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalBuscaNumeroProcessoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div
            className="w-full max-w-3xl bg-white border border-slate-200/90 rounded-2xl shadow-2xl ring-1 ring-indigo-500/10 overflow-hidden flex flex-col max-h-[min(92vh,720px)]"
            role="dialog"
            aria-labelledby="busca-numero-processo-titulo"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 shrink-0">
              <h3 id="busca-numero-processo-titulo" className="text-base font-semibold text-white">
                Busca por número de processo
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalBuscaNumeroProcessoAberto(false);
                  setBuscaNumeroProcessoErro('');
                  setBuscaNumeroProcessoCarregando(false);
                  setResultadoBuscaNumeroProcesso([]);
                  setRotuloBuscaNumeroProcesso('');
                }}
                className="p-2 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
              <p className="text-xs text-slate-600 leading-relaxed">
                Informe o CNJ (número único) com ou sem pontos e traços — por exemplo{' '}
                <code className="text-[11px] bg-slate-100 px-1 rounded">5338688-60.2023.8.09.0007</code> ou{' '}
                <code className="text-[11px] bg-slate-100 px-1 rounded">53386886020238090007</code>. A pesquisa
                compara apenas os dígitos. Inclui o histórico local deste navegador
                {featureFlags.useApiProcessos ? ' e, com a API de processos ativa, os registos no servidor.' : '.'}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 flex-1 min-w-[12rem]">
                  Número do processo
                  <input
                    type="text"
                    value={termoBuscaNumeroProcesso}
                    onChange={(e) => setTermoBuscaNumeroProcesso(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void executarBuscaNumeroProcesso();
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
                    placeholder="Ex.: 5338688-60.2023.8.09.0007"
                    autoFocus
                    autoComplete="off"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void executarBuscaNumeroProcesso()}
                  disabled={buscaNumeroProcessoCarregando}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-md disabled:opacity-50"
                >
                  {buscaNumeroProcessoCarregando ? 'A buscar…' : 'Buscar'}
                </button>
              </div>
              {rotuloBuscaNumeroProcesso ? (
                <p className="text-[11px] text-slate-600" aria-live="polite">
                  {rotuloBuscaNumeroProcesso}
                </p>
              ) : null}
              <div className="text-sm min-h-[1.25rem]" aria-live="polite">
                {buscaNumeroProcessoErro ? <span className="text-red-700">{buscaNumeroProcessoErro}</span> : null}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 mb-1">Resultados</p>
                <p className="text-xs text-slate-600 mb-2">
                  Duplo clique na linha abre em Processos. A coluna [papéis] indica origem (API ou histórico local).
                </p>
                <div className="border border-slate-300 bg-white max-h-[min(45vh,320px)] overflow-auto p-2 text-[13px] leading-relaxed font-mono">
                  {buscaNumeroProcessoCarregando ? (
                    <p className="text-slate-600">A buscar…</p>
                  ) : resultadoBuscaNumeroProcesso.length === 0 ? (
                    <p className="text-slate-600">
                      Nenhum processo encontrado. Confirme o número ou importe/grave o CNJ em Processos ou no
                      histórico local.
                    </p>
                  ) : (
                    resultadoBuscaNumeroProcesso.map((item, idx) => (
                      <p
                        key={`${item.codCliente}-${item.proc}-${idx}`}
                        className="whitespace-pre-wrap break-words cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 select-none"
                        onDoubleClick={() => abrirProcessoPorItem(item)}
                        title="Duplo clique: abrir em Processos"
                      >
                        {String(idx + 1).padStart(3, '0')} - (Cod. {item.codCliente}, Proc. {String(item.proc).padStart(2, '0')})
                        {' — '}
                        [{item.papeis}] {item.parteCliente || item.cliente || 'CLIENTE'} x {item.parteOposta || 'PARTE OPOSTA'}{' '}
                        ({item.numeroProcessoNovo || 'sem nº'})
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setModalBuscaNumeroProcessoAberto(false);
                  setBuscaNumeroProcessoErro('');
                  setBuscaNumeroProcessoCarregando(false);
                  setResultadoBuscaNumeroProcesso([]);
                  setRotuloBuscaNumeroProcesso('');
                }}
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalBuscaPessoaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div
            className="w-full max-w-xl bg-white border border-slate-200/90 rounded-2xl shadow-2xl ring-1 ring-indigo-500/10 overflow-hidden flex flex-col"
            role="dialog"
            aria-labelledby="busca-pessoa-titulo"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 shrink-0">
              <h3 id="busca-pessoa-titulo" className="text-base font-semibold text-white">
                Busca pessoa
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalBuscaPessoaAberto(false);
                  setCandidatosBuscaPessoa([]);
                  setBuscaPessoaErro('');
                  setBuscaPessoaCarregando(false);
                }}
                className="p-2 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                Busca única no cadastro (API). O relatório reúne, para a pessoa escolhida: processos no histórico
                local (como parte e/ou advogado), imóveis na API de locação (quando ativa) e atalhos ao cadastro e
                clientes.
              </p>

              <label className="block text-sm font-medium text-slate-700">
                Código, nome, CPF/CNPJ ou RG
                <input
                  type="text"
                  value={termoBuscaPessoa}
                  onChange={(e) => setTermoBuscaPessoa(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    const first = candidatosBuscaPessoa[0];
                    if (first) abrirResultadoProcessosParaPessoa(first);
                  }}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  placeholder="Ex.: 42, Maria Silva, 123.456.789-00, MG-12.345.678"
                  autoFocus
                  autoComplete="off"
                />
              </label>

              <p className="text-xs text-slate-500">
                A lista atualiza enquanto você digita. Código: só números. Nome ou RG: pelo menos 2 letras. CPF/CNPJ:
                pelo menos 3 dígitos. A API pode não filtrar por RG; prefira código, nome ou CPF. Enter abre o primeiro
                resultado da lista.
              </p>

              <div className="text-sm text-slate-600 min-h-[1.25rem]" aria-live="polite">
                {!String(termoBuscaPessoa ?? '').trim() ? (
                  <span className="text-slate-500">Comece a digitar para ver sugestões.</span>
                ) : !termoBuscaPessoaAtingeMinimoParaBuscar(termoBuscaPessoa) ? (
                  <span className="text-slate-500">
                    Digite pelo menos 2 letras (nome ou RG), 3 dígitos (CPF/CNPJ) ou só números para o código.
                  </span>
                ) : buscaPessoaErro ? (
                  <span className="text-red-700">{buscaPessoaErro}</span>
                ) : buscaPessoaCarregando ? (
                  <span>
                    Buscando…
                    {candidatosBuscaPessoa.length > 0 ? ' (lista abaixo pode ser da digitação anterior.)' : ''}
                  </span>
                ) : candidatosBuscaPessoa.length === 0 ? (
                  <span className="text-slate-500">Nenhuma pessoa encontrada.</span>
                ) : (
                  <span>
                    {candidatosBuscaPessoa.length} resultado(s). Clique em uma linha para abrir o relatório completo.
                  </span>
                )}
              </div>

              {termoBuscaPessoaAtingeMinimoParaBuscar(termoBuscaPessoa) && candidatosBuscaPessoa.length > 0 ? (
                <ul className="max-h-[min(50vh,320px)] overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100">
                  {candidatosBuscaPessoa.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 text-slate-800"
                        onClick={() => void abrirResultadoProcessosParaPessoa(p)}
                      >
                        <span className="font-medium">{p.nome || '—'}</span>
                        <span className="text-slate-500"> — cód. {p.id}</span>
                        {p.cpf ? <span className="text-slate-600"> — {p.cpf}</span> : null}
                        {p.rg ? <span className="text-slate-600"> — RG {p.rg}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalBuscaPessoaAberto(false);
                  setCandidatosBuscaPessoa([]);
                  setBuscaPessoaErro('');
                  setBuscaPessoaCarregando(false);
                }}
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalReusClienteExcelAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div
            className="w-full max-w-xl bg-white border border-slate-200/90 rounded-2xl shadow-2xl ring-1 ring-indigo-500/10 overflow-hidden flex flex-col"
            role="dialog"
            aria-labelledby="reus-excel-titulo"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 shrink-0">
              <h3 id="reus-excel-titulo" className="text-base font-semibold text-white">
                Réus por cliente (Excel)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalReusClienteExcelAberto(false);
                  setReusExcelErro('');
                  setReusExcelProgresso('');
                  setReusExcelCarregando(false);
                }}
                className="p-2 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Gera um ficheiro Excel com os réus ligados aos processos do cliente: nome e número da pessoa no
                cadastro (quando for possível localizar). A pesquisa no cadastro de pessoas usa a API.
                {featureFlags.useApiProcessos
                  ? ' A lista de processos vem da API de processos.'
                  : ' Com a API de processos desligada, a lista de processos vem só do histórico local neste navegador.'}
              </p>
              <label className="block text-sm font-medium text-slate-700">
                Código do cliente
                <input
                  type="text"
                  inputMode="numeric"
                  value={codigoClienteReusExcel}
                  onChange={(e) => setCodigoClienteReusExcel(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
                  placeholder="Ex.: 1 ou 00000001"
                  autoFocus
                  autoComplete="off"
                  disabled={reusExcelCarregando}
                />
              </label>
              <div className="text-sm min-h-[1.25rem]" aria-live="polite">
                {reusExcelErro ? (
                  <span className="text-red-700">{reusExcelErro}</span>
                ) : reusExcelCarregando ? (
                  <span className="text-slate-700">{reusExcelProgresso || 'A iniciar…'}</span>
                ) : reusExcelProgresso ? (
                  <span className="text-emerald-800">{reusExcelProgresso}</span>
                ) : (
                  <span className="text-slate-500 text-xs">
                    O navegador descarrega o ficheiro (normalmente para a pasta de descargas).
                  </span>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalReusClienteExcelAberto(false);
                  setReusExcelErro('');
                  setReusExcelProgresso('');
                  setReusExcelCarregando(false);
                }}
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
                disabled={reusExcelCarregando}
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => void gerarExcelReusCliente()}
                disabled={reusExcelCarregando}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
              >
                {reusExcelCarregando ? 'A gerar…' : 'Gerar Excel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalPrazoFatalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 shrink-0">
              <h3 className="text-lg leading-none font-semibold text-white">Prazo Fatal</h3>
              <button
                type="button"
                onClick={() => setModalPrazoFatalAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] items-start gap-6">
                <p className="text-base md:text-xl leading-snug font-medium text-slate-800">
                  Informe o dia que deseja consultar o prazo fatal:
                </p>
                <CampoDataBrComContador
                  value={dataPrazoFatal}
                  onChange={setDataPrazoFatal}
                  ariaLabel="Data do prazo fatal"
                />
              </div>

              <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void consultarPrazoFatalPorData()}
                  className="min-w-[200px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
                >
                  Consultar
                </button>
                <button
                  type="button"
                  onClick={() => setModalPrazoFatalAberto(false)}
                  className="min-w-[160px] px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalConsultasARealizarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 shrink-0">
              <h3 className="text-lg leading-none font-semibold text-white">Consultas à Realizar</h3>
              <button
                type="button"
                onClick={() => setModalConsultasARealizarAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] items-start gap-6">
                <p className="text-base md:text-xl leading-snug font-medium text-slate-800">
                  Informe o dia que deseja consultar:
                </p>
                <CampoDataBrComContador
                  value={dataConsulta}
                  onChange={setDataConsulta}
                  ariaLabel="Data da consulta"
                />
              </div>

              <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={consultarPorDataConsultasARealizar}
                  className="min-w-[200px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
                >
                  Consultar
                </button>
                <button
                  type="button"
                  onClick={() => setModalConsultasARealizarAberto(false)}
                  className="min-w-[160px] px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalPublicacoesAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 shrink-0">
              <h3 className="text-lg leading-none font-semibold text-white">Publicações</h3>
              <button
                type="button"
                onClick={() => setModalPublicacoesAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] items-start gap-6">
                <p className="text-base md:text-xl leading-snug font-medium text-slate-800">
                  Informe o dia que deseja consultar:
                </p>
                <CampoDataBrComContador
                  value={dataConsulta}
                  onChange={setDataConsulta}
                  ariaLabel="Data da consulta"
                />
              </div>

              <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void consultarPorDataPublicacoes()}
                  className="min-w-[200px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
                >
                  Consultar
                </button>
                <button
                  type="button"
                  onClick={() => setModalPublicacoesAberto(false)}
                  className="min-w-[160px] px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ModalResultadoHistoricoLista
        open={modalResultadoAberto}
        onClose={() => setModalResultadoAberto(false)}
        titulo={rotuloResultadoConsulta}
        dataConsulta={dataConsulta}
        itens={resultadoConsulta}
        erroMensagem={consultaHistoricoErro}
        onOpenProcesso={abrirProcessoPorItem}
      />

      {modalResultadoBuscaPessoaAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-6xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10 max-h-[min(92vh,900px)] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0">
              <p className="text-base text-white pr-2">Relatório da pessoa: {rotuloPessoaBusca}</p>
              <button
                type="button"
                onClick={() => {
                  setModalResultadoBuscaPessoaAberto(false);
                  setIdPessoaBuscaDiag(null);
                  setImoveisRelatorioBusca({ status: 'idle', itens: [] });
                  setBuscaPessoaProcessosCarregando(false);
                }}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15 shrink-0"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0 space-y-4">
              {idPessoaBuscaDiag != null ? (
                <div className="rounded border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800">
                  <p className="font-medium text-slate-700 mb-2">Atalhos</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border border-blue-600 bg-blue-50 text-blue-900 text-xs font-medium hover:bg-blue-100"
                      onClick={() => {
                        setModalResultadoBuscaPessoaAberto(false);
                        setIdPessoaBuscaDiag(null);
                        setImoveisRelatorioBusca({ status: 'idle', itens: [] });
                        setBuscaPessoaProcessosCarregando(false);
                        navigate(`/clientes/editar/${idPessoaBuscaDiag}`);
                      }}
                    >
                      Cadastro de Pessoas (edição)
                    </button>
                    {listarCodigosClientePorIdPessoa(idPessoaBuscaDiag, clientesCodigosLista).map((cod) => (
                      <button
                        key={cod}
                        type="button"
                        className="px-3 py-1.5 rounded border border-slate-400 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50"
                        onClick={() => {
                          setModalResultadoBuscaPessoaAberto(false);
                          setIdPessoaBuscaDiag(null);
                          setImoveisRelatorioBusca({ status: 'idle', itens: [] });
                          setBuscaPessoaProcessosCarregando(false);
                          navigate('/pessoas', {
                            state: buildRouterStateChaveClienteProcesso(padCliente8Nav(cod), ''),
                          });
                        }}
                      >
                        Clientes — cód. {padCliente8Nav(cod)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800">
                <p className="font-medium text-slate-700 mb-1">
                  Resumo {featureFlags.useApiProcessos ? '(API + histórico local)' : 'no histórico local de processos'}
                </p>
                <p className="text-slate-600">
                  {buscaPessoaProcessosCarregando ? (
                    'Carregando vínculos de processos…'
                  ) : resultadoBuscaPessoa.length === 0 ? (
                    featureFlags.useApiProcessos ? (
                      'Nenhum processo encontrado para esta pessoa na API nem no histórico local deste navegador.'
                    ) : (
                      'Nenhum processo encontrado para esta pessoa no histórico deste navegador.'
                    )
                  ) : (
                    (() => {
                        const comAdv = resultadoBuscaPessoa.filter((x) =>
                          String(x.papeis || '').includes('Advogado')
                        ).length;
                        const comParte = resultadoBuscaPessoa.filter(
                          (x) =>
                            String(x.papeis || '').includes('Parte Cliente') ||
                            String(x.papeis || '').includes('Parte Oposta')
                        ).length;
                        return (
                          <>
                            {resultadoBuscaPessoa.length} processo(s) listado(s) abaixo. Destes,{' '}
                            <span className="font-medium text-slate-800">{comParte}</span> com papel de parte (cliente
                            ou oposta) e <span className="font-medium text-slate-800">{comAdv}</span> em que figura como
                            advogado(a) (a coluna [papéis] detalha cada um).
                          </>
                        );
                      })()
                  )}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-800 mb-2">
                  Processos {featureFlags.useApiProcessos ? '(API e histórico local)' : '(histórico local)'}
                </p>
                <p className="text-xs text-slate-600 mb-2">
                  Duplo clique na linha abre em Processos. A coluna [papéis] indica se é parte e/ou advogado(a).
                </p>
                <div className="border border-slate-300 bg-white max-h-[240px] overflow-auto p-2 text-[13px] leading-relaxed font-mono">
                  {buscaPessoaProcessosCarregando ? (
                    <p className="text-slate-600">Carregando…</p>
                  ) : resultadoBuscaPessoa.length === 0 ? (
                    <p className="text-slate-600">
                      {featureFlags.useApiProcessos
                        ? 'Nenhum processo na API nem no histórico local em que esta pessoa figure como cliente do processo, parte ou advogado(a).'
                        : 'Nenhum processo no histórico local. Vincule a pessoa nas partes ou como advogado em Processos para aparecer aqui.'}
                    </p>
                  ) : (
                    resultadoBuscaPessoa.map((item, idx) => (
                      <p
                        key={`${item.codCliente}-${item.proc}-${idx}`}
                        className="whitespace-pre-wrap break-words cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 select-none"
                        onDoubleClick={() => abrirProcessoPorItem(item)}
                        title="Duplo clique: abrir em Processos"
                      >
                        {String(idx + 1).padStart(3, '0')} - (Cod. {item.codCliente}, Proc. {String(item.proc).padStart(2, '0')})
                        {' — '}
                        [{item.papeis}] {item.parteCliente || item.cliente || 'CLIENTE'} x {item.parteOposta || 'PARTE OPOSTA'}{' '}
                        ({item.numeroProcessoNovo || 'sem nº'})
                      </p>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-800 mb-2">Imóveis</p>
                {!featureFlags.useApiImoveis ? (
                  <p className="text-xs text-slate-600">
                    Lista de imóveis por pessoa requer a API de imóveis ativa (`VITE_USE_API_IMOVEIS`). Com o cadastro
                    legado, abra Imóveis manualmente e confira proprietário/inquilino.
                  </p>
                ) : imoveisRelatorioBusca.status === 'loading' ? (
                  <p className="text-sm text-slate-600">Carregando imóveis…</p>
                ) : imoveisRelatorioBusca.status === 'erro' ? (
                  <p className="text-sm text-red-700">Não foi possível consultar imóveis na API.</p>
                ) : imoveisRelatorioBusca.itens.length === 0 ? (
                  <p className="text-xs text-slate-600">
                    Nenhum imóvel encontrado na API em que esta pessoa seja proprietário(a) ou inquilino(a) em contrato de
                    locação.
                  </p>
                ) : (
                  <ul className="space-y-2 border border-slate-300 bg-white rounded p-2 text-sm">
                    {imoveisRelatorioBusca.itens.map((im, i) => (
                      <li key={`${im.imovelId}-${im.papel}-${i}`} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 last:border-0">
                        <span className="text-slate-800">
                          Imóvel nº {im.imovelId} — <span className="font-medium">{im.papel}</span>
                          {im.unidade ? ` — ${im.unidade}` : ''}
                          {im.condominio ? ` (${im.condominio})` : ''}
                        </span>
                        <span className="text-slate-500 text-xs truncate max-w-full">{im.endereco}</span>
                        <button
                          type="button"
                          className="px-2 py-1 rounded border border-teal-600 text-teal-900 text-xs font-medium hover:bg-teal-50"
                          onClick={() => {
                            setModalResultadoBuscaPessoaAberto(false);
                            setIdPessoaBuscaDiag(null);
                            setImoveisRelatorioBusca({ status: 'idle', itens: [] });
                            setBuscaPessoaProcessosCarregando(false);
                            navigate('/imoveis', { state: { imovelId: im.imovelId } });
                          }}
                        >
                          Abrir Imóveis
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200/80 flex justify-center bg-slate-50/90 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setModalResultadoBuscaPessoaAberto(false);
                  setIdPessoaBuscaDiag(null);
                  setImoveisRelatorioBusca({ status: 'idle', itens: [] });
                  setBuscaPessoaProcessosCarregando(false);
                }}
                className="min-w-[120px] px-8 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoAguardandoDocsAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-6xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0">
              <p className="text-base text-white">
                Processos em fase Aguardando Documentos (Ag. Documentos)
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoDocsAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-slate-700 mb-3">
                {resultadoAguardandoDocs.length} processo(s). Duplo clique na linha para abrir em Processos. A fase é gravada ao marcar em Processos ou ao sincronizar com o histórico local.
              </p>
              <div className="border border-slate-200 rounded-xl bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono ring-1 ring-slate-100">
                {resultadoAguardandoDocs.length === 0 ? (
                  <p>Nenhum processo com essa fase no momento. Marque &quot;Ag. Documentos&quot; em Processos ou abra processos para sincronizar a fase.</p>
                ) : (
                  resultadoAguardandoDocs.map((item, idx) => (
                    <p
                      key={`${item.codCliente}-${item.proc}-${idx}`}
                      className="whitespace-pre-wrap break-words cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 select-none"
                      onDoubleClick={() => abrirProcessoPorItem(item)}
                      title="Duplo clique: abrir em Processos"
                    >
                      {String(idx + 1).padStart(3, '0')} - (Cod. {item.codCliente}, Proc. {String(item.proc).padStart(2, '0')}){' '}
                      {item.parteCliente || item.cliente || 'CLIENTE'} x {item.parteOposta || 'PARTE OPOSTA'} ({item.numeroProcessoNovo || 'sem nº'})
                      {' — '}
                      Fase: {item.faseSelecionada}
                    </p>
                  ))
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200/80 flex justify-center bg-slate-50/90">
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoDocsAberto(false)}
                className="min-w-[120px] px-8 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoAguardandoPeticionarAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-6xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0">
              <p className="text-base text-white">
                Processos em fase Aguardando Peticionar (Ag. Peticionar)
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoPeticionarAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-slate-700 mb-3">
                {resultadoAguardandoPeticionar.length} processo(s). Duplo clique na linha para abrir em Processos. A fase é gravada ao marcar em Processos ou ao sincronizar com o histórico local.
              </p>
              <div className="border border-slate-200 rounded-xl bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono ring-1 ring-slate-100">
                {resultadoAguardandoPeticionar.length === 0 ? (
                  <p>Nenhum processo com essa fase no momento. Marque &quot;Ag. Peticionar&quot; em Processos ou abra processos para sincronizar a fase.</p>
                ) : (
                  resultadoAguardandoPeticionar.map((item, idx) => (
                    <p
                      key={`${item.codCliente}-${item.proc}-${idx}`}
                      className="whitespace-pre-wrap break-words cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 select-none"
                      onDoubleClick={() => abrirProcessoPorItem(item)}
                      title="Duplo clique: abrir em Processos"
                    >
                      {String(idx + 1).padStart(3, '0')} - (Cod. {item.codCliente}, Proc. {String(item.proc).padStart(2, '0')}){' '}
                      {item.parteCliente || item.cliente || 'CLIENTE'} x {item.parteOposta || 'PARTE OPOSTA'} ({item.numeroProcessoNovo || 'sem nº'})
                      {' — '}
                      Fase: {item.faseSelecionada}
                    </p>
                  ))
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200/80 flex justify-center bg-slate-50/90">
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoPeticionarAberto(false)}
                className="min-w-[120px] px-8 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoAguardandoVerificacaoAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-6xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0">
              <p className="text-base text-white">
                Processos em fase Aguardando Verificação (Ag. Verificação)
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoVerificacaoAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-slate-700 mb-3">
                {resultadoAguardandoVerificacao.length} processo(s). Duplo clique na linha para abrir em Processos. A fase é gravada ao marcar em Processos ou ao sincronizar com o histórico local.
              </p>
              <div className="border border-slate-200 rounded-xl bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono ring-1 ring-slate-100">
                {resultadoAguardandoVerificacao.length === 0 ? (
                  <p>Nenhum processo com essa fase no momento. Marque &quot;Ag. Verificação&quot; em Processos ou abra processos para sincronizar a fase.</p>
                ) : (
                  resultadoAguardandoVerificacao.map((item, idx) => (
                    <p
                      key={`${item.codCliente}-${item.proc}-${idx}`}
                      className="whitespace-pre-wrap break-words cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 select-none"
                      onDoubleClick={() => abrirProcessoPorItem(item)}
                      title="Duplo clique: abrir em Processos"
                    >
                      {String(idx + 1).padStart(3, '0')} - (Cod. {item.codCliente}, Proc. {String(item.proc).padStart(2, '0')}){' '}
                      {item.parteCliente || item.cliente || 'CLIENTE'} x {item.parteOposta || 'PARTE OPOSTA'} ({item.numeroProcessoNovo || 'sem nº'})
                      {' — '}
                      Fase: {item.faseSelecionada}
                    </p>
                  ))
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200/80 flex justify-center bg-slate-50/90">
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoVerificacaoAberto(false)}
                className="min-w-[120px] px-8 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoAguardandoProtocoloAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-6xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0">
              <p className="text-base text-white">
                Processos em fase Aguardando Protocolo (Protocolo / Movimentação)
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoProtocoloAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-slate-700 mb-3">
                {resultadoAguardandoProtocolo.length} processo(s). Duplo clique na linha para abrir em Processos. A lista usa o cadastro na API; o histórico local deste navegador só entra se o processo ainda não estiver na API ou se a fase na API for a mesma. Processos com petição já na fila PROJUDI (assinada, agendada ou pendente) não aparecem aqui.
              </p>
              {aguardandoProtocoloBaixarErro ? (
                <p className="text-sm text-red-600 mb-2" role="alert">
                  {aguardandoProtocoloBaixarErro}
                </p>
              ) : null}
              <div className="border border-slate-200 rounded-xl bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono ring-1 ring-slate-100">
                {resultadoAguardandoProtocolo.length === 0 ? (
                  <p>
                    Nenhum processo com essa fase no momento. Use «Inserir na Pasta Assinar», marque «Protocolo / Movimentação» em Processos ou aguarde a sincronização com a API.
                  </p>
                ) : (
                  <ul className="list-none m-0 p-0 space-y-0">
                    {resultadoAguardandoProtocolo.map((item, idx) => {
                      const { codCliente, proc } = chavesClienteProcAguardandoProtocolo(item);
                      const abrivel = itemAguardandoProtocoloAbrivel(item);
                      return (
                        <li
                          key={`${codCliente ?? 'x'}-${proc ?? 'y'}-${idx}`}
                          className={`whitespace-pre-wrap break-words rounded px-1 -mx-1 select-none ${
                            abrivel ? 'cursor-pointer hover:bg-slate-100' : ''
                          }`}
                          onDoubleClick={
                            abrivel
                              ? () => abrirProcessoPorItem({ codCliente, proc })
                              : undefined
                          }
                          title={abrivel ? 'Duplo clique: abrir em Processos' : undefined}
                        >
                          {String(idx + 1).padStart(3, '0')} - (Cod. {codCliente}, Proc.{' '}
                          {String(proc).padStart(2, '0')}){' '}
                          {item.parteCliente || item.cliente || 'CLIENTE'} x{' '}
                          {item.parteOposta || 'PARTE OPOSTA'} ({item.numeroProcessoNovo || 'sem nº'})
                          {' — '}
                          Fase: {item.faseSelecionada}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200/80 flex flex-wrap justify-center gap-2 bg-slate-50/90">
              <button
                type="button"
                onClick={() => void iniciarAssinarAutomatico()}
                disabled={
                  !resultadoAguardandoProtocolo.length ||
                  aguardandoProtocoloBaixando ||
                  assinarAutomaticoAtivo
                }
                className="min-w-[220px] flex-1 max-w-xs px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {assinarAutomaticoAtivo ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Assinando…
                  </>
                ) : (
                  'Assinar automaticamente'
                )}
              </button>
              <button
                type="button"
                onClick={() => void abrirModalPrepararAssinar()}
                disabled={
                  !resultadoAguardandoProtocolo.length ||
                  aguardandoProtocoloBaixando ||
                  assinarAutomaticoAtivo
                }
                className="min-w-[220px] flex-1 max-w-xs px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {aguardandoProtocoloBaixando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Gerando ZIP…
                  </>
                ) : (
                  'Assinar manualmente (baixar ZIP)'
                )}
              </button>
              <button
                type="button"
                onClick={() => void abrirModalUploadAssinados()}
                disabled={!resultadoAguardandoProtocolo.length}
                className="min-w-[180px] px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload dos Arquivos Assinados
              </button>
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoProtocoloAberto(false)}
                className="min-w-[120px] px-8 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAssinarAutomaticoAberto && (
        <div className="fixed inset-0 z-[67] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-violet-500/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-violet-700 to-indigo-700 text-white shrink-0">
              <p className="text-base font-semibold">Assinatura automática</p>
              <button
                type="button"
                onClick={fecharModalAssinarAutomatico}
                disabled={assinarAutomaticoAtivo && assinarAutomaticoFase !== 'concluido' && assinarAutomaticoFase !== 'erro'}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-5 space-y-4 text-sm text-slate-700">
              {assinarAutomaticoFase === 'preparando' || (!assinarAutomaticoFase && assinarAutomaticoAtivo) ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-hidden />
                  <p className="font-medium text-slate-800">Preparando…</p>
                  <p className="text-xs text-slate-500">
                    Buscando PDFs no Drive e enfileirando lote para o assinador local.
                    {assinarAutomaticoLoteId != null ? ` · Lote #${assinarAutomaticoLoteId}` : ''}
                  </p>
                </div>
              ) : null}
              {assinarAutomaticoFase === 'aguardando' ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-hidden />
                  <p className="font-medium text-slate-800">Aguardando assinatura no token…</p>
                  <p className="text-xs text-slate-500">
                    {assinarAutomaticoPeticaoCount > 0
                      ? `${assinarAutomaticoPeticaoCount} petição(ões) no lote`
                      : 'O assinador local deve estar conectado e autenticado.'}
                    {assinarAutomaticoLoteId != null ? ` · Lote #${assinarAutomaticoLoteId}` : ''}
                  </p>
                </div>
              ) : null}
              {assinarAutomaticoFase === 'concluido' ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-4 text-center space-y-2">
                  <p className="font-semibold text-emerald-900">
                    Concluído! {assinarAutomaticoPeticaoCount} petição(ões) assinada(s)
                  </p>
                  <p className="text-xs text-emerald-800">
                    As petições estão com status ASSINADA e prontas para protocolar no PROJUDI.
                  </p>
                </div>
              ) : null}
              {assinarAutomaticoFase === 'erro' ? (
                <div className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-3 text-sm text-red-800 space-y-2" role="alert">
                  <p className="font-medium">
                    {assinarAutomaticoErroCodigo === 'TOKEN_OCUPADO'
                      ? MSG_TOKEN_OCUPADO_ASSINADOR
                      : 'Não foi possível concluir a assinatura automática'}
                  </p>
                  {assinarAutomaticoErroCodigo !== 'TOKEN_OCUPADO' && assinarAutomaticoErro ? (
                    <p className="leading-relaxed">{assinarAutomaticoErro}</p>
                  ) : null}
                  {assinarAutomaticoErroCodigo === 'TOKEN_OCUPADO' && assinarAutomaticoErro &&
                  assinarAutomaticoErro !== MSG_TOKEN_OCUPADO_ASSINADOR ? (
                    <p className="text-xs leading-relaxed">{assinarAutomaticoErro}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="px-4 py-3 border-t border-slate-200/80 flex flex-wrap justify-center gap-2 bg-slate-50/90">
              {assinarAutomaticoFase === 'concluido' ? (
                <button
                  type="button"
                  onClick={irParaPeticionamentoProjudi}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white"
                >
                  Abrir Peticionamento PROJUDI
                </button>
              ) : null}
              {assinarAutomaticoFase === 'erro' && assinarAutomaticoErroCodigo === 'TOKEN_OCUPADO' ? (
                <button
                  type="button"
                  onClick={() => void tentarNovamenteAssinarAutomatico()}
                  disabled={assinarAutomaticoReliberando || assinarAutomaticoLoteId == null}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {assinarAutomaticoReliberando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Re-liberando…
                    </>
                  ) : (
                    'Tentar novamente'
                  )}
                </button>
              ) : null}
              {assinarAutomaticoFase === 'erro' ? (
                <button
                  type="button"
                  onClick={abrirFluxoManualAssinar}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-semibold text-white"
                >
                  Assinar manualmente (baixar ZIP)
                </button>
              ) : null}
              {assinarAutomaticoFase === 'erro' || assinarAutomaticoFase === 'concluido' ? (
                <button
                  type="button"
                  onClick={fecharModalAssinarAutomatico}
                  className="px-6 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Fechar
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {modalPrepararAssinarAberto && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-emerald-500/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-emerald-700 to-teal-700 text-white shrink-0">
              <p className="text-base font-semibold">Baixar Arquivos para Assinar</p>
              <button
                type="button"
                onClick={() => setModalPrepararAssinarAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3 text-sm text-slate-700">
              <p>
                Os PDFs da pasta <strong>Assinar</strong> serão pré-registrados na fila PROJUDI
                (pendentes de assinatura). O ZIP usa nomes canônicos; o pareamento no retorno é por{' '}
                <strong>hash do conteúdo</strong>, não por nome.
              </p>
              <p className="text-xs text-slate-500">
                Cada «Preparar e baixar» busca os PDFs de novo na pasta <strong>Assinar</strong> do
                Drive e descarta preparações anteriores (pendentes ou não concluídas). PDFs já
                protocolados no PROJUDI não entram no lote. Arquivos grandes abrem o diálogo
                «Salvar como» do navegador (evita queda da aba por falta de memória).
              </p>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Credencial PROJUDI</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={prepararAssinarCredencialId}
                  onChange={(e) => setPrepararAssinarCredencialId(e.target.value)}
                  disabled={aguardandoProtocoloBaixando || !!prepararAssinarResultado}
                >
                  {prepararAssinarCredenciais.length === 0 ? (
                    <option value="">Carregando…</option>
                  ) : (
                    prepararAssinarCredenciais.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.rotulo
                          ? `#${c.id} — ${c.cpfUsuario || ''} — ${c.rotulo}`
                          : c.nome || c.login || `Credencial #${c.id}`}
                      </option>
                    ))
                  )}
                </select>
              </label>
              {prepararAssinarErro ? (
                <div className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-800" role="alert">
                  <p className="font-medium">Não foi possível concluir o download</p>
                  <p className="mt-1 leading-relaxed">{prepararAssinarErro}</p>
                </div>
              ) : null}
              {prepararAssinarResultado ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-900 space-y-2">
                  <p className="font-medium">
                    {prepararAssinarResultado.totalArquivos ?? 0} PDF(s) no ZIP ·{' '}
                    {(prepararAssinarResultado.peticaoIds || []).length} petição(ões)
                  </p>
                  {Array.isArray(prepararAssinarResultado.resumo) &&
                    prepararAssinarResultado.resumo.map((r, i) => (
                      <p key={i} className="text-xs font-mono leading-relaxed">
                        {r.cnj || '—'}: {r.registradas ?? 0} registrada(s), {r.reutilizadas ?? 0}{' '}
                        reaproveitada(s), {r.ignoradasJaAssinadas ?? 0} já assinada(s)
                        {r.semArquivos ? ', sem arquivos' : ''}
                      </p>
                    ))}
                </div>
              ) : null}
            </div>
            <div className="px-4 py-3 border-t border-slate-200/80 flex flex-wrap justify-center gap-2 bg-slate-50/90">
              {prepararAssinarResultado ? (
                <button
                  type="button"
                  onClick={() => setModalPrepararAssinarAberto(false)}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-semibold text-white"
                >
                  Fechar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void confirmarPrepararEBaixar()}
                  disabled={aguardandoProtocoloBaixando || !prepararAssinarCredencialId}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {aguardandoProtocoloBaixando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Preparando e baixando…
                    </>
                  ) : (
                    'Preparar e baixar ZIP'
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setModalPrepararAssinarAberto(false)}
                className="px-6 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalUploadAssinadosAberto && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-sky-700 to-indigo-700 text-white shrink-0">
              <p className="text-base font-semibold">Upload dos Arquivos Assinados</p>
              <button
                type="button"
                onClick={() => setModalUploadAssinadosAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3 text-sm text-slate-700">
              <p>
                O pareamento é por <strong>conteúdo (hash)</strong>. O nome dos .p7s pode mudar ao
                assinar (vira .p7s, pode achatar pastas) — não é preciso preservar nome nem
                estrutura.
              </p>
              <p className="text-xs text-slate-500">
                Limite por envio: até {formatBytesCompact(UPLOAD_P7S_LIMITE_BYTES)} no total. Se
                houver muitos arquivos ou PDFs grandes, envie em lotes menores.
              </p>
              <div>
                <input
                  ref={inputUploadAssinadosRef}
                  type="file"
                  accept=".p7s,application/pkcs7-signature"
                  multiple
                  className="hidden"
                  onChange={onSelecionarArquivosAssinados}
                />
                <button
                  type="button"
                  onClick={() => inputUploadAssinadosRef.current?.click()}
                  className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:bg-slate-50"
                >
                  {uploadAssinadosArquivos.length
                    ? `${uploadAssinadosArquivos.length} arquivo(s) .p7s · ${formatBytesCompact(somaBytesArquivos(uploadAssinadosArquivos))}`
                    : 'Clique para escolher arquivos .p7s'}
                </button>
              </div>
              {uploadAssinadosErro ? (
                <p className="text-sm text-red-600" role="alert">
                  {uploadAssinadosErro}
                </p>
              ) : null}
              {uploadAssinadosResultado ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-800 space-y-2">
                  <p>
                    <strong>Pareadas:</strong> {uploadAssinadosResultado.pareadas ?? 0}
                  </p>
                  <p>
                    <strong>Já assinadas:</strong> {uploadAssinadosResultado.jaAssinadas ?? 0}
                  </p>
                  {(uploadAssinadosResultado.naoPareadas || []).length > 0 ? (
                    <p className="text-xs">
                      <strong>Não pareadas:</strong>{' '}
                      {uploadAssinadosResultado.naoPareadas.join(', ')}
                    </p>
                  ) : null}
                  {(uploadAssinadosResultado.ambiguas || []).length > 0 ? (
                    <p className="text-xs text-amber-800">
                      <strong>Ambíguas:</strong> {uploadAssinadosResultado.ambiguas.join(', ')}
                      <span className="block mt-1 text-amber-900/90">
                        Há mais de um registro pendente com o mesmo conteúdo (preparações anteriores).
                      </span>
                    </p>
                  ) : null}
                  {uploadAssinadosResultado.requerConfirmacaoSubstituicao ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 space-y-2">
                      <p>
                        Parte dos arquivos já consta na fila ou conflita com preparações anteriores.
                        Deseja <strong>substituir</strong> as assinaturas/registros antigos pelos .p7s
                        enviados agora?
                      </p>
                      <button
                        type="button"
                        onClick={() => void enviarArquivosAssinados(true)}
                        disabled={uploadAssinadosEnviando}
                        className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                      >
                        Substituir e enviar de novo
                      </button>
                    </div>
                  ) : null}
                  {(uploadAssinadosResultado.invalidas || []).length > 0 ? (
                    <p className="text-xs text-red-700">
                      <strong>Inválidas:</strong> {uploadAssinadosResultado.invalidas.join(', ')}
                    </p>
                  ) : null}
                  {(uploadAssinadosResultado.semConteudo || []).length > 0 ? (
                    <p className="text-xs text-red-700">
                      <strong>Sem conteúdo embutido:</strong>{' '}
                      {uploadAssinadosResultado.semConteudo.join(', ')}
                    </p>
                  ) : null}
                  <p className="font-medium text-emerald-800">
                    {uploadAssinadosResultado.peticoesQueViraramAssinadas ?? 0} petição(ões) com
                    status ASSINADA (prontas para protocolar).
                  </p>
                </div>
              ) : null}
            </div>
            <div className="px-4 py-3 border-t border-slate-200/80 flex flex-wrap justify-center gap-2 bg-slate-50/90">
              {(uploadAssinadosResultado?.pareadas > 0 ||
                uploadAssinadosResultado?.peticoesQueViraramAssinadas > 0) ? (
                <button
                  type="button"
                  onClick={() => {
                    setModalUploadAssinadosAberto(false);
                    setModalResultadoAguardandoProtocoloAberto(false);
                    navigate('/processos/peticionamento-projudi');
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white"
                >
                  Abrir Peticionamento PROJUDI
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void enviarArquivosAssinados(false)}
                  disabled={uploadAssinadosEnviando || !uploadAssinadosArquivos.length}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {uploadAssinadosEnviando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Registrando…
                    </>
                  ) : (
                    'Enviar .p7s assinados'
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setModalUploadAssinadosAberto(false)}
                className="px-6 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoAguardandoProvidenciaAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-6xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0">
              <p className="text-base text-white">Processos em fase Aguardando Providência</p>
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoProvidenciaAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-slate-700 mb-3">
                {resultadoAguardandoProvidencia.length} processo(s). Duplo clique na linha para abrir em Processos. A fase
                é gravada ao marcar em Processos ou ao sincronizar com o histórico local.
              </p>
              <div className="border border-slate-200 rounded-xl bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono ring-1 ring-slate-100">
                {resultadoAguardandoProvidencia.length === 0 ? (
                  <p>
                    Nenhum processo com essa fase no momento. Marque &quot;Aguardando Providência&quot; em Processos ou
                    abra processos para sincronizar a fase.
                  </p>
                ) : (
                  resultadoAguardandoProvidencia.map((item, idx) => (
                    <p
                      key={`${item.codCliente}-${item.proc}-${idx}`}
                      className="whitespace-pre-wrap break-words cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 select-none"
                      onDoubleClick={() => abrirProcessoPorItem(item)}
                      title="Duplo clique: abrir em Processos"
                    >
                      {String(idx + 1).padStart(3, '0')} - (Cod. {item.codCliente}, Proc. {String(item.proc).padStart(2, '0')}){' '}
                      {item.parteCliente || item.cliente || 'CLIENTE'} x {item.parteOposta || 'PARTE OPOSTA'} (
                      {item.numeroProcessoNovo || 'sem nº'})
                      {' — '}
                      Fase: {item.faseSelecionada}
                    </p>
                  ))
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200/80 flex justify-center bg-slate-50/90">
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoProvidenciaAberto(false)}
                className="min-w-[120px] px-8 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoProcAdministrativoAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-6xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0">
              <p className="text-base text-white">
                Processos em fase Proc. Administrativo (Procedimento Adm.)
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoProcAdministrativoAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-slate-700 mb-3">
                {resultadoProcAdministrativo.length} processo(s). Duplo clique na linha para abrir em Processos. A fase é
                gravada ao marcar em Processos ou ao sincronizar com o histórico local.
              </p>
              <div className="border border-slate-200 rounded-xl bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono ring-1 ring-slate-100">
                {resultadoProcAdministrativo.length === 0 ? (
                  <p>
                    Nenhum processo com essa fase no momento. Marque &quot;Procedimento Adm.&quot; em Processos ou abra
                    processos para sincronizar a fase.
                  </p>
                ) : (
                  resultadoProcAdministrativo.map((item, idx) => (
                    <p
                      key={`${item.codCliente}-${item.proc}-${idx}`}
                      className="whitespace-pre-wrap break-words cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 select-none"
                      onDoubleClick={() => abrirProcessoPorItem(item)}
                      title="Duplo clique: abrir em Processos"
                    >
                      {String(idx + 1).padStart(3, '0')} - (Cod. {item.codCliente}, Proc. {String(item.proc).padStart(2, '0')}){' '}
                      {item.parteCliente || item.cliente || 'CLIENTE'} x {item.parteOposta || 'PARTE OPOSTA'} (
                      {item.numeroProcessoNovo || 'sem nº'})
                      {' — '}
                      Fase: {item.faseSelecionada}
                    </p>
                  ))
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200/80 flex justify-center bg-slate-50/90">
              <button
                type="button"
                onClick={() => setModalResultadoProcAdministrativoAberto(false)}
                className="min-w-[120px] px-8 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoAudienciasPendentesAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-6xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0">
              <p className="text-base text-white">Audiências pendentes (data hoje ou futura)</p>
              <button
                type="button"
                onClick={() => setModalResultadoAudienciasPendentesAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-slate-700 mb-3">
                {resultadoAudienciasPendentes.length} processo(s) com data de audiência gravada no histórico local (
                <code className="text-xs bg-slate-100 px-1">vilareal:processos-historico:v1</code>
                ). Só entram processos cuja data da audiência é{' '}
                <span className="font-semibold">hoje ou futura</span>, no formato válido{' '}
                <code className="text-xs bg-slate-100 px-1">dd/mm/aaaa</code>. Com API de processos ativa, a audiência é
                espelhada neste armazenamento ao salvar o processo com sucesso. Duplo clique na linha abre Processos.
              </p>
              <div className="border border-slate-200 rounded-xl bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono ring-1 ring-slate-100">
                {resultadoAudienciasPendentes.length === 0 ? (
                  <p>
                    Nenhuma audiência pendente. Confira: (1) data da audiência preenchida em Processos e saída do campo
                    para normalizar; (2) data não pode ser anterior a hoje neste relatório; (3) com API de processos, é
                    preciso que o salvamento na API tenha concluído (o sistema grava então uma cópia local para este
                    relatório). Use também, se aplicável, a sincronização agenda → processos na tela abaixo.
                  </p>
                ) : (
                  resultadoAudienciasPendentes.map((item, idx) => {
                    const horaTxt = item.audienciaHora ? ` às ${item.audienciaHora}` : '';
                    const tipoTxt = item.audienciaTipo ? ` — ${item.audienciaTipo}` : '';
                    const avisoTxt =
                      item.avisoAudiencia && String(item.avisoAudiencia).trim() !== '' && item.avisoAudiencia !== 'nao_avisado'
                        ? ` — aviso: ${item.avisoAudiencia}`
                        : '';
                    return (
                      <p
                        key={`${item.codCliente}-${item.proc}-${item.audienciaData}-${idx}`}
                        className="whitespace-pre-wrap break-words cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 select-none"
                        onDoubleClick={() => abrirProcessoPorItem(item)}
                        title="Duplo clique: abrir em Processos"
                      >
                        {String(idx + 1).padStart(3, '0')} - Audiência {item.audienciaData}
                        {horaTxt}
                        {tipoTxt}
                        {' — '}(Cod. {item.codCliente}, Proc. {String(item.proc).padStart(2, '0')}){' '}
                        {item.parteCliente || item.cliente || 'CLIENTE'} x {item.parteOposta || 'PARTE OPOSTA'} (
                        {item.numeroProcessoNovo || 'sem nº'})
                        {avisoTxt}
                      </p>
                    );
                  })
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200/80 flex justify-center bg-slate-50/90">
              <button
                type="button"
                onClick={() => setModalResultadoAudienciasPendentesAberto(false)}
                className="min-w-[120px] px-8 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalResultadoPrazoFatal
        open={modalResultadoPrazoFatalAberto}
        onClose={() => setModalResultadoPrazoFatalAberto(false)}
        dataPrazoFatal={dataPrazoFatal}
        itens={resultadoPrazoFatal}
        onOpenProcesso={abrirProcessoPorItem}
      />

      {processoEmbed ? (
        <Suspense fallback={null}>
          <ProcessoEmbedModal embed={processoEmbed} onFechar={() => setProcessoEmbed(null)} />
        </Suspense>
      ) : null}
    </div>
  );
}
