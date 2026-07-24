import { useCallback, useEffect, useRef, useState } from 'react';
import { FileUp, Loader2, X } from 'lucide-react';
import {
  downloadPdfBlob,
  extrairConteudoArquivo,
  gerarPdfReformatado,
  inserirPdfReformatadoNaPastaAssinar,
  NOME_ARQUIVO_PETICAO_FORMATADA,
} from '../../../repositories/documentosRepository.js';
import { resolveSelectExato, extrairDataIsoDeLocalData, formatarLocalData, LOCAL_DATA_PADRAO } from '../../../helpers/documentoHelper.js';
import { salvarHistoricoDoProcesso } from '../../../data/processosHistoricoData.js';
import { CIDADE_ESTADO_PADRAO, ENDERECAMENTOS } from '../constants.js';
import { btnPrimary, btnSecondary, fieldErrorClass, inputClass } from '../documentosStyles.js';
import { CollapsibleSection } from './CollapsibleSection.jsx';
import { DadosProcesso, resolveEnderecamento } from './DadosProcesso.jsx';
import { PreviewArquivoDocumento } from './PreviewArquivoDocumento.jsx';

const TIPOS_ACEITOS = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const hojeIso = () => new Date().toISOString().split('T')[0];

const estadoInicial = () => ({
  enderecamentoSelect: '',
  enderecamentoOutro: '',
  numeroProcesso: '',
  cidadeEstado: LOCAL_DATA_PADRAO,
});

export function ModoEnviarArquivo({ dadosProcesso, onErro, onSucesso, onLoadingChange }) {
  const inputRef = useRef(null);
  const previewUrlRef = useRef(null);
  const inserindoPastaAssinarRef = useRef(false);
  const [form, setForm] = useState(() => {
    const base = estadoInicial();
    if (!dadosProcesso) return base;
    const end = resolveSelectExato(dadosProcesso.enderecamento, ENDERECAMENTOS);
    return {
      ...base,
      numeroProcesso: dadosProcesso.numeroProcesso || '',
      cidadeEstado: formatarLocalData(dadosProcesso.cidadeEstado || CIDADE_ESTADO_PADRAO),
      enderecamentoSelect: end.select,
      enderecamentoOutro: end.outro,
    };
  });
  const [arquivo, setArquivo] = useState(null);
  const [errors, setErrors] = useState({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingFinal, setLoadingFinal] = useState(false);
  const [loadingPastaAssinar, setLoadingPastaAssinar] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewVisivel, setPreviewVisivel] = useState(false);
  const [conteudoEditavel, setConteudoEditavel] = useState(null);

  const revogarPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  useEffect(() => () => revogarPreviewUrl(), [revogarPreviewUrl]);

  const patch = useCallback((p) => {
    setForm((f) => ({ ...f, ...p }));
    setErrors({});
    onErro?.('');
  }, [onErro]);

  const selecionarArquivo = (file) => {
    if (!file) return;
    const nome = (file.name || '').toLowerCase();
    const ok = nome.endsWith('.pdf') || nome.endsWith('.docx');
    if (!ok) {
      onErro?.('Envie um arquivo .docx (Word) ou .pdf.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      onErro?.('Arquivo muito grande (máximo 25 MB).');
      return;
    }
    setArquivo(file);
    revogarPreviewUrl();
    setPreviewVisivel(false);
    setConteudoEditavel(null);
    onErro?.('');
    setErrors({});
  };

  const limparArquivo = () => {
    setArquivo(null);
    revogarPreviewUrl();
    setPreviewVisivel(false);
    setConteudoEditavel(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const montarOpcoesExtracao = useCallback(() => {
    const enderecamento = resolveEnderecamento(form);
    const localData = form.cidadeEstado?.trim() || LOCAL_DATA_PADRAO;
    const dataIso = extrairDataIsoDeLocalData(localData) || hojeIso();
    return {
      enderecamento: enderecamento || undefined,
      numeroProcesso: form.numeroProcesso?.trim() || undefined,
      cidadeEstado: localData,
      data: dataIso,
      processoId: dadosProcesso?.processoApiId,
    };
  }, [form, dadosProcesso?.processoApiId]);

  const montarOpcoesGeracao = useCallback(
    (preview) => ({
      preview,
      codigoCliente: dadosProcesso?.codigoCliente,
      numeroInterno: dadosProcesso?.numeroInterno,
      processoId: dadosProcesso?.processoApiId,
    }),
    [dadosProcesso],
  );

  const podeInserirPastaAssinar = Boolean(
    dadosProcesso?.processoApiId
      || (dadosProcesso?.codigoCliente && dadosProcesso?.numeroInterno != null),
  );

  const validarArquivo = () => {
    const errs = {};
    if (!arquivo) errs.arquivo = 'Selecione um arquivo Word (.docx) ou PDF.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const setOcupado = (ocupado) => {
    onLoadingChange?.(ocupado);
  };

  const atualizarPdfPreview = async (conteudo) => {
    const blob = await gerarPdfReformatado(conteudo, montarOpcoesGeracao(true));
    revogarPreviewUrl();
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  };

  const iniciarPreview = async () => {
    onErro?.('');
    if (!validarArquivo()) return;

    setLoadingPreview(true);
    setPreviewVisivel(true);
    setOcupado(true);
    try {
      const conteudo = await extrairConteudoArquivo(arquivo, montarOpcoesExtracao());
      setConteudoEditavel(conteudo);
      await atualizarPdfPreview(conteudo);
    } catch (e) {
      onErro?.(e?.message || 'Falha ao gerar prévia do documento.');
      setPreviewVisivel(false);
      setConteudoEditavel(null);
      revogarPreviewUrl();
    } finally {
      setLoadingPreview(false);
      setOcupado(false);
    }
  };

  const handleAtualizarPreview = async () => {
    if (!conteudoEditavel) return;
    onErro?.('');
    setLoadingPreview(true);
    setOcupado(true);
    try {
      await atualizarPdfPreview(conteudoEditavel);
    } catch (e) {
      onErro?.(e?.message || 'Falha ao atualizar prévia.');
    } finally {
      setLoadingPreview(false);
      setOcupado(false);
    }
  };

  const handleGerarFinal = async () => {
    if (!conteudoEditavel) return;
    onErro?.('');
    setLoadingFinal(true);
    setOcupado(true);
    try {
      const blob = await gerarPdfReformatado(conteudoEditavel, montarOpcoesGeracao(false));
      downloadPdfBlob(blob, NOME_ARQUIVO_PETICAO_FORMATADA);
    } catch (e) {
      onErro?.(e?.message || 'Falha ao gerar PDF final.');
    } finally {
      setLoadingFinal(false);
      setOcupado(false);
    }
  };

  const handleInserirPastaAssinar = async () => {
    if (!conteudoEditavel || inserindoPastaAssinarRef.current) return;
    if (!podeInserirPastaAssinar) {
      onErro?.('Abra esta tela a partir de um processo para inserir na pasta Assinar.');
      return;
    }
    onErro?.('');
    onSucesso?.('');
    inserindoPastaAssinarRef.current = true;
    setLoadingPastaAssinar(true);
    setOcupado(true);
    try {
      const resp = await inserirPdfReformatadoNaPastaAssinar(conteudoEditavel, montarOpcoesGeracao(false));
      if (dadosProcesso?.codigoCliente && dadosProcesso?.numeroInterno != null) {
        salvarHistoricoDoProcesso({
          codCliente: dadosProcesso.codigoCliente,
          proc: dadosProcesso.numeroInterno,
          faseSelecionada: 'Protocolo / Movimentação',
        });
      }
      const nomeArquivo = resp?.nomeArquivo ? ` «${resp.nomeArquivo}»` : '';
      onSucesso?.(
        `PDF${nomeArquivo} inserido nas pastas Petições e Assinar (mesmo nível no Drive). Fase atualizada para Protocolo / Movimentação.`,
      );
    } catch (e) {
      onSucesso?.('');
      onErro?.(e?.message || 'Falha ao inserir PDF na pasta Assinar.');
    } finally {
      inserindoPastaAssinarRef.current = false;
      setLoadingPastaAssinar(false);
      setOcupado(false);
    }
  };

  const ocupado = loadingPreview || loadingFinal || loadingPastaAssinar;

  return (
    <div className="space-y-4">
      {!previewVisivel ? (
        <>
          <CollapsibleSection title="1. Arquivo" defaultOpen>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Envie um Word (.docx) ou PDF com o texto da peça. O conteúdo não é alterado — o sistema
              reaplica apenas a identidade visual do escritório: logo, cabeçalho, rodapé, fontes,
              títulos, recuos e negritos no padrão das petições.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept={TIPOS_ACEITOS}
              className="sr-only"
              id="doc-upload-arquivo"
              onChange={(e) => selecionarArquivo(e.target.files?.[0])}
            />

            {!arquivo ? (
              <label
                htmlFor="doc-upload-arquivo"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 transition hover:border-cyan-400 hover:bg-cyan-50/50 dark:border-slate-600 dark:bg-slate-900/50 dark:hover:border-cyan-600"
              >
                <FileUp className="h-10 w-10 text-slate-400" aria-hidden />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Clique para selecionar .docx ou .pdf
                </span>
                <span className="text-xs text-slate-500">Máximo 25 MB</span>
              </label>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {arquivo.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(arquivo.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800"
                  onClick={limparArquivo}
                  aria-label="Remover arquivo"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            {errors.arquivo ? (
              <p className={`mt-2 text-xs ${fieldErrorClass}`}>{errors.arquivo}</p>
            ) : null}
          </CollapsibleSection>

          <CollapsibleSection title="2. Dados complementares (opcional)" defaultOpen>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
              Se o arquivo já tiver endereçamento e número do processo, o sistema tenta detectá-los. Use
              os campos abaixo para sobrescrever ou completar.
            </p>
            <DadosProcesso values={form} onChange={patch} errors={errors} />
            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                Local e data
              </span>
              <input
                type="text"
                className={inputClass}
                value={form.cidadeEstado}
                onChange={(e) => patch({ cidadeEstado: e.target.value })}
                placeholder="Anápolis, estado de Goiás, 01 de junho de 2026"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Informe cidade, estado e data do peticionamento. Sobrescreve a linha em branco do Word.
              </span>
            </label>
          </CollapsibleSection>
        </>
      ) : null}

      {previewVisivel ? (
        <>
          {!podeInserirPastaAssinar ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
              Para usar <strong>Inserir na Pasta Assinar</strong>, abra esta tela a partir de{' '}
              <strong>Processos → Gerar documento</strong> (vincula Cod.+Proc. ao Drive).
            </p>
          ) : null}
          <PreviewArquivoDocumento
          conteudo={conteudoEditavel}
          pdfUrl={previewUrl}
          loading={loadingPreview}
          gerandoFinal={loadingFinal}
          inserindoPastaAssinar={loadingPastaAssinar}
          podeInserirPastaAssinar={podeInserirPastaAssinar}
          onConteudoChange={setConteudoEditavel}
          onAtualizar={() => void handleAtualizarPreview()}
          onGerarFinal={() => void handleGerarFinal()}
          onInserirPastaAssinar={() => void handleInserirPastaAssinar()}
        />
        </>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-2">
        {!previewVisivel ? (
          <button
            type="button"
            className={btnPrimary}
            disabled={ocupado}
            onClick={() => void iniciarPreview()}
          >
            {loadingPreview ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Preparando prévia…
              </>
            ) : (
              'Visualizar prévia'
            )}
          </button>
        ) : (
          <button
            type="button"
            className={btnSecondary}
            disabled={ocupado}
            onClick={() => {
              setPreviewVisivel(false);
              revogarPreviewUrl();
            }}
          >
            Voltar ao upload
          </button>
        )}
        <button
          type="button"
          className={btnSecondary}
          disabled={ocupado}
          onClick={() => inputRef.current?.click()}
        >
          Trocar arquivo
        </button>
      </div>
    </div>
  );
}
