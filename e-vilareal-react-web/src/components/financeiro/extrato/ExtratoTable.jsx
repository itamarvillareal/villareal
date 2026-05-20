import { memo, useMemo } from 'react';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import { EtapaDot } from '../shared/EtapaDot.jsx';
import { ValorText } from '../shared/ValorText.jsx';
import { ExtratoSkeleton } from '../shared/LoadingSkeleton.jsx';
import { ETAPAS } from '../constants/financeiroConstants.js';
import { contaCodigoExtratoExibicao } from '../shared/financeiroDescricaoContaF.js';
import { textoObsExtrato } from './extratoMappers.js';

function ExtratoTableInner({
  data = [],
  selectedIds,
  onSelect,
  onSelectAll,
  onRowClick,
  isLoading,
  sortDataAsc = false,
  onSortDataDoubleClick,
  highlightLancamentoId = null,
}) {
  if (isLoading) {
    return <ExtratoSkeleton />;
  }

  const ids = useMemo(() => data.map((r) => r.id).filter((id) => id != null), [data]);
  const allSelected = useMemo(
    () => ids.length > 0 && ids.every((id) => selectedIds.has(id)),
    [ids, selectedIds],
  );
  const someSelected = useMemo(() => ids.some((id) => selectedIds.has(id)), [ids, selectedIds]);

  return (
    <div className="overflow-x-auto min-w-0">
      <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
        <colgroup>
          <col style={{ width: 36 }} />
          <col style={{ width: 48 }} />
          <col style={{ width: 108 }} />
          <col />
          <col style={{ width: 116 }} />
          <col style={{ width: 176 }} />
          <col style={{ width: 44 }} />
        </colgroup>
        <thead>
          <tr
            className="text-xs font-medium text-slate-500 dark:text-slate-400"
            style={{ background: 'var(--fin-header-bg)' }}
          >
            <th className="px-1 py-2 text-center">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={onSelectAll}
                aria-label="Selecionar todos"
                className="rounded border-slate-300"
              />
            </th>
            <th className="px-2 py-2 text-left whitespace-nowrap">Conta</th>
            <th
              className="px-2 py-2 text-left whitespace-nowrap cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200"
              onDoubleClick={(e) => {
                e.preventDefault();
                onSortDataDoubleClick?.();
              }}
              title={
                sortDataAsc
                  ? 'Duplo clique: ordenar do mais novo para o mais antigo'
                  : 'Duplo clique: ordenar do mais antigo para o mais novo'
              }
            >
              Data
              <span className="ml-1 text-[10px] opacity-70" aria-hidden>
                {sortDataAsc ? '↑' : '↓'}
              </span>
            </th>
            <th className="px-2 py-2 text-left min-w-0">Descrição</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Valor</th>
            <th className="px-2 py-2 text-left min-w-0">Obs</th>
            <th className="px-1 py-2 text-center whitespace-nowrap">Etapa</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-slate-500 text-sm">
                Nenhum lançamento neste período/filtro.
              </td>
            </tr>
          ) : (
            data.map((item, idx) => {
              const selected = selectedIds.has(item.id);
              const destacado = highlightLancamentoId != null && Number(item.id) === Number(highlightLancamentoId);
              const pendente = item.etapa === ETAPAS.IMPORTADO;
              const fechado = item.etapa === ETAPAS.FECHADO;
              let rowBg = idx % 2 === 1 ? 'var(--fin-row-alt)' : 'transparent';
              if (pendente) rowBg = 'var(--fin-row-pendente)';
              if (selected) rowBg = 'var(--fin-row-selected)';
              if (destacado) rowBg = 'var(--fin-row-selected)';

              return (
                <tr
                  key={item.id}
                  data-lancamento-id={item.id}
                  className={`group border-b transition-colors cursor-pointer ${
                    fechado ? 'opacity-70' : ''
                  } ${destacado ? 'ring-2 ring-inset ring-indigo-500/70' : ''}`}
                  style={{
                    borderColor: 'var(--vl-border, #e2e8f0)',
                    background: rowBg,
                  }}
                  onMouseEnter={(e) => {
                    if (!selected && !pendente) {
                      e.currentTarget.style.background = 'var(--fin-row-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = rowBg;
                  }}
                  onClick={() => onRowClick(item)}
                >
                  <td className="px-1 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onSelect(item.id)}
                      aria-label={`Selecionar lançamento ${item.numeroLancamento}`}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-2 py-2 align-middle overflow-hidden">
                    <ContaBadge codigo={contaCodigoExtratoExibicao(item)} />
                  </td>
                  <td className="px-2 py-2 align-middle text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.dataExibicao}
                  </td>
                  <td className="px-2 py-2 align-middle overflow-hidden">
                    <div className="truncate text-slate-900 dark:text-slate-100" title={item.descricao}>
                      {item.descricao}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-middle text-right whitespace-nowrap overflow-hidden">
                    <ValorText valor={item.valor} natureza={item.natureza} />
                  </td>
                  <td className="px-2 py-2 align-middle overflow-hidden">
                    <div
                      className="truncate text-xs text-slate-600 dark:text-slate-400"
                      title={textoObsExtrato(item)}
                    >
                      {textoObsExtrato(item)}
                    </div>
                  </td>
                  <td className="px-1 py-2 align-middle text-center overflow-hidden">
                    <EtapaDot etapa={item.etapa} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export const ExtratoTable = memo(ExtratoTableInner);
