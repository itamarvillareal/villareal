import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  Download,
  ExternalLink,
  File,
  Files,
  FileText,
  Folder,
  Image,
  Loader2,
  Sheet,
  Upload,
  X,
} from 'lucide-react';
import { downloadPdfBlob } from '../repositories/documentosRepository.js';
import {
  consolidarMovimentacoesPdfSelecionados,
  listarPdfsMovimentacoes,
} from '../repositories/processosRepository.js';
import {
  listarArquivos,
  obterInfoPasta,
  obterLinkPasta,
  uploadArquivo,
} from '../repositories/driveRepository.js';
import { useCloseOnEscape } from '../hooks/useCloseOnEscape.js';

function formatarTamanho(bytes) {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function IconeArquivo({ mimeType, tipo }) {
  if (tipo === 'pasta') {
    return <Folder className="w-5 h-5 text-amber-500 shrink-0" aria-hidden />;
  }
  const mt = String(mimeType ?? '').toLowerCase();
  if (mt.includes('pdf')) {
    return <FileText className="w-5 h-5 text-red-600 shrink-0" aria-hidden />;
  }
  if (mt.startsWith('image/')) {
    return <Image className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden />;
  }
  if (mt.includes('spreadsheet') || mt.includes('excel') || mt.includes('sheet')) {
    return <Sheet className="w-5 h-5 text-green-700 shrink-0" aria-hidden />;
  }
  if (mt.includes('word') || mt.includes('document')) {
    return <FileText className="w-5 h-5 text-blue-600 shrink-0" aria-hidden />;
  }
  return <File className="w-5 h-5 text-slate-500 shrink-0" aria-hidden />;
}

/**
 * Navegador de arquivos do Google Drive vinculado a um processo.
 *
 * @param {{ codigoCliente: string, numeroInterno: number, processoId?: number|null, numeroCnj?: string, onClose: () => void }} props
 */
export default function DriveExplorer({ codigoCliente, numeroInterno, processoId, numeroCnj, onClose }) {
  const [arquivos, setArquivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [pastaAtual, setPastaAtual] = useState(null);
  /** Caminho navegado (do ancestral mais alto conhecido até a pasta atual): [{ id, nome }, …] */
  const [trilha, setTrilha] = useState([]);
  /** Pai imediato da pasta atual (para subir de nível); nulo na fronteira (pasta de clientes). */
  const [paiInfo, setPaiInfo] = useState({ paiId: null, paiNome: null });
  const [uploading, setUploading] = useState(false);
  const [pastaRaiz, setPastaRaiz] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [consolidando, setConsolidando] = useState(false);
  const [modalSelecaoAberto, setModalSelecaoAberto] = useState(false);
  const [candidatos, setCandidatos] = useState([]);
  const [carregandoCandidatos, setCarregandoCandidatos] = useState(false);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [filtroNome, setFiltroNome] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const inputRef = useRef(null);

  useCloseOnEscape(true, onClose);
  useCloseOnEscape(modalSelecaoAberto, () => setModalSelecaoAberto(false));

  useEffect(() => {
    if (!toastMsg) return undefined;
    const t = setTimeout(() => setToastMsg(''), 5000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const carregarArquivos = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const data = await listarArquivos(codigoCliente, numeroInterno, pastaAtual);
      setArquivos(Array.isArray(data) ? data : []);
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar os arquivos.');
      setArquivos([]);
    } finally {
      setLoading(false);
    }
  }, [codigoCliente, numeroInterno, pastaAtual]);

  const caminhoRaiz =
    pastaRaiz?.caminho ||
    pastaRaiz?.nomePasta ||
    `Proc. ${String(numeroInterno).padStart(2, '0')}`;

  useEffect(() => {
    let cancelado = false;
    setPastaAtual(null);
    setTrilha([]);
    setPaiInfo({ paiId: null, paiNome: null });
    (async () => {
      try {
        const pasta = await obterLinkPasta(codigoCliente, numeroInterno);
        if (cancelado) return;
        setPastaRaiz(pasta);
        if (pasta?.pastaId) {
          setPastaAtual(pasta.pastaId);
          setTrilha([
            {
              id: pasta.pastaId,
              nome:
                pasta.caminho ||
                pasta.nomePasta ||
                `Proc. ${String(numeroInterno).padStart(2, '0')}`,
            },
          ]);
        }
      } catch {
        if (!cancelado) setPastaRaiz(null);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [codigoCliente, numeroInterno]);

  useEffect(() => {
    void carregarArquivos();
  }, [carregarArquivos]);

  useEffect(() => {
    if (!pastaAtual) {
      setPaiInfo({ paiId: null, paiNome: null });
      return undefined;
    }
    let cancelado = false;
    (async () => {
      try {
        const info = await obterInfoPasta(pastaAtual);
        if (!cancelado) {
          setPaiInfo({ paiId: info?.paiId ?? null, paiNome: info?.paiNome ?? null });
        }
      } catch {
        if (!cancelado) setPaiInfo({ paiId: null, paiNome: null });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [pastaAtual]);

  function abrirPasta(pasta) {
    setTrilha((prev) => [...prev, { id: pasta.id, nome: pasta.nome }]);
    setPastaAtual(pasta.id);
  }

  function irParaRaiz() {
    if (!pastaRaiz?.pastaId) return;
    setTrilha([{ id: pastaRaiz.pastaId, nome: caminhoRaiz }]);
    setPastaAtual(pastaRaiz.pastaId);
  }

  function subirNivel() {
    const { paiId, paiNome } = paiInfo;
    if (!paiId) return;
    setTrilha((prev) => {
      if (prev.length > 1 && prev[prev.length - 2].id === paiId) {
        return prev.slice(0, -1);
      }
      return [{ id: paiId, nome: paiNome || '…' }];
    });
    setPastaAtual(paiId);
  }

  async function enviarArquivos(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    setUploading(true);
    setErro('');
    try {
      for (const file of files) {
        await uploadArquivo(codigoCliente, numeroInterno, file, pastaAtual);
      }
      await carregarArquivos();
    } catch (e) {
      setErro(e?.message || 'Falha ao enviar arquivo.');
    } finally {
      setUploading(false);
    }
  }

  function abrirArquivo(arquivo) {
    if (arquivo.tipo === 'pasta') {
      abrirPasta(arquivo);
      return;
    }
    if (arquivo.webViewLink) {
      window.open(arquivo.webViewLink, '_blank', 'noopener,noreferrer');
    }
  }

  function baixarArquivo(arquivo, e) {
    e?.stopPropagation();
    const url = arquivo.webContentLink || arquivo.webViewLink;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  const candidatosFiltrados = useMemo(() => {
    const q = filtroNome.trim().toLowerCase();
    if (!q) return candidatos;
    return candidatos.filter((c) => String(c.nome ?? '').toLowerCase().includes(q));
  }, [candidatos, filtroNome]);

  const qtdSelecionados = selecionados.size;
  const podeConsolidarProcesso =
    Number.isFinite(Number(processoId)) && Number(processoId) > 0 && !consolidando;

  function fecharModalSelecao() {
    if (consolidando) return;
    setModalSelecaoAberto(false);
    setFiltroNome('');
    setErro('');
  }

  function alternarSelecao(id) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selecionarTodos() {
    setSelecionados(new Set(candidatos.map((c) => c.id).filter(Boolean)));
  }

  function limparSelecao() {
    setSelecionados(new Set());
  }

  async function abrirModalConsolidacao() {
    const id = Number(processoId);
    if (!Number.isFinite(id) || id <= 0 || consolidando) return;
    setModalSelecaoAberto(true);
    setCarregandoCandidatos(true);
    setFiltroNome('');
    setErro('');
    setCandidatos([]);
    setSelecionados(new Set());
    try {
      const lista = await listarPdfsMovimentacoes(id);
      const arr = Array.isArray(lista) ? lista : [];
      setCandidatos(arr);
      setSelecionados(new Set(arr.map((c) => c.id).filter(Boolean)));
    } catch (e) {
      setToastMsg(e?.message || 'Não foi possível carregar os PDFs da pasta Movimentações.');
      setModalSelecaoAberto(false);
    } finally {
      setCarregandoCandidatos(false);
    }
  }

  async function handleConfirmarConsolidacao() {
    const id = Number(processoId);
    if (!Number.isFinite(id) || id <= 0 || consolidando || qtdSelecionados === 0) return;
    const fileIds = candidatos.filter((c) => selecionados.has(c.id)).map((c) => c.id);
    if (!fileIds.length) return;
    setConsolidando(true);
    setErro('');
    try {
      const cnj = String(numeroCnj ?? '').trim();
      const { blob, filename, avisos, streamed } = await consolidarMovimentacoesPdfSelecionados(id, fileIds, {
        numeroCnj: cnj,
        streamToDisk: true,
      });
      if (!streamed && blob) {
        downloadPdfBlob(blob, filename);
      }
      setModalSelecaoAberto(false);
      setFiltroNome('');
      const msgAvisos = avisos ? String(avisos).trim() : '';
      setToastMsg(
        msgAvisos
          ? `PDF consolidado baixado. Avisos: ${msgAvisos}`
          : 'PDF consolidado baixado com sucesso.',
      );
    } catch (e) {
      const msg = e?.message || 'Não foi possível consolidar os PDFs.';
      setErro(msg);
      setToastMsg(msg);
    } finally {
      setConsolidando(false);
    }
  }

  const caminho = trilha.map((t) => t.nome).join(' / ') || caminhoRaiz;
  const naRaizProcesso = pastaAtual && pastaRaiz?.pastaId === pastaAtual;
  const linkAbrirDrive = pastaAtual
    ? `https://drive.google.com/drive/folders/${pastaAtual}`
    : pastaRaiz?.webViewLink;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[999] bg-black/40"
        aria-label="Fechar navegador de arquivos"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-[1000] flex h-full w-full max-w-[450px] flex-col bg-white shadow-[-4px_0_20px_rgba(0,0,0,0.15)] animate-[driveSlideIn_0.2s_ease-out] dark:bg-slate-900"
        role="dialog"
        aria-labelledby="drive-explorer-title"
      >
        <style>{`
          @keyframes driveSlideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        <header className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 id="drive-explorer-title" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
                <Folder className="w-5 h-5 text-amber-500 shrink-0" aria-hidden />
                Arquivos do Processo
              </h2>
              <p className="mt-1 flex items-start gap-1 text-xs text-slate-500" title={caminho}>
                <Folder className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                <span className="break-words">{caminho}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {linkAbrirDrive ? (
                <a
                  href={linkAbrirDrive}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                  Abrir no Drive
                </a>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={subirNivel}
              disabled={!paiInfo.paiId}
              title={paiInfo.paiNome ? `Subir para "${paiInfo.paiNome}"` : 'Sem pasta acima'}
              className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
              {paiInfo.paiNome ? `Voltar (${paiInfo.paiNome})` : 'Voltar'}
            </button>
            {!naRaizProcesso && pastaRaiz?.pastaId ? (
              <button
                type="button"
                onClick={irParaRaiz}
                className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Raiz do processo
              </button>
            ) : null}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={!podeConsolidarProcesso}
                onClick={() => void abrirModalConsolidacao()}
                title="Escolha quais PDFs da pasta Movimentações entram no arquivo consolidado"
                className="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {consolidando ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  <Files className="w-4 h-4" aria-hidden />
                )}
                {consolidando ? 'Consolidando…' : 'Consolidar PDFs'}
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  void enviarArquivos(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="w-4 h-4" aria-hidden />
                )}
                Enviar arquivo
              </button>
            </div>
          </div>
        </header>

        <div
          className={`mx-4 mb-2 mt-2 rounded-lg border-2 border-dashed px-3 py-4 text-center text-xs transition-colors ${
            dragOver
              ? 'border-indigo-400 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40'
              : 'border-slate-200 text-slate-500 dark:border-slate-700'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void enviarArquivos(e.dataTransfer.files);
          }}
        >
          Arraste arquivos aqui para enviar
        </div>

        {erro ? (
          <div className="mx-4 mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {erro}
          </div>
        ) : null}

        {toastMsg ? (
          <div
            role="status"
            className="mx-4 mb-2 rounded border border-slate-200 bg-slate-800 px-3 py-2 text-sm text-white shadow dark:border-slate-600"
          >
            {toastMsg}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-600">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
              Carregando…
            </div>
          ) : arquivos.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-slate-500">Nenhum arquivo nesta pasta.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {arquivos.map((arquivo) => (
                <li key={arquivo.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    onClick={() => abrirArquivo(arquivo)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        abrirArquivo(arquivo);
                      }
                    }}
                  >
                    <IconeArquivo mimeType={arquivo.mimeType} tipo={arquivo.tipo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {arquivo.nome}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {[formatarTamanho(arquivo.tamanho), formatarData(arquivo.dataModificacao)]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {arquivo.tipo !== 'pasta' ? (
                      <button
                        type="button"
                        title="Baixar"
                        className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                        onClick={(e) => baixarArquivo(arquivo, e)}
                      >
                        <Download className="w-4 h-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {modalSelecaoAberto ? (
        <div
          className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-consolidar-modal-title"
          onClick={fecharModalSelecao}
        >
          <div
            className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h3
                id="drive-consolidar-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Selecionar PDFs para consolidar
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Pasta Movimentações — ordem da lista = ordem no PDF final
              </p>
              {erro ? (
                <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {erro}
                </p>
              ) : null}
            </div>

            <div className="shrink-0 space-y-2 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
              <input
                type="search"
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                placeholder="Filtrar por nome…"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selecionarTodos}
                  disabled={carregandoCandidatos || candidatos.length === 0}
                  className="rounded border border-slate-300 px-2 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={limparSelecao}
                  disabled={carregandoCandidatos || qtdSelecionados === 0}
                  className="rounded border border-slate-300 px-2 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Limpar seleção
                </button>
                <span className="ml-auto text-slate-500">
                  ({qtdSelecionados} de {candidatos.length} selecionados)
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
              {carregandoCandidatos ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Carregando arquivos…
                </div>
              ) : candidatos.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Nenhum PDF na pasta Movimentações.
                </p>
              ) : candidatosFiltrados.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Nenhum arquivo corresponde ao filtro.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {candidatosFiltrados.map((arquivo) => (
                    <li key={arquivo.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <input
                          type="checkbox"
                          className="mt-1 shrink-0"
                          checked={selecionados.has(arquivo.id)}
                          onChange={() => alternarSelecao(arquivo.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {arquivo.nome}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatarTamanho(arquivo.tamanho)}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={fecharModalSelecao}
                disabled={consolidando}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmarConsolidacao()}
                disabled={
                  consolidando ||
                  carregandoCandidatos ||
                  qtdSelecionados === 0 ||
                  candidatos.length === 0
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {consolidando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Files className="h-4 w-4" aria-hidden />
                )}
                {consolidando
                  ? 'Gerando…'
                  : `Gerar PDF consolidado (${qtdSelecionados})`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
