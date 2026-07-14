import { useEffect, useRef, useState } from 'react';
import { Loader2, PenLine, X } from 'lucide-react';
import {
  assinarAutomaticoInicial,
  baixarP7sAssinadoInicial,
  cancelarLoteAssinaturaInicial,
  consultarLoteAssinaturaInicial,
  listarArquivosAssinadosInicial,
  reliberarLoteAssinaturaInicial,
} from '../../api/iniciaisProjudiApi.js';
import { mensagemErroAmigavel } from '../../utils/mensagemErroAmigavel.js';
import { processosBtnPrimary } from '../processos/ProcessosAdminLayout.jsx';

const POLL_MS = 2500;
const MSG_TOKEN_OCUPADO =
  'Token em uso por outro programa. Feche o sai.jar e tente novamente.';

function nomeArquivoP7s(nomeOriginal, nomeP7s) {
  const base = String(nomeOriginal ?? '').trim();
  if (base.toLowerCase().endsWith('.p7s')) return base;
  if (base.toLowerCase().endsWith('.pdf')) return `${base.slice(0, -4)}.p7s`;
  if (base) return `${base}.p7s`;
  return String(nomeP7s ?? 'documento.p7s');
}

/**
 * Botão + modal de assinatura automática (PDFs da pasta «Assinar» → .p7s).
 * @param {object} props
 * @param {string} props.credencialId
 * @param {string} props.codigoCliente
 * @param {number|string} props.numeroInterno
 * @param {boolean} [props.disabled]
 * @param {(linhas: { key: string, file: File, idArquivoTipo: number }[]) => void} props.onArquivosAssinados
 * @param {(msg: string) => void} [props.onToast]
 * @param {(msg: string) => void} [props.onErro]
 */
export function AssinaturaAutomaticaInicialPanel({
  credencialId,
  codigoCliente,
  numeroInterno,
  disabled = false,
  onArquivosAssinados,
  onToast,
  onErro,
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const [loteId, setLoteId] = useState(null);
  const [fase, setFase] = useState('');
  const [erro, setErro] = useState('');
  const [erroCodigo, setErroCodigo] = useState('');
  const [peticaoCount, setPeticaoCount] = useState(0);
  const [cancelando, setCancelando] = useState(false);
  const [reliberando, setReliberando] = useState(false);
  const pollRef = useRef(null);

  const pararPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => pararPoll(), []);

  const fecharModal = () => {
    if (ativo && fase !== 'concluido' && fase !== 'erro' && fase !== 'cancelado') return;
    pararPoll();
    setModalAberto(false);
    setAtivo(false);
    setLoteId(null);
    setFase('');
    setErro('');
    setErroCodigo('');
    setPeticaoCount(0);
  };

  const carregarJaAssinadosSeExistirem = async () => {
    const arquivos = await listarArquivosAssinadosInicial({ codigoCliente, numeroInterno });
    if (!Array.isArray(arquivos) || arquivos.length === 0) return false;
    await carregarP7sAssinados();
    setFase('concluido');
    setAtivo(false);
    pararPoll();
    return true;
  };

  const carregarP7sAssinados = async () => {
    const arquivos = await listarArquivosAssinadosInicial({ codigoCliente, numeroInterno });
    if (!Array.isArray(arquivos) || arquivos.length === 0) {
      throw new Error('Nenhum .p7s assinado encontrado para este processo.');
    }
    const linhas = await Promise.all(
      arquivos.map(async (arq) => {
        const nome = nomeArquivoP7s(arq.nomeOriginal, arq.nomeP7s);
        const blob = await baixarP7sAssinadoInicial({
          arquivoId: arq.arquivoId,
          codigoCliente,
          numeroInterno,
          nomeFallback: nome,
        });
        const file = new File([blob], nome, { type: 'application/pkcs7-signature' });
        return {
          key: `assinado-${arq.arquivoId}`,
          file,
          idArquivoTipo: arq.idArquivoTipo ?? (arq.ordem === 1 ? 16 : 1),
        };
      }),
    );
    onArquivosAssinados(linhas);
    onToast?.(`${linhas.length} arquivo(s) .p7s carregado(s) da assinatura automática.`);
  };

  const aplicarStatusLote = async (status) => {
    const st = String(status?.status ?? '').toUpperCase();
    if (st === 'PREPARANDO') {
      setFase('preparando');
      return;
    }
    if (st === 'CANCELADO') {
      setFase('cancelado');
      setAtivo(false);
      pararPoll();
      return;
    }
    if (st === 'CONCLUIDO') {
      setFase('concluido');
      setAtivo(false);
      pararPoll();
      try {
        await carregarP7sAssinados();
      } catch (e) {
        setFase('erro');
        setErro(mensagemErroAmigavel(e, 'carregar os .p7s assinados'));
      }
      return;
    }
    if (st === 'ERRO') {
      const msg = String(status?.mensagemUsuario || status?.erroMensagem || '').trim();
      if (msg.includes('já constam na fila PROJUDI')) {
        try {
          if (await carregarJaAssinadosSeExistirem()) return;
        } catch {
          /* exibe erro abaixo se não houver .p7s prontos */
        }
      }
      setFase('erro');
      setErroCodigo(String(status?.erroCodigo ?? '').trim());
      setErro(status?.mensagemUsuario || status?.erroMensagem || 'Falha na assinatura automática.');
      setAtivo(false);
      pararPoll();
      return;
    }
    if (st === 'LIBERADO' || st === 'EM_ASSINATURA') {
      setFase('aguardando');
      if (Array.isArray(status?.peticaoIds)) {
        setPeticaoCount(status.peticaoIds.length);
      }
    }
  };

  const iniciarPoll = (id) => {
    pararPoll();
    pollRef.current = setInterval(() => {
      void consultarLoteAssinaturaInicial(id)
        .then((status) => aplicarStatusLote(status))
        .catch((e) => {
          setFase('erro');
          setErro(mensagemErroAmigavel(e, 'consultar o lote de assinatura'));
          setAtivo(false);
          pararPoll();
        });
    }, POLL_MS);
  };

  const iniciar = async () => {
    if (disabled || ativo) return;
    setModalAberto(true);
    setFase('');
    setErro('');
    setErroCodigo('');
    setLoteId(null);
    setPeticaoCount(0);
    setAtivo(true);
    pararPoll();
    try {
      if (await carregarJaAssinadosSeExistirem()) return;

      const resp = await assinarAutomaticoInicial({ credencialId, codigoCliente, numeroInterno });
      const id = resp?.loteId;
      if (id == null) throw new Error('Resposta sem loteId.');
      setLoteId(id);
      if (Array.isArray(resp?.peticaoIds) && resp.peticaoIds.length > 0) {
        setPeticaoCount(resp.peticaoIds.length);
      }
      const status = await consultarLoteAssinaturaInicial(id);
      await aplicarStatusLote(status);
      if (String(status?.status ?? '').toUpperCase() !== 'CONCLUIDO') {
        iniciarPoll(id);
      }
    } catch (e) {
      const msg = mensagemErroAmigavel(e, 'iniciar a assinatura automática');
      if (msg.includes('já constam na fila PROJUDI')) {
        try {
          if (await carregarJaAssinadosSeExistirem()) return;
        } catch {
          /* segue para erro */
        }
      }
      setFase('erro');
      setErro(msg);
      setAtivo(false);
      onErro?.(msg);
    }
  };

  const carregarAssinadosExistentes = async () => {
    if (disabled || ativo) return;
    setModalAberto(true);
    setFase('');
    setErro('');
    setErroCodigo('');
    setAtivo(true);
    pararPoll();
    try {
      const ok = await carregarJaAssinadosSeExistirem();
      if (!ok) {
        setFase('erro');
        setErro(
          'Nenhum .p7s assinado encontrado para este processo. Use «Assinar automaticamente» para assinar os PDFs da pasta «Assinar».',
        );
        setAtivo(false);
      }
    } catch (e) {
      setFase('erro');
      setErro(mensagemErroAmigavel(e, 'carregar os .p7s já assinados'));
      setAtivo(false);
    }
  };

  const cancelarPreparo = async () => {
    if (loteId == null || cancelando) return;
    setCancelando(true);
    try {
      await cancelarLoteAssinaturaInicial(loteId);
      setFase('cancelado');
      setAtivo(false);
      pararPoll();
    } catch (e) {
      setFase('erro');
      setErro(mensagemErroAmigavel(e, 'cancelar o preparo'));
      setAtivo(false);
      pararPoll();
    } finally {
      setCancelando(false);
    }
  };

  const tentarNovamente = async () => {
    if (loteId == null || reliberando) return;
    setReliberando(true);
    setErro('');
    setErroCodigo('');
    setFase('aguardando');
    setAtivo(true);
    try {
      const status = await reliberarLoteAssinaturaInicial(loteId);
      await aplicarStatusLote(status);
      iniciarPoll(loteId);
    } catch (e) {
      setFase('erro');
      setErro(mensagemErroAmigavel(e, 're-liberar o lote'));
      setAtivo(false);
      pararPoll();
    } finally {
      setReliberando(false);
    }
  };

  const processoOk = String(codigoCliente ?? '').trim() && String(numeroInterno ?? '').trim();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={`${processosBtnPrimary} inline-flex items-center gap-1.5 text-sm`}
        disabled={disabled || !processoOk || ativo}
        onClick={() => void iniciar()}
        title="Assina PDFs da pasta «Assinar» no Drive via token (assinador local)"
      >
        {ativo ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <PenLine className="h-4 w-4" aria-hidden />
        )}
        Assinar automaticamente
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        disabled={disabled || !processoOk || ativo}
        onClick={() => void carregarAssinadosExistentes()}
        title="Carrega .p7s já assinados deste processo (sem refazer assinatura no token)"
      >
        Carregar .p7s já assinados
      </button>
      </div>

      {modalAberto ? (
        <div className="fixed inset-0 z-[67] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-gradient-to-r from-violet-700 to-indigo-700 text-white">
              <p className="text-base font-semibold">Assinatura automática — inicial</p>
              <button
                type="button"
                onClick={fecharModal}
                disabled={ativo && fase !== 'concluido' && fase !== 'erro' && fase !== 'cancelado'}
                className="p-1 rounded-lg text-white/90 hover:bg-white/15 disabled:opacity-40"
                aria-label="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-4 py-5 space-y-4 text-sm text-slate-700">
              <p className="text-xs text-slate-500">
                Processo <span className="font-mono">{codigoCliente}/{numeroInterno}</span> — PDFs
                na subpasta «Assinar» do Google Drive.
              </p>

              {(fase === 'preparando' || (!fase && ativo)) && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-hidden />
                  <p className="font-medium">Preparando…</p>
                  <p className="text-xs text-slate-500">
                    Buscando PDFs no Drive e enfileirando para o assinador.
                    {loteId != null ? ` · Lote #${loteId}` : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => void cancelarPreparo()}
                    disabled={cancelando || loteId == null}
                    className="mt-1 px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {cancelando ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Cancelando…
                      </>
                    ) : (
                      'Cancelar preparo'
                    )}
                  </button>
                </div>
              )}

              {fase === 'aguardando' && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-hidden />
                  <p className="font-medium">Aguardando assinatura no token…</p>
                  <p className="text-xs text-slate-500">
                    {peticaoCount > 0
                      ? `${peticaoCount} petição(ões) no lote`
                      : 'O assinador local deve estar conectado.'}
                    {loteId != null ? ` · Lote #${loteId}` : ''}
                  </p>
                </div>
              )}

              {fase === 'concluido' && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-center space-y-2">
                  <p className="font-semibold text-emerald-900">Assinatura concluída</p>
                  <p className="text-xs text-emerald-800">
                    Os .p7s foram carregados na lista de anexos abaixo. Confira os tipos e prossiga
                    com Preparar ou Distribuir.
                  </p>
                </div>
              )}

              {fase === 'cancelado' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-center">
                  <p className="font-semibold text-amber-900">Preparo cancelado</p>
                </div>
              )}

              {fase === 'erro' && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 space-y-2">
                  <p className="font-semibold text-rose-900">
                    {erroCodigo === 'TOKEN_OCUPADO' ? MSG_TOKEN_OCUPADO : 'Falha na assinatura'}
                  </p>
                  {erroCodigo !== 'TOKEN_OCUPADO' && erro ? (
                    <p className="text-xs leading-relaxed text-rose-800">{erro}</p>
                  ) : null}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                {fase === 'erro' && erroCodigo === 'TOKEN_OCUPADO' ? (
                  <button
                    type="button"
                    onClick={() => void tentarNovamente()}
                    disabled={reliberando || loteId == null}
                    className={`${processosBtnPrimary} text-sm px-4 py-2`}
                  >
                    {reliberando ? 'Re-liberando…' : 'Tentar novamente'}
                  </button>
                ) : null}
                {(fase === 'concluido' || fase === 'erro' || fase === 'cancelado') && (
                  <button
                    type="button"
                    onClick={fecharModal}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium hover:bg-slate-50"
                  >
                    Fechar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
