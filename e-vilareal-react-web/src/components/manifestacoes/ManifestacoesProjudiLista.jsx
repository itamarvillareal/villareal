import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Check,
  CircleOff,
  Link2,
  Loader2,
  MoreVertical,
  RotateCcw,
} from 'lucide-react';
import {
  formatarPartesLinha,
  tipoMovimentoLinha,
} from '../../data/manifestacoesProjudiDisplay.js';
import { resolverSugestaoVinculoLinha } from '../../data/publicacoesVinculoProcessos.js';

const GRID_COLS = 'grid-cols-[84px_96px_minmax(0,1fr)_96px_92px]';

const TOOLTIP_ACOES = {
  abrirProcesso: 'Abrir o cadastro do processo vinculado ou sugerido.',
  vincular: 'Associar esta movimentação a um processo do cadastro (escolher cliente e nº interno).',
  auto: 'Vincular automaticamente pelo CNJ ao processo já cadastrado no sistema.',
  tratar: 'Marcar como tratada — movimentação revisada e concluída na sua fila.',
  ignorar: 'Marcar como ignorada — sem providência (aviso duplicado, irrelevante, etc.).',
};

function fmtDataBr(isoDate) {
  if (!isoDate) return '—';
  const s = String(isoDate);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
}

function fmtRecebidoCurto(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `recebido ${dd}/${mm}`;
  } catch {
    return null;
  }
}

function cnjLinha(row) {
  return row.numeroProcessoEncontrado || row.numero_processo_cnj || row.processoCnjNormalizado || '—';
}

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

function formatarCnjComProc(row, indiceCnj, sugestoesApi) {
  const cnj = cnjLinha(row);
  const sug = resolverSugestaoVinculoLinha(row, indiceCnj, sugestoesApi);
  const proc = row?.procInterno ?? sug?.procInterno;
  if (cnj === '—') return '—';
  if (proc != null && String(proc).trim() !== '') return `${cnj} · nº ${proc}`;
  return cnj;
}

function BadgeStatusVinculo({ row }) {
  const vinculado = row?.statusVinculo === 'vinculado';
  const cls = vinculado
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
    : 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  return (
    <span className={`inline-flex max-w-full truncate rounded px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {vinculado ? 'Vinculado' : 'Pendente'}
    </span>
  );
}

function MenuAcoesManifestacao({
  aberto,
  onFechar,
  menuId,
  onVincular,
  onAuto,
  onTratar,
  onIgnorar,
  anchorRef,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const onDocMouseDown = (e) => {
      if (menuRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onFechar();
    };
    const onDocKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onFechar();
        anchorRef.current?.focus();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
      const items = menuRef.current?.querySelectorAll('[role="menuitem"]');
      if (!items?.length) return;
      e.preventDefault();
      const list = Array.from(items);
      const idx = list.indexOf(document.activeElement);
      if (e.key === 'Home') {
        list[0]?.focus();
        return;
      }
      if (e.key === 'End') {
        list[list.length - 1]?.focus();
        return;
      }
      const next =
        e.key === 'ArrowDown'
          ? list[(idx < 0 ? 0 : idx + 1) % list.length]
          : list[(idx <= 0 ? list.length : idx) - 1];
      next?.focus();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKeyDown);
    const t = requestAnimationFrame(() => {
      menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    });
    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKeyDown);
    };
  }, [aberto, onFechar, anchorRef]);

  if (!aberto) return null;

  const itemClass =
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:text-slate-200 dark:hover:bg-white/10 dark:focus:bg-white/10';

  const run = (fn) => () => {
    fn?.();
    onFechar();
  };

  return (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-orientation="vertical"
      className="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#141922]"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vínculo</p>
      <button type="button" role="menuitem" className={itemClass} onClick={run(onVincular)}>
        <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        Vincular manualmente
      </button>
      <button type="button" role="menuitem" className={itemClass} onClick={run(onAuto)}>
        <RotateCcw className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        Vincular automático
      </button>
      <p className="mt-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Triagem</p>
      <button type="button" role="menuitem" className={itemClass} onClick={run(onTratar)}>
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
        Tratar / concluir
      </button>
      <button type="button" role="menuitem" className={itemClass} onClick={run(onIgnorar)}>
        <CircleOff className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        Ignorar
      </button>
    </div>
  );
}

function AcoesLinhaCompacta({
  onAbrirProcesso,
  podeAbrirProcesso = false,
  onVincular,
  onAuto,
  onTratar,
  onIgnorar,
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const menuBtnRef = useRef(null);
  const menuId = useId();

  const fecharMenu = useCallback(() => setMenuAberto(false), []);

  return (
    <div className="relative flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {onAbrirProcesso ? (
        <button
          type="button"
          title={TOOLTIP_ACOES.abrirProcesso}
          onClick={onAbrirProcesso}
          disabled={!podeAbrirProcesso}
          className="inline-flex h-7 items-center rounded-md bg-sky-600 px-2 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/10 dark:disabled:text-slate-500"
        >
          Abrir
        </button>
      ) : null}
      <button
        ref={menuBtnRef}
        type="button"
        aria-label="Mais ações da movimentação"
        aria-haspopup="menu"
        aria-expanded={menuAberto}
        aria-controls={menuAberto ? menuId : undefined}
        title="Mais ações"
        onClick={() => setMenuAberto((v) => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      <MenuAcoesManifestacao
        aberto={menuAberto}
        onFechar={fecharMenu}
        menuId={menuId}
        anchorRef={menuBtnRef}
        onVincular={onVincular}
        onAuto={onAuto}
        onTratar={onTratar}
        onIgnorar={onIgnorar}
      />
    </div>
  );
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
  const recebido = fmtRecebidoCurto(row.emailRecebidoEm);
  const cnjProc = formatarCnjComProc(row, indiceCnj, sugestoesApi);
  const partes = formatarPartesLinha(row);

  return (
    <div
      role="row"
      className={`grid ${GRID_COLS} min-h-[52px] items-center gap-x-2 border-b border-slate-100 px-2 py-1 hover:bg-slate-50/80 dark:border-white/10 dark:hover:bg-white/5 ${destaque}`}
    >
      <button
        type="button"
        role="cell"
        className="min-w-0 cursor-pointer text-left"
        onClick={onAbrirDetalhe}
        title="Ver detalhes"
      >
        <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
          {fmtDataBr(row.dataPublicacao)}
        </div>
        {recebido ? (
          <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">{recebido}</div>
        ) : (
          <div className="text-[10px] text-slate-400">—</div>
        )}
      </button>

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

      <div role="cell" className="min-w-0">
        {carregandoSugestoes && row.statusVinculo !== 'vinculado' ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            …
          </span>
        ) : (
          <BadgeStatusVinculo row={row} />
        )}
      </div>

      <div role="cell" className="relative min-w-0">
        <AcoesLinhaCompacta
          onAbrirProcesso={onAbrirProcesso}
          podeAbrirProcesso={podeAbrirProcesso}
          onVincular={onVincular}
          onAuto={onAuto}
          onTratar={onTratar}
          onIgnorar={onIgnorar}
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
  return (
    <div
      className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#141922] md:block"
      role="table"
      aria-label="Lista de movimentações por email"
    >
      <div
        role="row"
        className={`grid ${GRID_COLS} items-center gap-x-2 border-b border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400`}
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
        <span className="text-right">Ações</span>
      </div>
      <div role="rowgroup">
        {rows.map((row) => {
          const destaque =
            row.statusVinculo === 'nao_vinculado' || row.statusVinculo === 'sem_cnj'
              ? 'border-l-2 border-l-amber-400/80'
              : '';
          const props = acoesProps(row);
          return (
            <LinhaManifestacaoProjudi
              key={row.id}
              row={row}
              indiceCnj={indiceCnj}
              sugestoesApi={sugestoesApi}
              carregandoSugestoes={carregandoSugestoes}
              destaque={destaque}
              onAbrirDetalhe={() => onAbrirDetalhe(row)}
              onAbrirProcesso={props.onAbrirProcesso}
              podeAbrirProcesso={props.podeAbrirProcesso}
              onVincular={props.onVincular}
              onAuto={props.onAuto}
              onTratar={props.onTratar}
              onIgnorar={props.onIgnorar}
            />
          );
        })}
      </div>
    </div>
  );
}

export { AcoesLinhaCompacta, fmtDataBr, cnjLinha };
