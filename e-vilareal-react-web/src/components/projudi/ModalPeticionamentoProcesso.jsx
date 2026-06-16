import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  FileSignature,
  History,
  Loader2,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  acompanharProtocolo,
  excluirPeticao,
  listarCredenciais,
  listarPorProcesso,
  previaProtocolo,
  protocolarProcesso,
  reabrirProtocolo,
  registrarAssinados,
} from '../../api/peticoesProjudiApi.js';
import { isArquivoP7s } from '../../domain/peticaoArquivo.js';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';
import { labelTipoArquivoPeticao } from './PeticaoArquivosTabela.jsx';
import { PeticaoHistoricoLista } from './PeticaoHistoricoLista.jsx';
import { PeticaoProtocoloConfirmModal } from './PeticaoProtocoloConfirmModal.jsx';

const inputClass =
  'w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white text-slate-900';

const TIPOS_ARQUIVO = [
  { id: 16, label: 'Petição' },
  { id: 1, label: 'Outros' },
];

function inferirTipoArquivo(nome) {
  const n = String(nome || '').toLowerCase();
  if (n.includes('calculo') || n.includes('cálculo')) return 1;
  return 16;
}

function classeResultadoProtocolo(resultado) {
  switch (resultado) {
    case 'PROTOCOLADA':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'IGNORADA':
      return 'text-slate-600 bg-slate-50 border-slate-200';
    case 'EM ANDAMENTO':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    default:
      return 'text-rose-700 bg-rose-50 border-rose-200';
  }
}

/**
 * @param {{ open: boolean, onClose?: () => void, numeroCnj?: string, clienteNome?: string }} props
 */
export function ModalPeticionamentoProcesso({ open, onClose, numeroCnj, clienteNome }) {
  useCloseOnEscape(open, onClose);

  const [aba, setAba] = useState('protocolar');
  const [peticoes, setPeticoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [operacao, setOperacao] = useState(null);
  const [modalConfirmar, setModalConfirmar] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [resultadoProtocolo, setResultadoProtocolo] = useState([]);

  const [linhasP7s, setLinhasP7s] = useState([]);
  const [complemento, setComplemento] = useState('');
  const [credencialId, setCredencialId] = useState('');

  const cnj = String(numeroCnj ?? '').trim();

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listarCredenciais();
        const lista = Array.isArray(rows) ? rows : [];
        const preferida = lista.find((c) => String(c.cpfUsuario || '').endsWith('5190')) || lista[0];
        if (preferida) setCredencialId(String(preferida.id));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const recarregar = useCallback(async () => {
    if (!cnj) {
      setPeticoes([]);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const rows = await listarPorProcesso(cnj);
      setPeticoes(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar petições.');
      setPeticoes([]);
    } finally {
      setCarregando(false);
    }
  }, [cnj]);

  useEffect(() => {
    if (open) {
      setAba('protocolar');
      void recarregar();
    }
  }, [open, recarregar]);

  const assinadas = useMemo(() => peticoes.filter((p) => p.status === 'ASSINADA'), [peticoes]);
  const historico = useMemo(
    () => peticoes.filter((p) => ['PROTOCOLADA', 'ERRO'].includes(p.status)),
    [peticoes],
  );

  const registrarP7s = async (e) => {
    e.preventDefault();
    const arquivos = linhasP7s.filter((l) => l.file);
    if (!cnj || arquivos.length === 0) return;
    setOperacao('registrar');
    setErro('');
    try {
      const cred =
        credencialId ||
        String(peticoes[0]?.credencialId ?? assinadas[0]?.credencialId ?? '');
      const fd = new FormData();
      fd.append('credencialId', cred || '2');
      fd.append('numeroProcesso', cnj);
      if (complemento.trim()) fd.append('complemento', complemento.trim());
      for (const linha of arquivos) {
        fd.append('arquivosP7s', linha.file);
        fd.append('idArquivoTipos', String(linha.idArquivoTipo));
      }
      await registrarAssinados(fd);
      setLinhasP7s([]);
      setComplemento('');
      await recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao registrar .p7s.');
    } finally {
      setOperacao(null);
    }
  };

  const abrirModalProtocolo = async () => {
    setModalConfirmar(true);
    setPrevia(null);
    setCarregandoPrevia(true);
    setErro('');
    try {
      setPrevia(await previaProtocolo(cnj));
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar prévia.');
      setModalConfirmar(false);
    } finally {
      setCarregandoPrevia(false);
    }
  };

  const confirmarProtocolo = async () => {
    setOperacao('protocolo');
    setErro('');
    setResultadoProtocolo([]);
    let aceitas = [];
    try {
      const res = await protocolarProcesso(cnj);
      aceitas = Array.isArray(res?.peticaoIds) ? res.peticaoIds : [];
    } catch (e) {
      setErro(e?.message || 'Falha ao iniciar o protocolo.');
      setOperacao(null);
      setModalConfirmar(false);
      return;
    }
    setModalConfirmar(false);
    if (aceitas.length === 0) {
      setErro('Nenhuma petição ASSINADA pronta para protocolo.');
      setOperacao(null);
      await recarregar();
      return;
    }
    try {
      const r = await acompanharProtocolo(aceitas, (rows) => setPeticoes(rows), {
        fetcher: () => listarPorProcesso(cnj),
      });
      setResultadoProtocolo([
        ...r.protocoladas.map((id) => ({ peticaoId: id, resultado: 'PROTOCOLADA', mensagem: '' })),
        ...r.comErro.map((id) => ({
          peticaoId: id,
          resultado: 'ERRO',
          mensagem: 'Voltou para a fila — verifique e tente novamente.',
        })),
        ...r.pendentes.map((id) => ({
          peticaoId: id,
          resultado: 'EM ANDAMENTO',
          mensagem: 'Ainda processando em segundo plano.',
        })),
      ]);
    } catch {
      // A fila reflete o estado real; ignora erro de acompanhamento.
    } finally {
      await recarregar();
      setOperacao(null);
    }
  };

  const onReabrirProtocolo = async (peticaoId) => {
    setOperacao(`reabrir-${peticaoId}`);
    setErro('');
    try {
      await reabrirProtocolo(peticaoId);
      setAba('protocolar');
      await recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao reabrir.');
    } finally {
      setOperacao(null);
    }
  };

  const onExcluirPeticao = async (peticaoId) => {
    if (
      !window.confirm(
        `Excluir a petição #${peticaoId} da fila de protocolo? Os arquivos serão removidos e esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setOperacao(`excluir-${peticaoId}`);
    setErro('');
    try {
      await excluirPeticao(peticaoId);
      await recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao excluir petição.');
    } finally {
      setOperacao(null);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-2 sm:p-3"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-peticionamento-processo-titulo"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        <div
          className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sky-200/60 bg-gradient-to-r from-sky-700 to-slate-800 px-3 py-2 text-white">
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/10 hover:bg-white/20"
              aria-label="Fechar"
            >
              <ChevronLeft className="h-5 w-5 md:hidden" aria-hidden />
              <X className="h-5 w-5 hidden md:block" aria-hidden />
            </button>
            <div className="min-w-0 flex-1 text-center md:text-left">
              <h2 id="modal-peticionamento-processo-titulo" className="text-sm font-semibold">
                Protocolo PROJUDI
              </h2>
              <p className="truncate text-[11px] text-sky-100/95 font-mono">{cnj}</p>
              {clienteNome ? (
                <p className="truncate text-[11px] text-sky-100/80">{clienteNome}</p>
              ) : null}
            </div>
            <div className="w-9" aria-hidden />
          </div>

          <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
            <button
              type="button"
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
                aba === 'protocolar' ? 'bg-white shadow text-sky-800' : 'text-slate-600'
              }`}
              onClick={() => setAba('protocolar')}
            >
              Protocolar
              {assinadas.length > 0 ? ` (${assinadas.length})` : ''}
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium inline-flex items-center justify-center gap-1 ${
                aba === 'historico' ? 'bg-white shadow text-slate-800' : 'text-slate-600'
              }`}
              onClick={() => setAba('historico')}
            >
              <History className="w-3.5 h-3.5" aria-hidden />
              Histórico
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
            {!cnj ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm text-amber-900 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
                <span>
                  Este processo não tem <strong>número CNJ</strong> (campo &quot;Nº Processo Novo&quot;).
                  Preencha o número CNJ do processo para registrar e protocolar petições no PROJUDI.
                </span>
              </div>
            ) : null}

            {erro ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-sm text-rose-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
                {erro}
              </div>
            ) : null}

            {resultadoProtocolo.length > 0 ? (
              <div className="space-y-1">
                {resultadoProtocolo.map((item) => (
                  <div
                    key={item.peticaoId}
                    className={`rounded border px-2 py-1.5 text-sm ${classeResultadoProtocolo(item.resultado)}`}
                  >
                    <strong>#{item.peticaoId}</strong> — {item.resultado}
                    {item.mensagem ? `: ${item.mensagem}` : ''}
                  </div>
                ))}
              </div>
            ) : null}

            {aba === 'protocolar' ? (
              <>
                <form onSubmit={(e) => void registrarP7s(e)} className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Registrar .p7s
                  </h3>
                  <input
                    id="modal-p7s"
                    type="file"
                    accept=".p7s,.pdf.p7s"
                    multiple
                    className="sr-only"
                    onChange={(ev) => {
                      const files = Array.from(ev.target.files || []);
                      ev.target.value = '';
                      const validos = files.filter((f) => isArquivoP7s(f));
                      if (validos.length !== files.length) {
                        setErro('Somente arquivos .p7s.');
                        return;
                      }
                      setLinhasP7s((rows) => [
                        ...rows,
                        ...validos.map((file) => ({
                          key: crypto.randomUUID(),
                          file,
                          idArquivoTipo: inferirTipoArquivo(file.name),
                        })),
                      ]);
                    }}
                  />
                  <label
                    htmlFor="modal-p7s"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-sky-700 px-3 py-1.5 text-sm text-white hover:bg-sky-800"
                  >
                    <FileSignature className="w-4 h-4" aria-hidden />
                    Escolher .p7s
                  </label>
                  {linhasP7s.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {linhasP7s.map((l, idx) => (
                        <li key={l.key} className="flex items-center gap-2">
                          <span className="truncate flex-1">{l.file.name}</span>
                          <select
                            className={`${inputClass} w-auto text-xs py-0.5`}
                            value={l.idArquivoTipo}
                            onChange={(ev) => {
                              const v = Number(ev.target.value);
                              setLinhasP7s((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, idArquivoTipo: v } : r)),
                              );
                            }}
                          >
                            {TIPOS_ARQUIVO.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={() => setLinhasP7s((r) => r.filter((_, i) => i !== idx))}>
                            <Trash2 className="w-4 h-4 text-slate-400" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <input
                    className={inputClass}
                    placeholder="Complemento (opcional)"
                    value={complemento}
                    onChange={(ev) => setComplemento(ev.target.value)}
                  />
                  {linhasP7s.length > 0 ? (
                    <button
                      type="submit"
                      className="text-sm rounded-lg bg-slate-800 text-white px-3 py-1.5 disabled:opacity-50"
                      disabled={operacao === 'registrar'}
                    >
                      {operacao === 'registrar' ? (
                        <Loader2 className="w-4 h-4 animate-spin inline" aria-hidden />
                      ) : null}{' '}
                      Adicionar à fila
                    </button>
                  ) : null}
                </form>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Fila ({assinadas.length})
                  </h3>
                  {carregando ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-500" aria-hidden />
                  ) : assinadas.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum .p7s pronto. Registre acima.</p>
                  ) : (
                    <ul className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-sm">
                      {assinadas.map((p) => (
                        <li key={p.id} className="flex items-start gap-2 px-2 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">#{p.id}</div>
                            {(p.arquivos || []).map((a) => (
                              <div key={a.id ?? a.ordem} className="text-xs text-slate-600 truncate">
                                {a.nomeOriginal} ({labelTipoArquivoPeticao(a.idArquivoTipo)})
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="shrink-0 p-1 text-rose-600 hover:text-rose-800 disabled:opacity-50"
                            disabled={operacao === `excluir-${p.id}` || operacao === 'protocolo'}
                            onClick={() => void onExcluirPeticao(p.id)}
                            title="Excluir petição da fila"
                            aria-label={`Excluir petição ${p.id}`}
                          >
                            {operacao === `excluir-${p.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="w-4 h-4" aria-hidden />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                    disabled={assinadas.length === 0 || operacao === 'protocolo'}
                    onClick={() => void abrirModalProtocolo()}
                  >
                    {operacao === 'protocolo' ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="w-4 h-4" aria-hidden />
                    )}
                    Protocolar {assinadas.length} petição(ões)
                  </button>
                  <p className="text-[11px] text-slate-500 text-center">
                    Todas as assinadas deste processo entram em uma juntada.
                  </p>
                </div>
              </>
            ) : (
              <PeticaoHistoricoLista
                peticoes={historico}
                onReabrir={onReabrirProtocolo}
                operacao={operacao}
              />
            )}
          </div>
        </div>
      </div>

      <PeticaoProtocoloConfirmModal
        open={modalConfirmar}
        processoLabel={cnj}
        previa={previa}
        carregandoPrevia={carregandoPrevia}
        confirmando={operacao === 'protocolo'}
        onCancel={() => {
          if (operacao === 'protocolo') return;
          setModalConfirmar(false);
          setPrevia(null);
        }}
        onConfirmar={() => void confirmarProtocolo()}
      />
    </>
  );
}
