import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCopy, Loader2, Trash2 } from 'lucide-react';
import { featureFlags } from '../../config/featureFlags.js';
import {
  carregarPainelCitacaoReu,
  excluirTentativaCitacao,
  registrarPositivoCitacao,
  registrarRetornoCitacao,
  solicitarCitacao,
} from '../../repositories/citacaoRepository.js';

const STATUS_BADGE = {
  SOLICITADO: 'bg-amber-100 text-amber-900 border-amber-200',
  NEGATIVO: 'bg-red-100 text-red-900 border-red-200',
  POSITIVO: 'bg-emerald-100 text-emerald-900 border-emerald-200',
};

function hojeIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatarDataBr(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function textoEnderecoTentativa(t) {
  if (t?.enderecoFormatado) return t.enderecoFormatado;
  const e = t?.endereco;
  if (!e) return 'Endereço';
  const partes = [e.rua, e.bairro, e.cidade || e.municipio?.nome, e.estado || e.municipio?.uf, e.cep ? `CEP ${e.cep}` : '']
    .map((x) => String(x ?? '').trim())
    .filter(Boolean);
  return partes.join(' — ') || 'Endereço';
}

function MiniFormSolicitar({ onSubmit, busy }) {
  const [data, setData] = useState(hojeIso());
  const [mov, setMov] = useState('');
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ dataSolicitacao: data, movProjudiSolicitacao: mov.trim() || null });
      }}
    >
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-0.5">Data solicitação</label>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" required />
      </div>
      <div className="flex-1 min-w-[8rem]">
        <label className="block text-xs font-medium text-slate-600 mb-0.5">Nº PROJUDI (opc.)</label>
        <input type="text" value={mov} onChange={(e) => setMov(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Ex.: 333" />
      </div>
      <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        Confirmar
      </button>
    </form>
  );
}

function MiniFormRetorno({ onSubmit, busy, movSugerido }) {
  const [data, setData] = useState(hojeIso());
  const [motivo, setMotivo] = useState('');
  const [mov, setMov] = useState(movSugerido ?? '');
  useEffect(() => {
    if (movSugerido) setMov(movSugerido);
  }, [movSugerido]);
  return (
    <form
      className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          dataRetorno: data,
          motivoRetorno: motivo.trim(),
          movProjudiRetorno: mov.trim() || null,
        });
      }}
    >
      <div className="flex flex-wrap gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-0.5">Data retorno</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" required />
        </div>
        <div className="flex-1 min-w-[8rem]">
          <label className="block text-xs font-medium text-slate-600 mb-0.5">Nº PROJUDI (opc.)</label>
          <input type="text" value={mov} onChange={(e) => setMov(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-0.5">Motivo</label>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" required />
      </div>
      <button type="submit" disabled={busy} className="self-start rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        Confirmar retorno
      </button>
    </form>
  );
}

/**
 * @param {{
 *   processoId: number|null,
 *   partesReu: Array<{ id: number, nomeExibicao?: string, nomeLivre?: string, pessoaId?: number }>,
 *   parteInicialId?: number|null,
 *   movProjudiSugerido?: string|null,
 * }} props
 */
export function ProcessoCitacaoPainel({ processoId, partesReu, parteInicialId, movProjudiSugerido }) {
  const [parteId, setParteId] = useState(null);
  const [painel, setPainel] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiadoId, setCopiadoId] = useState(null);
  const [acaoAberta, setAcaoAberta] = useState(null);

  const partes = useMemo(() => (Array.isArray(partesReu) ? partesReu : []), [partesReu]);

  useEffect(() => {
    if (!partes.length) {
      setParteId(null);
      return;
    }
    const inicial = Number(parteInicialId);
    if (Number.isFinite(inicial) && partes.some((p) => Number(p.id) === inicial)) {
      setParteId(inicial);
      return;
    }
    setParteId((prev) => (prev && partes.some((p) => Number(p.id) === prev) ? prev : Number(partes[0].id)));
  }, [partes, parteInicialId]);

  const recarregar = useCallback(async () => {
    const pid = Number(processoId);
    const ppid = Number(parteId);
    if (!featureFlags.useApiCitacao || !Number.isFinite(pid) || pid < 1 || !Number.isFinite(ppid) || ppid < 1) {
      setPainel(null);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const data = await carregarPainelCitacaoReu(pid, ppid);
      setPainel(data);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar painel de citação.');
      setPainel(null);
    } finally {
      setCarregando(false);
    }
  }, [processoId, parteId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  if (!featureFlags.useApiCitacao) {
    return (
      <p className="text-sm text-slate-600 p-4">
        Ative <code className="mx-1">VITE_USE_API_CITACAO</code> para usar o controle de citação.
      </p>
    );
  }

  if (!processoId) {
    return <p className="text-sm text-slate-500 p-4">Salve o processo na API antes de usar o painel de citação.</p>;
  }

  const tentados = Array.isArray(painel?.tentados) ? painel.tentados : [];
  const proximos = Array.isArray(painel?.proximos) ? painel.proximos : [];

  async function executar(fn) {
    setBusy(true);
    setErro('');
    try {
      await fn();
      setAcaoAberta(null);
      await recarregar();
    } catch (e) {
      setErro(e?.message || 'Operação falhou.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem]">
          <label className="block text-sm font-medium text-slate-700 mb-1">Réu (polo passivo)</label>
          <select
            value={parteId ?? ''}
            onChange={(e) => setParteId(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            disabled={!partes.length}
          >
            {!partes.length ? <option value="">Nenhuma parte RÉU cadastrada</option> : null}
            {partes.map((p) => (
              <option key={p.id} value={p.id}>
                {String(p.nomeExibicao || p.nomeLivre || `Parte #${p.id}`).trim()}
              </option>
            ))}
          </select>
        </div>
        {carregando ? (
          <span className="inline-flex items-center gap-1 text-sm text-slate-500 pb-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </span>
        ) : null}
      </div>

      {erro ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <header className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">
            Já tentados ({tentados.length})
          </header>
          <ul className="divide-y divide-slate-100 max-h-[32rem] overflow-y-auto">
            {tentados.length === 0 ? (
              <li className="px-4 py-6 text-sm text-slate-500 text-center">Nenhuma tentativa registrada.</li>
            ) : (
              tentados.map((t) => {
                const st = String(t.status || '').toUpperCase();
                const badge = STATUS_BADGE[st] || 'bg-slate-100 text-slate-700 border-slate-200';
                return (
                  <li key={t.id} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-slate-800 font-medium min-w-0 flex-1">{textoEnderecoTentativa(t)}</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${badge}`}>{st || '—'}</span>
                    </div>
                    <dl className="mt-2 space-y-0.5 text-xs text-slate-600">
                      {t.dataSolicitacao ? (
                        <div>
                          <span className="font-medium">Solicitado:</span> {formatarDataBr(t.dataSolicitacao)}
                          {t.movProjudiSolicitacao ? ` · Mov. ${t.movProjudiSolicitacao}` : ''}
                        </div>
                      ) : null}
                      {st === 'NEGATIVO' || st === 'POSITIVO' ? (
                        <div>
                          <span className="font-medium">Retorno:</span> {formatarDataBr(t.dataRetorno)}
                          {t.movProjudiRetorno ? ` · Mov. ${t.movProjudiRetorno}` : ''}
                          {t.movMonitoradaRetornoId ? (
                            <span className="ml-1 text-slate-500 italic">(detectado automaticamente)</span>
                          ) : null}
                        </div>
                      ) : null}
                      {t.motivoRetorno ? (
                        <div>
                          <span className="font-medium">Motivo:</span> {t.motivoRetorno}
                        </div>
                      ) : null}
                    </dl>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {st === 'SOLICITADO' ? (
                        <>
                          <button
                            type="button"
                            className="text-xs font-medium text-blue-700 hover:underline"
                            onClick={() =>
                              setAcaoAberta(
                                acaoAberta?.tipo === 'retorno' && acaoAberta.id === t.id
                                  ? null
                                  : { tipo: 'retorno', id: t.id },
                              )
                            }
                          >
                            Registrar retorno
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-emerald-700 hover:underline"
                            onClick={() => {
                              if (!window.confirm('Marcar este endereço como citado (POSITIVO)?')) return;
                              void executar(() =>
                                registrarPositivoCitacao(processoId, { tentativaId: t.id, dataRetorno: hojeIso() }),
                              );
                            }}
                          >
                            Marcar citado
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline"
                        onClick={() => {
                          if (
                            !window.confirm(
                              'Remover esta tentativa? O endereço voltará para «Próximos endereços» (se ainda existir no cadastro).',
                            )
                          ) {
                            return;
                          }
                          void executar(() => excluirTentativaCitacao(processoId, t.id));
                        }}
                      >
                        <Trash2 className="w-3 h-3" /> Remover
                      </button>
                    </div>
                    {acaoAberta?.tipo === 'retorno' && acaoAberta.id === t.id ? (
                      <MiniFormRetorno
                        busy={busy}
                        movSugerido={movProjudiSugerido}
                        onSubmit={(body) =>
                          executar(() => registrarRetornoCitacao(processoId, { tentativaId: t.id, ...body }))
                        }
                      />
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <header className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">
            Próximos endereços ({proximos.length})
          </header>
          <ul className="divide-y divide-slate-100 max-h-[32rem] overflow-y-auto">
            {proximos.length === 0 ? (
              <li className="px-4 py-6 text-sm text-amber-900 bg-amber-50/80 text-center leading-relaxed">
                Não há mais endereços não tentados — cadastre novos endereços na ficha da pessoa (inclusive em lote).
              </li>
            ) : (
              proximos.map((p) => {
                const fmt = p.enderecoFormatado || textoEnderecoTentativa(p);
                return (
                  <li key={p.pessoaEnderecoId} className="px-4 py-3 text-sm">
                    <p className="text-slate-800 whitespace-pre-wrap">{fmt}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(fmt);
                            setCopiadoId(p.pessoaEnderecoId);
                            window.setTimeout(() => setCopiadoId(null), 2000);
                          } catch {
                            setErro('Não foi possível copiar para a área de transferência.');
                          }
                        }}
                      >
                        {copiadoId === p.pessoaEnderecoId ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado
                          </>
                        ) : (
                          <>
                            <ClipboardCopy className="w-3.5 h-3.5" /> Copiar endereço
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-700 hover:underline"
                        onClick={() =>
                          setAcaoAberta(
                            acaoAberta?.tipo === 'solicitar' && acaoAberta.id === p.pessoaEnderecoId
                              ? null
                              : { tipo: 'solicitar', id: p.pessoaEnderecoId },
                          )
                        }
                      >
                        Marcar como solicitado
                      </button>
                    </div>
                    {acaoAberta?.tipo === 'solicitar' && acaoAberta.id === p.pessoaEnderecoId ? (
                      <MiniFormSolicitar
                        busy={busy}
                        onSubmit={(body) =>
                          executar(() =>
                            solicitarCitacao(processoId, {
                              processoParteId: parteId,
                              pessoaEnderecoId: p.pessoaEnderecoId,
                              ...body,
                            }),
                          )
                        }
                      />
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
