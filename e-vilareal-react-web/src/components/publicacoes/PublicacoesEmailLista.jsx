import {
  AcoesLinhaCompacta,
  CelulaDataCompacta,
  CelulaStatusCompacta,
  GRID_COLS_PUBLICACOES_EMAIL,
  cnjLinha,
  destaqueLinhaNaoVinculada,
  formatarCnjComProc,
  shellTabelaCompacta,
  truncarTexto,
} from './PublicacoesEmailListaShared.jsx';

function resolverBadgeOrigem(row) {
  const origem = String(row.arquivoOrigem || row.arquivoOrigemNome || 'Email').trim();
  const label = origem.length > 14 ? `${origem.slice(0, 12).trim()}…` : origem || 'Email';
  return {
    label,
    title: origem || 'Email',
    className:
      'bg-violet-100 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100',
  };
}

function LinhaPublicacaoEmail({
  row,
  indiceCnj,
  sugestoesApi,
  carregandoSugestoes,
  destaque,
  teorDaLinha,
  badgeNoDrive,
  onAbrirDetalhe,
  onAbrirProcesso,
  podeAbrirProcesso,
  onVincular,
  onAuto,
  onTratar,
  onIgnorar,
}) {
  const origemBadge = resolverBadgeOrigem(row);
  const cnjProc = formatarCnjComProc(row, indiceCnj, sugestoesApi);
  const teor = truncarTexto(teorDaLinha(row), 160);

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
        title={origemBadge.title}
      >
        <span
          className={`inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold ${origemBadge.className}`}
        >
          {origemBadge.label}
        </span>
      </button>

      <button
        type="button"
        role="cell"
        className="min-w-0 cursor-pointer text-left"
        onClick={onAbrirDetalhe}
        title={`${cnjProc}\n${teorDaLinha(row)}`}
      >
        <div className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 truncate whitespace-nowrap font-mono text-[11px] text-sky-800 dark:text-sky-300">
            {cnjProc}
          </span>
          {badgeNoDrive ? badgeNoDrive(row) : null}
        </div>
        <div className="truncate whitespace-nowrap text-[11px] text-slate-600 dark:text-slate-400">
          {teor}
        </div>
      </button>

      <CelulaStatusCompacta row={row} carregandoSugestoes={carregandoSugestoes} />

      <div role="cell" className="relative min-w-0">
        <AcoesLinhaCompacta
          onAbrirProcesso={onAbrirProcesso}
          podeAbrirProcesso={podeAbrirProcesso}
          onVincular={onVincular}
          onAuto={onAuto}
          onTratar={onTratar}
          onIgnorar={onIgnorar}
          menuAriaLabel="Mais ações da publicação"
        />
      </div>
    </div>
  );
}

export function TabelaPublicacoesEmail({
  rows,
  indiceCnj,
  sugestoesApi,
  carregandoSugestoes,
  ordemDataAsc,
  onToggleOrdemData,
  onAbrirDetalhe,
  acoesProps,
  teorDaLinha,
  badgeNoDrive,
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
      <span>Origem</span>
      <span>Processo / Teor</span>
      <span>Status</span>
      <span className="text-right">Ações</span>
    </div>
  );

  return shellTabelaCompacta({
    ariaLabel: 'Lista de publicações por email',
    cabecalho,
    children: rows.map((row) => {
      const props = acoesProps(row);
      return (
        <LinhaPublicacaoEmail
          key={row.id}
          row={row}
          indiceCnj={indiceCnj}
          sugestoesApi={sugestoesApi}
          carregandoSugestoes={carregandoSugestoes}
          destaque={destaqueLinhaNaoVinculada(row)}
          teorDaLinha={teorDaLinha}
          badgeNoDrive={badgeNoDrive}
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

export { cnjLinha };
