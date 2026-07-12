import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, HelpCircle, X } from 'lucide-react';
import {
  calcularProximoPassoAcerto,
  ocultarGuia,
} from './acertoGuiaRapido.js';
import { formatMoeda } from '../../shared/financeiroFormat.js';

const ZONAS = [
  {
    id: 'cards',
    titulo: 'Cards (roxos)',
    cor: 'border-indigo-200 bg-indigo-50/80 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-100',
    texto: 'Compensações internas já fechadas (soma zero). Clique para abrir em modal — só consulta, não altera a fila de trabalho.',
  },
  {
    id: 'aberto',
    titulo: 'Período aberto (verde)',
    cor: 'border-emerald-300 bg-emerald-50/80 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100',
    texto: 'Sua fila de trabalho desde o corte manual. Não se «fecha» como card — você confere e compensa proc a proc.',
  },
  {
    id: 'ficha',
    titulo: 'Ficha do Acerto',
    cor: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100',
    texto: 'Fechamento formal (Iniciar → Fechar → PDF). Use só quando a conferência do período aberto estiver coerente.',
  },
];

/**
 * Guia colapsável da tela Acerto do Cliente — próximo passo dinâmico.
 */
export function AcertoGuiaRapido({
  periodosResumo,
  resumoProcessos,
  periodoAtivo,
  onAplicarFiltroSugerido,
  onDispensar,
}) {
  const [expandido, setExpandido] = useState(true);

  const proximo = useMemo(
    () => calcularProximoPassoAcerto({ periodosResumo, resumoProcessos, periodoAtivo }),
    [periodosResumo, resumoProcessos, periodoAtivo],
  );

  const aberto = useMemo(
    () => (periodosResumo?.periodos ?? []).find((p) => p.status === 'ABERTO'),
    [periodosResumo],
  );

  const cardsCount = useMemo(
    () =>
      (periodosResumo?.periodos ?? []).filter(
        (p) => p.status === 'FECHADO_GRUPO' || p.tipoPeriodo === 'CARD',
      ).length,
    [periodosResumo],
  );

  const dispensar = () => {
    ocultarGuia();
    onDispensar?.();
  };

  return (
    <section className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 overflow-hidden print:hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-blue-100 dark:border-blue-900/40">
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"
        >
          {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Como usar esta tela
        </button>
        <button
          type="button"
          onClick={dispensar}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800"
          title="Ocultar guia (pode reabrir pelo botão Guia no topo)"
        >
          <X className="w-3 h-3" /> Dispensar
        </button>
      </div>

      {expandido ? (
        <div className="px-4 py-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {ZONAS.map((z) => (
              <div key={z.id} className={`rounded-lg border px-3 py-2 text-xs ${z.cor}`}>
                <p className="font-semibold">{z.titulo}</p>
                <p className="mt-1 opacity-90 leading-snug">{z.texto}</p>
                {z.id === 'cards' && cardsCount > 0 ? (
                  <p className="mt-1 font-medium">{cardsCount} card(s) neste cliente</p>
                ) : null}
                {z.id === 'aberto' && aberto ? (
                  <p className="mt-1 font-medium tabular-nums">
                    {Number(aberto.qtdLancamentos).toLocaleString('pt-BR')} lanç. · saldo{' '}
                    {formatMoeda(Number(aberto.saldoFinal ?? 0))}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30 px-3 py-2.5">
            <p className="text-xs font-bold text-amber-900 dark:text-amber-100">{proximo.titulo}</p>
            <p className="text-xs text-amber-950/90 dark:text-amber-100/90 mt-1 leading-relaxed">{proximo.texto}</p>
            {proximo.acaoSugerida === 'filtro_nao_conferidos' && onAplicarFiltroSugerido ? (
              <button
                type="button"
                onClick={onAplicarFiltroSugerido}
                className="mt-2 inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700"
              >
                Aplicar filtro e ir à tabela
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">
          <strong>{proximo.titulo}:</strong> {proximo.texto.slice(0, 120)}
          {proximo.texto.length > 120 ? '…' : ''}
        </p>
      )}
    </section>
  );
}
