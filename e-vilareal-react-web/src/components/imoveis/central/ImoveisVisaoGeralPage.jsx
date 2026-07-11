import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, CircleDollarSign, Home, Search, TriangleAlert, X } from 'lucide-react';
import { useImoveisCentral } from './ImoveisCentralContext.jsx';
import { competenciaLabel, formatBRL, statusMesItem, textoBuscaItem } from './imoveisCentralFormat.js';

const FILTRO_STATUS_OPCOES = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendencias', label: 'Com pendência no mês' },
  { key: 'aluguel-pendente', label: 'Aluguel não recebido' },
  { key: 'repasse-pendente', label: 'Repasse pendente' },
  { key: 'vago', label: 'Vagos' },
];

function KpiCard({ icone: Icone, titulo, valor, sub, tom = 'slate' }) {
  const tons = {
    slate: 'text-slate-800 dark:text-slate-100',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    orange: 'text-orange-700 dark:text-orange-300',
    red: 'text-red-700 dark:text-red-300',
  };
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {Icone ? <Icone className="w-3.5 h-3.5 shrink-0" aria-hidden /> : null}
        {titulo}
      </p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tons[tom] ?? tons.slate}`}>{valor}</p>
      {sub ? <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{sub}</p> : null}
    </div>
  );
}

export function ImoveisVisaoGeralPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { competencia, itens, carregando, erro, ultimaCarga } = useImoveisCentral();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [diaRepasse, setDiaRepasse] = useState('');

  /** Compat: navegações antigas para /imoveis com state abriam o cadastro do nº informado. */
  useEffect(() => {
    const st = location.state && typeof location.state === 'object' ? location.state : null;
    const np = Number(st?.numeroPlanilha ?? st?.imovelId);
    if (Number.isFinite(np) && np >= 1) {
      navigate(`/imoveis/${Math.floor(np)}?aba=cadastro`, { replace: true });
    }
  }, [location.state, navigate]);

  const kpis = useMemo(() => {
    let ocupados = 0;
    let alugueisRecebidos = 0;
    let somaAlugueis = 0;
    let repassesPendentes = 0;
    let vagos = 0;
    for (const it of itens) {
      if (it.ocupado) ocupados += 1;
      else vagos += 1;
      const aluguel = Number(it.aluguelRecebido) || 0;
      if (aluguel > 0) {
        alugueisRecebidos += 1;
        somaAlugueis += aluguel;
        const st = String(it.statusRepasse ?? '').toUpperCase();
        if (st === 'PENDENTE' || st === 'DIVERGENTE') repassesPendentes += 1;
      }
    }
    return { total: itens.length, ocupados, vagos, alugueisRecebidos, somaAlugueis, repassesPendentes };
  }, [itens]);

  const linhas = useMemo(() => {
    const b = busca.trim().toLocaleLowerCase('pt-BR');
    const dia = Number(diaRepasse);
    return itens.filter((it) => {
      if (b && !textoBuscaItem(it).includes(b)) return false;
      if (Number.isFinite(dia) && dia >= 1 && Number(it.diaRepasse) !== dia) return false;
      const st = statusMesItem(it);
      if (filtroStatus === 'pendencias') {
        return it.ocupado && st.key !== 'ok' && st.key !== 'sem-contrato';
      }
      if (filtroStatus === 'aluguel-pendente') return st.key === 'aluguel-pendente';
      if (filtroStatus === 'repasse-pendente') {
        return st.key === 'repasse-pendente' || st.key === 'repasse-divergente';
      }
      if (filtroStatus === 'vago') return st.key === 'vago';
      return true;
    });
  }, [itens, busca, filtroStatus, diaRepasse]);

  const filtrosAtivos = Boolean(busca.trim()) || filtroStatus !== 'todos' || Boolean(diaRepasse);

  function abrirImovel(it) {
    if (it?.numeroPlanilha != null) {
      navigate(`/imoveis/${it.numeroPlanilha}`);
    }
  }

  const th =
    'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap bg-slate-50/90 dark:bg-slate-900/90';
  const td = 'px-3 py-2 text-sm text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/60 align-middle';

  return (
    <div className="p-4 space-y-4 max-w-[1500px] w-full mx-auto">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard icone={Building2} titulo="Imóveis" valor={kpis.total} sub={`${kpis.ocupados} ocupados · ${kpis.vagos} vagos`} />
        <KpiCard
          icone={CircleDollarSign}
          titulo={`Aluguéis recebidos · ${competenciaLabel(competencia)}`}
          valor={kpis.alugueisRecebidos}
          sub={formatBRL(kpis.somaAlugueis)}
          tom="emerald"
        />
        <KpiCard
          icone={TriangleAlert}
          titulo="Repasses pendentes"
          valor={kpis.repassesPendentes}
          sub="aluguel recebido sem repasse conferido"
          tom={kpis.repassesPendentes > 0 ? 'orange' : 'slate'}
        />
        <KpiCard
          icone={Home}
          titulo="Sem aluguel no mês"
          valor={itens.filter((it) => it.ocupado && !(Number(it.aluguelRecebido) > 0)).length}
          sub="ocupados sem crédito vinculado"
          tom="red"
        />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 min-w-[16rem] flex-1">
            Buscar imóvel
            <span className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Endereço, condomínio, unidade, inquilino, proprietário, nº, Cod.+Proc.…"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-3 py-2 text-sm"
              />
            </span>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
            Status do mês
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            >
              {FILTRO_STATUS_OPCOES.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 w-28">
            Dia repasse
            <input
              type="number"
              min={1}
              max={31}
              value={diaRepasse}
              onChange={(e) => setDiaRepasse(e.target.value)}
              placeholder="—"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm tabular-nums"
            />
          </label>
          {filtrosAtivos ? (
            <button
              type="button"
              onClick={() => {
                setBusca('');
                setFiltroStatus('todos');
                setDiaRepasse('');
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-teal-700 dark:text-slate-400 pb-2.5"
            >
              <X className="w-3.5 h-3.5" aria-hidden />
              Limpar
            </button>
          ) : null}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {linhas.length} de {itens.length} imóve{itens.length === 1 ? 'l' : 'is'}
          {ultimaCarga ? ` · atualizado ${ultimaCarga.toLocaleTimeString('pt-BR')}` : ''}
          {carregando ? ' · carregando…' : ''}
        </p>

        {erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[1050px] text-left border-collapse">
            <thead>
              <tr>
                <th className={th}>Nº</th>
                <th className={th}>Imóvel</th>
                <th className={th}>Inquilino</th>
                <th className={th}>Proprietário</th>
                <th className={`${th} text-right`}>Aluguel</th>
                <th className={th}>Dias (venc./rep.)</th>
                <th className={`${th} text-right`}>Recebido no mês</th>
                <th className={`${th} text-right`}>Repassado</th>
                <th className={th}>Status do mês</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((it) => {
                const st = statusMesItem(it);
                const enderecoLinha = [it.condominio, it.unidade].filter(Boolean).join(' · ');
                return (
                  <tr
                    key={it.imovelId ?? `np-${it.numeroPlanilha}`}
                    className={`hover:bg-teal-50/60 dark:hover:bg-teal-950/30 ${
                      it.numeroPlanilha != null ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => abrirImovel(it)}
                    title={it.numeroPlanilha != null ? 'Abrir página do imóvel' : undefined}
                  >
                    <td className={`${td} font-semibold tabular-nums`}>{it.numeroPlanilha ?? '—'}</td>
                    <td className={`${td} max-w-[280px]`}>
                      <p className="font-medium truncate">{enderecoLinha || it.titulo || it.enderecoCompleto || '—'}</p>
                      {enderecoLinha && it.enderecoCompleto ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{it.enderecoCompleto}</p>
                      ) : null}
                    </td>
                    <td className={`${td} max-w-[190px] truncate`} title={it.inquilino ?? undefined}>
                      {it.inquilino || '—'}
                    </td>
                    <td className={`${td} max-w-[190px] truncate`} title={it.proprietario ?? undefined}>
                      {it.proprietario || '—'}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {it.valorAluguel != null ? formatBRL(it.valorAluguel) : '—'}
                    </td>
                    <td className={`${td} tabular-nums text-xs`}>
                      {it.diaVencimentoAluguel ?? '—'} / {it.diaRepasse ?? '—'}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {Number(it.aluguelRecebido) > 0 ? formatBRL(it.aluguelRecebido) : '—'}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {Number(it.repassado) > 0 ? formatBRL(it.repassado) : '—'}
                    </td>
                    <td className={td}>
                      <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${st.cls}`}>
                        {st.label}
                      </span>
                      {it.repasseInterno ? (
                        <span className="ml-1 text-[10px] text-teal-700 dark:text-teal-300">próprio</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!carregando && linhas.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              {itens.length === 0
                ? 'Nenhum imóvel carregado.'
                : 'Nenhum imóvel corresponde aos filtros.'}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
