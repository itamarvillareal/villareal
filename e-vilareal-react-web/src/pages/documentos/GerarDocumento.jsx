import { useCallback, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FileSignature, FileText, Layers, Loader2, Sparkles } from 'lucide-react';
import { mapearDadosProcessoParaFormIA } from '../../helpers/documentoHelper.js';
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

const hojeIso = () => new Date().toISOString().split('T')[0];

const MODO_IA = 'ia';
const MODO_MANUAL = 'manual';
const MODO_PROCURACAO = 'procuracao';
const MODO_MODELO = 'modelo';

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

  return (
    <div className={`mx-auto px-4 py-6 lg:px-6 ${modoModelo ? 'max-w-7xl pb-8' : 'max-w-4xl pb-32'}`}>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
            <FileText className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Gerar Documento</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Petições e peças processuais em PDF
            </p>
          </div>
        </div>

        <div
          className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800"
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
        {modoModelo ? (
          <ModoModeloTopicos
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

      {!modoModelo ? (
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
        onClose={() => setPreviewOpen(false)}
        onGerarPdf={() => void handleGerarPdfFromPreview()}
      />
    </div>
  );
}
