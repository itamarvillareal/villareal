import { ContaBadge } from '../shared/ContaBadge.jsx';
import { EtapaDot } from '../shared/EtapaDot.jsx';
import { ValorText } from '../shared/ValorText.jsx';
import { ExtratoSkeleton } from '../shared/LoadingSkeleton.jsx';
import { ETAPAS } from '../constants/financeiroConstants.js';
import { textoObsExtrato } from './extratoMappers.js';

export function ExtratoTable({
  data = [],
  selectedIds,
  onSelect,
  onSelectAll,
  onRowClick,
  isLoading,
}) {
  if (isLoading) {
    return <ExtratoSkeleton />;
  }

  const ids = data.map((r) => r.id).filter((id) => id != null);
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
  const someSelected = ids.some((id) => selectedIds.has(id));

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
            <th className="px-2 py-2 text-left whitespace-nowrap">Data</th>
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
              const pendente = item.etapa === ETAPAS.IMPORTADO;
              const fechado = item.etapa === ETAPAS.FECHADO;
              let rowBg = idx % 2 === 1 ? 'var(--fin-row-alt)' : 'transparent';
              if (pendente) rowBg = 'var(--fin-row-pendente)';
              if (selected) rowBg = 'var(--fin-row-selected)';

              return (
                <tr
                  key={item.id}
                  className={`group border-b transition-colors cursor-pointer ${
                    fechado ? 'opacity-70' : ''
                  }`}
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
                    <ContaBadge codigo={item.contaCodigo} />
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
