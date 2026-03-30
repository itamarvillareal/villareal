import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { buscarCliente, pesquisarCadastroPessoasPorNomeOuCpf } from '../api/clientesService.js';
import { getCadastroPessoasMockComNovosLocais } from '../data/cadastroPessoasMockNovosLocal.js';
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
  listarProcessosPorIdPessoa,
  listarProcessosPorPrazoFatal,
} from '../data/processosHistoricoData';
import { resolverAliasHojeEmTexto } from '../services/hjDateAliasService.js';
import { listarImoveisResumoPorPessoaDiagnostico } from '../services/listarImoveisPorPessoaDiagnostico.js';
import { listarCodigosClientePorIdPessoa } from '../data/clientesCadastradosMock.js';
import { padCliente8Nav } from './cadastro-pessoas/cadastroPessoasNavUtils.js';
import { featureFlags } from '../config/featureFlags.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';

const MOCK_CADASTRO_PESSOAS = import.meta.env.VITE_USE_MOCK_CADASTRO_PESSOAS === 'true';

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

/** Mock/local: código numérico, nome, CPF/CNPJ, RG. */
function buscarPessoasMockPorTermo(termo) {
  const raw = String(termo ?? '').trim();
  if (!raw) return [];
  const lista = getCadastroPessoasMockComNovosLocais(false);
  const t = normalizarBuscaDiag(raw);
  const tDig = soDigitosDiag(raw);
  const pareceSoCodigo = /^\d+$/.test(raw.replace(/\s+/g, ''));
  const codStr = pareceSoCodigo ? raw.replace(/\D/g, '') : '';
  const out = [];
  const seen = new Set();
  for (const p of lista) {
    const id = Number(p.id);
    if (!Number.isFinite(id) || id < 1) continue;
    let ok = false;
    if (pareceSoCodigo && codStr === String(id)) ok = true;
    else if (t.length >= 2 && normalizarBuscaDiag(p.nome).includes(t)) ok = true;
    else if (tDig.length >= 3 && soDigitosDiag(p.cpf).includes(tDig)) ok = true;
    else if (p.rg != null && String(p.rg).trim() !== '') {
      const rgDig = soDigitosDiag(p.rg);
      if (tDig.length >= 2 && rgDig.includes(tDig)) ok = true;
      else if (t.length >= 2 && normalizarBuscaDiag(String(p.rg)).includes(t)) ok = true;
    }
    if (ok && !seen.has(id)) {
      seen.add(id);
      out.push({
        id,
        nome: String(p.nome ?? ''),
        cpf: String(p.cpf ?? ''),
        rg: p.rg != null ? String(p.rg) : '',
      });
    }
  }
  return out;
}

function mapPessoaApiParaDiag(p) {
  return {
    id: Number(p.id),
    nome: String(p.nome ?? ''),
    cpf: String(p.cpf ?? ''),
    rg: '',
  };
}

/** API: id numérico (GET + lista ?codigo=), nome, CPF/CNPJ. RG não está no filtro do backend — use mock para RG. */
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

const BOTOES_ESQUERDA = [
  'Consultas Realizadas',
  'Consultas à Realizar',
  'Prazo Fatal',
  'Consultas Atrasadas',
  'Publicações',
  'Busca pessoa',
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
  const [rotuloPessoaBusca, setRotuloPessoaBusca] = useState('');
  /** Pessoa escolhida na busca (para atalhos ao cadastro / clientes mesmo sem processos locais). */
  const [idPessoaBuscaDiag, setIdPessoaBuscaDiag] = useState(null);
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

  function consultarPrazoFatalPorData() {
    const data = String(dataPrazoFatal ?? '').trim();
    if (!data) return;
    const itens = listarProcessosPorPrazoFatal(data);
    setResultadoPrazoFatal(itens);
    setModalPrazoFatalAberto(false);
    setModalResultadoPrazoFatalAberto(true);
  }

  function abrirResultadoProcessosParaPessoa(pessoa) {
    const id = Number(pessoa.id);
    const nome = String(pessoa.nome ?? '').trim();
    const itens = listarProcessosPorIdPessoa(String(id), nome || undefined);
    const doc = pessoa.cpf ? ` — ${pessoa.cpf}` : '';
    const rg = pessoa.rg ? ` — RG ${pessoa.rg}` : '';
    setRotuloPessoaBusca(`${nome || '—'} (cód. ${id})${doc}${rg}`);
    setResultadoBuscaPessoa(itens);
    setIdPessoaBuscaDiag(Number.isFinite(id) && id >= 1 ? id : null);
    setImoveisRelatorioBusca({ status: 'idle', itens: [] });
    setModalBuscaPessoaAberto(false);
    setCandidatosBuscaPessoa([]);
    setTermoBuscaPessoa('');
    setModalResultadoBuscaPessoaAberto(true);
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

    if (MOCK_CADASTRO_PESSOAS) {
      aplicarLista(buscarPessoasMockPorTermo(raw));
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

  function abrirProcessoPorItem(item) {
    if (!item?.codCliente || item?.proc == null || item?.proc === '') return;
    setModalResultadoAberto(false);
    setModalResultadoPrazoFatalAberto(false);
    setModalResultadoBuscaPessoaAberto(false);
    setIdPessoaBuscaDiag(null);
    setImoveisRelatorioBusca({ status: 'idle', itens: [] });
    setModalResultadoAguardandoDocsAberto(false);
    setModalResultadoAguardandoPeticionarAberto(false);
    setModalResultadoAguardandoVerificacaoAberto(false);
    setModalResultadoAguardandoProtocoloAberto(false);
    setModalResultadoAguardandoProvidenciaAberto(false);
    setModalResultadoProcAdministrativoAberto(false);
    setModalConsultasARealizarAberto(false);
    setModalPublicacoesAberto(false);
    navigate('/processos', {
      replace: false,
      state: buildRouterStateChaveClienteProcesso(item.codCliente, item.proc),
    });
  }

  return (
    <div className="min-h-full bg-slate-200 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">Informe o relatório que deseja fazer</h2>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="p-2 rounded text-slate-500 hover:bg-slate-100"
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
                }}
                className={`px-4 py-2.5 rounded border text-left text-sm font-medium transition-colors ${
                  focado === label
                    ? 'border-slate-400 border-2 bg-slate-50 text-slate-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
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
                className={`px-4 py-2.5 rounded border text-left text-sm font-medium transition-colors ${
                  focado === label
                    ? 'border-slate-400 border-2 bg-slate-50 text-slate-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 pb-4 space-y-3 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-600 text-center leading-relaxed">
            Os relatórios usam apenas os dados já gravados neste navegador (histórico de processos, prazos e vínculos de
            pessoas). Não há pacote de demonstração automático.
          </p>
        </div>
        <div className="px-6 pb-6 flex justify-center">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-8 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>

      {modalConsultasRealizadasAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg leading-none font-semibold text-slate-800">Consultas Realizadas</h3>
              <button
                type="button"
                onClick={() => setModalConsultasRealizadasAberto(false)}
                className="p-1 text-slate-700 hover:bg-slate-200"
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
                  className="min-w-[200px] px-6 py-2.5 rounded border border-blue-700 bg-blue-600 text-sm leading-none text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-blue-700"
                >
                  Consultar
                </button>
                <button
                  type="button"
                  onClick={() => setModalConsultasRealizadasAberto(false)}
                  className="min-w-[160px] px-6 py-2.5 rounded border border-slate-300 bg-white text-sm leading-none text-slate-700 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalBuscaPessoaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
          <div
            className="w-full max-w-xl bg-white border border-slate-300 rounded-lg shadow-xl"
            role="dialog"
            aria-labelledby="busca-pessoa-titulo"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 id="busca-pessoa-titulo" className="text-base font-semibold text-slate-800">
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
                className="p-2 rounded text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                Busca única no cadastro (API ou mock). O relatório reúne, para a pessoa escolhida: processos no histórico
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
                pelo menos 3 dígitos. Com a API Java, RG não entra no filtro do servidor; use mock local para buscar por
                RG. Enter abre o primeiro resultado da lista.
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
                        onClick={() => abrirResultadoProcessosParaPessoa(p)}
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

      {modalPrazoFatalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg leading-none font-semibold text-slate-800">Prazo Fatal</h3>
              <button
                type="button"
                onClick={() => setModalPrazoFatalAberto(false)}
                className="p-1 text-slate-700 hover:bg-slate-200"
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
                  onClick={consultarPrazoFatalPorData}
                  className="min-w-[200px] px-6 py-2.5 rounded border border-blue-700 bg-blue-600 text-sm leading-none text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-blue-700"
                >
                  Consultar
                </button>
                <button
                  type="button"
                  onClick={() => setModalPrazoFatalAberto(false)}
                  className="min-w-[160px] px-6 py-2.5 rounded border border-slate-300 bg-white text-sm leading-none text-slate-700 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalConsultasARealizarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg leading-none font-semibold text-slate-800">Consultas à Realizar</h3>
              <button
                type="button"
                onClick={() => setModalConsultasARealizarAberto(false)}
                className="p-1 text-slate-700 hover:bg-slate-200"
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
                  className="min-w-[200px] px-6 py-2.5 rounded border border-blue-700 bg-blue-600 text-sm leading-none text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-blue-700"
                >
                  Consultar
                </button>
                <button
                  type="button"
                  onClick={() => setModalConsultasARealizarAberto(false)}
                  className="min-w-[160px] px-6 py-2.5 rounded border border-slate-300 bg-white text-sm leading-none text-slate-700 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalPublicacoesAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg leading-none font-semibold text-slate-800">Publicações</h3>
              <button
                type="button"
                onClick={() => setModalPublicacoesAberto(false)}
                className="p-1 text-slate-700 hover:bg-slate-200"
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
                  className="min-w-[200px] px-6 py-2.5 rounded border border-blue-700 bg-blue-600 text-sm leading-none text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-blue-700"
                >
                  Consultar
                </button>
                <button
                  type="button"
                  onClick={() => setModalPublicacoesAberto(false)}
                  className="min-w-[160px] px-6 py-2.5 rounded border border-slate-300 bg-white text-sm leading-none text-slate-700 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalResultadoAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-6xl bg-slate-100 border border-slate-400 shadow-xl">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 bg-white">
              <p className="text-base text-black">
                Informação sobre {rotuloResultadoConsulta} em {dataConsulta}:
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoAberto(false)}
                className="p-1 text-slate-700 hover:bg-slate-200"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-black mb-3">
                Você tem {resultadoConsulta.length} item(ns) em {rotuloResultadoConsulta} na data {dataConsulta}. Veja: (duplo clique na linha abre o processo)
              </p>
              <div className="border border-slate-300 bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono">
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
            <div className="px-4 py-3 border-t border-slate-300 flex justify-center bg-slate-100">
              <button
                type="button"
                onClick={() => setModalResultadoAberto(false)}
                className="min-w-[120px] px-8 py-1.5 border border-slate-500 bg-white text-base text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-slate-50"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoBuscaPessoaAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-6xl bg-slate-100 border border-slate-400 shadow-xl max-h-[min(92vh,900px)] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 bg-white shrink-0">
              <p className="text-base text-black pr-2">Relatório da pessoa: {rotuloPessoaBusca}</p>
              <button
                type="button"
                onClick={() => {
                  setModalResultadoBuscaPessoaAberto(false);
                  setIdPessoaBuscaDiag(null);
                  setImoveisRelatorioBusca({ status: 'idle', itens: [] });
                }}
                className="p-1 text-slate-700 hover:bg-slate-200 shrink-0"
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
                        navigate(`/clientes/editar/${idPessoaBuscaDiag}`);
                      }}
                    >
                      Cadastro de Pessoas (edição)
                    </button>
                    {listarCodigosClientePorIdPessoa(idPessoaBuscaDiag).map((cod) => (
                      <button
                        key={cod}
                        type="button"
                        className="px-3 py-1.5 rounded border border-slate-400 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50"
                        onClick={() => {
                          setModalResultadoBuscaPessoaAberto(false);
                          setIdPessoaBuscaDiag(null);
                          setImoveisRelatorioBusca({ status: 'idle', itens: [] });
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
                <p className="font-medium text-slate-700 mb-1">Resumo no histórico local de processos</p>
                <p className="text-slate-600">
                  {resultadoBuscaPessoa.length === 0
                    ? 'Nenhum processo encontrado para esta pessoa no histórico deste navegador.'
                    : (() => {
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
                      })()}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-800 mb-2">Processos (histórico local)</p>
                <p className="text-xs text-slate-600 mb-2">
                  Duplo clique na linha abre em Processos. A coluna [papéis] indica se é parte e/ou advogado(a).
                </p>
                <div className="border border-slate-300 bg-white max-h-[240px] overflow-auto p-2 text-[13px] leading-relaxed font-mono">
                  {resultadoBuscaPessoa.length === 0 ? (
                    <p className="text-slate-600">
                      Nenhum processo no histórico local. Vincule a pessoa nas partes ou como advogado em Processos para
                      aparecer aqui.
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
            <div className="px-4 py-3 border-t border-slate-300 flex justify-center bg-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setModalResultadoBuscaPessoaAberto(false);
                  setIdPessoaBuscaDiag(null);
                  setImoveisRelatorioBusca({ status: 'idle', itens: [] });
                }}
                className="min-w-[120px] px-8 py-1.5 border border-slate-500 bg-white text-base text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-slate-50"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoAguardandoDocsAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-6xl bg-slate-100 border border-slate-400 shadow-xl">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 bg-white">
              <p className="text-base text-black">
                Processos em fase Aguardando Documentos (Ag. Documentos)
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoDocsAberto(false)}
                className="p-1 text-slate-700 hover:bg-slate-200"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-black mb-3">
                {resultadoAguardandoDocs.length} processo(s). Duplo clique na linha para abrir em Processos. A fase é gravada ao marcar em Processos ou ao sincronizar com o mock.
              </p>
              <div className="border border-slate-300 bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono">
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
            <div className="px-4 py-3 border-t border-slate-300 flex justify-center bg-slate-100">
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoDocsAberto(false)}
                className="min-w-[120px] px-8 py-1.5 border border-slate-500 bg-white text-base text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-slate-50"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoAguardandoPeticionarAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-6xl bg-slate-100 border border-slate-400 shadow-xl">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 bg-white">
              <p className="text-base text-black">
                Processos em fase Aguardando Peticionar (Ag. Peticionar)
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoPeticionarAberto(false)}
                className="p-1 text-slate-700 hover:bg-slate-200"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-black mb-3">
                {resultadoAguardandoPeticionar.length} processo(s). Duplo clique na linha para abrir em Processos. A fase é gravada ao marcar em Processos ou ao sincronizar com o mock.
              </p>
              <div className="border border-slate-300 bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono">
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
            <div className="px-4 py-3 border-t border-slate-300 flex justify-center bg-slate-100">
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoPeticionarAberto(false)}
                className="min-w-[120px] px-8 py-1.5 border border-slate-500 bg-white text-base text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-slate-50"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoAguardandoVerificacaoAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-6xl bg-slate-100 border border-slate-400 shadow-xl">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 bg-white">
              <p className="text-base text-black">
                Processos em fase Aguardando Verificação (Ag. Verificação)
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoVerificacaoAberto(false)}
                className="p-1 text-slate-700 hover:bg-slate-200"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-black mb-3">
                {resultadoAguardandoVerificacao.length} processo(s). Duplo clique na linha para abrir em Processos. A fase é gravada ao marcar em Processos ou ao sincronizar com o mock.
              </p>
              <div className="border border-slate-300 bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono">
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
            <div className="px-4 py-3 border-t border-slate-300 flex justify-center bg-slate-100">
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoVerificacaoAberto(false)}
                className="min-w-[120px] px-8 py-1.5 border border-slate-500 bg-white text-base text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-slate-50"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoAguardandoProtocoloAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-6xl bg-slate-100 border border-slate-400 shadow-xl">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 bg-white">
              <p className="text-base text-black">
                Processos em fase Aguardando Protocolo (Protocolo / Movimentação)
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoProtocoloAberto(false)}
                className="p-1 text-slate-700 hover:bg-slate-200"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-black mb-3">
                {resultadoAguardandoProtocolo.length} processo(s). Duplo clique na linha para abrir em Processos. A fase é gravada ao marcar em Processos ou ao sincronizar com o mock.
              </p>
              <div className="border border-slate-300 bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono">
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
            <div className="px-4 py-3 border-t border-slate-300 flex justify-center bg-slate-100">
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoProtocoloAberto(false)}
                className="min-w-[120px] px-8 py-1.5 border border-slate-500 bg-white text-base text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-slate-50"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoAguardandoProvidenciaAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-6xl bg-slate-100 border border-slate-400 shadow-xl">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 bg-white">
              <p className="text-base text-black">Processos em fase Aguardando Providência</p>
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoProvidenciaAberto(false)}
                className="p-1 text-slate-700 hover:bg-slate-200"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-black mb-3">
                {resultadoAguardandoProvidencia.length} processo(s). Duplo clique na linha para abrir em Processos. A fase
                é gravada ao marcar em Processos ou ao sincronizar com o mock.
              </p>
              <div className="border border-slate-300 bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono">
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
            <div className="px-4 py-3 border-t border-slate-300 flex justify-center bg-slate-100">
              <button
                type="button"
                onClick={() => setModalResultadoAguardandoProvidenciaAberto(false)}
                className="min-w-[120px] px-8 py-1.5 border border-slate-500 bg-white text-base text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-slate-50"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoProcAdministrativoAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-6xl bg-slate-100 border border-slate-400 shadow-xl">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 bg-white">
              <p className="text-base text-black">
                Processos em fase Proc. Administrativo (Procedimento Adm.)
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoProcAdministrativoAberto(false)}
                className="p-1 text-slate-700 hover:bg-slate-200"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-black mb-3">
                {resultadoProcAdministrativo.length} processo(s). Duplo clique na linha para abrir em Processos. A fase é
                gravada ao marcar em Processos ou ao sincronizar com o mock.
              </p>
              <div className="border border-slate-300 bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono">
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
            <div className="px-4 py-3 border-t border-slate-300 flex justify-center bg-slate-100">
              <button
                type="button"
                onClick={() => setModalResultadoProcAdministrativoAberto(false)}
                className="min-w-[120px] px-8 py-1.5 border border-slate-500 bg-white text-base text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-slate-50"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalResultadoPrazoFatalAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-6xl bg-slate-100 border border-slate-400 shadow-xl">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 bg-white">
              <p className="text-base text-black">
                Processos com Prazo Fatal em {dataPrazoFatal}:
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoPrazoFatalAberto(false)}
                className="p-1 text-slate-700 hover:bg-slate-200"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-black mb-3">
                Você tem {resultadoPrazoFatal.length} processo(s) com prazo fatal nesta data. Veja: (duplo clique na linha abre o processo)
              </p>
              <div className="border border-slate-300 bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono">
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
            <div className="px-4 py-3 border-t border-slate-300 flex justify-center bg-slate-100">
              <button
                type="button"
                onClick={() => setModalResultadoPrazoFatalAberto(false)}
                className="min-w-[120px] px-8 py-1.5 border border-slate-500 bg-white text-base text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-slate-50"
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
