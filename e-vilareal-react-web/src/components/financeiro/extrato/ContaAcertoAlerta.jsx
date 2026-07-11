import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import { obterContaAcertoResumoApi } from '../../../repositories/financeiroRepository.js';
import { formatMoeda } from '../shared/financeiroFormat.js';

/**
 * Alerta de pendências da conta de acerto (CONTA ZERO): enquanto a soma dos lançamentos sem
 * grupo não for 0, mostra o saldo pendente por vínculo (cliente ou pessoa/imóvel).
 */
export function ContaAcertoAlerta({ numeroBanco, refreshKey = 0, onFiltrarVinculo }) {
  const [resumo, setResumo] = useState(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || numeroBanco == null) {
      setResumo(null);
      return undefined;
    }
    const ac = new AbortController();
    obterContaAcertoResumoApi(numeroBanco, { signal: ac.signal })
      .then((r) => setResumo(r ?? null))
      .catch(() => setResumo(null));
    return () => ac.abort();
  }, [numeroBanco, refreshKey]);

  if (!resumo) return null;

  const somaPendente = Number(resumo.somaPendente ?? 0);
  const totalPendentes = Number(resumo.totalPendentes ?? 0);
  const conciliada = totalPendentes === 0 && Math.abs(somaPendente) < 0.005;

  if (conciliada) {
    return (
      <p className="mx-3 mb-1 flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-200 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
        Conta de acerto conciliada — todos os lançamentos compensados em grupos soma zero.
      </p>
    );
  }

  const vinculosPendentes = (resumo.vinculos ?? []).filter(
    (v) => Number(v.pendentes) > 0 || Math.abs(Number(v.saldoPendente ?? 0)) >= 0.005,
  );

  return (
    <div className="mx-3 mb-1 text-xs rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 space-y-1.5">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left text-amber-900 dark:text-amber-200"
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span className="font-medium">
          Conta de acerto com {totalPendentes.toLocaleString('pt-BR')} pendência
          {totalPendentes !== 1 ? 's' : ''} — saldo pendente {formatMoeda(somaPendente)}
        </span>
        {aberto ? (
          <ChevronDown className="w-3.5 h-3.5 ml-auto shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0" aria-hidden />
        )}
      </button>
      {aberto && vinculosPendentes.length > 0 ? (
        <ul className="space-y-1 pl-5">
          {vinculosPendentes.map((v) => {
            const chave = v.clienteId != null ? `cli-${v.clienteId}` : `pes-${v.pessoaRefId}`;
            const rotulo =
              String(v.nome ?? '').trim() ||
              (v.codigoCliente ? `Cliente ${v.codigoCliente}` : `Pessoa ${v.pessoaRefId}`);
            return (
              <li key={chave} className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                {onFiltrarVinculo && v.codigoCliente ? (
                  <button
                    type="button"
                    onClick={() => onFiltrarVinculo(v)}
                    className="hover:underline font-medium truncate max-w-[18rem] text-left"
                    title={`Filtrar extrato por ${rotulo}`}
                  >
                    {rotulo}
                  </button>
                ) : (
                  <span className="font-medium truncate max-w-[18rem]">{rotulo}</span>
                )}
                <span className="tabular-nums">
                  {Number(v.pendentes).toLocaleString('pt-BR')} pend. · {formatMoeda(Number(v.saldoPendente ?? 0))}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
