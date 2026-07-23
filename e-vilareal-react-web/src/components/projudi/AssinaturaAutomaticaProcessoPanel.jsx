import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, PenLine, X } from 'lucide-react';
import {
  assinarAutomaticoAguardandoProtocolo,
  cancelarLoteAssinaturaAguardandoProtocolo,
  consultarLoteAssinaturaAguardandoProtocolo,
  reliberarLoteAssinaturaAguardandoProtocolo,
} from '../../repositories/processosRepository.js';
import { mensagemErroAmigavel } from '../../utils/mensagemErroAmigavel.js';

const POLL_MS = 2500;
const MSG_TOKEN_OCUPADO =
  'Token em uso por outro programa. Feche o sai.jar e tente novamente.';

function filtrarResumoIgnoradosPorErro(resumo) {
  if (!Array.isArray(resumo)) return [];
  return resumo.filter((r) => r?.ignoradoPorErro);
}

function extrairResumoPreparoDoLote(status) {
  const json = status?.resultadoJson;
  if (Array.isArray(json?.resumoPreparo)) return json.resumoPreparo;
  return [];
}

function formatarLinhaResumoIgnorado(r) {
  const partes = [r?.codigoCliente, r?.cnj].filter((p) => String(p ?? '').trim());
  const chave = partes.length ? partes.join(' · ') : '—';
  return `${chave}: ${r?.motivoErro || 'erro desconhecido'}`;
}

function ResumoIgnorados({ resumoIgnorados }) {
  if (!resumoIgnorados?.length) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900 space-y-1">
      <p className="font-medium">{resumoIgnorados.length} processo(s) ignorado(s)</p>
      <ul className="list-disc pl-4 space-y-0.5 font-mono">
        {resumoIgnorados.map((r, i) => (
          <li key={i}>{formatarLinhaResumoIgnorado(r)}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Assinatura automática de PDFs da pasta «Assinar» (processo interlocutório/CNJ).
 * @param {object} props
 * @param {string} props.credencialId
 * @param {string} props.codigoCliente
 * @param {number|string} props.numeroInterno
 * @param {string} [props.numeroCnj]
 * @param {boolean} [props.disabled]
 * @param {() => void} [props.onConcluido]
 * @param {(msg: string) => void} [props.onErro]
 */
export function AssinaturaAutomaticaProcessoPanel({
  credencialId,
  codigoCliente,
  numeroInterno,
  numeroCnj = '',
  disabled = false,
  onConcluido,
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
  const [resumoIgnorados, setResumoIgnorados] = useState([]);
  const pollRef = useRef(null);

  const podeAssinar =
    !disabled &&
    String(codigoCliente ?? '').trim() !== '' &&
    String(numeroInterno ?? '').trim() !== '' &&
    String(credencialId ?? '').trim() !== '';

  const processoPayload = useCallback(
    () => [
      {
        codCliente: codigoCliente,
        proc: numeroInterno,
        numeroProcessoNovo: String(numeroCnj ?? '').trim(),
      },
    ],
    [codigoCliente, numeroInterno, numeroCnj],
  );

  const pararPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => pararPoll(), []);

  const fecharModal = () => {
    if (ativo && fase !== 'concluido' && fase !== 'erro' && fase !== 'cancelado') {
      return;
    }
    pararPoll();
    setModalAberto(false);
    setAtivo(false);
    setLoteId(null);
    setFase('');
    setErro('');
    setErroCodigo('');
    setPeticaoCount(0);
    setResumoIgnorados([]);
  };

  const aplicarStatus = useCallback(
    (status) => {
      const ignorados = filtrarResumoIgnoradosPorErro(extrairResumoPreparoDoLote(status));
      if (ignorados.length > 0) {
        setResumoIgnorados(ignorados);
      }
      const st = String(status?.status ?? '').toUpperCase();
      if (st === 'PREPARANDO') {
        setFase('preparando');
        return false;
      }
      if (st === 'CANCELADO') {
        setFase('cancelado');
        setAtivo(false);
        pararPoll();
        return true;
      }
      if (st === 'CONCLUIDO') {
        setFase('concluido');
        setPeticaoCount((prev) =>
          Array.isArray(status?.peticaoIds) && status.peticaoIds.length > 0
            ? status.peticaoIds.length
            : prev,
        );
        setAtivo(false);
        pararPoll();
        onConcluido?.();
        return true;
      }
      if (st === 'ERRO') {
        setFase('erro');
        setErroCodigo(String(status?.erroCodigo ?? '').trim());
        setErro(
          status?.mensagemUsuario ||
            status?.erroMensagem ||
            'Não foi possível concluir a assinatura automática.',
        );
        setAtivo(false);
        pararPoll();
        return true;
      }
      if (st === 'LIBERADO' || st === 'EM_ASSINATURA') {
        setFase('aguardando');
        if (Array.isArray(status?.peticaoIds) && status.peticaoIds.length > 0) {
          setPeticaoCount(status.peticaoIds.length);
        }
      }
      return false;
    },
    [onConcluido],
  );

  const consultarLote = useCallback(
    async (id) => {
      const status = await consultarLoteAssinaturaAguardandoProtocolo(id);
      return aplicarStatus(status);
    },
    [aplicarStatus],
  );

  const iniciarPolling = useCallback(
    (id) => {
      pararPoll();
      void consultarLote(id);
      pollRef.current = setInterval(() => {
        void consultarLote(id);
      }, POLL_MS);
    },
    [consultarLote],
  );

  const iniciar = async () => {
    if (!podeAssinar || ativo) return;
    setModalAberto(true);
    setFase('');
    setErro('');
    setErroCodigo('');
    setLoteId(null);
    setPeticaoCount(0);
    setResumoIgnorados([]);
    setAtivo(true);
    pararPoll();
    try {
      const resp = await assinarAutomaticoAguardandoProtocolo(processoPayload(), credencialId);
      const id = resp?.loteId;
      if (id == null) {
        throw new Error('Resposta inválida: loteId ausente.');
      }
      setLoteId(id);
      if (Array.isArray(resp?.peticaoIds) && resp.peticaoIds.length > 0) {
        setPeticaoCount(resp.peticaoIds.length);
      }
      iniciarPolling(id);
    } catch (e) {
      const msg = mensagemErroAmigavel(e, 'iniciar a assinatura automática');
      setFase('erro');
      setErro(msg);
      setAtivo(false);
      onErro?.(msg);
      pararPoll();
    }
  };

  const cancelarPreparo = async () => {
    if (loteId == null || cancelando) return;
    setCancelando(true);
    try {
      await cancelarLoteAssinaturaAguardandoProtocolo(loteId);
      setFase('cancelado');
      setAtivo(false);
      pararPoll();
    } catch (e) {
      const msg = mensagemErroAmigavel(e, 'cancelar o preparo');
      setFase('erro');
      setErro(msg);
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
      await reliberarLoteAssinaturaAguardandoProtocolo(loteId);
      iniciarPolling(loteId);
    } catch (e) {
      const msg = mensagemErroAmigavel(e, 're-liberar o lote de assinatura');
      setFase('erro');
      setErro(msg);
      setAtivo(false);
      pararPoll();
    } finally {
      setReliberando(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 space-y-2">
        <h3 className="text-xs font-semibold text-violet-900 uppercase tracking-wide">
          Assinatura automática
        </h3>
        <p className="text-[11px] text-violet-900/85 leading-relaxed">
          Busca PDFs na pasta «Assinar» deste processo no Drive, assina no token local e deixa prontas
          para protocolar abaixo — sem baixar ZIP manualmente.
        </p>
        <button
          type="button"
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-sm font-medium text-white hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
          disabled={!podeAssinar || ativo}
          onClick={() => void iniciar()}
        >
          {ativo ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : (
            <PenLine className="w-4 h-4" aria-hidden />
          )}
          Assinar automaticamente
        </button>
        {!String(codigoCliente ?? '').trim() || !String(numeroInterno ?? '').trim() ? (
          <p className="text-[10px] text-violet-800/80">
            Informe código do cliente e nº do processo no cadastro.
          </p>
        ) : null}
      </div>

      {modalAberto ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-violet-200/60 bg-gradient-to-r from-violet-700 to-indigo-700 text-white">
              <p className="text-sm font-semibold">Assinatura automática</p>
              <button
                type="button"
                onClick={fecharModal}
                disabled={ativo && fase !== 'concluido' && fase !== 'erro' && fase !== 'cancelado'}
                className="p-1 rounded hover:bg-white/15 disabled:opacity-40"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3 text-sm text-slate-700">
              {fase === 'preparando' || (!fase && ativo) ? (
                <div className="flex flex-col items-center gap-2 py-3 text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-violet-600" aria-hidden />
                  <p className="font-medium">Preparando…</p>
                  <p className="text-xs text-slate-500">
                    Buscando PDFs no Drive e enfileirando para o assinador.
                    {loteId != null ? ` Lote #${loteId}` : ''}
                  </p>
                  <button
                    type="button"
                    className="text-xs rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
                    disabled={cancelando || loteId == null}
                    onClick={() => void cancelarPreparo()}
                  >
                    {cancelando ? 'Cancelando…' : 'Cancelar preparo'}
                  </button>
                </div>
              ) : null}

              {fase === 'aguardando' ? (
                <div className="flex flex-col items-center gap-2 py-3 text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-indigo-600" aria-hidden />
                  <p className="font-medium">Aguardando assinatura no token…</p>
                  <p className="text-xs text-slate-500">
                    {peticaoCount > 0
                      ? `${peticaoCount} petição(ões) no lote`
                      : 'O assinador local deve estar conectado.'}
                    {loteId != null ? ` · Lote #${loteId}` : ''}
                  </p>
                  <ResumoIgnorados resumoIgnorados={resumoIgnorados} />
                </div>
              ) : null}

              {fase === 'concluido' ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-center space-y-1">
                  <p className="font-semibold text-emerald-900">
                    Concluído! {peticaoCount} petição(ões) assinada(s)
                  </p>
                  <p className="text-xs text-emerald-800">
                    As petições aparecem em «Prontas para protocolar» — clique em Protocolar.
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-emerald-900 underline"
                    onClick={fecharModal}
                  >
                    Fechar
                  </button>
                </div>
              ) : null}

              {fase === 'cancelado' ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-center text-xs text-amber-900">
                  Preparo cancelado. Feche e tente novamente quando quiser.
                </div>
              ) : null}

              {fase === 'erro' ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 space-y-2 text-rose-900">
                  <p className="font-semibold">
                    {erroCodigo === 'TOKEN_OCUPADO' ? MSG_TOKEN_OCUPADO : 'Falha na assinatura automática'}
                  </p>
                  {erroCodigo !== 'TOKEN_OCUPADO' && erro ? (
                    <p className="text-xs leading-relaxed">{erro}</p>
                  ) : null}
                  {erroCodigo === 'TOKEN_OCUPADO' ? (
                    <button
                      type="button"
                      className="text-xs font-medium underline disabled:opacity-50"
                      disabled={reliberando || loteId == null}
                      onClick={() => void tentarNovamente()}
                    >
                      {reliberando ? 'Re-liberando…' : 'Tentar novamente'}
                    </button>
                  ) : null}
                  <button type="button" className="block text-xs underline" onClick={fecharModal}>
                    Fechar
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
