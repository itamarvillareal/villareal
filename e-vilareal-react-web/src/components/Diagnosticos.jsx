import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { getPessoaPorId } from '../data/cadastroPessoasMock';
import {
  DEMO_DATA_CONSULTA_BR,
  DEMO_DATA_PRAZO_FATAL_BR,
  DEMO_PESSOA_ID_EXEMPLO,
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
  reaplicarDemonstracaoDiagnostico,
} from '../data/processosHistoricoData';
import { resolverAliasHojeEmTexto } from '../services/hjDateAliasService.js';

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
  const [dataPrazoFatal, setDataPrazoFatal] = useState(DEMO_DATA_PRAZO_FATAL_BR);
  const [modalResultadoPrazoFatalAberto, setModalResultadoPrazoFatalAberto] = useState(false);
  const [resultadoPrazoFatal, setResultadoPrazoFatal] = useState([]);
  const [modalConsultasARealizarAberto, setModalConsultasARealizarAberto] = useState(false);
  const [modalPublicacoesAberto, setModalPublicacoesAberto] = useState(false);
  const [modalBuscaPessoaAberto, setModalBuscaPessoaAberto] = useState(false);
  const [codigoPessoaBusca, setCodigoPessoaBusca] = useState('');
  const [modalResultadoBuscaPessoaAberto, setModalResultadoBuscaPessoaAberto] = useState(false);
  const [resultadoBuscaPessoa, setResultadoBuscaPessoa] = useState([]);
  const [rotuloPessoaBusca, setRotuloPessoaBusca] = useState('');
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

  const pessoaDemoBusca = getPessoaPorId(DEMO_PESSOA_ID_EXEMPLO);

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

  function consultarProcessosDaPessoa() {
    const id = String(codigoPessoaBusca ?? '').trim().replace(/\D/g, '');
    if (!id) {
      window.alert('Informe o número da pessoa no cadastro.');
      return;
    }
    const pessoa = getPessoaPorId(Number(id));
    const itens = listarProcessosPorIdPessoa(id, pessoa?.nome);
    setRotuloPessoaBusca(
      pessoa ? `${pessoa.nome} (cód. ${pessoa.id})` : `Código ${id} — não encontrado no cadastro local`
    );
    setResultadoBuscaPessoa(itens);
    setModalBuscaPessoaAberto(false);
    setModalResultadoBuscaPessoaAberto(true);
  }

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
      state: { codCliente: String(item.codCliente), proc: String(item.proc) },
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
                    setCodigoPessoaBusca(String(DEMO_PESSOA_ID_EXEMPLO));
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
            <strong>Dados de teste (localStorage):</strong> consultas e prazo fatal em <strong>{DEMO_DATA_CONSULTA_BR}</strong>
            ; também há lançamentos em <strong>20/03/2026</strong>. Cliente <strong>00000001</strong> proc. <strong>1–6</strong>{' '}
            cobre cada fase do painel à direita. Busca pessoa: código <strong>{DEMO_PESSOA_ID_EXEMPLO}</strong> (vínculo demo na parte
            cliente do proc. 1).
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                const r = reaplicarDemonstracaoDiagnostico();
                window.alert(
                  r.ok
                    ? `Dados demo reaplicados. Inseridos: ${r.inseridos}, atualizados: ${r.atualizados}.`
                    : 'Não foi possível reaplicar (sem window/localStorage).'
                );
              }}
              className="px-3 py-1.5 rounded border border-amber-400 bg-amber-50 text-amber-900 text-xs font-medium hover:bg-amber-100"
            >
              Reaplicar dados demo (reset)
            </button>
          </div>
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
            className="w-full max-w-md bg-white border border-slate-300 rounded-lg shadow-xl"
            role="dialog"
            aria-labelledby="busca-pessoa-titulo"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 id="busca-pessoa-titulo" className="text-base font-semibold text-slate-800">
                Busca pessoa
              </h3>
              <button
                type="button"
                onClick={() => setModalBuscaPessoaAberto(false)}
                className="p-2 rounded text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Número da pessoa (cadastro de pessoas)
                <input
                  type="text"
                  inputMode="numeric"
                  value={codigoPessoaBusca}
                  onChange={(e) => setCodigoPessoaBusca(e.target.value.replace(/\D/g, ''))}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  placeholder={`Ex.: ${DEMO_PESSOA_ID_EXEMPLO} (demo)`}
                  autoFocus
                />
              </label>
              <p className="text-xs text-slate-500">
                Serão listados os processos em que essa pessoa está vinculada como Parte Cliente ou Parte Oposta.                 Demo: pessoa <strong>{DEMO_PESSOA_ID_EXEMPLO}</strong>
                {pessoaDemoBusca ? ` — ${pessoaDemoBusca.nome}` : ''} no proc. 1 do cliente 00000001.
              </p>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalBuscaPessoaAberto(false)}
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={consultarProcessosDaPessoa}
                className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                OK
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
          <div className="w-full max-w-6xl bg-slate-100 border border-slate-400 shadow-xl">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 bg-white">
              <p className="text-base text-black">
                Processos em que participa: {rotuloPessoaBusca}
              </p>
              <button
                type="button"
                onClick={() => setModalResultadoBuscaPessoaAberto(false)}
                className="p-1 text-slate-700 hover:bg-slate-200"
                aria-label="Fechar relatório"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-black mb-3">
                {resultadoBuscaPessoa.length} processo(s) encontrado(s). Dê duplo clique em uma linha para abrir em Processos.
              </p>
              <div className="border border-slate-300 bg-white h-[430px] overflow-auto p-2 text-[13px] leading-relaxed font-mono">
                {resultadoBuscaPessoa.length === 0 ? (
                  <p>Nenhum processo encontrado para esta pessoa (verifique o vínculo em Processos → Pessoas).</p>
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
                      [{item.papeis}] {item.parteCliente || item.cliente || 'CLIENTE'} x {item.parteOposta || 'PARTE OPOSTA'} (
                      {item.numeroProcessoNovo || 'sem nº'})
                    </p>
                  ))
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-300 flex justify-center bg-slate-100">
              <button
                type="button"
                onClick={() => setModalResultadoBuscaPessoaAberto(false)}
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
