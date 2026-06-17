import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileSignature, FileText, FileUp, Layers, Loader2, Scale, Sparkles, X } from 'lucide-react';
import { mapearDadosProcessoParaFormIA } from '../../helpers/documentoHelper.js';
import { buildRouterStateChaveClienteProcesso } from '../../domain/camposProcessoCliente.js';
import {
  downloadPdfBlob,
  gerarPdfComIA,
  gerarPdfManual,
  gerarPreviewIA,
  gerarProcuracao,
  nomeArquivoPeticaoPdf,
  nomeArquivoProcuracaoPdf,
} from '../../repositories/documentosRepository.js';
import { CIDADE_ESTADO_PADRAO } from './constants.js';
import { btnGhost, btnPrimary, btnSecondary } from './documentosStyles.js';
import { CollapsibleSection } from './components/CollapsibleSection.jsx';
import { DadosProcesso, resolveEnderecamento } from './components/DadosProcesso.jsx';
import { DadosPartes } from './components/DadosPartes.jsx';
import { FatosDoCaso, resolveTipoPeca } from './components/FatosDoCaso.jsx';
import { ConfiguracaoIA } from './components/ConfiguracaoIA.jsx';
import { SecoesManuais } from './components/SecoesManuais.jsx';
import { PreviewPeticao } from './components/PreviewPeticao.jsx';
import { pedidosPreenchidos } from './components/PedidosEspecificos.jsx';
import { ModoModeloTopicos } from './components/ModoModeloTopicos.jsx';
import { ModoEnviarArquivo } from './components/ModoEnviarArquivo.jsx';
import {
  carregarCalculoSalvo,
  gerarPeticaoExecucaoDeCalculoSalvo,
} from '../../services/peticaoExecucaoDeRodada.js';
import { dataBRparaISO } from '../../data/peticaoExecucaoBuilder.js';

const hojeIso = () => new Date().toISOString().split('T')[0];

const hojeBR = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const MODO_IA = 'ia';
const MODO_MANUAL = 'manual';
const MODO_PROCURACAO = 'procuracao';
const MODO_MODELO = 'modelo';
const MODO_ARQUIVO = 'arquivo';
const MODO_EXECUCAO = 'execucao';

const estadoInicialIA = () => ({
  enderecamentoSelect: '',
  enderecamentoOutro: '',
  numeroProcesso: '',
  nomeAutor: '',
  qualificacaoAutor: '',
  nomeReu: '',
  qualificacaoReu: '',
  tipoPecaSelect: '',
  tipoPecaOutro: '',
  fatos: '',
  valorCausa: '',
  fundamentacaoAdicional: '',
  modeloBase: '',
  instrucoesAdicionais: '',
  pedidosEspecificos: [''],
  cidadeEstado: CIDADE_ESTADO_PADRAO,
});

const estadoInicialManual = () => ({
  enderecamentoSelect: '',
  enderecamentoOutro: '',
  numeroProcesso: '',
  preambulo: '',
  secoes: [
    { titulo: 'DOS FATOS', conteudo: '' },
    { titulo: 'DO DIREITO', conteudo: '' },
  ],
  pedidos: [''],
  cidadeEstado: CIDADE_ESTADO_PADRAO,
});

function opcional(val) {
  const t = (val ?? '').trim();
  return t || null;
}

function montarPeticaoAiRequest(form) {
  const pedidos = pedidosPreenchidos(form.pedidosEspecificos);
  return {
    enderecamento: resolveEnderecamento(form),
    numeroProcesso: opcional(form.numeroProcesso),
    tipoPeca: resolveTipoPeca(form),
    nomeAutor: form.nomeAutor.trim(),
    qualificacaoAutor: opcional(form.qualificacaoAutor),
    nomeReu: form.nomeReu.trim(),
    qualificacaoReu: opcional(form.qualificacaoReu),
    fatos: form.fatos.trim(),
    fundamentacaoAdicional: opcional(form.fundamentacaoAdicional),
    valorCausa: opcional(form.valorCausa),
    pedidosEspecificos: pedidos.length ? pedidos : null,
    modeloBase: opcional(form.modeloBase),
    instrucoesAdicionais: opcional(form.instrucoesAdicionais),
    cidadeEstado: form.cidadeEstado?.trim() || CIDADE_ESTADO_PADRAO,
    data: hojeIso(),
  };
}

function montarDocumentoManualRequest(form) {
  const secoes = (form.secoes || [])
    .map((s) => ({ titulo: s.titulo.trim(), conteudo: s.conteudo.trim() }))
    .filter((s) => s.titulo && s.conteudo);
  const pedidos = pedidosPreenchidos(form.pedidos);

  return {
    enderecamento: resolveEnderecamento(form),
    numeroProcesso: opcional(form.numeroProcesso),
    preambulo: form.preambulo.trim(),
    secoes,
    pedidos,
    cidadeEstado: form.cidadeEstado?.trim() || CIDADE_ESTADO_PADRAO,
    data: hojeIso(),
  };
}

function validarModoIA(form) {
  const errors = {};
  const enderecamento = resolveEnderecamento(form);
  if (!enderecamento) errors.enderecamento = 'Selecione ou informe o endereçamento.';
  if (!form.nomeAutor?.trim()) errors.nomeAutor = 'Informe o nome do autor.';
  if (!form.nomeReu?.trim()) errors.nomeReu = 'Informe o nome do réu.';
  if (!resolveTipoPeca(form)) errors.tipoPeca = 'Selecione o tipo de peça.';
  if (!form.fatos?.trim()) errors.fatos = 'Descreva os fatos do caso.';
  return errors;
}

function validarModoManual(form) {
  const errors = {};
  const enderecamento = resolveEnderecamento(form);
  if (!enderecamento) errors.enderecamento = 'Selecione ou informe o endereçamento.';
  if (!form.preambulo?.trim()) errors.preambulo = 'Informe o preâmbulo.';
  const secoesValidas = (form.secoes || []).filter((s) => s.titulo?.trim() && s.conteudo?.trim());
  if (!secoesValidas.length) errors.secoes = 'Adicione ao menos uma seção com título e conteúdo.';
  if (!pedidosPreenchidos(form.pedidos).length) errors.pedidos = 'Informe ao menos um pedido.';
  return errors;
}

export function GerarDocumento() {
  const location = useLocation();
  const navigate = useNavigate();
  const dadosProcesso = location.state?.dadosProcesso;
  const formInicialIA = useMemo(
    () => (dadosProcesso ? mapearDadosProcessoParaFormIA(dadosProcesso) : estadoInicialIA()),
    [dadosProcesso]
  );
  const vindoDoProcesso = Boolean(dadosProcesso);

  const [modo, setModo] = useState(() => (vindoDoProcesso ? MODO_IA : MODO_IA));
  const modoIA = modo === MODO_IA;
  const modoProcuracao = modo === MODO_PROCURACAO;
  const modoModelo = modo === MODO_MODELO;
  const modoArquivo = modo === MODO_ARQUIVO;
  const modoExecucao = modo === MODO_EXECUCAO;

  const codigoClienteProcesso = dadosProcesso?.codigoCliente;
  const numeroInternoProcesso = dadosProcesso?.numeroInterno;
  const temChaveProcesso =
    Boolean(codigoClienteProcesso) && String(numeroInternoProcesso ?? '').trim() !== '';
  const [formIA, setFormIA] = useState(formInicialIA);
  const [formManual, setFormManual] = useState(estadoInicialManual);
  const [formProcuracao, setFormProcuracao] = useState(() => ({
    pessoaId: dadosProcesso?.pessoaIdOutorgante ? String(dadosProcesso.pessoaIdOutorgante) : '',
    cidadeEstado: dadosProcesso?.cidadeEstado || CIDADE_ESTADO_PADRAO,
    nomeOutorgante: dadosProcesso?.nomeOutorgante || '',
  }));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [mensagemErro, setMensagemErro] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [formExecucao, setFormExecucao] = useState(() => ({
    enderecamento: dadosProcesso?.enderecamento || '',
    modo: 'Completo',
    data: hojeBR(),
  }));
  // Cálculo salvo carregado para a petição de execução: { loading, dados, erro }.
  const [execCalc, setExecCalc] = useState({ loading: false, dados: null, erro: '' });

  const patchIA = useCallback((patch) => {
    setFormIA((f) => ({ ...f, ...patch }));
    setErrors({});
    setMensagemErro('');
  }, []);

  const patchManual = useCallback((patch) => {
    setFormManual((f) => ({ ...f, ...patch }));
    setErrors({});
    setMensagemErro('');
  }, []);

  const limpar = () => {
    setFormIA(estadoInicialIA());
    setFormManual(estadoInicialManual());
    setFormProcuracao({
      pessoaId: '',
      cidadeEstado: CIDADE_ESTADO_PADRAO,
      nomeOutorgante: '',
    });
    setErrors({});
    setMensagemErro('');
    setPreviewOpen(false);
    setPreviewData(null);
  };

  const baixarPdf = async (gerarFn, payload) => {
    const blob = await gerarFn(payload);
    downloadPdfBlob(blob, nomeArquivoPeticaoPdf());
  };

  // Carrega o último cálculo salvo do processo ao entrar no modo Execução.
  useEffect(() => {
    if (!modoExecucao || !temChaveProcesso) {
      setExecCalc({ loading: false, dados: null, erro: '' });
      return undefined;
    }
    let cancelado = false;
    setExecCalc({ loading: true, dados: null, erro: '' });
    carregarCalculoSalvo({
      codigoCliente: codigoClienteProcesso,
      numeroInterno: numeroInternoProcesso,
    })
      .then((dados) => {
        if (cancelado) return;
        if (!dados) {
          setExecCalc({
            loading: false,
            dados: null,
            erro: 'Não há cálculo salvo para este processo. Faça o cálculo na tela de Cálculos primeiro.',
          });
        } else if (!dados.titulos.length) {
          setExecCalc({
            loading: false,
            dados,
            erro: 'O cálculo salvo não possui títulos com valor para gerar a petição.',
          });
        } else {
          setExecCalc({ loading: false, dados, erro: '' });
        }
      })
      .catch((e) => {
        if (cancelado) return;
        setExecCalc({
          loading: false,
          dados: null,
          erro: e?.message || 'Falha ao carregar o cálculo salvo.',
        });
      });
    return () => {
      cancelado = true;
    };
  }, [modoExecucao, temChaveProcesso, codigoClienteProcesso, numeroInternoProcesso]);

  const handleGerarExecucao = async () => {
    setMensagemErro('');
    if (!temChaveProcesso) {
      setMensagemErro('Abra esta tela a partir de um processo para gerar a petição de execução.');
      return;
    }
    if (!formExecucao.enderecamento.trim()) {
      setErrors({ enderecamentoExec: 'Informe o endereçamento.' });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await gerarPeticaoExecucaoDeCalculoSalvo({
        codigoCliente: codigoClienteProcesso,
        numeroInterno: numeroInternoProcesso,
        enderecamento: formExecucao.enderecamento.trim(),
        modo: formExecucao.modo,
        dataIso: dataBRparaISO(formExecucao.data),
        dadosPreCarregados: execCalc.dados,
      });
    } catch (e) {
      setMensagemErro(e?.message || 'Falha ao gerar a petição de execução.');
    } finally {
      setLoading(false);
    }
  };

  const handleGerarProcuracao = async () => {
    setMensagemErro('');
    const pessoaId = Number(formProcuracao.pessoaId);
    if (!Number.isFinite(pessoaId) || pessoaId <= 0) {
      setErrors({ pessoaId: 'Informe o ID da pessoa (outorgante).' });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const blob = await gerarProcuracao({
        pessoaId,
        cidadeEstado: formProcuracao.cidadeEstado?.trim() || CIDADE_ESTADO_PADRAO,
        data: hojeIso(),
      });
      downloadPdfBlob(blob, nomeArquivoProcuracaoPdf(formProcuracao.nomeOutorgante));
    } catch (e) {
      setMensagemErro(e?.message || 'Falha ao gerar procuração.');
    } finally {
      setLoading(false);
    }
  };

  const handleGerarPdf = async () => {
    setMensagemErro('');
    if (modoProcuracao) {
      await handleGerarProcuracao();
      return;
    }
    if (modoIA) {
      const errs = validarModoIA(formIA);
      if (Object.keys(errs).length) {
        setErrors(errs);
        return;
      }
      const payload = montarPeticaoAiRequest(formIA);
      setLoading(true);
      try {
        await baixarPdf(gerarPdfComIA, payload);
      } catch (e) {
        setMensagemErro(e?.message || 'Falha ao gerar PDF.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const errs = validarModoManual(formManual);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const payload = montarDocumentoManualRequest(formManual);
    setLoading(true);
    try {
      await baixarPdf(gerarPdfManual, payload);
    } catch (e) {
      setMensagemErro(e?.message || 'Falha ao gerar PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handleGerarPdfFromPreview = async () => {
    if (!previewData) return;
    setMensagemErro('');
    setLoading(true);
    try {
      await baixarPdf(gerarPdfManual, previewData);
      setPreviewOpen(false);
    } catch (e) {
      setMensagemErro(e?.message || 'Falha ao gerar PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    setMensagemErro('');
    const errs = validarModoIA(formIA);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const payload = montarPeticaoAiRequest(formIA);
    setPreviewOpen(true);
    setPreviewData(null);
    setLoadingPreview(true);
    try {
      const data = await gerarPreviewIA(payload);
      setPreviewData(data);
    } catch (e) {
      setMensagemErro(e?.message || 'Falha ao gerar preview.');
      setPreviewOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const ocupado = loading || loadingPreview;

  const fecharParaProcesso = useCallback(() => {
    if (!dadosProcesso?.codigoCliente) {
      navigate('/processos');
      return;
    }
    navigate('/processos', {
      state: buildRouterStateChaveClienteProcesso(
        dadosProcesso.codigoCliente,
        dadosProcesso.numeroInterno,
      ),
    });
  }, [navigate, dadosProcesso]);

  return (
    <div className={`mx-auto px-4 py-6 lg:px-6 ${modoArquivo ? 'max-w-7xl pb-8' : modoModelo || modoExecucao ? 'max-w-4xl pb-8' : 'max-w-4xl pb-32'}`}>
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
              <FileText className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Gerar Documento</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Petições e peças processuais em PDF — inclusive a partir de Word ou PDF enviado
              </p>
            </div>
          </div>
          {vindoDoProcesso ? (
            <button
              type="button"
              onClick={fecharParaProcesso}
              className="shrink-0 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Fechar e voltar ao processo"
              title="Voltar ao processo"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
        </div>

        <div
          className="inline-flex w-full flex-wrap rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800 sm:w-auto"
          role="tablist"
          aria-label="Modo de geração"
        >
          <button
            type="button"
            role="tab"
            aria-selected={modoIA}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              modoIA
                ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
            onClick={() => {
              setModo(MODO_IA);
              setErrors({});
              setMensagemErro('');
            }}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Com IA
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === MODO_MANUAL}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              modo === MODO_MANUAL
                ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
            onClick={() => {
              setModo(MODO_MANUAL);
              setErrors({});
              setMensagemErro('');
            }}
          >
            Manual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modoProcuracao}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              modoProcuracao
                ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
            onClick={() => {
              setModo(MODO_PROCURACAO);
              setErrors({});
              setMensagemErro('');
            }}
          >
            <FileSignature className="h-4 w-4" aria-hidden />
            Procuração
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modoModelo}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              modoModelo
                ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
            onClick={() => {
              setModo(MODO_MODELO);
              setErrors({});
              setMensagemErro('');
            }}
          >
            <Layers className="h-4 w-4" aria-hidden />
            A partir de Modelo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modoArquivo}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              modoArquivo
                ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
            onClick={() => {
              setModo(MODO_ARQUIVO);
              setErrors({});
              setMensagemErro('');
            }}
          >
            <FileUp className="h-4 w-4" aria-hidden />
            Enviar arquivo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modoExecucao}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              modoExecucao
                ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
            onClick={() => {
              setModo(MODO_EXECUCAO);
              setErrors({});
              setMensagemErro('');
            }}
          >
            <Scale className="h-4 w-4" aria-hidden />
            Execução
          </button>
        </div>
      </header>

      {mensagemErro && (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {mensagemErro}
        </div>
      )}

      {vindoDoProcesso && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
          Dados pré-preenchidos do processo
          {dadosProcesso.numeroProcesso ? ` ${dadosProcesso.numeroProcesso}` : ''}
          {dadosProcesso.codigoCliente
            ? ` (cliente ${dadosProcesso.codigoCliente}${
                dadosProcesso.numeroInterno != null ? ` / proc. ${dadosProcesso.numeroInterno}` : ''
              })`
            : ''}
          . Revise e complemente os fatos antes de gerar.
        </div>
      )}

      <div className="space-y-4">
        {modoExecucao ? (
          <CollapsibleSection title="Petição de Execução (a partir do cálculo salvo)" defaultOpen>
            {!temChaveProcesso ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Abra esta tela pelo botão <strong>Gerar Documento</strong> dentro de um processo
                para gerar a petição de execução com o cálculo já salvo.
              </p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Usa o último cálculo salvo do processo (cliente {codigoClienteProcesso} / proc.{' '}
                  {numeroInternoProcesso}). O PDF da memória de cálculo é baixado junto com a petição.
                </p>

                {execCalc.loading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando cálculo salvo…
                  </div>
                ) : execCalc.erro ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    {execCalc.erro}
                  </div>
                ) : execCalc.dados ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-700 dark:text-slate-200">
                      <span>
                        <strong>{execCalc.dados.titulos.length}</strong> título(s)
                      </span>
                      <span>
                        Total geral: <strong>{execCalc.dados.resumo?.total}</strong>
                      </span>
                      {execCalc.dados.aceito ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          cálculo aceito (valores congelados)
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">
                          último cálculo salvo (não aceito)
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                    Endereçamento *
                  </span>
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                    value={formExecucao.enderecamento}
                    onChange={(e) => {
                      setFormExecucao((f) => ({ ...f, enderecamento: e.target.value }));
                      setErrors({});
                      setMensagemErro('');
                    }}
                  />
                  {errors.enderecamentoExec ? (
                    <span className="mt-1 text-xs text-red-600">{errors.enderecamentoExec}</span>
                  ) : null}
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Modo</span>
                    <select
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                      value={formExecucao.modo}
                      onChange={(e) => setFormExecucao((f) => ({ ...f, modo: e.target.value }))}
                    >
                      <option value="Completo">Completo</option>
                      <option value="Resumido">Resumido</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Data</span>
                    <input
                      type="text"
                      placeholder="dd/mm/aaaa"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                      value={formExecucao.data}
                      onChange={(e) => setFormExecucao((f) => ({ ...f, data: e.target.value }))}
                    />
                  </label>
                </div>

                <div>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={
                      loading ||
                      execCalc.loading ||
                      !execCalc.dados ||
                      !execCalc.dados?.titulos?.length
                    }
                    onClick={() => void handleGerarExecucao()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Gerando petição…
                      </>
                    ) : (
                      'Gerar Petição de Execução'
                    )}
                  </button>
                </div>
              </div>
            )}
          </CollapsibleSection>
        ) : modoModelo ? (
          <ModoModeloTopicos
            onErro={setMensagemErro}
            onLoadingChange={(v) => {
              if (v) setLoading(true);
              else setLoading(false);
            }}
          />
        ) : modoArquivo ? (
          <ModoEnviarArquivo
            dadosProcesso={dadosProcesso}
            onErro={setMensagemErro}
            onLoadingChange={(v) => {
              if (v) setLoading(true);
              else setLoading(false);
            }}
          />
        ) : modoProcuracao ? (
          <CollapsibleSection title="Procuração Ad Judicia" defaultOpen>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Gera procuração com texto fixo dos poderes. Informe o ID da pessoa outorgante (dados
              vêm do cadastro).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                  ID da pessoa (outorgante) *
                </span>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                  value={formProcuracao.pessoaId}
                  onChange={(e) => {
                    setFormProcuracao((f) => ({ ...f, pessoaId: e.target.value }));
                    setErrors({});
                    setMensagemErro('');
                  }}
                />
                {errors.pessoaId ? (
                  <span className="mt-1 text-xs text-red-600">{errors.pessoaId}</span>
                ) : null}
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                  Local e data (cidade/estado)
                </span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                  value={formProcuracao.cidadeEstado}
                  onChange={(e) =>
                    setFormProcuracao((f) => ({ ...f, cidadeEstado: e.target.value }))
                  }
                />
              </label>
            </div>
          </CollapsibleSection>
        ) : modoIA ? (
          <>
            <CollapsibleSection title="1. Dados do processo" defaultOpen>
              <DadosProcesso values={formIA} onChange={patchIA} errors={errors} />
            </CollapsibleSection>

            <CollapsibleSection title="2. Partes" defaultOpen>
              <DadosPartes values={formIA} onChange={patchIA} errors={errors} />
            </CollapsibleSection>

            <CollapsibleSection title="3. Tipo de peça e fatos" defaultOpen>
              <FatosDoCaso values={formIA} onChange={patchIA} errors={errors} />
            </CollapsibleSection>

            <CollapsibleSection title="4. Configurações avançadas" defaultOpen={false}>
              <ConfiguracaoIA values={formIA} onChange={patchIA} />
            </CollapsibleSection>
          </>
        ) : (
          <>
            <CollapsibleSection title="1. Dados do processo" defaultOpen>
              <DadosProcesso values={formManual} onChange={patchManual} errors={errors} />
            </CollapsibleSection>

            <CollapsibleSection title="2. Preâmbulo e seções" defaultOpen>
              <SecoesManuais values={formManual} onChange={patchManual} errors={errors} />
            </CollapsibleSection>
          </>
        )}
      </div>

      {!modoModelo && !modoArquivo && !modoExecucao ? (
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:left-56">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
          <button type="button" className={btnPrimary} disabled={ocupado} onClick={() => void handleGerarPdf()}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {modoProcuracao
                  ? 'Gerando procuração…'
                  : modoIA
                    ? 'Gerando petição com IA…'
                    : 'Gerando PDF…'}
              </>
            ) : (
              modoProcuracao ? 'Gerar Procuração' : 'Gerar PDF'
            )}
          </button>

          {modoIA && (
            <button type="button" className={btnSecondary} disabled={ocupado} onClick={() => void handlePreview()}>
              {loadingPreview ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Gerando preview…
                </>
              ) : (
                'Preview'
              )}
            </button>
          )}

          <button type="button" className={btnGhost} disabled={ocupado} onClick={limpar}>
            Limpar
          </button>

          {loading && modoIA && (
            <p className="w-full text-xs text-slate-500 sm:w-auto">
              Gerando petição com IA… Isso pode levar até 30 segundos.
            </p>
          )}
        </div>
      </div>
      ) : null}

      <PreviewPeticao
        open={previewOpen}
        preview={previewData}
        loading={loadingPreview}
        gerando={loading}
        erro={mensagemErro}
        onClose={() => setPreviewOpen(false)}
        onPreviewChange={setPreviewData}
        onGerarPdf={() => void handleGerarPdfFromPreview()}
      />
    </div>
  );
}
