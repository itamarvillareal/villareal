import { useMemo, useState } from 'react';
import { Calendar, Search } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import { obterSaldoBancoMensalFinanceiro } from '../../../repositories/financeiroRepository.js';
import { formatMoeda } from '../shared/financeiroFormat.js';
import {
  calcularSaldoBancoPorMes,
  diaSemanaAbrev,
  formatarDataBrDeIso,
  labelMesAnoPt,
  mesAtualIso,
  parseMesIso,
} from './financeiroSaldoDiario.js';

function classeValor(v) {
  const n = Number(v) || 0;
  if (n > 0) return 'text-emerald-700 dark:text-emerald-300';
  if (n < 0) return 'text-red-700 dark:text-red-300';
  return 'text-slate-600 dark:text-slate-300';
}

function fmtMovimento(v) {
  const n = Number(v) || 0;
  if (n === 0) return '—';
  return formatMoeda(n);
}

export function VerificacaoSaldoDiario({ bancos = [], extratosPorBanco = {} }) {
  const opcoesBanco = useMemo(
    () => bancos.filter((b) => b.numeroBanco != null && Number.isFinite(Number(b.numeroBanco))),
    [bancos],
  );

  const [numeroBanco, setNumeroBanco] = useState(() => String(opcoesBanco[0]?.numeroBanco ?? ''));
  const [mesRef, setMesRef] = useState(mesAtualIso);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const bancoSelecionado = useMemo(
    () => opcoesBanco.find((b) => String(b.numeroBanco) === String(numeroBanco)),
    [opcoesBanco, numeroBanco],
  );

  const consultar = async () => {
    const nb = Number(numeroBanco);
    const periodo = parseMesIso(mesRef);
    if (!Number.isFinite(nb) || !periodo) {
      setErro('Selecione o banco e o mês.');
      return;
    }
    setErro('');
    setLoading(true);
    setResultado(null);
    try {
      if (featureFlags.useApiFinanceiro) {
        const api = await obterSaldoBancoMensalFinanceiro(nb, periodo.ano, periodo.mes);
        if (!api) throw new Error('Resposta vazia da API.');
        setResultado({
          nomeBanco: bancoSelecionado?.nome ?? `Banco ${nb}`,
          numeroBanco: nb,
          mesRef,
          saldoInicial: Number(api.saldoInicial) || 0,
          dias: (api.dias || []).map((d) => ({
            data: d.data,
            movimento: Number(d.movimento) || 0,
            saldo: Number(d.saldo) || 0,
            lancamentosNoDia: Number(d.lancamentosNoDia) || 0,
          })),
        });
      } else {
        const nome = bancoSelecionado?.nome;
        const lista = nome ? extratosPorBanco[nome] : [];
        const calc = calcularSaldoBancoPorMes(Array.isArray(lista) ? lista : [], periodo.ano, periodo.mes);
        setResultado({
          nomeBanco: nome ?? `Banco ${nb}`,
          numeroBanco: nb,
          mesRef,
          saldoInicial: calc.saldoInicial,
          dias: calc.dias,
        });
      }
    } catch (e) {
      setErro(e?.message || 'Falha ao consultar saldos do mês.');
    } finally {
      setLoading(false);
    }
  };

  const ultimoDia = resultado?.dias?.length ? resultado.dias[resultado.dias.length - 1] : null;
  const diasComMovimento = resultado?.dias?.filter((d) => d.lancamentosNoDia > 0).length ?? 0;

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white/95 shadow-md overflow-hidden ring-1 ring-slate-200/60">
      <CabecalhoVerificacaoSaldo />

      <div className="p-4 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void consultar();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="flex-1 min-w-[180px] text-sm">
            <span className="text-slate-600 dark:text-slate-400">Conta bancária</span>
            <select
              value={numeroBanco}
              onChange={(e) => setNumeroBanco(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
            >
              {opcoesBanco.length === 0 ? (
                <option value="">Nenhum banco disponível</option>
              ) : (
                opcoesBanco.map((b) => (
                  <option key={b.nome} value={String(b.numeroBanco)}>
                    {b.nome}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600 dark:text-slate-400">Mês</span>
            <span className="mt-1 flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
              <input
                type="month"
                value={mesRef}
                onChange={(e) => setMesRef(e.target.value)}
                className="bg-transparent text-sm focus:outline-none"
                required
              />
            </span>
          </label>
          <button
            type="submit"
            disabled={loading || !numeroBanco || !mesRef}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            <Search className="w-4 h-4" aria-hidden />
            {loading ? 'Carregando…' : 'Ver mês'}
          </button>
        </form>

        {erro ? (
          <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">
            {erro}
          </p>
        ) : null}

        {resultado ? (
          <ResultadoSaldoMensal
            resultado={resultado}
            ultimoDia={ultimoDia}
            diasComMovimento={diasComMovimento}
          />
        ) : null}
      </div>
    </section>
  );
}

function CabecalhoVerificacaoSaldo() {
  return (
    <div className="border-b border-slate-100 bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 px-4 py-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-white">Verificação de saldo diário</h2>
      <p className="text-xs text-white/90 mt-0.5 font-medium">
        Saldo ao fim de cada dia do mês (acumulado desde o início do extrato importado).
      </p>
    </div>
  );
}

function ResultadoSaldoMensal({ resultado, ultimoDia, diasComMovimento }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-slate-700 dark:text-slate-200">
        <p>
          <strong>{resultado.nomeBanco}</strong>
          {' · '}
          {labelMesAnoPt(resultado.mesRef)}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Saldo inicial do mês:{' '}
          <span className={`font-semibold tabular-nums ${classeValor(resultado.saldoInicial)}`}>
            {formatMoeda(resultado.saldoInicial)}
          </span>
          {ultimoDia ? (
            <>
              {' '}
              · fim do mês:{' '}
              <span className={`font-semibold tabular-nums ${classeValor(ultimoDia.saldo)}`}>
                {formatMoeda(ultimoDia.saldo)}
              </span>
            </>
          ) : null}
          {' '}
          · {diasComMovimento} dia(s) com lançamento
        </p>
      </div>

      <TabelaSaldoMensal dias={resultado.dias} />

      {!featureFlags.useApiFinanceiro ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Modo local (extratos no navegador). Ative a API financeiro para o histórico completo do servidor.
        </p>
      ) : null}
    </div>
  );
}

function TabelaSaldoMensal({ dias }) {
  if (!dias?.length) {
    return <p className="text-sm text-slate-500 text-center py-6">Nenhum dia no período.</p>;
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[min(70vh,520px)] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          <tr>
            <th className="py-2 px-3 text-left w-12">Dia</th>
            <th className="py-2 px-3 text-left w-14">Sem</th>
            <th className="py-2 px-3 text-left">Data</th>
            <th className="py-2 px-3 text-right w-28">Mov. do dia</th>
            <th className="py-2 px-3 text-right w-32">Saldo fim do dia</th>
            <th className="py-2 px-3 text-right w-16">Lanç.</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((row) => {
            const diaNum = Number(String(row.data).slice(8, 10)) || 0;
            const sem = diaSemanaAbrev(row.data);
            const fimSemana = sem === 'Dom' || sem === 'Sáb';
            const temMov = row.lancamentosNoDia > 0;
            return (
              <tr
                key={row.data}
                className={`border-t border-slate-100 dark:border-slate-800 ${
                  fimSemana ? 'bg-slate-50/80 dark:bg-slate-900/50' : ''
                } ${temMov ? '' : 'text-slate-500 dark:text-slate-400'}`}
              >
                <td className="py-1.5 px-3 tabular-nums font-medium">{diaNum}</td>
                <td className="py-1.5 px-3 text-xs">{sem}</td>
                <td className="py-1.5 px-3">{formatarDataBrDeIso(row.data)}</td>
                <td className={`py-1.5 px-3 text-right tabular-nums ${classeValor(row.movimento)}`}>
                  {fmtMovimento(row.movimento)}
                </td>
                <td className={`py-1.5 px-3 text-right tabular-nums font-semibold ${classeValor(row.saldo)}`}>
                  {formatMoeda(row.saldo)}
                </td>
                <td className="py-1.5 px-3 text-right tabular-nums text-slate-500">
                  {row.lancamentosNoDia > 0 ? row.lancamentosNoDia : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
