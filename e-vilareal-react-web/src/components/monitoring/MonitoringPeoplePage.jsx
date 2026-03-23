import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Play,
  Pause,
  RefreshCw,
  UserSearch,
  Settings2,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import * as monitoringApi from '../../api/monitoringService.js';
import { buscarCliente, atualizarCliente } from '../../api/clientesService.js';
import { getCadastroPessoasMock } from '../../data/cadastroPessoasMock.js';
import {
  listarMonitoramentoLocalMock,
  setMockMarcadoMonitoramento,
} from '../../data/cadastroPessoasMockMonitoramento.js';

const FORCA_MOCK_CADASTRO = import.meta.env.VITE_USE_MOCK_CADASTRO_PESSOAS === 'true';

const FREQ_OPTIONS = [
  { v: 'MINUTES_15', l: 'A cada 15 min' },
  { v: 'MINUTES_30', l: 'A cada 30 min' },
  { v: 'HOURS_1', l: 'A cada 1 hora' },
  { v: 'HOURS_6', l: 'A cada 6 horas' },
  { v: 'HOURS_12', l: 'A cada 12 horas' },
  { v: 'DAILY', l: 'Diário' },
  { v: 'BUSINESS_HOURS', l: 'Dias úteis (janela)' },
];

function fmtInstant(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

export function MonitoringPeoplePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [rows, setRows] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [detail, setDetail] = useState(null);
  const [hits, setHits] = useState([]);
  const [settings, setSettings] = useState(null);
  const [tab, setTab] = useState('lista');
  const [novaChave, setNovaChave] = useState({ keyType: 'numero_processo', keyValue: '', notes: '' });
  const [runBusy, setRunBusy] = useState(null);
  const [removendoPersonId, setRemovendoPersonId] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [p, c, s] = await Promise.all([
        monitoringApi.listarMonitorados().catch((e) => {
          return { __err: e?.message || String(e) };
        }),
        monitoringApi.listarCandidatosMonitoramento().catch((e) => {
          return { __err: e?.message || String(e) };
        }),
        monitoringApi.obterConfigMonitoramento().catch(() => null),
      ]);
      const errP = p && p.__err;
      const errC = c && c.__err;
      let rowsNext = Array.isArray(p) && !errP ? p : [];
      let candidatesNext = Array.isArray(c) && !errC ? c : [];

      // Fallback: liga Cadastro (mock) com Monitoramento quando a API estiver fora/instável.
      if ((FORCA_MOCK_CADASTRO || errP || errC) && rowsNext.length === 0 && candidatesNext.length === 0) {
        const local = listarMonitoramentoLocalMock(getCadastroPessoasMock(false));
        rowsNext = local;
        candidatesNext = local;
      }

      setRows(rowsNext);
      setCandidates(candidatesNext);
      setSettings(s);
      if (errP || errC) {
        if (rowsNext.length === 0 && candidatesNext.length === 0) {
          const partes = [];
          if (errP) partes.push(`Monitorados: ${errP}`);
          if (errC) partes.push(`Candidatos: ${errC}`);
          setErr(partes.join(' · '));
        } else {
          setErr('');
        }
      }
    } catch (e) {
      setErr(e?.message || 'Falha ao carregar monitoramento. Verifique se o backend está no ar e a migration V4 foi aplicada.');
      setRows([]);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openDetail = async (id) => {
    if (!id) return;
    setErr('');
    try {
      const d = await monitoringApi.detalheMonitorado(id);
      setDetail(d);
      const h = await monitoringApi.listarHits(id);
      setHits(Array.isArray(h) ? h : []);
      setTab('detalhe');
    } catch (e) {
      setErr(e?.message || 'Erro ao abrir detalhe');
    }
  };

  const registrarCandidato = async (personId) => {
    setErr('');
    try {
      await monitoringApi.registrarMonitoramento({ personId, enabled: true });
      await loadAll();
    } catch (e) {
      setErr(e?.message || 'Erro ao registrar');
    }
  };

  const removerMonitoramento = async (r) => {
    const personId = r.personId != null ? Number(r.personId) : null;
    if (!personId || personId < 1) return;
    if (!window.confirm(`Remover o monitoramento de "${r.nome || 'esta pessoa'}"?`)) return;
    setRemovendoPersonId(personId);
    setErr('');
    try {
      const isMockLocal = r.lastStatus === 'MOCK_LOCAL' || r.id == null;
      if (isMockLocal) {
        setMockMarcadoMonitoramento(personId, false);
        await loadAll();
        return;
      }
      const c = await buscarCliente(personId);
      if (!c) {
        setErr('Cadastro da pessoa não encontrado.');
        return;
      }
      const dns =
        c.dataNascimento == null || c.dataNascimento === ''
          ? null
          : typeof c.dataNascimento === 'string' && c.dataNascimento.includes('T')
            ? c.dataNascimento.split('T')[0]
            : c.dataNascimento;
      await atualizarCliente(personId, {
        nome: String(c.nome ?? '').trim(),
        email: String(c.email ?? '').trim(),
        cpf: String(c.cpf ?? '').replace(/\D/g, ''),
        telefone: c.telefone?.trim() || null,
        dataNascimento: dns,
        ativo: c.ativo !== false,
        marcadoMonitoramento: false,
        responsavelId:
          c.responsavelId != null && c.responsavelId !== '' ? Number(c.responsavelId) : null,
      });
      await loadAll();
    } catch (e) {
      setErr(e?.message || 'Erro ao remover monitoramento.');
    } finally {
      setRemovendoPersonId(null);
    }
  };

  const toggleEnabled = async (id, enabled) => {
    setErr('');
    try {
      await monitoringApi.patchMonitorado(id, { enabled });
      await loadAll();
      if (detail?.id === id) {
        const d = await monitoringApi.detalheMonitorado(id);
        setDetail(d);
      }
    } catch (e) {
      setErr(e?.message || 'Erro ao atualizar');
    }
  };

  const salvarFrequencia = async (id, globalFrequencyType) => {
    setErr('');
    try {
      await monitoringApi.patchMonitorado(id, { globalFrequencyType });
      await loadAll();
      if (detail?.id === id) {
        const d = await monitoringApi.detalheMonitorado(id);
        setDetail(d);
      }
    } catch (e) {
      setErr(e?.message || 'Erro ao salvar frequência');
    }
  };

  const runNow = async (id) => {
    setRunBusy(id);
    setErr('');
    try {
      await monitoringApi.executarMonitoramentoAgora(id);
      await loadAll();
      if (detail?.id === id) {
        const d = await monitoringApi.detalheMonitorado(id);
        setDetail(d);
        const h = await monitoringApi.listarHits(id);
        setHits(Array.isArray(h) ? h : []);
      }
    } catch (e) {
      setErr(e?.message || 'Execução em conflito ou erro na API DataJud (veja logs no backend).');
    } finally {
      setRunBusy(null);
    }
  };

  const adicionarChave = async () => {
    if (!detail?.id || !novaChave.keyValue.trim()) return;
    setErr('');
    try {
      await monitoringApi.adicionarChaveBusca(detail.id, {
        keyType: novaChave.keyType,
        keyValue: novaChave.keyValue.trim(),
        notes: novaChave.notes || undefined,
        priority: 10,
        enabled: true,
      });
      setNovaChave({ keyType: 'numero_processo', keyValue: '', notes: '' });
      const d = await monitoringApi.detalheMonitorado(detail.id);
      setDetail(d);
    } catch (e) {
      setErr(e?.message || 'Erro ao adicionar chave');
    }
  };

  const revisar = async (hitId, reviewStatus) => {
    setErr('');
    try {
      await monitoringApi.revisarHit(hitId, { reviewStatus });
      if (detail?.id) {
        const h = await monitoringApi.listarHits(detail.id);
        setHits(Array.isArray(h) ? h : []);
      }
      await loadAll();
    } catch (e) {
      setErr(e?.message || 'Erro na revisão');
    }
  };

  const salvarSettings = async () => {
    if (!settings) return;
    setErr('');
    try {
      const s = await monitoringApi.salvarConfigMonitoramento(settings);
      setSettings(s);
    } catch (e) {
      setErr(e?.message || 'Erro ao salvar configurações');
    }
  };

  const pendentesTotal = useMemo(() => rows.reduce((a, r) => a + (r.pendingReviewHits || 0), 0), [rows]);

  return (
    <div className="min-h-full bg-slate-100 dark:bg-[#0c0f14] text-slate-900 dark:text-slate-100">
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/processos')}
            className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Processos
          </button>
          <div className="flex items-center gap-2">
            <UserSearch className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold">Monitoramento de Pessoas</h1>
          </div>
          <span className="text-xs text-slate-500">DataJud (CNJ) — metadados e movimentações; revisão humana antes do vínculo definitivo.</span>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
          <button
            type="button"
            onClick={() => setTab('lista')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'lista' ? 'bg-indigo-600 text-white' : 'bg-slate-200/80 dark:bg-white/10'}`}
          >
            Monitorados ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('candidatos')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'candidatos' ? 'bg-indigo-600 text-white' : 'bg-slate-200/80 dark:bg-white/10'}`}
          >
            Candidatos ({candidates.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('config')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-1 ${tab === 'config' ? 'bg-indigo-600 text-white' : 'bg-slate-200/80 dark:bg-white/10'}`}
          >
            <Settings2 className="w-4 h-4" />
            Agendador global
          </button>
          {detail ? (
            <button
              type="button"
              onClick={() => setTab('detalhe')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-1 ${tab === 'detalhe' ? 'bg-amber-600 text-white' : 'bg-amber-100 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100'}`}
            >
              Detalhe: {detail.nome}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={loadAll}
            className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-slate-300 dark:border-white/15"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {pendentesTotal > 0 ? (
          <div className="rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 px-4 py-2 text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
            Existem <strong>{pendentesTotal}</strong> achado(s) pendentes de revisão no total.
          </div>
        ) : null}

        {err ? (
          <div className="rounded-lg border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/25 px-4 py-3 text-sm text-red-900 dark:text-red-100">
            {err}
          </div>
        ) : null}

        {loading && tab !== 'detalhe' ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Carregando…
          </div>
        ) : null}

        {tab === 'lista' && !loading ? (
          <section className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141c2c] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1000px]">
                <thead className="bg-slate-50 dark:bg-black/30">
                  <tr className="text-left">
                    <th className="p-2 min-w-[220px]">Nome</th>
                    <th className="p-2">Documento</th>
                    <th className="p-2">Ativo</th>
                    <th className="p-2">Frequência</th>
                    <th className="p-2">Último / próximo</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Pend. revisão</th>
                    <th className="p-2">Falhas</th>
                    <th className="p-2 w-48">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        Nenhuma pessoa em monitoramento. Use a aba Candidatos ou POST /api/monitoring/people.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id || r.personId} className="border-t border-slate-100 dark:border-white/[0.06]">
                        <td className="p-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium leading-snug">{r.nome}</span>
                            <button
                              type="button"
                              onClick={() => removerMonitoramento(r)}
                              disabled={removendoPersonId != null}
                              className="shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-[10px] font-semibold whitespace-nowrap disabled:opacity-50"
                            >
                              {removendoPersonId === r.personId ? 'Removendo…' : 'Remover'}
                            </button>
                          </div>
                        </td>
                        <td className="p-2 font-mono text-[11px]">{r.documentoPrincipal}</td>
                        <td className="p-2">{r.enabled ? 'Sim' : 'Não'}</td>
                        <td className="p-2">
                          <select
                            className="max-w-[10rem] rounded border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0d1018] text-[11px] py-1"
                            value={r.frequencyType || 'HOURS_6'}
                            onChange={(e) => r.id && salvarFrequencia(r.id, e.target.value)}
                            disabled={!r.id}
                          >
                            {FREQ_OPTIONS.map((o) => (
                              <option key={o.v} value={o.v}>
                                {o.l}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 whitespace-nowrap text-[11px]">
                          <div>{fmtInstant(r.lastRunAt)}</div>
                          <div className="text-slate-500">→ {fmtInstant(r.nextRunAt)}</div>
                        </td>
                        <td className="p-2 text-[11px]">{r.lastStatus || '—'}</td>
                        <td className="p-2">{r.pendingReviewHits ?? 0}</td>
                        <td className="p-2">{r.recentFailureCount ?? 0}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              disabled={!r.id || runBusy === r.id}
                              onClick={() => r.id && runNow(r.id)}
                              className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-medium disabled:opacity-50"
                            >
                              <Play className="w-3 h-3" />
                              Agora
                            </button>
                            <button
                              type="button"
                              disabled={!r.id}
                              onClick={() => r.id && toggleEnabled(r.id, !r.enabled)}
                              className="inline-flex items-center gap-0.5 px-2 py-1 rounded border border-slate-300 dark:border-white/15 text-[10px]"
                            >
                              {r.enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              {r.enabled ? 'Pausar' : 'Ativar'}
                            </button>
                            <button
                              type="button"
                              disabled={!r.id}
                              onClick={() => openDetail(r.id)}
                              className="px-2 py-1 rounded border border-slate-300 dark:border-white/15 text-[10px]"
                            >
                              Detalhe
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === 'candidatos' && !loading ? (
          <section className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141c2c] p-5 shadow-sm space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Pessoas com <strong>marcadoMonitoramento</strong> no cadastro, ainda sem registro em <code className="text-xs">monitored_people</code>.
            </p>
            <ul className="space-y-2">
              {candidates.length === 0 ? (
                <li className="text-slate-500 text-sm">Nenhum candidato pendente.</li>
              ) : (
                candidates.map((c) => (
                  <li
                    key={c.personId}
                    className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 dark:border-white/[0.06] rounded-lg p-3"
                  >
                    <div>
                      <div className="font-medium">{c.nome}</div>
                      <div className="text-xs font-mono text-slate-500">{c.documentoPrincipal}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => registrarCandidato(c.personId)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm"
                    >
                      Ativar monitoramento
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {tab === 'config' && settings ? (
          <section className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141c2c] p-5 shadow-sm space-y-4 max-w-lg">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.schedulerEnabled}
                onChange={(e) => setSettings({ ...settings, schedulerEnabled: e.target.checked })}
              />
              Scheduler habilitado
            </label>
            <label className="grid gap-1 text-sm">
              Lote por ciclo (pessoas)
              <input
                type="number"
                min={1}
                max={50}
                value={settings.batchSize}
                onChange={(e) => setSettings({ ...settings, batchSize: Number(e.target.value) })}
                className="rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0d1018] px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Frequência padrão (novos registros)
              <select
                value={settings.defaultFrequencyType || 'HOURS_6'}
                onChange={(e) => setSettings({ ...settings, defaultFrequencyType: e.target.value })}
                className="rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0d1018] px-3 py-2"
              >
                {FREQ_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={salvarSettings} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm dark:bg-indigo-600">
              Salvar configurações
            </button>
            <p className="text-xs text-slate-500">
              Timeout e API Key do DataJud ficam no backend (<code>application.properties</code> / variável <code>DATAJUD_API_KEY</code>).
            </p>
          </section>
        ) : null}

        {tab === 'detalhe' && detail ? (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141c2c] p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold">{detail.nome}</h2>
              <div className="text-xs text-slate-500 grid sm:grid-cols-2 gap-2">
                <div>
                  Modo: <strong>{detail.monitorMode}</strong> · CPF/nome na API:{' '}
                  <strong>{detail.monitorByCpfCnpj ? 'sim' : 'não'}</strong> · Processos conhecidos:{' '}
                  <strong>{detail.monitorByKnownProcesses ? 'sim' : 'não'}</strong>
                </div>
                <div>
                  Estratégias adicionais documentadas no backend; busca por nome costuma ser limitada por tribunal.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => runNow(detail.id)} disabled={runBusy === detail.id} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm">
                  <Play className="w-4 h-4" />
                  Reprocessar agora
                </button>
                <button type="button" onClick={() => navigate('/clientes/lista')} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-white/15 text-sm">
                  Abrir cadastro (Pessoas)
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141c2c] p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold">Chaves de busca</h3>
              <p className="text-xs text-slate-500">
                Inclua <strong>numero_processo</strong> com o CNJ completo para a estratégia A (reconsulta confiável). CPF/nome são auxiliares e podem não funcionar em todos os índices.
              </p>
              <ul className="text-xs space-y-1 font-mono">
                {(detail.searchKeys || []).map((k) => (
                  <li key={k.id}>
                    [{k.keyType}] {k.keyValue}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 items-end">
                <label className="grid gap-1 text-xs">
                  Tipo
                  <select
                    value={novaChave.keyType}
                    onChange={(e) => setNovaChave({ ...novaChave, keyType: e.target.value })}
                    className="rounded border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0d1018] px-2 py-1"
                  >
                    <option value="numero_processo">numero_processo</option>
                    <option value="cpf">cpf</option>
                    <option value="cnpj">cnpj</option>
                    <option value="nome">nome</option>
                    <option value="oab">oab</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs flex-1 min-w-[200px]">
                  Valor
                  <input
                    value={novaChave.keyValue}
                    onChange={(e) => setNovaChave({ ...novaChave, keyValue: e.target.value })}
                    className="rounded border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0d1018] px-2 py-1 w-full"
                    placeholder="0000000-00.0000.0.00.0000"
                  />
                </label>
                <button type="button" onClick={adicionarChave} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm">
                  Adicionar
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141c2c] p-5 shadow-sm space-y-2">
              <h3 className="text-sm font-semibold">Últimas execuções</h3>
              <div className="overflow-x-auto text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="p-1">Início</th>
                      <th className="p-1">Status</th>
                      <th className="p-1">Novos</th>
                      <th className="p-1">Dup.</th>
                      <th className="p-1">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.recentRuns || []).map((run) => (
                      <tr key={run.id} className="border-t border-slate-100 dark:border-white/[0.06]">
                        <td className="p-1 whitespace-nowrap">{fmtInstant(run.startedAt)}</td>
                        <td className="p-1">{run.status}</td>
                        <td className="p-1">{run.newHits}</td>
                        <td className="p-1">{run.duplicatesSkipped}</td>
                        <td className="p-1 max-w-md truncate" title={run.limitationNote}>
                          {run.limitationNote || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141c2c] p-5 shadow-sm space-y-2">
              <h3 className="text-sm font-semibold">Achados (revisão)</h3>
              <div className="overflow-x-auto text-xs">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="p-1">Tribunal</th>
                      <th className="p-1">Processo</th>
                      <th className="p-1">Classe</th>
                      <th className="p-1">Último mov.</th>
                      <th className="p-1">Score</th>
                      <th className="p-1">Status</th>
                      <th className="p-1 w-56">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hits.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-slate-500">
                          Nenhum achado.
                        </td>
                      </tr>
                    ) : (
                      hits.map((h) => (
                        <tr key={h.id} className="border-t border-slate-100 dark:border-white/[0.06] align-top">
                          <td className="p-1">{h.tribunal}</td>
                          <td className="p-1 font-mono">{h.processNumber}</td>
                          <td className="p-1">{h.className || '—'}</td>
                          <td className="p-1 max-w-[180px]">
                            <div className="truncate" title={h.lastMovementName}>
                              {h.lastMovementName || '—'}
                            </div>
                            <div className="text-slate-500">{h.lastMovementAt || ''}</div>
                          </td>
                          <td className="p-1">
                            <div>{h.matchScore}</div>
                            <div className="text-slate-500 text-[10px]">{h.matchReason}</div>
                          </td>
                          <td className="p-1">{h.reviewStatus}</td>
                          <td className="p-1">
                            {h.reviewStatus === 'PENDING' ? (
                              <div className="flex flex-wrap gap-1">
                                <button type="button" onClick={() => revisar(h.id, 'APPROVED')} className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[10px]">
                                  Aprovar
                                </button>
                                <button type="button" onClick={() => revisar(h.id, 'FALSE_POSITIVE')} className="px-2 py-0.5 rounded bg-slate-600 text-white text-[10px]">
                                  Falso positivo
                                </button>
                                <button type="button" onClick={() => revisar(h.id, 'REJECTED')} className="px-2 py-0.5 rounded border border-slate-400 text-[10px]">
                                  Rejeitar
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
