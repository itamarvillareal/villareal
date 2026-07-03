import { memo, useMemo } from 'react';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import { EtapaDot } from '../shared/EtapaDot.jsx';
import { ValorText } from '../shared/ValorText.jsx';
import { ExtratoSkeleton } from '../shared/LoadingSkeleton.jsx';
import { ETAPAS } from '../constants/financeiroConstants.js';
import { contaCodigoExtratoExibicao } from '../shared/financeiroDescricaoContaF.js';
import { textoObsExtrato } from './extratoMappers.js';
import { temCodigoEProcExtratoRow, temImovelVinculadoExtratoRow } from './extratoCadastroFiltro.js';
import { origemExtratoLabel } from '../total/totalFinanceiroMerge.js';

function rowKeyOf(item, rowKeyField) {
  if (rowKeyField && item?.[rowKeyField]) return item[rowKeyField];
  return item?.id;
}

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
  rowKeyField = null,
  /** Conta Escritório no consolidado: etapa = cod+proc (azul/vermelho) em vez da etapa do workflow. */
  etapaModoEscritorio = false,
  /** Conta Imóveis no consolidado: etapa = imóvel vinculado (azul/vermelho). */
  etapaModoImoveis = false,
  /** Extrato de cartão: coluna extra de vencimento da fatura. */
  modoCartao = false,
  /** Extrato consolidado AUTO-FAT: coluna cartão; data = vencimento (sem coluna venc. duplicada). */
  modoFechamentoFatura = false,
  /** Total (bancos + cartões): coluna origem (banco/cartão). */
  modoTotal = false,
}) {
  const ids = useMemo(
    () => data.map((r) => rowKeyOf(r, rowKeyField)).filter((id) => id != null),
    [data, rowKeyField],
  );
  const allSelected = useMemo(
    () => ids.length > 0 && ids.every((id) => selectedIds.has(id)),
    [ids, selectedIds],
  );
  const someSelected = useMemo(() => ids.some((id) => selectedIds.has(id)), [ids, selectedIds]);

  const mostrarVencFatura = modoCartao && !modoFechamentoFatura;
  const colSpan =
    7 + (mostrarVencFatura ? 1 : 0) + (modoFechamentoFatura ? 1 : 0) + (modoTotal ? 1 : 0);

  if (isLoading) {
    return <ExtratoSkeleton />;
  }

  return (
    <div className="overflow-x-auto min-w-0">
      <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
        <colgroup>
          <col style={{ width: 36 }} />
          <col style={{ width: 48 }} />
          {modoTotal ? <col style={{ width: 96 }} /> : null}
          <col style={{ width: 108 }} />
          {modoFechamentoFatura ? <col style={{ width: 100 }} /> : null}
          {mostrarVencFatura ? <col style={{ width: 72 }} /> : null}
          <col style={{ width: modoCartao ? 240 : 300 }} />
          <col style={{ width: 112 }} />
          <col />
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
            {modoTotal ? (
              <th className="px-2 py-2 text-left whitespace-nowrap">Origem</th>
            ) : null}
            {modoFechamentoFatura ? (
              <th className="px-2 py-2 text-left whitespace-nowrap">Cartão</th>
            ) : null}
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
              {modoFechamentoFatura ? 'Vencimento' : modoCartao ? 'Data compra' : 'Data'}
              <span className="ml-1 text-[10px] opacity-70" aria-hidden>
                {sortDataAsc ? '↑' : '↓'}
              </span>
            </th>
            {mostrarVencFatura ? (
              <th className="px-2 py-2 text-left whitespace-nowrap">Venc. fatura</th>
            ) : null}
            <th className="px-2 py-2 text-left min-w-0">Descrição</th>
            <th className="px-2 py-2 text-right whitespace-nowrap">Valor</th>
            <th className="px-2 py-2 text-left min-w-0">Obs</th>
            <th className="px-1 py-2 text-center whitespace-nowrap">Etapa</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-12 text-center text-slate-500 text-sm">
                Nenhum lançamento neste período/filtro.
              </td>
            </tr>
          ) : (
            data.map((item, idx) => {
              const rowKey = rowKeyOf(item, rowKeyField);
              const selected = selectedIds.has(rowKey);
              const destacado = highlightLancamentoId != null && Number(item.id) === Number(highlightLancamentoId);
              const pendente = item.etapa === ETAPAS.IMPORTADO;
              const fechado = item.etapa === ETAPAS.FECHADO;
              let rowBg = idx % 2 === 1 ? 'var(--fin-row-alt)' : 'transparent';
              if (pendente) rowBg = 'var(--fin-row-pendente)';
              if (selected) rowBg = 'var(--fin-row-selected)';
              if (destacado) rowBg = 'var(--fin-row-selected)';

              return (
                <tr
                  key={rowKey ?? item.id}
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
                      onChange={() => onSelect(rowKey)}
                      aria-label={`Selecionar lançamento ${item.numeroLancamento}`}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-2 py-2 align-middle overflow-hidden">
                    <ContaBadge codigo={contaCodigoExtratoExibicao(item)} />
                  </td>
                  {modoTotal ? (
                    <td
                      className="px-2 py-2 align-middle text-xs text-slate-600 dark:text-slate-400 truncate"
                      title={origemExtratoLabel(item)}
                    >
                      {origemExtratoLabel(item)}
                    </td>
                  ) : null}
                  {modoFechamentoFatura ? (
                    <td className="px-2 py-2 align-middle text-slate-700 dark:text-slate-300 text-xs truncate" title={item.cartaoNome}>
                      {item.cartaoNome || '—'}
                    </td>
                  ) : null}
                  <td className="px-2 py-2 align-middle text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.dataExibicao}
                  </td>
                  {mostrarVencFatura ? (
                    <td className="px-2 py-2 align-middle text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                      {item.vencimentoFaturaExibicao || '—'}
                    </td>
                  ) : null}
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
                    <EtapaDot
                      etapa={item.etapa}
                      cadastroEscritorio={
                        etapaModoEscritorio ? temCodigoEProcExtratoRow(item) : undefined
                      }
                      cadastroImoveis={
                        etapaModoImoveis ? temImovelVinculadoExtratoRow(item) : undefined
                      }
                    />
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
