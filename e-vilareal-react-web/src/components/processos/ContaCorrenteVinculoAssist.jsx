import { Link2, Sparkles, X } from 'lucide-react';

function fmtValor(v) {
  const n = Number(v) || 0;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Barra de apoio à vinculação em listas longas: próximo nº, modo 2 cliques, filtro, chips e pares sugeridos.
 */
export function ContaCorrenteVinculoAssist({
  painel,
  modoVincular,
  onToggleModoVincular,
  filtroSemVinculo,
  onToggleFiltroSemVinculo,
  pendenteChave,
  onCancelarPendente,
  onFiltrarNumero,
  onVincularParSugerido,
  onVincularTodosSugeridos,
  salvando,
  qtdSelecionados,
  numeroVinculoInput,
  onNumeroVinculoInputChange,
  onAtribuirSelecionados,
}) {
  const { proximoNumeroVinculo, resumosVinculo, paresSugeridos, qtdSemVinculo } = painel;

  return (
    <div className="border-b border-indigo-100 bg-indigo-50/50 shrink-0 space-y-2 px-2 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-indigo-200 text-sm font-semibold text-indigo-900 tabular-nums">
          Próximo nº: {proximoNumeroVinculo}
        </span>
        <button
          type="button"
          onClick={onToggleModoVincular}
          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors ${
            modoVincular
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-indigo-800 border-indigo-300 hover:bg-indigo-100'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" aria-hidden />
          Modo 2 cliques {modoVincular ? '(ativo)' : ''}
        </button>
        <button
          type="button"
          onClick={onToggleFiltroSemVinculo}
          className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
            filtroSemVinculo
              ? 'bg-amber-100 border-amber-300 text-amber-900'
              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Só sem vínculo ({qtdSemVinculo})
        </button>
        {pendenteChave ? (
          <span className="inline-flex items-center gap-1 text-xs text-indigo-800 bg-indigo-100 px-2 py-1 rounded-md">
            1ª linha marcada — clique na 2ª
            <button type="button" onClick={onCancelarPendente} className="p-0.5 hover:bg-indigo-200 rounded" aria-label="Cancelar">
              <X className="w-3 h-3" />
            </button>
          </span>
        ) : null}
      </div>

      {modoVincular ? (
        <p className="text-[11px] text-indigo-800 leading-snug">
          Clique na entrada, depois no pagamento/repasse: o sistema atribui o próximo número automaticamente. Duplo clique na linha continua abrindo o Financeiro.
        </p>
      ) : null}

      {resumosVinculo.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-slate-500 shrink-0">Vínculos:</span>
          {resumosVinculo.map((r) => (
            <button
              key={r.numero}
              type="button"
              onClick={() => onFiltrarNumero(r.numero)}
              className="px-2 py-0.5 text-[11px] font-mono rounded-full border border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-100"
              title={`${r.qtd} lançamento(s) · soma ${fmtValor(r.soma)}`}
            >
              {r.numero} ({r.qtd}) {fmtValor(r.soma)}
            </button>
          ))}
        </div>
      ) : null}

      {paresSugeridos.length > 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-2 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-emerald-900 inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" aria-hidden />
              Pares sugeridos ({paresSugeridos.length})
            </span>
            <button
              type="button"
              disabled={salvando}
              onClick={onVincularTodosSugeridos}
              className="text-[11px] font-medium text-emerald-800 hover:underline disabled:opacity-50"
            >
              Vincular todos
            </button>
          </div>
          <ul className="space-y-1 max-h-28 overflow-y-auto">
            {paresSugeridos.map((par) => (
              <li key={par.id} className="flex flex-wrap items-center gap-2 text-[11px] text-slate-800">
                <span className="min-w-0 flex-1 truncate" title={par.entrada.descricao}>
                  <span className="text-emerald-700">+{fmtValor(par.entrada.valor)}</span>
                  {' '}
                  <span className="text-red-700">{fmtValor(par.pagamento.valor)}</span>
                  <span className="text-slate-500 ml-1">= {fmtValor(par.somaPar)}</span>
                </span>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => onVincularParSugerido(par)}
                  className="shrink-0 px-2 py-0.5 rounded border border-emerald-400 bg-white text-emerald-800 font-medium hover:bg-emerald-100 disabled:opacity-50"
                >
                  Vincular
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!modoVincular ? (
        <div className="flex flex-wrap items-center gap-2 pt-0.5 border-t border-indigo-100/80">
          <span className="text-[10px] text-slate-500 shrink-0">Seleção múltipla:</span>
          <input
            type="text"
            inputMode="numeric"
            value={numeroVinculoInput}
            onChange={(e) => onNumeroVinculoInputChange(e.target.value.replace(/\D/g, ''))}
            placeholder={proximoNumeroVinculo}
            className="w-14 px-2 py-0.5 text-xs border border-slate-300 rounded bg-white font-mono"
          />
          <button
            type="button"
            disabled={qtdSelecionados < 2 || salvando}
            onClick={onAtribuirSelecionados}
            className="text-[11px] px-2 py-0.5 rounded border border-slate-300 bg-white disabled:opacity-40"
          >
            Atribuir nº ({qtdSelecionados})
          </button>
        </div>
      ) : null}
    </div>
  );
}
