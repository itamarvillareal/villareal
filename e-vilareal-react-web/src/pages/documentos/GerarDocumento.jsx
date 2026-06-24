import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FileSignature,
  FileText,
  FileUp,
  Layers,
  Loader2,
  Scale,
  ScrollText,
  Sparkles,
  X,
} from 'lucide-react';
import {
  mapearDadosProcessoParaFormIA,
  mapearDadosProcessoParaFormManual,
  extrairCidadeEstadoDeLocalData,
  extrairDataIsoDeLocalData,
  formatarLocalData,
  LOCAL_DATA_PADRAO,
} from '../../helpers/documentoHelper.js';
import { buildRouterStateChaveClienteProcesso } from '../../domain/camposProcessoCliente.js';
import {
  downloadPdfBlob,
  gerarPdfComIA,
  gerarPdfManual,
  gerarPreviewIA,
  gerarContratoAluguel,
  gerarContratoHonorarios,
  gerarProcuracao,
  nomeArquivoContratoPdf,
  nomeArquivoPeticaoPdf,
  nomeArquivoProcuracaoPdf,
  previewConteudoContratoHonorarios,
  previewPdfContratoHonorarios,
  buscarContratoHonorariosProcesso,
  salvarContratoHonorariosProcesso,
} from '../../repositories/documentosRepository.js';
import { ENDERECAMENTOS } from './constants.js';
import { btnGhost, btnPrimary, btnSecondary } from './documentosStyles.js';
import { CollapsibleSection } from './components/CollapsibleSection.jsx';
import { DadosProcesso, resolveEnderecamento } from './components/DadosProcesso.jsx';
import { DadosPartes } from './components/DadosPartes.jsx';
import { FatosDoCaso, resolveTipoPeca } from './components/FatosDoCaso.jsx';
import { ConfiguracaoIA } from './components/ConfiguracaoIA.jsx';
import { SecoesManuais } from './components/SecoesManuais.jsx';
import { pedidosPreenchidos } from './components/PedidosEspecificos.jsx';
import { DocumentosSubmenu } from './components/DocumentosSubmenu.jsx';
import { dataBRparaISO } from '../../data/peticaoExecucaoBuilder.js';
import {
  CLAUSULA_3_REMUNERACAO_PADRAO,
  CONTRATADO_HONORARIOS_NOME,
  FORMA_ASSINATURA_DUAS_VIAS,
  FORMAS_ASSINATURA_CONTRATO,
  MODELO_CONTRATO_ALUGUEL,
  MODELO_CONTRATO_HONORARIOS,
  MODELOS_CONTRATO,
  rotuloModeloContrato,
} from './contratoModelos.js';
import { estadoInicialClausula3, parcelamentoAtivo, clausula3DadosParaForm } from './contratoHonorariosClausula3.js';
import { renumerarClausulas } from './contratoHonorariosClausulasPreview.js';

const ModoModeloTopicos = lazy(() =>
  import('./components/ModoModeloTopicos.jsx').then((m) => ({ default: m.ModoModeloTopicos })),
);
const ModoEnviarArquivo = lazy(() =>
  import('./components/ModoEnviarArquivo.jsx').then((m) => ({ default: m.ModoEnviarArquivo })),
);
const PreviewPeticao = lazy(() =>
  import('./components/PreviewPeticao.jsx').then((m) => ({ default: m.PreviewPeticao })),
);
const ContratoHonorariosClausula3Modal = lazy(() =>
  import('./components/ContratoHonorariosClausula3Modal.jsx').then((m) => ({
    default: m.ContratoHonorariosClausula3Modal,
  })),
);
const PreviewContratoHonorarios = lazy(() =>
  import('./components/PreviewContratoHonorarios.jsx').then((m) => ({
    default: m.PreviewContratoHonorarios,
  })),
);

function LazyModoFallback() {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-slate-500 dark:text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Carregando…
    </div>
  );
}

const hojeIso = () => new Date().toISOString().split('T')[0];

const STORAGE_KEY_DADOS_PROCESSO = 'vilareal.gerarDocumento.dadosProcesso';

/** Só o necessário para reabrir a tela — evita estourar sessionStorage / memória. */
const CAMPOS_DADOS_PROCESSO_PERSISTIDOS = [
  'enderecamento',
  'numeroProcesso',
  'tipoPeca',
  'nomeAutor',
  'nomeReu',
  'cidadeEstado',
  'codigoCliente',
  'numeroInterno',
  'processoApiId',
  'parteCliente',
  'parteOposta',
  'papelParte',
  'pessoaIdOutorgante',
  'nomeOutorgante',
  'nomeLocador',
  'nomeLocatarios',
];

function compactarDadosProcessoParaPersistencia(dados) {
  if (!dados || typeof dados !== 'object') return null;
  const out = {};
  for (const chave of CAMPOS_DADOS_PROCESSO_PERSISTIDOS) {
    const val = dados[chave];
    if (val == null || val === '') continue;
    out[chave] = val;
  }
  return Object.keys(out).length ? out : null;
}

function lerDadosProcessoPersistidos() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_DADOS_PROCESSO);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function salvarDadosProcessoPersistidos(dados) {
  const compacto = compactarDadosProcessoParaPersistencia(dados);
  if (!compacto) return;
  try {
    sessionStorage.setItem(STORAGE_KEY_DADOS_PROCESSO, JSON.stringify(compacto));
  } catch {
    /* quota / modo privado */
  }
}

const hojeBR = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const MODO_IA = 'ia';
const MODO_MANUAL = 'manual';
const MODO_PROCURACAO = 'procuracao';
const MODO_CONTRATO = 'contrato';
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
  cidadeEstado: LOCAL_DATA_PADRAO,
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
  cidadeEstado: LOCAL_DATA_PADRAO,
});

function opcional(val) {
  const t = (val ?? '').trim();
  return t || null;
}

function montarPeticaoAiRequest(form, processoId, dadosProcesso) {
  const pedidos = pedidosPreenchidos(form.pedidosEspecificos);
  const payload = {
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
    cidadeEstado: extrairCidadeEstadoDeLocalData(form.cidadeEstado),
    data: extrairDataIsoDeLocalData(form.cidadeEstado) || hojeIso(),
  };
  if (processoId != null && processoId !== '') payload.processoId = Number(processoId);
  if (dadosProcesso?.codigoCliente) payload.codigoCliente = dadosProcesso.codigoCliente;
  if (dadosProcesso?.numeroInterno != null && dadosProcesso?.numeroInterno !== '') {
    payload.numeroInterno = Number(dadosProcesso.numeroInterno);
  }
  return payload;
}

function montarDocumentoManualRequest(form, processoId, dadosProcesso) {
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
    cidadeEstado: extrairCidadeEstadoDeLocalData(form.cidadeEstado),
    data: extrairDataIsoDeLocalData(form.cidadeEstado) || hojeIso(),
    ...(processoId != null && processoId !== '' ? { processoId: Number(processoId) } : {}),
    ...(dadosProcesso?.codigoCliente ? { codigoCliente: dadosProcesso.codigoCliente } : {}),
    ...(dadosProcesso?.numeroInterno != null && dadosProcesso?.numeroInterno !== ''
      ? { numeroInterno: Number(dadosProcesso.numeroInterno) }
      : {}),
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

function sugerirObjetoContrato(dadosProcesso) {
  if (!dadosProcesso) return '';
  const emFaceDe =
    dadosProcesso.nomeOutorgante?.trim() === dadosProcesso.nomeAutor?.trim()
      ? dadosProcesso.nomeReu?.trim()
      : dadosProcesso.nomeAutor?.trim();
  const tipo = (dadosProcesso.tipoPeca || 'INDENIZAÇÃO POR DANO MORAL E MATERIAL').trim().toUpperCase();
  const pedido = tipo.startsWith('EM ') ? tipo : `EM PEDIDO DE ${tipo}`;
  return emFaceDe ? `${pedido}, em face de ${emFaceDe.toUpperCase()}` : `${pedido}, em face de XXXXXXXXXXXX`;
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
  const dadosProcessoState = location.state?.dadosProcesso;
  const dadosProcesso = useMemo(
    () => dadosProcessoState ?? lerDadosProcessoPersistidos(),
    [dadosProcessoState],
  );
  const modoInicial = location.state?.modoInicial;

  useEffect(() => {
    if (dadosProcessoState) {
      salvarDadosProcessoPersistidos(dadosProcessoState);
    }
  }, [dadosProcessoState]);

  /** Limpa snapshot antigo/grande que podia estourar memória ao reabrir a rota. */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY_DADOS_PROCESSO);
      if (!raw || raw.length <= 50_000) return;
      const parsed = JSON.parse(raw);
      const compacto = compactarDadosProcessoParaPersistencia(parsed);
      if (compacto) {
        sessionStorage.setItem(STORAGE_KEY_DADOS_PROCESSO, JSON.stringify(compacto));
      } else {
        sessionStorage.removeItem(STORAGE_KEY_DADOS_PROCESSO);
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY_DADOS_PROCESSO);
    }
  }, []);
  const formInicialIA = useMemo(
    () => (dadosProcesso ? mapearDadosProcessoParaFormIA(dadosProcesso) : estadoInicialIA()),
    [dadosProcesso]
  );
  const formInicialManual = useMemo(
    () => (dadosProcesso ? mapearDadosProcessoParaFormManual(dadosProcesso) : estadoInicialManual()),
    [dadosProcesso]
  );
  const vindoDoProcesso = Boolean(dadosProcesso);

  const [modo, setModo] = useState(() => {
    if (modoInicial === 'contrato') return MODO_CONTRATO;
    return MODO_IA;
  });
  const modoIA = modo === MODO_IA;
  const modoProcuracao = modo === MODO_PROCURACAO;
  const modoContrato = modo === MODO_CONTRATO;
  const modoModelo = modo === MODO_MODELO;
  const modoArquivo = modo === MODO_ARQUIVO;
  const modoExecucao = modo === MODO_EXECUCAO;

  const codigoClienteProcesso = dadosProcesso?.codigoCliente;
  const numeroInternoProcesso = dadosProcesso?.numeroInterno;
  const processoApiId = dadosProcesso?.processoApiId ?? null;
  const temChaveProcesso =
    Boolean(codigoClienteProcesso) && String(numeroInternoProcesso ?? '').trim() !== '';
  const [formIA, setFormIA] = useState(formInicialIA);
  const [formManual, setFormManual] = useState(formInicialManual);
  const [formProcuracao, setFormProcuracao] = useState(() => ({
    pessoaId: dadosProcesso?.pessoaIdOutorgante ? String(dadosProcesso.pessoaIdOutorgante) : '',
    cidadeEstado: formatarLocalData(dadosProcesso?.cidadeEstado),
    nomeOutorgante: dadosProcesso?.nomeOutorgante || '',
  }));
  const [formContrato, setFormContrato] = useState(() => ({
    modelo: MODELO_CONTRATO_HONORARIOS,
    pessoaId: dadosProcesso?.pessoaIdOutorgante ? String(dadosProcesso.pessoaIdOutorgante) : '',
    cidadeEstado: formatarLocalData(dadosProcesso?.cidadeEstado),
    nomeContratante: dadosProcesso?.nomeOutorgante || '',
    objetoContrato: sugerirObjetoContrato(dadosProcesso),
    clausula3Remuneracao: CLAUSULA_3_REMUNERACAO_PADRAO,
    clausula3Form: estadoInicialClausula3(),
    clausula3Dados: null,
    clausula3Configurada: false,
    formaAssinatura: FORMA_ASSINATURA_DUAS_VIAS,
    nomeLocador: dadosProcesso?.nomeLocador || '',
    nomeLocatarios: dadosProcesso?.nomeLocatarios || '',
  }));
  const contratoHonorarios = formContrato.modelo === MODELO_CONTRATO_HONORARIOS;
  const contratoAluguel = formContrato.modelo === MODELO_CONTRATO_ALUGUEL;
  const [clausula3ModalOpen, setClausula3ModalOpen] = useState(false);
  const [contratoPreviewVisivel, setContratoPreviewVisivel] = useState(false);
  const [contratoPreviewConteudo, setContratoPreviewConteudo] = useState(null);
  const [contratoPreviewPdfUrl, setContratoPreviewPdfUrl] = useState(null);
  const contratoPreviewRef = useRef(null);
  const contratoPreviewPdfUrlRef = useRef(null);
  const [loadingContratoPreview, setLoadingContratoPreview] = useState(false);
  const [loadingContratoFinal, setLoadingContratoFinal] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [mensagemErro, setMensagemErro] = useState('');
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [formExecucao, setFormExecucao] = useState(() => ({
    enderecamento: dadosProcesso?.enderecamento || '',
    modo: 'Completo',
    data: hojeBR(),
  }));
  // Cálculo salvo carregado para a petição de execução: { loading, dados, erro }.
  const [execCalc, setExecCalc] = useState({ loading: false, dados: null, erro: '' });

  useEffect(() => {
    if (!mensagemSucesso) return undefined;
    const t = window.setTimeout(() => setMensagemSucesso(''), 8000);
    return () => window.clearTimeout(t);
  }, [mensagemSucesso]);

  useEffect(() => {
    if (!processoApiId || !contratoHonorarios) return undefined;
    let cancel = false;
    buscarContratoHonorariosProcesso(processoApiId)
      .then((salvo) => {
        if (cancel || !salvo?.resumo) return;
        const r = salvo.resumo;
        setFormContrato((f) => ({
          ...f,
          pessoaId: r.pessoaId != null ? String(r.pessoaId) : f.pessoaId,
          nomeContratante: r.nomeContratante || f.nomeContratante,
          objetoContrato: r.objetoContrato ?? f.objetoContrato,
          formaAssinatura: salvo.formaAssinatura || f.formaAssinatura,
          clausula3Form: clausula3DadosParaForm(salvo.clausula3Dados, r.dataContrato),
          clausula3Dados: salvo.clausula3Dados,
          clausula3Remuneracao: r.clausula3Texto || f.clausula3Remuneracao,
          clausula3Configurada: true,
        }));
      })
      .catch((e) => {
        if (String(e?.message || '').includes('404')) return;
        if (!cancel) {
          setMensagemErro(e?.message || 'Falha ao carregar contratação do processo.');
        }
      });
    return () => {
      cancel = true;
    };
  }, [processoApiId, contratoHonorarios]);

  const revogarContratoPreviewPdfUrl = useCallback(() => {
    if (contratoPreviewPdfUrlRef.current) {
      URL.revokeObjectURL(contratoPreviewPdfUrlRef.current);
      contratoPreviewPdfUrlRef.current = null;
    }
    setContratoPreviewPdfUrl(null);
  }, []);

  useEffect(() => () => revogarContratoPreviewPdfUrl(), [revogarContratoPreviewPdfUrl]);

  const fecharContratoPreview = useCallback(() => {
    setContratoPreviewVisivel(false);
    setContratoPreviewConteudo(null);
    revogarContratoPreviewPdfUrl();
  }, [revogarContratoPreviewPdfUrl]);

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
      cidadeEstado: LOCAL_DATA_PADRAO,
      nomeOutorgante: '',
    });
    setFormContrato({
      modelo: MODELO_CONTRATO_HONORARIOS,
      pessoaId: '',
      cidadeEstado: LOCAL_DATA_PADRAO,
      nomeContratante: '',
      objetoContrato: '',
      clausula3Remuneracao: CLAUSULA_3_REMUNERACAO_PADRAO,
      clausula3Form: estadoInicialClausula3(),
      clausula3Dados: null,
      clausula3Configurada: false,
      formaAssinatura: FORMA_ASSINATURA_DUAS_VIAS,
      nomeLocador: '',
      nomeLocatarios: '',
    });
    setErrors({});
    setMensagemErro('');
    setPreviewOpen(false);
    setPreviewData(null);
    fecharContratoPreview();
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
    import('../../services/peticaoExecucaoDeRodada.js')
      .then(({ carregarCalculoSalvo }) =>
        carregarCalculoSalvo({
          codigoCliente: codigoClienteProcesso,
          numeroInterno: numeroInternoProcesso,
        }),
      )
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
      const { gerarPeticaoExecucaoDeCalculoSalvo } = await import(
        '../../services/peticaoExecucaoDeRodada.js'
      );
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
        cidadeEstado: formProcuracao.cidadeEstado?.trim() || LOCAL_DATA_PADRAO,
        data: extrairDataIsoDeLocalData(formProcuracao.cidadeEstado) || hojeIso(),
        processoId: processoApiId,
      });
      downloadPdfBlob(blob, nomeArquivoProcuracaoPdf(formProcuracao.nomeOutorgante));
    } catch (e) {
      setMensagemErro(e?.message || 'Falha ao gerar procuração.');
    } finally {
      setLoading(false);
    }
  };

  const montarPayloadContratoHonorarios = (conteudoEditado) => {
    const pessoaId = Number(formContrato.pessoaId);
    return {
      pessoaId,
      cidadeEstado: formContrato.cidadeEstado?.trim() || LOCAL_DATA_PADRAO,
      data: extrairDataIsoDeLocalData(formContrato.cidadeEstado) || hojeIso(),
      processoId: processoApiId,
      codigoCliente: codigoClienteProcesso,
      numeroInterno: numeroInternoProcesso,
      objetoContrato: formContrato.objetoContrato,
      clausula3Remuneracao: formContrato.clausula3Configurada ? undefined : formContrato.clausula3Remuneracao,
      clausula3Dados: formContrato.clausula3Configurada ? formContrato.clausula3Dados : undefined,
      persistirDados: false,
      formaAssinatura: formContrato.formaAssinatura,
      ...(conteudoEditado ? { conteudoEditado } : {}),
    };
  };

  const validarContratoHonorarios = () => {
    const pessoaId = Number(formContrato.pessoaId);
    if (!Number.isFinite(pessoaId) || pessoaId <= 0) {
      setErrors({ pessoaIdContrato: 'Informe o ID da pessoa (contratante).' });
      setMensagemErro('Informe o ID da pessoa (contratante) para visualizar a prévia.');
      return false;
    }
    setErrors({});
    return true;
  };

  const aplicarMensagemSucessoContratoHonorarios = () => {
    setMensagemSucesso('PDF do contrato gerado (contratação permanece a salva no processo).');
  };

  const montarPayloadSalvarContratacao = (dados) => {
    const pessoaId = Number(formContrato.pessoaId);
    if (!Number.isFinite(pessoaId) || pessoaId <= 0) {
      throw new Error('Informe o ID da pessoa (contratante) para salvar a contratação.');
    }
    if (!dados) {
      throw new Error('Configure a Cláusula 3ª antes de salvar a contratação.');
    }
    return {
      pessoaId,
      cidadeEstado: formContrato.cidadeEstado?.trim() || LOCAL_DATA_PADRAO,
      data: extrairDataIsoDeLocalData(formContrato.cidadeEstado) || hojeIso(),
      processoId: processoApiId,
      codigoCliente: codigoClienteProcesso,
      numeroInterno: numeroInternoProcesso,
      objetoContrato: formContrato.objetoContrato,
      clausula3Dados: dados,
      formaAssinatura: formContrato.formaAssinatura,
    };
  };

  const handleSalvarContratacao = async ({ form, dados, texto }) => {
    if (!processoApiId) {
      setMensagemErro('Abra a tela a partir de um processo para salvar a contratação.');
      return false;
    }
    try {
      const payload = montarPayloadSalvarContratacao(dados);
      const salvo = await salvarContratoHonorariosProcesso(processoApiId, payload);
      setFormContrato((f) => ({
        ...f,
        clausula3Form: clausula3DadosParaForm(salvo?.clausula3Dados ?? dados) || form,
        clausula3Dados: salvo?.clausula3Dados ?? dados,
        clausula3Remuneracao: salvo?.resumo?.clausula3Texto || texto,
        objetoContrato: salvo?.resumo?.objetoContrato ?? f.objetoContrato,
        formaAssinatura: salvo?.formaAssinatura || f.formaAssinatura,
        clausula3Configurada: true,
      }));
      if (dados?.gerarRecebiveis) {
        setMensagemSucesso('Contratação salva. Recebíveis atualizados no financeiro do processo.');
      } else if (parcelamentoAtivo(form)) {
        setMensagemSucesso('Contratação salva com parcelamento registrado na Cláusula 3ª.');
      } else {
        setMensagemSucesso('Contratação salva no processo.');
      }
      setMensagemErro('');
      return true;
    } catch (e) {
      setMensagemErro(e?.message || 'Falha ao salvar contratação.');
      return false;
    }
  };

  const atualizarContratoPreviewPdf = async (conteudo) => {
    const blob = await previewPdfContratoHonorarios(conteudo, { processoId: processoApiId });
    revogarContratoPreviewPdfUrl();
    const url = URL.createObjectURL(blob);
    contratoPreviewPdfUrlRef.current = url;
    setContratoPreviewPdfUrl(url);
  };

  const handleIniciarPreviewContratoHonorarios = async () => {
    setMensagemErro('');
    if (!validarContratoHonorarios()) return;

    setContratoPreviewVisivel(true);
    setContratoPreviewConteudo(null);
    revogarContratoPreviewPdfUrl();
    setLoadingContratoPreview(true);
    window.requestAnimationFrame(() => {
      contratoPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    try {
      const conteudo = await previewConteudoContratoHonorarios(montarPayloadContratoHonorarios());
      setContratoPreviewConteudo(conteudo);
      await atualizarContratoPreviewPdf(conteudo);
    } catch (e) {
      setMensagemErro(e?.message || 'Falha ao gerar prévia do contrato.');
      setContratoPreviewVisivel(false);
      setContratoPreviewConteudo(null);
      revogarContratoPreviewPdfUrl();
    } finally {
      setLoadingContratoPreview(false);
    }
  };

  const handleAtualizarPreviewContratoHonorarios = async () => {
    if (!contratoPreviewConteudo) return;
    setMensagemErro('');
    setLoadingContratoPreview(true);
    try {
      const conteudo = {
        ...contratoPreviewConteudo,
        clausulas: renumerarClausulas(contratoPreviewConteudo.clausulas),
      };
      setContratoPreviewConteudo(conteudo);
      await atualizarContratoPreviewPdf(conteudo);
    } catch (e) {
      setMensagemErro(e?.message || 'Falha ao atualizar prévia.');
    } finally {
      setLoadingContratoPreview(false);
    }
  };

  const handleGerarContratoHonorariosFinal = async () => {
    if (!contratoPreviewConteudo) return;
    if (processoApiId && !formContrato.clausula3Configurada) {
      setMensagemErro('Salve a contratação (Cláusula 3ª) no processo antes de gerar o PDF final.');
      return;
    }
    setMensagemErro('');
    setLoadingContratoFinal(true);
    try {
      const conteudo = {
        ...contratoPreviewConteudo,
        clausulas: renumerarClausulas(contratoPreviewConteudo.clausulas),
      };
      setContratoPreviewConteudo(conteudo);
      const blob = await gerarContratoHonorarios(
        montarPayloadContratoHonorarios(conteudo),
      );
      downloadPdfBlob(
        blob,
        nomeArquivoContratoPdf(
          conteudo.nomeContratante || formContrato.nomeContratante,
          'honorarios',
        ),
      );
      aplicarMensagemSucessoContratoHonorarios();
      fecharContratoPreview();
    } catch (e) {
      setMensagemErro(e?.message || 'Falha ao gerar contrato de honorários.');
    } finally {
      setLoadingContratoFinal(false);
    }
  };

  const handleGerarContrato = async () => {
    setMensagemErro('');
    setErrors({});

    if (contratoAluguel) {
      if (!processoApiId) {
        setMensagemErro(
          'Abra esta tela a partir de um processo para gerar o contrato de aluguel (locador e locatário vêm das partes do processo).',
        );
        return;
      }
      setLoading(true);
      try {
        const blob = await gerarContratoAluguel({
          processoId: processoApiId,
          cidadeEstado: formContrato.cidadeEstado?.trim() || LOCAL_DATA_PADRAO,
          data: extrairDataIsoDeLocalData(formContrato.cidadeEstado) || hojeIso(),
          codigoCliente: codigoClienteProcesso,
          numeroInterno: numeroInternoProcesso,
          formaAssinatura: formContrato.formaAssinatura,
        });
        downloadPdfBlob(
          blob,
          nomeArquivoContratoPdf(formContrato.nomeLocador || 'locador', 'aluguel'),
        );
      } catch (e) {
        setMensagemErro(e?.message || 'Falha ao gerar contrato de aluguel.');
      } finally {
        setLoading(false);
      }
      return;
    }

    await handleIniciarPreviewContratoHonorarios();
  };

  const handleGerarPdf = async () => {
    setMensagemErro('');
    if (modoProcuracao) {
      await handleGerarProcuracao();
      return;
    }
    if (modoContrato) {
      await handleGerarContrato();
      return;
    }
    if (modoIA) {
      const errs = validarModoIA(formIA);
      if (Object.keys(errs).length) {
        setErrors(errs);
        return;
      }
      const payload = montarPeticaoAiRequest(formIA, processoApiId, dadosProcesso);
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
    const payload = montarDocumentoManualRequest(formManual, processoApiId, dadosProcesso);
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
    const payload = montarPeticaoAiRequest(formIA, processoApiId, dadosProcesso);
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

  const ocupado = loading || loadingPreview || loadingContratoPreview || loadingContratoFinal;

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
      <DocumentosSubmenu />
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
            aria-selected={modoContrato}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              modoContrato
                ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
            onClick={() => {
              setModo(MODO_CONTRATO);
              setErrors({});
              setMensagemErro('');
            }}
          >
            <ScrollText className="h-4 w-4" aria-hidden />
            Contrato
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

      {mensagemSucesso && (
        <div
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
          role="status"
        >
          {mensagemSucesso}
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
          <Suspense fallback={<LazyModoFallback />}>
            <ModoModeloTopicos
              onErro={setMensagemErro}
              onLoadingChange={(v) => {
                if (v) setLoading(true);
                else setLoading(false);
              }}
            />
          </Suspense>
        ) : modoArquivo ? (
          <Suspense fallback={<LazyModoFallback />}>
            <ModoEnviarArquivo
              dadosProcesso={dadosProcesso}
              onErro={setMensagemErro}
              onSucesso={setMensagemSucesso}
              onLoadingChange={(v) => {
                if (v) setLoading(true);
                else setLoading(false);
              }}
            />
          </Suspense>
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
        ) : modoContrato ? (
          <CollapsibleSection title="Contrato" defaultOpen>
            <div className="mb-4 grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                  Modelo de contrato
                </span>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                  value={formContrato.modelo}
                  onChange={(e) => {
                    setFormContrato((f) => ({ ...f, modelo: e.target.value }));
                    setErrors({});
                    setMensagemErro('');
                  }}
                >
                  {MODELOS_CONTRATO.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {MODELOS_CONTRATO.find((m) => m.id === formContrato.modelo)?.descricao}
              </p>
              <fieldset className="block text-sm">
                <legend className="mb-2 font-medium text-slate-700 dark:text-slate-300">
                  Forma de assinatura
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FORMAS_ASSINATURA_CONTRATO.map((forma) => (
                    <label
                      key={forma.id}
                      className={`flex cursor-pointer gap-2 rounded-lg border px-3 py-2.5 transition ${
                        formContrato.formaAssinatura === forma.id
                          ? 'border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-950/30'
                          : 'border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900'
                      }`}
                    >
                      <input
                        type="radio"
                        name="formaAssinaturaContrato"
                        className="mt-0.5"
                        checked={formContrato.formaAssinatura === forma.id}
                        onChange={() => {
                          setFormContrato((f) => ({ ...f, formaAssinatura: forma.id }));
                          setMensagemErro('');
                        }}
                      />
                      <span>
                        <span className="block font-medium text-slate-800 dark:text-slate-100">
                          {forma.label}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {forma.descricao}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            {contratoHonorarios ? (
              <>
                <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                  Cláusulas fixas do escritório. Informe o contratante, o objeto (Cláusula 2ª) e a remuneração
                  (Cláusula 3ª).
                </p>
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Contratado (fixo): </span>
                  <span className="text-slate-600 dark:text-slate-300">{CONTRATADO_HONORARIOS_NOME}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                      ID da pessoa (contratante) *
                    </span>
                    <input
                      type="number"
                      min="1"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                      value={formContrato.pessoaId}
                      onChange={(e) => {
                        setFormContrato((f) => ({ ...f, pessoaId: e.target.value }));
                        setErrors({});
                        setMensagemErro('');
                      }}
                    />
                    {errors.pessoaIdContrato ? (
                      <span className="mt-1 text-xs text-red-600">{errors.pessoaIdContrato}</span>
                    ) : null}
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                      Objeto do contrato (Cláusula 2ª)
                    </span>
                    <textarea
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                      placeholder="EM PEDIDO DE INDENIZAÇÃO POR DANO MORAL E MATERIAL, em face de XXXXXXXXXXXX"
                      value={formContrato.objetoContrato}
                      onChange={(e) => {
                        setFormContrato((f) => ({ ...f, objetoContrato: e.target.value }));
                        setMensagemErro('');
                      }}
                    />
                  </label>
                  <div className="block text-sm sm:col-span-2">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Remuneração (Cláusula 3ª)
                      </span>
                      <button
                        type="button"
                        className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
                        onClick={() => setClausula3ModalOpen(true)}
                      >
                        Configurar remuneração…
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      readOnly={formContrato.clausula3Configurada}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                      value={formContrato.clausula3Remuneracao}
                      onChange={(e) => {
                        if (formContrato.clausula3Configurada) return;
                        setFormContrato((f) => ({
                          ...f,
                          clausula3Remuneracao: e.target.value,
                          clausula3Configurada: false,
                          clausula3Dados: null,
                        }));
                        setMensagemErro('');
                      }}
                    />
                    {formContrato.clausula3Configurada ? (
                      <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                        Contratação salva no processo
                        {formContrato.clausula3Form?.gerarRecebiveis
                          ? ' · recebíveis no financeiro'
                          : parcelamentoAtivo(formContrato.clausula3Form)
                            ? ' · parcelamento na cláusula'
                            : ''}
                        . O PDF pode ser gerado várias vezes sem duplicar o relatório.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Configure e salve a contratação no botão acima (percentuais, parcelas e recebíveis).
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {!processoApiId ? (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    Abra esta tela pelo botão <strong>Gerar Documento</strong> dentro de um processo.
                    O locador e o locatário são montados a partir das partes autora e oposta do processo.
                  </div>
                ) : (
                  <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                    <div>
                      <span className="font-medium text-slate-700 dark:text-slate-200">Locador (autor): </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {formContrato.nomeLocador || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        Locatário (parte oposta):{' '}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {formContrato.nomeLocatarios || '—'}
                      </span>
                    </div>
                  </div>
                )}
                <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                  Modelo em desenvolvimento — gera PDF esqueleto com preâmbulo e assinaturas locador/locatário.
                </p>
              </>
            )}

            <label className="mt-4 block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                Local e data (cidade/estado)
              </span>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                value={formContrato.cidadeEstado}
                onChange={(e) => setFormContrato((f) => ({ ...f, cidadeEstado: e.target.value }))}
              />
            </label>
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

      {modoContrato && contratoHonorarios && contratoPreviewVisivel ? (
        <div ref={contratoPreviewRef} className="mt-6">
          <Suspense fallback={<LazyModoFallback />}>
            <PreviewContratoHonorarios
              conteudo={contratoPreviewConteudo}
              pdfUrl={contratoPreviewPdfUrl}
              loading={loadingContratoPreview}
              gerandoFinal={loadingContratoFinal}
              onConteudoChange={setContratoPreviewConteudo}
              onAtualizar={() => void handleAtualizarPreviewContratoHonorarios()}
              onGerarFinal={() => void handleGerarContratoHonorariosFinal()}
              onVoltar={fecharContratoPreview}
            />
          </Suspense>
        </div>
      ) : null}

      {!modoModelo && !modoArquivo && !modoExecucao && !(modoContrato && contratoHonorarios && contratoPreviewVisivel && contratoPreviewConteudo) ? (
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:left-56">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
          <button type="button" className={btnPrimary} disabled={ocupado} onClick={() => void handleGerarPdf()}>
            {loading || loadingContratoPreview ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {modoProcuracao
                  ? 'Gerando procuração…'
                  : modoContrato
                    ? contratoHonorarios
                      ? 'Preparando prévia…'
                      : 'Gerando contrato…'
                    : modoIA
                      ? 'Gerando petição com IA…'
                      : 'Gerando PDF…'}
              </>
            ) : modoProcuracao ? (
              'Gerar Procuração'
            ) : modoContrato ? (
              contratoHonorarios ? 'Visualizar prévia' : `Gerar ${rotuloModeloContrato(formContrato.modelo)}`
            ) : (
              'Gerar PDF'
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

      {previewOpen ? (
        <Suspense fallback={null}>
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
        </Suspense>
      ) : null}

      {clausula3ModalOpen && contratoHonorarios ? (
        <Suspense fallback={null}>
          <ContratoHonorariosClausula3Modal
            open={clausula3ModalOpen && contratoHonorarios}
            onClose={() => setClausula3ModalOpen(false)}
            initialForm={formContrato.clausula3Form}
            processoApiId={processoApiId}
            pessoaId={formContrato.pessoaId}
            onApply={(payload) => handleSalvarContratacao(payload)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
