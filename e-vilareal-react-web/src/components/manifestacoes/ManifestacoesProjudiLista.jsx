import {
  formatarPartesLinha,
  tipoMovimentoLinha,
} from '../../data/manifestacoesProjudiDisplay.js';
import {
  AcoesLinhaCompacta,
  CelulaDataCompacta,
  CelulaStatusCompacta,
  CelulaTratadoCompacta,
  GRID_COLS_PUBLICACOES_EMAIL,
  cnjLinha,
  destaqueLinhaNaoVinculada,
  formatarCnjComProc,
  shellTabelaCompacta,
} from '../publicacoes/PublicacoesEmailListaShared.jsx';

function resolverToneTipoMovimento(tipo) {
  const t = String(tipo ?? '').toLowerCase();
  if (t.includes('push')) {
    return {
      label: 'PUSH',
      className:
        'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200',
    };
  }
  if (t.includes('intima')) {
    return {
      label: 'Intimação',
      className:
        'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
    };
  }
  if (t.includes('despacho')) {
    return {
      label: 'Despacho',
      className:
        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    };
  }
  const curto = String(tipo ?? '—').trim();
  const label = curto.length > 14 ? `${curto.slice(0, 12).trim()}…` : curto || '—';
  return {
    label,
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  };
}

function LinhaManifestacaoProjudi({
  row,
  indiceCnj,
  sugestoesApi,
  carregandoSugestoes,
  destaque,
  onAbrirDetalhe,
  onAbrirProcesso,
  podeAbrirProcesso,
  onVincular,
  onAuto,
  onTratar,
  onIgnorar,
}) {
  const tipo = tipoMovimentoLinha(row);
  const tipoBadge = resolverToneTipoMovimento(tipo);
  const cnjProc = formatarCnjComProc(row, indiceCnj, sugestoesApi);
  const partes = formatarPartesLinha(row);

  return (
    <div
      role="row"
      className={`grid ${GRID_COLS_PUBLICACOES_EMAIL} min-h-[52px] items-center gap-x-2 border-b border-slate-100 px-2 py-1 hover:bg-slate-50/80 dark:border-white/10 dark:hover:bg-white/5 ${destaque}`}
    >
      <CelulaDataCompacta row={row} onAbrirDetalhe={onAbrirDetalhe} />

      <button
        type="button"
        role="cell"
        className="min-w-0 cursor-pointer text-left"
        onClick={onAbrirDetalhe}
        title={tipo}
      >
        <span
          className={`inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold ${tipoBadge.className}`}
        >
          {tipoBadge.label}
        </span>
      </button>

      <button
        type="button"
        role="cell"
        className="min-w-0 cursor-pointer text-left"
        onClick={onAbrirDetalhe}
        title={`${cnjProc}\n${partes}`}
      >
        <div className="truncate whitespace-nowrap font-mono text-[11px] text-sky-800 dark:text-sky-300">
          {cnjProc}
        </div>
        <div className="truncate whitespace-nowrap text-[11px] text-slate-600 dark:text-slate-400">
          {partes}
        </div>
      </button>

      <CelulaStatusCompacta row={row} carregandoSugestoes={carregandoSugestoes} />

      <CelulaTratadoCompacta row={row} />

      <div role="cell" className="relative min-w-0">
        <AcoesLinhaCompacta
          onAbrirProcesso={onAbrirProcesso}
          podeAbrirProcesso={podeAbrirProcesso}
          onVincular={onVincular}
          onAuto={onAuto}
          onTratar={onTratar}
          onIgnorar={onIgnorar}
          menuAriaLabel="Mais ações da movimentação"
        />
      </div>
    </div>
  );
}

export function TabelaManifestacoesProjudi({
  rows,
  indiceCnj,
  sugestoesApi,
  carregandoSugestoes,
  ordemDataAsc,
  onToggleOrdemData,
  onAbrirDetalhe,
  acoesProps,
}) {
  const cabecalho = (
    <div
      role="row"
      className={`grid ${GRID_COLS_PUBLICACOES_EMAIL} items-center gap-x-2 border-b border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400`}
    >
      <button
        type="button"
        className="cursor-pointer select-none text-left hover:text-slate-900 dark:hover:text-white"
        onDoubleClick={onToggleOrdemData}
        title="Duplo clique para inverter ordem"
      >
        Data
        <span className="ml-0.5 text-[10px] opacity-70">{ordemDataAsc ? '↑' : '↓'}</span>
      </button>
      <span>Tipo</span>
      <span>Processo / Partes</span>
      <span>Status</span>
      <span>Tratado</span>
      <span className="text-right">Ações</span>
    </div>
  );

  return shellTabelaCompacta({
    ariaLabel: 'Lista de movimentações por email',
    cabecalho,
    children: rows.map((row) => {
      const props = acoesProps(row);
      return (
        <LinhaManifestacaoProjudi
          key={row.id}
          row={row}
          indiceCnj={indiceCnj}
          sugestoesApi={sugestoesApi}
          carregandoSugestoes={carregandoSugestoes}
          destaque={destaqueLinhaNaoVinculada(row)}
          onAbrirDetalhe={() => onAbrirDetalhe(row)}
          onAbrirProcesso={props.onAbrirProcesso}
          podeAbrirProcesso={props.podeAbrirProcesso}
          onVincular={props.onVincular}
          onAuto={props.onAuto}
          onTratar={props.onTratar}
          onIgnorar={props.onIgnorar}
        />
      );
    }),
  });
}

export { AcoesLinhaCompacta, cnjLinha };
