import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Stethoscope } from 'lucide-react';
import { buscarCliente, pesquisarCadastroPessoasPorNomeOuCpf } from '../api/clientesService.js';
import {
  DEMO_DATA_CONSULTA_BR,
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
import { listarClientesCadastro } from '../repositories/clientesRepository.js';
import {
  listarProcessosPorNumeroProcessoDiagnostico,
  listarProcessosPorPrazoFatalDiagnostico,
  listarProcessosVinculoPessoaDiagnostico,
} from '../repositories/processosRepository.js';
import { padCliente8Nav } from './cadastro-pessoas/cadastroPessoasNavUtils.js';
import { featureFlags } from '../config/featureFlags.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';
import { exportarReusClienteParaExcel } from '../services/relatorioReusClienteExcel.js';
import { getContextoAuditoriaUsuario, registrarAuditoria } from '../services/auditoriaCliente.js';
import { chaveNumeroProcessoBuscaDiagnostico } from '../domain/normalizarNumeroProcessoBuscaDiagnostico.js';

/** Delay antes de chamar a API enquanto o usuário digita (ms). */
const DEBOUNCE_BUSCA_PESSOA_API_MS = 320;

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

const BOTOES_ESQUERDA = [
  'Consultas Realizadas',
  'Consultas à Realizar',
  'Audiências pendentes',
  'Prazo Fatal',
  'Consultas Atrasadas',
  'Publicações',
  'Busca pessoa',
  'Busca por número',
  'Réus por cliente (Excel)',
];

const BOTOES_DIREITA = [
  'Aguardando Documentos',
  'Aguardando Peticionar',
  'Aguardando Verificação',
  'Aguardando Protocolo',
  'Aguardando Providência',
  'Proc. Administrativo',
  'Baixar Protocolos',
];

function diaSemanaPtBr(brDate) {
  const [dd, mm, yyyy] = String(brDate ?? '').split('/');
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { weekday: 'long' });
}

export function Diagnosticos() {
  const navigate = useNavigate();
  const [focado, setFocado] = useState('Consultas Realizadas');
  const [modalConsultasRealizadasAberto, setModalConsultasRealizadasAberto] = useState(false);
  const [dataConsulta, setDataConsulta] = useState(DEMO_DATA_CONSULTA_BR);
  const [modalResultadoAberto, setModalResultadoAberto] = useState(false);
  const [resultadoConsulta, setResultadoConsulta] = useState([]);
  const [rotuloResultadoConsulta, setRotuloResultadoConsulta] = useState('Processos Consultados');
  const [modalPrazoFatalAberto, setModalPrazoFatalAberto] = useState(false);
  const [dataPrazoFatal, setDataPrazoFatal] = useState('');
  const [modalResultadoPrazoFatalAberto, setModalResultadoPrazoFatalAberto] = useState(false);
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
    setReusExcelCarregando(true);
    try {
      const res = await exportarReusClienteParaExcel(raw, (ev) => {
        setReusExcelProgresso(`A processar… ${ev.atual} de ${ev.total}`);
      });
      const { usuarioNome } = getContextoAuditoriaUsuario();
      registrarAuditoria({
        modulo: 'Diagnósticos',
        tela: '/diagnosticos',
        tipoAcao: 'EXPORTACAO_EXCEL',
        descricao: `Excel de réus por cliente: ${res.linhas} linha(s), ficheiro ${res.nomeArquivo}. Utilizador: ${usuarioNome || '—'}.`,
      });
      setReusExcelProgresso(`Guardado: ${res.nomeArquivo} (${res.linhas} linhas).`);
    } catch (e) {
      setReusExcelErro(String(e?.message || e || 'Erro ao gerar o Excel.'));
    } finally {
      setReusExcelCarregando(false);
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
    }
  }

  function consultarPorData() {
    const data = String(dataConsulta ?? '').trim();
    if (!data) return;
    const itens = listarHistoricoPorData(data);
    setResultadoConsulta(itens);
    setRotuloResultadoConsulta('Processos Consultados');
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

  function consultarPorDataPublicacoes() {
    const data = String(dataConsulta ?? '').trim();
    if (!data) return;
    const itens = listarHistoricoPorData(data);
    setResultadoConsulta(itens);
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
    let c = true;
    void listarClientesCadastro()
      .then((list) => {
        if (c) setClientesCodigosLista(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (c) setClientesCodigosLista([]);
      });
    return () => {
      c = false;
    };
  }, []);

  useEffect(() => {
    if (modalPrazoFatalAberto) setDataPrazoFatal(hojeDdMmYyyy());
  }, [modalPrazoFatalAberto]);

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
    const itens = listarProcessosFaseAguardandoProtocolo();
    setResultadoAguardandoProtocolo(itens);
    setModalResultadoAguardandoProtocoloAberto(true);
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

  async function executarSincronizacaoAudienciasAgendaProcessos() {
    setSyncAgendaMsg('Sincronizando (API de processos + agenda local + API de agenda)…');
    try {
      const r = await executarSincronizacaoAudienciasAgendaMesEProcessos(syncAgendaMes, syncAgendaAno);
      setSyncAgendaMsg(mensagemResumoSincAgenda(r, `[Mês ${syncAgendaMes}/${syncAgendaAno}] `));
    } catch (e) {
      setSyncAgendaMsg(String(e?.message || 'Erro na sincronização.'));
    }
  }

  async function executarSincronizacaoTodaAgendaProcessos() {
    setSyncAgendaMsg('Sincronizando (API de processos + agenda local + API de agenda)…');
    try {
      const r = await executarSincronizacaoAudienciasAgendaEProcessosCompleta();
      setSyncAgendaMsg(mensagemResumoSincAgenda(r, '[Toda a agenda] '));
    } catch (e) {
      setSyncAgendaMsg(String(e?.message || 'Erro na sincronização.'));
    }
  }

  function abrirProcessoPorItem(item) {
    if (!item?.codCliente || item?.proc == null || item?.proc === '') return;
    setModalResultadoAberto(false);
    setModalResultadoPrazoFatalAberto(false);
    setModalResultadoBuscaPessoaAberto(false);
    setIdPessoaBuscaDiag(null);
    setImoveisRelatorioBusca({ status: 'idle', itens: [] });
    setModalBuscaNumeroProcessoAberto(false);
    setModalResultadoAguardandoDocsAberto(false);
    setModalResultadoAguardandoPeticionarAberto(false);
    setModalResultadoAguardandoVerificacaoAberto(false);
    setModalResultadoAguardandoProtocoloAberto(false);
    setModalResultadoAguardandoProvidenciaAberto(false);
    setModalResultadoProcAdministrativoAberto(false);
    setModalResultadoAudienciasPendentesAberto(false);
    setModalConsultasARealizarAberto(false);
    setModalPublicacoesAberto(false);
    navigate('/processos', {
      replace: false,
      state: buildRouterStateChaveClienteProcesso(item.codCliente, item.proc),
    });
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/40 to-emerald-50/50 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] flex items-center justify-center p-6">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-200/90 ring-1 ring-indigo-500/10 w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 shrink-0">
              <Stethoscope className="w-5 h-5 text-white" aria-hidden />
            </span>
            <h2 className="text-base font-semibold text-white truncate">Informe o relatório que deseja fazer</h2>
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
          <div className="flex flex-col gap-2">
            {BOTOES_ESQUERDA.map((label) => (
              <button
                key={label}
                type="button"
                onFocus={() => setFocado(label)}
                onClick={() => {
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
                }}
                className={`px-4 py-2.5 rounded-xl border text-left text-sm font-medium transition-all ${
                  focado === label
                    ? 'border-indigo-400 border-2 bg-indigo-50/90 text-indigo-950 shadow-sm ring-2 ring-indigo-200/50'
                    : 'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 hover:border-indigo-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {BOTOES_DIREITA.map((label) => (
              <button
                key={label}
                type="button"
                onFocus={() => setFocado(label)}
                onClick={() => {
                  setFocado(label);
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
                }}
                className={`px-4 py-2.5 rounded-xl border text-left text-sm font-medium transition-all ${
                  focado === label
                    ? 'border-indigo-400 border-2 bg-indigo-50/90 text-indigo-950 shadow-sm ring-2 ring-indigo-200/50'
                    : 'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 hover:border-indigo-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 pb-4 space-y-3 border-t border-slate-100 pt-4 bg-slate-50/30">
          <div className="rounded-2xl border border-indigo-200/40 bg-gradient-to-br from-indigo-50/50 to-violet-50/30 p-4 space-y-2 shadow-sm">
            <p className="text-xs font-medium text-slate-700 text-center">
              Sincronizar audiências da agenda com o formulário de processos
            </p>
            <p className="text-[11px] text-slate-600 text-center leading-relaxed">
              Ao abrir o sistema, roda em segundo plano: agenda no navegador,{' '}
              <span className="font-medium">agenda na API</span> (todos os usuários, intervalo amplo) e casamento de CNJ
              usando <span className="font-medium">processos na API</span> além do histórico local. Exige APIs de agenda,
              clientes e processos ativas quando usar o backend. O vínculo no evento (<code className="text-[10px]">processoRef</code>)
              ou CNJ único atualiza o histórico local (audiência).
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
                Só este mês/ano
              </button>
              <button
                type="button"
                onClick={executarSincronizacaoTodaAgendaProcessos}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500"
              >
                Toda a agenda
              </button>
            </div>
            {syncAgendaMsg ? (
              <p className="text-[11px] text-slate-700 text-center leading-relaxed font-mono">{syncAgendaMsg}</p>
            ) : null}
          </div>
          <p className="text-xs text-slate-600 text-center leading-relaxed">
            {featureFlags.useApiProcessos
              ? 'Vários relatórios cruzam a API de processos com o histórico local deste navegador (ex.: busca por número, prazo fatal). Outros continuam só no histórico local (consultas, fases, audiências). Não há pacote de demonstração automático.'
              : 'Os relatórios usam apenas os dados já gravados neste navegador (histórico de processos, prazos e vínculos de pessoas). Não há pacote de demonstração automático.'}
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
              <h3 className="text-lg leading-none font-semibold text-white">Consultas Realizadas</h3>
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
                  Informe o dia que deseja consultar:
                </p>
                <div className="rounded border border-slate-200 bg-white p-4">
                  <input
                    type="text"
                    placeholder="dd/mm/aaaa ou hj"
                    value={dataConsulta}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDataConsulta(resolverAliasHojeEmTexto(v, 'br') ?? v);
                    }}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <p className="mt-2 text-sm leading-none text-slate-700 min-h-[1.25rem]">
                    {diaSemanaPtBr(dataConsulta) || ' '}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={consultarPorData}
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
                <div className="rounded border border-slate-200 bg-white p-4">
                  <input
                    type="text"
                    placeholder="dd/mm/aaaa ou hj"
                    value={dataPrazoFatal}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDataPrazoFatal(resolverAliasHojeEmTexto(v, 'br') ?? v);
                    }}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <p className="mt-2 text-sm leading-none text-slate-700 min-h-[1.25rem]">
                    {diaSemanaPtBr(dataPrazoFatal) || ' '}
                  </p>
                </div>
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
                <div className="rounded border border-slate-200 bg-white p-4">
                  <input
                    type="text"
                    placeholder="dd/mm/aaaa ou hj"
                    value={dataConsulta}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDataConsulta(resolverAliasHojeEmTexto(v, 'br') ?? v);
                    }}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <p className="mt-2 text-sm leading-none text-slate-700 min-h-[1.25rem]">
                    {diaSemanaPtBr(dataConsulta) || ' '}
                  </p>
                </div>
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
                <div className="rounded border border-slate-200 bg-white p-4">
                  <input
                    type="text"
                    placeholder="dd/mm/aaaa ou hj"
                    value={dataConsulta}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDataConsulta(resolverAliasHojeEmTexto(v, 'br') ?? v);
                    }}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <p className="mt-2 text-sm leading-none text-slate-700 min-h-[1.25rem]">
                    {diaSemanaPtBr(dataConsulta) || ' '}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={consultarPorDataPublicacoes}
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

      {modalResultadoAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-6xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0">
              <p className="text-base text-white">
                Informação sobre {rotuloResultadoConsulta} em {dataConsulta}:
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-slate-700 mb-3">
                Você tem {resultadoConsulta.length} item(ns) em {rotuloResultadoConsulta} na data {dataConsulta}. Veja: (duplo clique na linha abre o processo)
              </p>
              <div className="border border-slate-200 rounded-xl bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono ring-1 ring-slate-100">
                {resultadoConsulta.length === 0 ? (
                  <p>Nenhum histórico encontrado para a data informada.</p>
                ) : (
                  resultadoConsulta.map((item, idx) => (
                    <p
                      key={`${item.codCliente}-${item.proc}-${item.id}-${idx}`}
                      className="whitespace-pre-wrap break-words cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 select-none"
                      onDoubleClick={() => abrirProcessoPorItem(item)}
                      title="Duplo clique: abrir em Processos"
                    >
                      {String(idx + 1).padStart(3, '0')} - (Cod. {item.codCliente}, Proc. {String(item.proc).padStart(2, '0')}): {item.parteCliente || item.cliente || 'CLIENTE'} x {item.parteOposta || 'PARTE OPOSTA'} ({item.numeroProcessoNovo || 'sem nº'}){' '}
                      {item.info}
                    </p>
                  ))
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200/80 flex justify-center bg-slate-50/90">
              <button
                type="button"
                onClick={() => setModalResultadoAberto(false)}
                className="min-w-[120px] px-8 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

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
                {resultadoAguardandoProtocolo.length} processo(s). Duplo clique na linha para abrir em Processos. A fase é gravada ao marcar em Processos ou ao sincronizar com o histórico local.
              </p>
              <div className="border border-slate-200 rounded-xl bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono ring-1 ring-slate-100">
                {resultadoAguardandoProtocolo.length === 0 ? (
                  <p>
                    Nenhum processo com essa fase no momento. Marque &quot;Protocolo / Movimentação&quot; em Processos
                    ou abra processos para sincronizar a fase.
                  </p>
                ) : (
                  resultadoAguardandoProtocolo.map((item, idx) => (
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
                onClick={() => setModalResultadoAguardandoProtocoloAberto(false)}
                className="min-w-[120px] px-8 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
              >
                OK
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

      {modalResultadoPrazoFatalAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-6xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shrink-0">
              <p className="text-base text-white">
                Processos com Prazo Fatal em {dataPrazoFatal}:
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoPrazoFatalAberto(false)}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-slate-700 mb-3">
                Você tem {resultadoPrazoFatal.length} processo(s) com prazo fatal nesta data. Veja: (duplo clique na linha abre o processo)
              </p>
              <div className="border border-slate-200 rounded-xl bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono ring-1 ring-slate-100">
                {resultadoPrazoFatal.length === 0 ? (
                  <p>Nenhum processo com prazo fatal para a data informada.</p>
                ) : (
                  resultadoPrazoFatal.map((item, idx) => (
                    <p
                      key={`${item.codCliente}-${item.proc}-${idx}`}
                      className="whitespace-pre-wrap break-words cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 select-none"
                      onDoubleClick={() => abrirProcessoPorItem(item)}
                      title="Duplo clique: abrir em Processos"
                    >
                      {String(idx + 1).padStart(3, '0')} - (Cod. {item.codCliente}, Proc. {String(item.proc).padStart(2, '0')}):{' '}
                      {item.parteCliente || item.cliente || 'CLIENTE'} x {item.parteOposta || 'PARTE OPOSTA'} ({item.numeroProcessoNovo || 'sem nº'})
                      {' — '}
                      Prazo fatal: {item.prazoFatal}
                    </p>
                  ))
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200/80 flex justify-center bg-slate-50/90">
              <button
                type="button"
                onClick={() => setModalResultadoPrazoFatalAberto(false)}
                className="min-w-[120px] px-8 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
