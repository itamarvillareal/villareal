import { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileCheck2,
  Loader2,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react';
import {
  atualizarAcertoFechamentoApi,
  baixarPdfAcertoFechamentoApi,
  excluirAcertoFechamentoApi,
  fecharAcertoFechamentoApi,
  iniciarAcertoFechamentoApi,
  listarAcertoFechamentosApi,
  obterAcertoConfigApi,
  salvarAcertoConfigApi,
} from '../../../../repositories/financeiroRepository.js';
import { formatMoeda } from '../../shared/financeiroFormat.js';
import { ConfirmDialog } from '../../shared/ConfirmDialog.jsx';
import { useFinanceiroToast } from '../../shared/Toast.jsx';
import { fmtDataAcerto, fmtDataHoraAcerto, legendaSaldoAcerto } from './acertoUtils.js';

function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Ficha do Acerto (Etapa 5b): regras do acordo (percentual de repasse, observações), mensalidade
 * referenciada do cadastro mensalista, último fechamento e o fluxo do acerto
 * (Iniciar → conferir/ajustar → Fechar, com PDF arquivado).
 */
export function AcertoFichaPanel({ clienteId, numeroBanco, refreshKey, onAcertoFechado, onConfigSalva }) {
  const toast = useFinanceiroToast();
  const [aberto, setAberto] = useState(true);
  const [config, setConfig] = useState(null);
  const [fechamentos, setFechamentos] = useState([]);
  const [carregando, setCarregando] = useState(false);

  const [editando, setEditando] = useState(false);
  const [percentual, setPercentual] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [dataUltimoAcerto, setDataUltimoAcerto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [iniciando, setIniciando] = useState(false);
  const [fechandoId, setFechandoId] = useState(null);
  const [confirmFecharId, setConfirmFecharId] = useState(null);
  const [confirmExcluirId, setConfirmExcluirId] = useState(null);
  const [editandoRascunho, setEditandoRascunho] = useState(null);

  const carregar = useCallback(
    (signal) => {
      if (!clienteId || numeroBanco == null) return;
      setCarregando(true);
      Promise.all([
        obterAcertoConfigApi({ clienteId, numeroBanco }, { signal }),
        listarAcertoFechamentosApi({ clienteId, numeroBanco }, { signal }),
      ])
        .then(([cfg, lista]) => {
          setConfig(cfg ?? null);
          setFechamentos(Array.isArray(lista) ? lista : []);
        })
        .catch((e) => {
          if (e?.name !== 'AbortError') {
            setConfig(null);
            setFechamentos([]);
          }
        })
        .finally(() => {
          if (!signal?.aborted) setCarregando(false);
        });
    },
    [clienteId, numeroBanco],
  );

  useEffect(() => {
    const ac = new AbortController();
    carregar(ac.signal);
    return () => ac.abort();
  }, [carregar, refreshKey]);

  const iniciarEdicao = () => {
    setPercentual(config?.percentualRepasse != null ? String(config.percentualRepasse) : '');
    setObservacoes(config?.observacoes ?? '');
    setDataUltimoAcerto(
      config?.dataUltimoAcertoConhecido ? String(config.dataUltimoAcertoConhecido).slice(0, 10) : '',
    );
    setEditando(true);
  };

  const salvarFicha = async () => {
    setSalvando(true);
    try {
      const body = {
        clienteId: Number(clienteId),
        percentualRepasse: percentual.trim() !== '' ? Number(percentual.replace(',', '.')) : null,
        observacoes: observacoes.trim() || null,
        dataUltimoAcertoConhecido: dataUltimoAcerto.trim() || null,
      };
      await salvarAcertoConfigApi(body);
      toast.success('Ficha do Acerto salva.');
      setEditando(false);
      carregar();
      onConfigSalva?.();
    } catch (e) {
      toast.error(e?.message || 'Falha ao salvar a Ficha.');
    } finally {
      setSalvando(false);
    }
  };

  const rascunho = fechamentos.find((f) => f.status === 'RASCUNHO') ?? null;

  const iniciarAcerto = async () => {
    setIniciando(true);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      await iniciarAcertoFechamentoApi({
        clienteId: Number(clienteId),
        numeroBanco: Number(numeroBanco),
        periodoInicio: config?.ultimoFechamentoPeriodoFim ?? null,
        periodoFim: hoje,
      });
      toast.success('Acerto iniciado (rascunho). Confira os processos e feche quando terminar.');
      carregar();
    } catch (e) {
      toast.error(e?.message || 'Falha ao iniciar o acerto.');
    } finally {
      setIniciando(false);
    }
  };

  const fecharAcerto = async (id) => {
    setFechandoId(id);
    try {
      const r = await fecharAcertoFechamentoApi(id);
      toast.success(
        `Acerto fechado — saldo ${formatMoeda(Number(r?.saldoFinal ?? 0))} (${legendaSaldoAcerto(Number(r?.saldoFinal ?? 0))}). Relatório arquivado.`,
      );
      carregar();
      onAcertoFechado?.();
    } catch (e) {
      toast.error(e?.message || 'Falha ao fechar o acerto.');
    } finally {
      setFechandoId(null);
      setConfirmFecharId(null);
    }
  };

  const excluirRascunho = async (id) => {
    try {
      await excluirAcertoFechamentoApi(id);
      toast.success('Rascunho excluído.');
      carregar();
    } catch (e) {
      toast.error(e?.message || 'Falha ao excluir o rascunho.');
    } finally {
      setConfirmExcluirId(null);
    }
  };

  const salvarRascunho = async () => {
    if (!editandoRascunho) return;
    try {
      await atualizarAcertoFechamentoApi(editandoRascunho.id, {
        clienteId: Number(clienteId),
        numeroBanco: Number(numeroBanco),
        periodoInicio: editandoRascunho.periodoInicio || null,
        periodoFim: editandoRascunho.periodoFim || null,
        observacoes: editandoRascunho.observacoes || null,
      });
      toast.success('Rascunho atualizado.');
      setEditandoRascunho(null);
      carregar();
    } catch (e) {
      toast.error(e?.message || 'Falha ao atualizar o rascunho.');
    }
  };

  const baixarPdf = async (f) => {
    try {
      const blob = await baixarPdfAcertoFechamentoApi(f.id);
      baixarBlob(blob, `acerto_${config?.codigoCliente ?? clienteId}_${f.id}.pdf`);
    } catch (e) {
      toast.error(e?.message || 'Falha ao baixar o PDF.');
    }
  };

  if (!clienteId) return null;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 print:hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Ficha do Acerto
          {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : null}
        </span>
        <span className="text-[11px] text-slate-500">
          {config?.ultimoFechamentoData
            ? `Último fechamento: ${fmtDataHoraAcerto(config.ultimoFechamentoData)} · saldo ${formatMoeda(Number(config.ultimoFechamentoSaldo ?? 0))}`
            : 'Sem fechamento registrado'}
        </span>
      </button>

      {aberto ? (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-slate-500">Mensalidade (cadastro mensalista)</p>
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {config?.mensalidadeValor != null
                  ? `${formatMoeda(Number(config.mensalidadeValor))} · dia ${config.mensalidadeDiaVencimento ?? '—'}${config.mensalistaAtivo === false ? ' (inativo)' : ''}`
                  : 'não cadastrada'}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Percentual de repasse</p>
              {editando ? (
                <input
                  type="text"
                  value={percentual}
                  onChange={(e) => setPercentual(e.target.value)}
                  placeholder="ex.: 80"
                  className="w-24 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
                />
              ) : (
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {config?.percentualRepasse != null
                    ? `${Number(config.percentualRepasse).toLocaleString('pt-BR')}% cliente / ${(100 - Number(config.percentualRepasse)).toLocaleString('pt-BR')}% escritório`
                    : 'não definido'}
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Último acerto conhecido (corte manual)</p>
              {editando ? (
                <input
                  type="date"
                  value={dataUltimoAcerto}
                  onChange={(e) => setDataUltimoAcerto(e.target.value)}
                  title="Lançamentos até esta data formam um bloco fechado; a mesa de trabalho abre a partir do dia seguinte."
                  className="text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
                />
              ) : (
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {config?.dataUltimoAcertoConhecido
                    ? fmtDataAcerto(config.dataUltimoAcertoConhecido)
                    : 'não definido'}
                </p>
              )}
            </div>
            <div className="col-span-2">
              <p className="text-[11px] text-slate-500">Observações (parcelas internas, acordos)</p>
              {editando ? (
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                  className="w-full text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
                />
              ) : (
                <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {config?.observacoes || '—'}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editando ? (
              <>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => void salvarFicha()}
                  className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {salvando ? 'Salvando…' : 'Salvar Ficha'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(false)}
                  className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={iniciarEdicao}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar Ficha
              </button>
            )}

            {!rascunho ? (
              <button
                type="button"
                disabled={iniciando}
                onClick={() => void iniciarAcerto()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {iniciando ? 'Iniciando…' : 'Iniciar acerto'}
              </button>
            ) : null}
          </div>

          {rascunho ? (
            <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Acerto em andamento (rascunho #{rascunho.id}) — período{' '}
                  {rascunho.periodoInicio ? fmtDataAcerto(rascunho.periodoInicio) : 'início'} a{' '}
                  {rascunho.periodoFim ? fmtDataAcerto(rascunho.periodoFim) : 'hoje'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditandoRascunho({
                        id: rascunho.id,
                        periodoInicio: rascunho.periodoInicio ?? '',
                        periodoFim: rascunho.periodoFim ?? '',
                        observacoes: rascunho.observacoes ?? '',
                      })
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-amber-400 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  >
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmExcluirId(rascunho.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="w-3 h-3" /> Excluir
                  </button>
                  <button
                    type="button"
                    disabled={fechandoId === rascunho.id}
                    onClick={() => setConfirmFecharId(rascunho.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <FileCheck2 className="w-3 h-3" />
                    {fechandoId === rascunho.id ? 'Fechando…' : 'Fechar acerto'}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                Fluxo: conferir/ajustar os processos → registrar o pagamento de fechamento →
                compensar a seleção → Fechar acerto (arquiva o relatório e grava o saldo na Ficha).
              </p>
              {editandoRascunho?.id === rascunho.id ? (
                <div className="flex flex-wrap items-end gap-2 text-xs">
                  <label className="flex flex-col gap-0.5">
                    Início
                    <input
                      type="date"
                      value={editandoRascunho.periodoInicio}
                      onChange={(e) =>
                        setEditandoRascunho((s) => ({ ...s, periodoInicio: e.target.value }))
                      }
                      className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    Fim
                    <input
                      type="date"
                      value={editandoRascunho.periodoFim}
                      onChange={(e) =>
                        setEditandoRascunho((s) => ({ ...s, periodoFim: e.target.value }))
                      }
                      className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 min-w-[220px] flex-1">
                    Observações
                    <input
                      type="text"
                      value={editandoRascunho.observacoes}
                      onChange={(e) =>
                        setEditandoRascunho((s) => ({ ...s, observacoes: e.target.value }))
                      }
                      className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void salvarRascunho()}
                    className="px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoRascunho(null)}
                    className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {fechamentos.filter((f) => f.status === 'FECHADO').length > 0 ? (
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1">Acertos fechados</p>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {fechamentos
                  .filter((f) => f.status === 'FECHADO')
                  .map((f) => (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-xs"
                    >
                      <span className="text-slate-700 dark:text-slate-200">
                        #{f.id} · fechado em {fmtDataHoraAcerto(f.dataFechamento)}
                        {f.fechadoPorNome ? ` por ${f.fechadoPorNome}` : ''} · saldo{' '}
                        <strong>{formatMoeda(Number(f.saldoFinal ?? 0))}</strong> (
                        {legendaSaldoAcerto(Number(f.saldoFinal ?? 0))})
                        {f.qtdGrupos ? ` · ${f.qtdGrupos} grupos` : ''}
                      </span>
                      {f.temPdf ? (
                        <button
                          type="button"
                          onClick={() => void baixarPdf(f)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </button>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmFecharId != null}
        title="Fechar o acerto?"
        message="O saldo pendente atual será gravado como saldo final, os grupos de compensação serão vinculados e o relatório PDF será arquivado. Esta ação não pode ser desfeita."
        confirmLabel="Fechar acerto"
        onCancel={() => setConfirmFecharId(null)}
        onConfirm={() => void fecharAcerto(confirmFecharId)}
      />
      <ConfirmDialog
        open={confirmExcluirId != null}
        title="Excluir o rascunho?"
        message="O rascunho do acerto será removido. Lançamentos e conferências não são afetados."
        confirmLabel="Excluir"
        danger
        onCancel={() => setConfirmExcluirId(null)}
        onConfirm={() => void excluirRascunho(confirmExcluirId)}
      />
    </section>
  );
}
